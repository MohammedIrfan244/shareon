import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import { isTextFile, getFileExtension } from '@/lib/file-utils';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    await connectDB();
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const titleInput = formData.get('title') as string | null;
    const folderIdInput = formData.get('folderId') as string | null;
    const isProtectedInput = formData.get('isProtected') as string | null;
    const passwordInput = formData.get('password') as string | null;

    const originalName = file.name || 'untitled';
    const title = titleInput?.trim() ? titleInput.trim() : originalName;
    const mimeType = file.type || 'application/octet-stream';
    const extension = getFileExtension(originalName);
    const size = file.size;

    const folderId =
      !folderIdInput || folderIdInput === 'root' || folderIdInput === 'null'
        ? null
        : new mongoose.Types.ObjectId(folderIdInput);

    const isProtected = isProtectedInput === 'true';
    let passwordHash: string | null = null;

    if (isProtected) {
      if (!passwordInput || passwordInput.trim().length === 0) {
        return NextResponse.json(
          { error: 'A password is required for protected files' },
          { status: 400 }
        );
      }
      passwordHash = await bcrypt.hash(passwordInput.trim(), 12);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save text files directly to MongoDB
    if (isTextFile(originalName, mimeType) && size <= 512 * 1024) {
      const textContent = buffer.toString('utf-8');

      const fileDoc = await FileItem.create({
        title,
        originalName,
        mimeType,
        extension,
        size,
        folderId,
        storageProvider: 'MONGODB',
        uploadStatus: 'COMPLETED',
        textContent,
        isProtected,
        passwordHash,
      });

      return NextResponse.json(
        {
          success: true,
          file: {
            _id: fileDoc._id,
            title: fileDoc.title,
            originalName: fileDoc.originalName,
            mimeType: fileDoc.mimeType,
            extension: fileDoc.extension,
            size: fileDoc.size,
            folderId: fileDoc.folderId,
            storageProvider: fileDoc.storageProvider,
            isProtected: fileDoc.isProtected,
            createdAt: fileDoc.createdAt,
          },
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { error: 'Direct multipart upload is only supported for text files <= 512KB. Use /api/files/upload/init for Google Drive direct upload.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
