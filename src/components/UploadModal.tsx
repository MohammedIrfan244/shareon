'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, Ban } from 'lucide-react';
import { formatBytes } from '@/lib/file-utils';
import { uploadDirectToDrive, UploadProgress } from '@/lib/client/drive-uploader';

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
  const [activeTab, setActiveTab] = useState<'file' | 'note'>('file');

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Note / Text Field State
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteExt, setNoteExt] = useState('txt');
  const [noteProtected, setNoteProtected] = useState(false);
  const [notePassword, setNotePassword] = useState('');
  const [savingNote, setSavingNote] = useState(false);

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

  const handleCancelUpload = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    setUploadProgress(null);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
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
    setUploadProgress({
      bytesUploaded: 0,
      totalBytes: file.size,
      percentage: 0,
      speedMbps: 0,
      etaSeconds: 0,
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Step 1: Initialize upload session with server
      const initRes = await fetch('/api/files/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          title: title.trim() || file.name,
          folderId: currentFolderId,
          isProtected,
          password: isProtected ? password.trim() : undefined,
        }),
        signal: abortController.signal,
      });

      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData.error || 'Failed to initialize upload');
      }

      // Step 2: Route upload based on server decision
      if (initData.mode === 'MONGODB') {
        // Small text file -> direct multipart save to MongoDB
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title.trim() || file.name);
        if (currentFolderId) formData.append('folderId', currentFolderId);
        formData.append('isProtected', isProtected ? 'true' : 'false');
        if (isProtected) formData.append('password', password);

        const mongoRes = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
          signal: abortController.signal,
        });

        const mongoData = await mongoRes.json();
        if (!mongoRes.ok) {
          throw new Error(mongoData.error || 'Failed to upload text file to database');
        }
      } else {
        // Large or binary file -> Direct chunked upload to Google Drive (Zero server proxying)
        await uploadDirectToDrive({
          file,
          uploadSessionUrl: initData.uploadSessionUrl,
          fileRecordId: initData.fileRecordId,
          chunkSize: initData.chunkSize,
          onProgress: (p) => setUploadProgress(p),
          signal: abortController.signal,
        });
      }

      onUploadSuccess();
      handleClose();
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        setError('Upload cancelled');
      } else {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleNoteUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      setError('Please enter some text content');
      return;
    }

    if (noteProtected && !notePassword.trim()) {
      setError('Enter a password for protected note');
      return;
    }

    setError('');
    setSavingNote(true);

    try {
      const res = await fetch('/api/files/upload/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle.trim() || 'Untitled Note',
          content: noteContent,
          extension: noteExt,
          folderId: currentFolderId,
          isProtected: noteProtected,
          password: noteProtected ? notePassword.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save note');
      }

      onUploadSuccess();
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleClose = () => {
    if (uploading || savingNote) return;
    setFile(null);
    setTitle('');
    setIsProtected(false);
    setPassword('');
    setNoteTitle('');
    setNoteContent('');
    setNoteProtected(false);
    setNotePassword('');
    setError('');
    setUploadProgress(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75">
      <div className="w-full sm:max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-xl p-5 shadow-2xl text-zinc-100 max-h-[92vh] overflow-y-auto">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              disabled={uploading || savingNote}
              onClick={() => {
                setActiveTab('file');
                setError('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'file' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              disabled={uploading || savingNote}
              onClick={() => {
                setActiveTab('note');
                setError('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'note' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Write Text Note</span>
            </button>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading || savingNote}
            className="p-1 rounded text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded bg-zinc-950 border border-red-900/60 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: FILE UPLOAD */}
        {activeTab === 'file' && (
          <form onSubmit={handleFileUpload} className="mt-4 space-y-4">
            {/* File Picker */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border border-dashed rounded-lg p-5 text-center transition-colors ${
                uploading
                  ? 'border-zinc-800 bg-zinc-950/20 cursor-not-allowed'
                  : 'border-zinc-700 hover:border-zinc-500 bg-zinc-950/50 cursor-pointer'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                disabled={uploading}
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
                    {formatBytes(file.size)} • Direct to Private Storage (up to 5 GB)
                  </p>
                  {!uploading && (
                    <p className="text-[10px] text-zinc-500 pt-1">Tap to select a different file</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
                  <p className="text-xs text-zinc-300">Tap to browse file (up to 5 GB)</p>
                  <p className="text-[11px] text-zinc-500">
                    Binaries stream direct to Private Storage • Text ≤ 512KB saves to DB
                  </p>
                </div>
              )}
            </div>

            {/* Upload Progress Bar (Showing speed, ETA, percentage) */}
            {uploading && uploadProgress && (
              <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-white">
                    Uploading ({uploadProgress.percentage}%)
                  </span>
                  <span className="text-zinc-400">
                    {formatBytes(uploadProgress.bytesUploaded)} / {formatBytes(uploadProgress.totalBytes)}
                  </span>
                </div>

                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-white h-full transition-all duration-300"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <span>Speed: {uploadProgress.speedMbps} Mbps</span>
                  <span>ETA: {uploadProgress.etaSeconds}s</span>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs text-zinc-300 mb-1">Display Title</label>
              <input
                type="text"
                disabled={uploading}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="File title"
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 disabled:opacity-50"
              />
            </div>

            {/* Password Protection */}
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">Password protect</span>
                <input
                  type="checkbox"
                  disabled={uploading}
                  checked={isProtected}
                  onChange={(e) => setIsProtected(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-white cursor-pointer accent-white"
                />
              </div>

              {isProtected && (
                <div className="pt-2 border-t border-zinc-800/80">
                  <input
                    type="password"
                    disabled={uploading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set unlock password"
                    className="w-full px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              {uploading ? (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-red-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel Upload</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!file}
                    className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <span>Upload to Storage</span>
                  </button>
                </>
              )}
            </div>
          </form>
        )}

        {/* TAB 2: WRITE TEXT NOTE (Direct to MongoDB) */}
        {activeTab === 'note' && (
          <form onSubmit={handleNoteUpload} className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs text-zinc-300 mb-1">Note Title</label>
                <input
                  type="text"
                  required
                  disabled={savingNote}
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Snippet, Credentials, Idea"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Format</label>
                <select
                  disabled={savingNote}
                  value={noteExt}
                  onChange={(e) => setNoteExt(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600 disabled:opacity-50"
                >
                  <option value="txt">.txt (Plain)</option>
                  <option value="md">.md (Markdown)</option>
                  <option value="json">.json (JSON)</option>
                  <option value="js">.js (JavaScript)</option>
                  <option value="ts">.ts (TypeScript)</option>
                  <option value="py">.py (Python)</option>
                  <option value="sql">.sql (SQL)</option>
                  <option value="log">.log (Log)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Text Content</label>
              <textarea
                required
                disabled={savingNote}
                rows={8}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write or paste your text here..."
                className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs font-mono focus:outline-none focus:border-zinc-600 resize-y disabled:opacity-50"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Stored directly in MongoDB • Instant zero-latency loading
              </p>
            </div>

            {/* Password Protection */}
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">Password protect</span>
                <input
                  type="checkbox"
                  disabled={savingNote}
                  checked={noteProtected}
                  onChange={(e) => setNoteProtected(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-white cursor-pointer accent-white"
                />
              </div>

              {noteProtected && (
                <div className="pt-2 border-t border-zinc-800/80">
                  <input
                    type="password"
                    disabled={savingNote}
                    value={notePassword}
                    onChange={(e) => setNotePassword(e.target.value)}
                    placeholder="Set unlock password"
                    className="w-full px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={savingNote}
                className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingNote || !noteContent.trim()}
                className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" /> : null}
                <span>Save to Database</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
