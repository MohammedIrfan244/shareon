'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Link2,
  Loader2,
} from 'lucide-react';
import { IFileItem } from '@/types';
import { formatBytes } from '@/lib/file-utils';
import { downloadFileStream, DownloadProgress } from '@/lib/client/drive-downloader';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: IFileItem | null;
  unlockedData?: {
    url?: string;
    downloadUrl?: string;
    accessToken?: string;
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const content = unlockedData?.textContent ?? file?.textContent;
  const isMongo = file?.storageProvider === 'MONGODB' || content !== undefined;

  const mime = file ? file.mimeType.toLowerCase() : '';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const isPdf = mime === 'application/pdf';

  // For Drive media preview: fetch with token into object URL if small enough
  useEffect(() => {
    let ignore = false;
    let createdUrl: string | null = null;

    async function loadDriveMedia() {
      if (!isOpen || !file || isMongo) return;
      if (!isImage && !isAudio) return;
      if (file.size > 50 * 1024 * 1024) return; // Only preview media under 50MB

      setLoadingMedia(true);
      try {
        let authHeader: string | null = null;
        let targetUrl: string | null = null;

        if (unlockedData?.downloadUrl && unlockedData?.accessToken) {
          targetUrl = unlockedData.downloadUrl;
          authHeader = `Bearer ${unlockedData.accessToken}`;
        } else if (!file.isProtected) {
          const res = await fetch(`/api/files/${file._id}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.downloadUrl && data.accessToken) {
              targetUrl = data.downloadUrl;
              authHeader = `Bearer ${data.accessToken}`;
            }
          }
        }

        if (targetUrl && authHeader) {
          const mediaRes = await fetch(targetUrl, {
            headers: { Authorization: authHeader },
          });
          if (mediaRes.ok && !ignore) {
            const blob = await mediaRes.blob();
            createdUrl = URL.createObjectURL(blob);
            setMediaBlobUrl(createdUrl);
          }
        }
      } catch (err) {
        console.error('Failed to load drive preview:', err);
      } finally {
        if (!ignore) setLoadingMedia(false);
      }
    }

    loadDriveMedia();

    return () => {
      ignore = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setMediaBlobUrl(null);
    };
  }, [isOpen, file, isMongo, isImage, isAudio, unlockedData]);

  if (!isOpen || !file) return null;

  const handleCopyLink = async () => {
    try {
      const link = `${window.location.origin}/?file=${file._id}`;
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const handleCopyText = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadProgress(null);
    try {
      await downloadFileStream({
        fileId: file._id,
        password: unlockedData?.password,
        onProgress: (p) => setDownloadProgress(p),
      });
    } catch (err) {
      console.error('Download failed:', err);
      alert(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  const renderIcon = () => {
    if (isImage) return <ImageIcon className="w-4 h-4 text-zinc-400" />;
    if (isVideo) return <Video className="w-4 h-4 text-zinc-400" />;
    if (isAudio) return <Music className="w-4 h-4 text-zinc-400" />;
    if (isMongo) return <FileText className="w-4 h-4 text-zinc-400" />;
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
                {file.originalName} • {formatBytes(file.size)} •{' '}
                {isMongo ? 'Database Note' : 'Google Drive'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
              title="Copy share link"
            >
              {linkCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <button
              disabled={downloading}
              onClick={handleDownload}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloading ? 'Downloading...' : 'Download'}</span>
            </button>
            <button
              onClick={onClose}
              disabled={downloading}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Download progress banner if downloading */}
        {downloading && downloadProgress && (
          <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-300">
            <span>
              Streaming to disk: {downloadProgress.percentage}% ({formatBytes(downloadProgress.bytesDownloaded)} / {formatBytes(downloadProgress.totalBytes)})
            </span>
            <span>{downloadProgress.speedMbps} Mbps</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 bg-zinc-950 flex items-center justify-center min-h-[260px]">
          {isMongo ? (
            <div className="w-full h-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
                <span>{file.extension.toUpperCase() || 'TEXT'} (MongoDB)</span>
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
          ) : loadingMedia ? (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              <p className="text-xs">Loading media preview from Google Drive...</p>
            </div>
          ) : isImage && mediaBlobUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaBlobUrl}
              alt={file.title}
              className="max-h-[70vh] max-w-full rounded object-contain"
            />
          ) : isAudio && mediaBlobUrl ? (
            <div className="w-full max-w-sm p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-center space-y-3">
              <Music className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-xs font-medium text-white">{file.title}</p>
              <audio controls src={mediaBlobUrl} className="w-full" />
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <File className="w-8 h-8 text-zinc-500 mx-auto" />
              <div>
                <p className="text-xs font-medium text-zinc-200">{file.title}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Stored on Google Drive • {formatBytes(file.size)}
                </p>
              </div>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                Direct zero-RAM streaming download available for this file.
              </p>
              <div className="pt-2">
                <button
                  disabled={downloading}
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-white text-zinc-950 text-xs font-medium hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download to Device</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
