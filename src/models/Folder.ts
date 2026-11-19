import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFolderDoc extends Document {
  name: string;
  parentId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema = new Schema<IFolderDoc>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

FolderSchema.index({ parentId: 1, name: 1 });

const Folder: Model<IFolderDoc> =
  mongoose.models.Folder || mongoose.model<IFolderDoc>('Folder', FolderSchema);

export default Folder;
