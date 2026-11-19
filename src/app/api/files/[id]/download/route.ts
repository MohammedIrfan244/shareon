import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

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

    // Verify protection
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

    // If text file stored in MongoDB
    if (file.storageType === 'mongodb_text') {
      const content = file.textContent || '';
      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': file.mimeType || 'text/plain; charset=utf-8',
          'Content-Disposition': contentDisposition,
        },
      });
    }

    // If Cloudinary file: Fetch and stream directly so browser is forced to download as attachment
    if (file.cloudinary?.secureUrl) {
      const upstreamResponse = await fetch(file.cloudinary.secureUrl);

      if (!upstreamResponse.ok || !upstreamResponse.body) {
        // Fallback: If streaming fails, use Cloudinary fl_attachment redirect
        const secureUrl = file.cloudinary.secureUrl;
        const attachmentUrl = secureUrl.includes('/upload/')
          ? secureUrl.replace('/upload/', `/upload/fl_attachment:${encodedFilename}/`)
          : secureUrl;
        return NextResponse.redirect(attachmentUrl);
      }

      return new Response(upstreamResponse.body, {
        status: 200,
        headers: {
          'Content-Type': file.mimeType || 'application/octet-stream',
          'Content-Disposition': contentDisposition,
          ...(file.size ? { 'Content-Length': file.size.toString() } : {}),
        },
      });
    }

    return NextResponse.json({ error: 'File source not found' }, { status: 404 });
  } catch (error: unknown) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Failed to process download' }, { status: 500 });
  }
}
