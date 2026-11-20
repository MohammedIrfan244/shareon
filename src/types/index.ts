export type StorageProvider = 'MONGODB' | 'GDRIVE';
export type UploadStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface IFolder {
  _id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IFileItem {
  _id: string;
  title: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  folderId: string | null;
  storageProvider: StorageProvider;
  driveFileId?: string | null;
  uploadStatus?: UploadStatus;
  textContent?: string;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface StorageQuota {
  usage: number;
  limit: number;
  remaining: number;
}
