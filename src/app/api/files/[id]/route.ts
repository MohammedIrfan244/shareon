import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import { deleteDriveFile } from '@/lib/google-drive';
import mongoose from 'mongoose';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const file = await FileItem.findById(id).select('-passwordHash').lean();
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const isMongo = file.storageProvider === 'MONGODB' || (file as { storageType?: string }).storageType === 'mongodb_text';
    const provider = isMongo ? 'MONGODB' : 'GDRIVE';

    if (file.isProtected) {
      return NextResponse.json({
        file: {
          _id: file._id,
          title: file.title,
          originalName: file.originalName,
          mimeType: file.mimeType,
          extension: file.extension,
          size: file.size,
          folderId: file.folderId,
          storageProvider: provider,
          isProtected: true,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        },
      });
    }

    return NextResponse.json({
      file: {
        _id: file._id,
        title: file.title,
        originalName: file.originalName,
        mimeType: file.mimeType,
        extension: file.extension,
        size: file.size,
        folderId: file.folderId,
        storageProvider: provider,
        driveFileId: file.driveFileId,
        textContent: file.textContent,
        isProtected: false,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error('Get file error:', error);
    return NextResponse.json({ error: 'Failed to retrieve file' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const file = await FileItem.findById(id);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Permanent delete from Google Drive
    if (file.driveFileId) {
      await deleteDriveFile(file.driveFileId);
    }

    await FileItem.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'File deleted successfully' });
  } catch (error: unknown) {
    console.error('Delete file error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
