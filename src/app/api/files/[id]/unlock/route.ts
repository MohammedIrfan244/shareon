import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
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

    const body = await request.json();
    const { password } = body;

    const file = await FileItem.findById(id);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (!file.isProtected) {
      return NextResponse.json({
        success: true,
        storageType: file.storageType,
        url: file.cloudinary?.secureUrl,
        textContent: file.textContent,
      });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (!file.passwordHash) {
      return NextResponse.json({ error: 'File corrupted: missing protection hash' }, { status: 500 });
    }

    const matches = await bcrypt.compare(password, file.passwordHash);

    if (!matches) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      storageType: file.storageType,
      url: file.cloudinary?.secureUrl,
      textContent: file.textContent,
    });
  } catch (error: unknown) {
    console.error('Unlock error:', error);
    return NextResponse.json({ error: 'Failed to verify password' }, { status: 500 });
  }
}
