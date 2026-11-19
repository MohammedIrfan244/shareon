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

    const filter: Record<string, unknown> = {};

    if (query) {
      // Global search across files if search query is provided
      filter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { originalName: { $regex: query, $options: 'i' } },
      ];
    } else {
      // Directory-based filtering
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

    // Security sanitization: For protected files, NEVER leak secureUrl, publicId, or textContent in listing
    const sanitizedFiles = files.map((file) => {
      if (file.isProtected) {
        return {
          _id: file._id,
          title: file.title,
          originalName: file.originalName,
          mimeType: file.mimeType,
          extension: file.extension,
          size: file.size,
          folderId: file.folderId,
          storageType: file.storageType,
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
        storageType: file.storageType,
        cloudinary: file.cloudinary,
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
