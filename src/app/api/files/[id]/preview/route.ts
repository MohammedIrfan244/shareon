import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import { getDriveAccessToken } from '@/lib/google-drive';
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

    if (file.isProtected) {
      if (!password) {
        return NextResponse.json({ error: 'Password required' }, { status: 403 });
      }
      if (!file.passwordHash) {
        return NextResponse.json({ error: 'Corrupted protection hash' }, { status: 500 });
      }
      const match = await bcrypt.compare(password, file.passwordHash);
      if (!match) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
      }
    }

    // If MongoDB text file
    if (file.storageProvider === 'MONGODB') {
      return new Response(file.textContent || '', {
        status: 200,
        headers: {
          'Content-Type': file.mimeType || 'text/plain; charset=utf-8',
          'Content-Disposition': 'inline',
        },
      });
    }

    // Google Drive file
    if (!file.driveFileId) {
      return NextResponse.json({ error: 'Drive file ID missing' }, { status: 404 });
    }

    const accessToken = await getDriveAccessToken();
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${file.driveFileId}?alt=media`;

    // Forward range header for video/audio seeking
    const rangeHeader = request.headers.get('range');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const driveRes = await fetch(driveUrl, { headers });

    if (!driveRes.ok || !driveRes.body) {
      return NextResponse.json({ error: 'Failed to fetch media from Google Drive' }, { status: driveRes.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', file.mimeType || driveRes.headers.get('content-type') || 'application/octet-stream');
    responseHeaders.set('Content-Disposition', 'inline');

    const contentRange = driveRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }
    const contentLength = driveRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }
    const acceptRanges = driveRes.headers.get('accept-ranges');
    if (acceptRanges) {
      responseHeaders.set('Accept-Ranges', acceptRanges);
    }

    return new Response(driveRes.body, {
      status: driveRes.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Failed to stream preview' }, { status: 500 });
  }
}
