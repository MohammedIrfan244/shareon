'use client';

import React, { useState } from 'react';
import { X, Download, Copy, Check, FileText, Image as ImageIcon, Video, Music, File } from 'lucide-react';
import { IFileItem } from '@/types';
import { formatBytes } from '@/lib/file-utils';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: IFileItem | null;
  unlockedData?: {
    url?: string;
    textContent?: string;
    password?: string;
  } | null;
}

export default function PreviewModal({
  isOpen,
  onClose,
  file,
  unlockedData,
}: PreviewModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !file) return null;

  const content = unlockedData?.textContent ?? file.textContent;
  const url = unlockedData?.url ?? file.cloudinary?.secureUrl;
  const isText = file.storageType === 'mongodb_text' || content !== undefined;

  const mime = file.mimeType.toLowerCase();
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const isPdf = mime === 'application/pdf';

  const handleCopyText = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const getDownloadUrl = () => {
    let dlUrl = `/api/files/${file._id}/download`;
    if (file.isProtected && unlockedData?.password) {
      dlUrl += `?p=${encodeURIComponent(unlockedData.password)}`;
    }
    return dlUrl;
  };

  const renderIcon = () => {
    if (isImage) return <ImageIcon className="w-4 h-4 text-zinc-400" />;
    if (isVideo) return <Video className="w-4 h-4 text-zinc-400" />;
    if (isAudio) return <Music className="w-4 h-4 text-zinc-400" />;
    if (isText) return <FileText className="w-4 h-4 text-zinc-400" />;
    return <File className="w-4 h-4 text-zinc-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80">
      <div className="w-full max-w-3xl max-h-[92vh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            {renderIcon()}
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-semibold text-white truncate">{file.title}</h2>
              <p className="text-[11px] text-zinc-400 truncate">
                {file.originalName} • {formatBytes(file.size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={getDownloadUrl()}
              download={file.originalName}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 bg-zinc-950 flex items-center justify-center min-h-[240px]">
          {isText ? (
            <div className="w-full h-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
                <span>{file.extension.toUpperCase() || 'TEXT'}</span>
                <button
                  onClick={handleCopyText}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 text-xs font-mono text-zinc-300 overflow-auto whitespace-pre-wrap break-words max-h-[60vh]">
                {content ?? 'No content available'}
              </pre>
            </div>
          ) : isImage && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={file.title}
              className="max-h-[70vh] max-w-full rounded object-contain"
            />
          ) : isVideo && url ? (
            <video
              controls
              playsInline
              src={url}
              className="max-h-[70vh] max-w-full rounded"
            />
          ) : isAudio && url ? (
            <div className="w-full max-w-sm p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-center space-y-3">
              <Music className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-xs font-medium text-white">{file.title}</p>
              <audio controls src={url} className="w-full" />
            </div>
          ) : isPdf && url ? (
            <iframe
              src={url}
              className="w-full h-[65vh] rounded border border-zinc-800"
              title={file.title}
            />
          ) : (
            <div className="text-center py-10 space-y-2">
              <File className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="text-xs text-zinc-300">Preview not supported for this file</p>
              <div className="pt-2">
                <a
                  href={getDownloadUrl()}
                  download={file.originalName}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white text-zinc-950 text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download file</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
