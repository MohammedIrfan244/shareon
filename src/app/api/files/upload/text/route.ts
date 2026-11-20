import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FileItem from '@/models/FileItem';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const MIME_BY_EXT: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  js: 'text/javascript',
  ts: 'text/typescript',
  py: 'text/x-python',
  html: 'text/html',
  css: 'text/css',
  sql: 'text/x-sql',
  log: 'text/plain',
};

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const {
      title: rawTitle,
      content,
      extension: rawExt,
      folderId: rawFolderId,
      isProtected,
      password,
    } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    const title = rawTitle && typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : 'Untitled Note';
    const ext = rawExt && typeof rawExt === 'string' && rawExt.trim() ? rawExt.trim().replace(/^\./, '').toLowerCase() : 'txt';
    const originalName = title.toLowerCase().endsWith(`.${ext}`) ? title : `${title}.${ext}`;
    const mimeType = MIME_BY_EXT[ext] || 'text/plain; charset=utf-8';
    const size = Buffer.byteLength(content, 'utf-8');

    const folderId =
      !rawFolderId || rawFolderId === 'root' || rawFolderId === 'null'
        ? null
        : new mongoose.Types.ObjectId(rawFolderId);

    let passwordHash: string | null = null;
    if (isProtected) {
      if (!password || typeof password !== 'string' || !password.trim()) {
        return NextResponse.json({ error: 'Password is required for protected notes' }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(password.trim(), 12);
    }

    const fileDoc = await FileItem.create({
      title,
      originalName,
      mimeType,
      extension: ext,
      size,
      folderId,
      storageProvider: 'MONGODB',
      driveFileId: null,
      uploadStatus: 'COMPLETED',
      textContent: content,
      isProtected: Boolean(isProtected),
      passwordHash,
    });

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
    console.error('Text note create error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create text note';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
