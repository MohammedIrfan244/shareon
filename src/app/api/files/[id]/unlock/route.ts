import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import { getDriveAccessToken } from '@/lib/google-drive';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { password } = body;

    const file = await FileItem.findById(id);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.isProtected) {
      if (!password || typeof password !== 'string') {
        return NextResponse.json({ error: 'Password is required' }, { status: 400 });
      }

      if (!file.passwordHash) {
        return NextResponse.json({ error: 'Corrupted protection hash' }, { status: 500 });
      }

      const matches = await bcrypt.compare(password, file.passwordHash);
      if (!matches) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
      }
    }

    const isMongo = file.storageProvider === 'MONGODB' || (file as { storageType?: string }).storageType === 'mongodb_text';

    if (isMongo) {
      return NextResponse.json({
        success: true,
        storageProvider: 'MONGODB',
        textContent: file.textContent,
        fileName: file.originalName,
      });
    }

    // Google Drive
    if (!file.driveFileId) {
      return NextResponse.json({ error: 'Google Drive file ID not found' }, { status: 404 });
    }

    const accessToken = await getDriveAccessToken();
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.driveFileId}?alt=media`;

    return NextResponse.json({
      success: true,
      storageProvider: 'GDRIVE',
      downloadUrl,
      accessToken,
      fileName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    });
  } catch (error: unknown) {
    console.error('Unlock error:', error);
    return NextResponse.json({ error: 'Failed to verify password' }, { status: 500 });
  }
}
