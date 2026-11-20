import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import { getDriveStorageQuota, initiateResumableUpload } from '@/lib/google-drive';
import { isTextFile, getFileExtension } from '@/lib/file-utils';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_MONGODB_TEXT_SIZE = 512 * 1024; // 512 KB
const DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const {
      fileName,
      fileSize,
      mimeType,
      folderId: rawFolderId,
      title: rawTitle,
      isProtected,
      password,
    } = body;

    if (!fileName || typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json({ error: 'Valid fileName and fileSize are required' }, { status: 400 });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds maximum allowed size of 5 GB' }, { status: 400 });
    }

    const title = rawTitle && typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : fileName;
    const extension = getFileExtension(fileName);
    const resolvedMime = mimeType || 'application/octet-stream';

    const folderId =
      !rawFolderId || rawFolderId === 'root' || rawFolderId === 'null'
        ? null
        : new mongoose.Types.ObjectId(rawFolderId);

    // If small text file, direct to MongoDB text upload
    if (fileSize <= MAX_MONGODB_TEXT_SIZE && isTextFile(fileName, resolvedMime)) {
      return NextResponse.json({ mode: 'MONGODB' });
    }

    // Check Drive quota
    const quota = await getDriveStorageQuota();
    if (fileSize > quota.remaining) {
      return NextResponse.json(
        { error: `Insufficient storage space. Remaining: ${(quota.remaining / (1024 * 1024)).toFixed(1)} MB` },
        { status: 400 }
      );
    }

    // Password hashing if protected
    let passwordHash: string | null = null;
    if (isProtected) {
      if (!password || typeof password !== 'string' || !password.trim()) {
        return NextResponse.json({ error: 'Password is required for protected files' }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(password.trim(), 12);
    }

    // Determine client origin for CORS in Google Drive resumable upload
    const originHeader = request.headers.get('origin');
    const hostHeader = request.headers.get('host');
    const protoHeader = request.headers.get('x-forwarded-proto') || 'http';
    const origin = originHeader || (hostHeader ? `${protoHeader}://${hostHeader}` : 'http://localhost:3000');

    // Create PENDING file record in MongoDB
    const pendingDoc = await FileItem.create({
      title,
      originalName: fileName,
      mimeType: resolvedMime,
      extension,
      size: fileSize,
      folderId,
      storageProvider: 'GDRIVE',
      driveFileId: null,
      uploadStatus: 'PENDING',
      isProtected: Boolean(isProtected),
      passwordHash,
    });

    const uploadSessionUrl = await initiateResumableUpload({
      fileName,
      mimeType: resolvedMime,
      fileSize,
      origin,
    });

    return NextResponse.json({
      mode: 'GDRIVE',
      fileRecordId: pendingDoc._id.toString(),
      uploadSessionUrl,
      chunkSize: DEFAULT_CHUNK_SIZE,
    });
  } catch (error: unknown) {
    console.error('Upload init error:', error);
    const message = error instanceof Error ? error.message : 'Failed to initialize upload';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
