import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import cloudinary from '@/lib/cloudinary';
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
          storageType: file.storageType,
          isProtected: true,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        },
      });
    }

    return NextResponse.json({ file });
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

    if (file.storageType === 'cloudinary' && file.cloudinary?.publicId) {
      try {
        await cloudinary.uploader.destroy(file.cloudinary.publicId, {
          resource_type: (file.cloudinary.resourceType as 'image' | 'video' | 'raw') || 'image',
        });
      } catch (cloudErr) {
        console.error('Cloudinary asset deletion error:', cloudErr);
      }
    }

    await FileItem.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'File deleted successfully' });
  } catch (error: unknown) {
    console.error('Delete file error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
