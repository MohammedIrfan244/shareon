import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import mongoose from 'mongoose';

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const folderIdParam = searchParams.get('folderId');
    const query = searchParams.get('q')?.trim();

    const filter: Record<string, unknown> = {
      uploadStatus: { $ne: 'PENDING' },
    };

    if (query) {
      filter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { originalName: { $regex: query, $options: 'i' } },
      ];
    } else {
      const folderId =
        !folderIdParam || folderIdParam === 'root' || folderIdParam === 'null'
          ? null
          : new mongoose.Types.ObjectId(folderIdParam);
      filter.folderId = folderId;
    }

    const files = await FileItem.find(filter)
      .sort({ createdAt: -1 })
      .select('-passwordHash')
      .lean();

    const sanitizedFiles = files.map((file) => {
      const isMongo = file.storageProvider === 'MONGODB' || (file as { storageType?: string }).storageType === 'mongodb_text';
      const provider = isMongo ? 'MONGODB' : 'GDRIVE';

      if (file.isProtected) {
        return {
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
        };
      }

      return {
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
      };
    });

    return NextResponse.json({ files: sanitizedFiles });
  } catch (error: unknown) {
    console.error('Fetch files error:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}
