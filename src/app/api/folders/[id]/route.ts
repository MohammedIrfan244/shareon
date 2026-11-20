import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Folder from '@/models/Folder';
import FileItem from '@/models/FileItem';
import { deleteDriveFile } from '@/lib/google-drive';
import mongoose from 'mongoose';

async function getAllDescendantFolderIds(folderId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId[]> {
  const children = await Folder.find({ parentId: folderId }).select('_id');
  let ids: mongoose.Types.ObjectId[] = [folderId];

  for (const child of children) {
    const subIds = await getAllDescendantFolderIds(child._id as mongoose.Types.ObjectId);
    ids = ids.concat(subIds);
  }

  return ids;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const folderObjectId = new mongoose.Types.ObjectId(id);
    const targetFolder = await Folder.findById(folderObjectId);
    if (!targetFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Collect all descendant folder IDs
    const allFolderIds = await getAllDescendantFolderIds(folderObjectId);

    // Find all files in these folders to remove Google Drive files
    const filesToDelete = await FileItem.find({ folderId: { $in: allFolderIds } });

    for (const file of filesToDelete) {
      if (file.driveFileId) {
        try {
          await deleteDriveFile(file.driveFileId);
        } catch (err) {
          console.error(`Failed to delete Drive asset for file ${file._id}:`, err);
        }
      }
    }

    // Delete files and folders from MongoDB
    await FileItem.deleteMany({ folderId: { $in: allFolderIds } });
    await Folder.deleteMany({ _id: { $in: allFolderIds } });

    return NextResponse.json({ success: true, message: 'Folder and contents deleted successfully' });
  } catch (error: unknown) {
    console.error('Delete folder error:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
