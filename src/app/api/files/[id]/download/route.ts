import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import { getDriveAccessToken } from '@/lib/google-drive';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// POST /api/files/[id]/download -> issues Drive download URL + token (zero RAM streaming) or text
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { password } = body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const file = await FileItem.findById(id);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.isProtected) {
      if (!password || typeof password !== 'string') {
        return NextResponse.json({ error: 'Password required to download this file' }, { status: 403 });
      }
      if (!file.passwordHash) {
        return NextResponse.json({ error: 'Corrupted protection hash' }, { status: 500 });
      }
      const match = await bcrypt.compare(password, file.passwordHash);
      if (!match) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
      }
    }

    const isMongo = file.storageProvider === 'MONGODB' || (file as { storageType?: string }).storageType === 'mongodb_text';

    if (isMongo) {
      return NextResponse.json({
        storageProvider: 'MONGODB',
        fileName: file.originalName,
        mimeType: file.mimeType || 'text/plain',
        textContent: file.textContent || '',
        size: file.size,
      });
    }

    // Google Drive
    if (!file.driveFileId) {
      return NextResponse.json({ error: 'Google Drive file ID not found' }, { status: 404 });
    }

    const accessToken = await getDriveAccessToken();
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.driveFileId}?alt=media`;

    return NextResponse.json({
      storageProvider: 'GDRIVE',
      downloadUrl,
      accessToken,
      fileName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    });
  } catch (error: unknown) {
    console.error('Download init error:', error);
    const message = error instanceof Error ? error.message : 'Failed to prepare download';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/files/[id]/download -> for direct GET downloads of MongoDB text files
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('p');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const file = await FileItem.findById(id);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.isProtected) {
      if (!password) {
        return NextResponse.json({ error: 'Password required to download this file' }, { status: 403 });
      }
      if (!file.passwordHash) {
        return NextResponse.json({ error: 'Corrupted protection hash' }, { status: 500 });
      }
      const match = await bcrypt.compare(password, file.passwordHash);
      if (!match) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
      }
    }

    const encodedFilename = encodeURIComponent(file.originalName);
    const contentDisposition = `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`;

    const isMongo = file.storageProvider === 'MONGODB' || (file as { storageType?: string }).storageType === 'mongodb_text';

    if (isMongo) {
      return new Response(file.textContent || '', {
        status: 200,
        headers: {
          'Content-Type': file.mimeType || 'text/plain; charset=utf-8',
          'Content-Disposition': contentDisposition,
        },
      });
    }

    // For Drive files, redirect or return instructions
    return NextResponse.json({
      error: 'Direct GET not supported for large Drive files. Use client streaming downloader.',
    }, { status: 400 });
  } catch (error: unknown) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Failed to process download' }, { status: 500 });
  }
}
