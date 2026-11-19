import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Folder from '@/models/Folder';
import mongoose from 'mongoose';

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const parentIdParam = searchParams.get('parentId');

    const parentId =
      !parentIdParam || parentIdParam === 'root' || parentIdParam === 'null'
        ? null
        : new mongoose.Types.ObjectId(parentIdParam);

    const folders = await Folder.find({ parentId }).sort({ name: 1 }).lean();

    return NextResponse.json({ folders });
  } catch (error: unknown) {
    console.error('Fetch folders error:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, parentId } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const resolvedParentId =
      !parentId || parentId === 'root' || parentId === 'null'
        ? null
        : new mongoose.Types.ObjectId(parentId);

    // Check if folder with same name already exists in this directory
    const existing = await Folder.findOne({
      name: trimmedName,
      parentId: resolvedParentId,
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A folder with this name already exists here' },
        { status: 409 }
      );
    }

    const folder = await Folder.create({
      name: trimmedName,
      parentId: resolvedParentId,
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create folder error:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
