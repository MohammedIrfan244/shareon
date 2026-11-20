import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Folder from '@/models/Folder';
import mongoose from 'mongoose';
import { BreadcrumbItem } from '@/types';

interface IAncestorFolder {
  _id: mongoose.Types.ObjectId;
  name: string;
  parentId: mongoose.Types.ObjectId | null;
}

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    const breadcrumbs: BreadcrumbItem[] = [{ id: null, name: 'Root' }];

    if (!folderId || folderId === 'root' || folderId === 'null') {
      return NextResponse.json({ breadcrumbs });
    }

    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return NextResponse.json({ breadcrumbs });
    }

    // Traverse upwards to collect all ancestor folders
    const pathFolders: { id: string; name: string }[] = [];
    let currentId: mongoose.Types.ObjectId | null = new mongoose.Types.ObjectId(folderId);

    while (currentId) {
      const folderDoc: IAncestorFolder | null = await Folder.findById(currentId)
        .select('name parentId')
        .lean();

      if (!folderDoc) break;

      pathFolders.unshift({
        id: folderDoc._id.toString(),
        name: folderDoc.name,
      });

      currentId = folderDoc.parentId ? (folderDoc.parentId as mongoose.Types.ObjectId) : null;
    }

    breadcrumbs.push(...pathFolders);

    return NextResponse.json({ breadcrumbs });
  } catch (error: unknown) {
    console.error('Fetch breadcrumbs error:', error);
    return NextResponse.json({ error: 'Failed to retrieve breadcrumbs' }, { status: 500 });
  }
}
