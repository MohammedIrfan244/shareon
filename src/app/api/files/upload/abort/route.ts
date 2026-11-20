import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { fileRecordId, uploadSessionUrl } = body;

    if (uploadSessionUrl && typeof uploadSessionUrl === 'string') {
      try {
        // Cancel resumable session with Google Drive
        await fetch(uploadSessionUrl, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to cancel Google Drive resumable session:', err);
      }
    }

    if (fileRecordId && mongoose.Types.ObjectId.isValid(fileRecordId)) {
      await FileItem.findByIdAndDelete(fileRecordId);
    }

    return NextResponse.json({ success: true, message: 'Upload aborted' });
  } catch (error: unknown) {
    console.error('Upload abort error:', error);
    return NextResponse.json({ error: 'Failed to abort upload' }, { status: 500 });
  }
}
