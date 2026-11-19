export type StorageType = 'cloudinary' | 'mongodb_text';

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
  storageType: StorageType;
  cloudinary?: {
    publicId: string;
    secureUrl: string;
    resourceType: string;
  };
  textContent?: string;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}
