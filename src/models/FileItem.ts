import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFileItemDoc extends Document {
  title: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  folderId: mongoose.Types.ObjectId | null;
  storageType: 'cloudinary' | 'mongodb_text';
  cloudinary?: {
    publicId: string;
    secureUrl: string;
    resourceType: string;
  };
  textContent?: string;
  isProtected: boolean;
  passwordHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const FileItemSchema = new Schema<IFileItemDoc>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
      default: '',
    },
    size: {
      type: Number,
      required: true,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    storageType: {
      type: String,
      enum: ['cloudinary', 'mongodb_text'],
      required: true,
    },
    cloudinary: {
      publicId: { type: String },
      secureUrl: { type: String },
      resourceType: { type: String },
    },
    textContent: {
      type: String,
    },
    isProtected: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

FileItemSchema.index({ folderId: 1, createdAt: -1 });
FileItemSchema.index({ title: 'text', originalName: 'text' });

const FileItem: Model<IFileItemDoc> =
  mongoose.models.FileItem || mongoose.model<IFileItemDoc>('FileItem', FileItemSchema);

export default FileItem;
