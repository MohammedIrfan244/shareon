import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import { verifyDriveFile } from '@/lib/google-drive';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { fileRecordId, driveFileId } = body;

    if (!fileRecordId || !driveFileId) {
      return NextResponse.json({ error: 'fileRecordId and driveFileId are required' }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(fileRecordId)) {
      return NextResponse.json({ error: 'Invalid fileRecordId' }, { status: 400 });
    }

    const fileDoc = await FileItem.findById(fileRecordId);
    if (!fileDoc) {
      return NextResponse.json({ error: 'Pending file record not found' }, { status: 404 });
    }

    // Verify file exists on Google Drive
    const verified = await verifyDriveFile(driveFileId);

    fileDoc.driveFileId = driveFileId;
    fileDoc.uploadStatus = 'COMPLETED';
    fileDoc.storageProvider = 'GDRIVE';
    if (verified.size > 0) {
      fileDoc.size = verified.size;
    }
    await fileDoc.save();

    return NextResponse.json({
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
    });
  } catch (error: unknown) {
    console.error('Upload complete error:', error);
    const message = error instanceof Error ? error.message : 'Failed to finalize upload';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
