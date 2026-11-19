'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { isTextFile, formatBytes } from '@/lib/file-utils';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderId: string | null;
  onUploadSuccess: () => void;
}

export default function UploadModal({
  isOpen,
  onClose,
  currentFolderId,
  onUploadSuccess,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelection = (selectedFile: File) => {
    setFile(selectedFile);
    setError('');
    if (!title) {
      const nameWithoutExt =
        selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
      setTitle(nameWithoutExt);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a file to upload');
      return;
    }

    if (isProtected && !password.trim()) {
      setError('Enter a password for protected upload');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim() || file.name);
      if (currentFolderId) {
        formData.append('folderId', currentFolderId);
      }
      formData.append('isProtected', isProtected ? 'true' : 'false');
      if (isProtected) {
        formData.append('password', password);
      }

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onUploadSuccess();
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setFile(null);
    setTitle('');
    setIsProtected(false);
    setPassword('');
    setError('');
    onClose();
  };

  const isText = file ? isTextFile(file.name, file.type) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70">
      <div className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-xl p-5 shadow-xl text-zinc-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">Upload File</h2>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1 rounded text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded bg-zinc-950 border border-red-900/60 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleUpload} className="mt-4 space-y-4">
          {/* File Picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg p-5 text-center cursor-pointer bg-zinc-950/50 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelection(e.target.files[0]);
                }
              }}
            />
            {file ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-white truncate max-w-xs mx-auto">
                  {file.name}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {formatBytes(file.size)} • {isText ? 'Database Text' : 'Cloudinary'}
                </p>
                <p className="text-[10px] text-zinc-500 pt-1">Tap to change file</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
                <p className="text-xs text-zinc-300">Tap to browse file</p>
                <p className="text-[11px] text-zinc-500">
                  Text files save to DB • Media saves to Cloudinary
                </p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs text-zinc-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="File title"
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Password Protection */}
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">Password protect</span>
              <input
                type="checkbox"
                checked={isProtected}
                onChange={(e) => setIsProtected(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-white cursor-pointer accent-white"
              />
            </div>

            {isProtected && (
              <div className="pt-2 border-t border-zinc-800/80">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set unlock password"
                  className="w-full px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" /> : null}
              <span>{uploading ? 'Uploading...' : 'Upload'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
