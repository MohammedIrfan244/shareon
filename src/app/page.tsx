'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import UploadModal from '@/components/UploadModal';
import NewFolderModal from '@/components/NewFolderModal';
import UnlockModal from '@/components/UnlockModal';
import PreviewModal from '@/components/PreviewModal';
import { IFolder, IFileItem, BreadcrumbItem } from '@/types';
import { formatBytes } from '@/lib/file-utils';
import {
  Folder as FolderIcon,
  ChevronRight,
  Lock,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Trash2,
  Download,
  Eye,
  Link2,
  Check,
  Loader2,
  FolderOpen,
  Home,
  Upload,
  FolderPlus,
  LayoutGrid,
  List,
} from 'lucide-react';

export default function DashboardPage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'Root' },
  ]);
  const [folders, setFolders] = useState<IFolder[]>([]);
  const [files, setFiles] = useState<IFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [unlockTargetFile, setUnlockTargetFile] = useState<IFileItem | null>(null);
  const [previewTargetFile, setPreviewTargetFile] = useState<IFileItem | null>(null);
  const [unlockedData, setUnlockedData] = useState<{
    url?: string;
    textContent?: string;
    password?: string;
  } | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'file' | 'folder';
    id: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  const handleCopyLink = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    try {
      const link = `${window.location.origin}/?file=${fileId}`;
      await navigator.clipboard.writeText(link);
      setCopiedFileId(fileId);
      setTimeout(() => setCopiedFileId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  // Handle incoming deep link: ?file=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetFileId = params.get('file');
    if (!targetFileId) return;

    async function loadTargetFile() {
      try {
        const res = await fetch(`/api/files/${targetFileId}`);
        if (!res.ok) return;
        const data = await res.json();
        const file: IFileItem = data.file;
        if (!file) return;

        // If file belongs to a folder, sync the folder view & breadcrumbs
        if (file.folderId) {
          setCurrentFolderId(file.folderId);
          try {
            const bcRes = await fetch(`/api/folders/breadcrumbs?folderId=${file.folderId}`);
            if (bcRes.ok) {
              const bcData = await bcRes.json();
              if (bcData.breadcrumbs) {
                setBreadcrumbs(bcData.breadcrumbs);
              }
            }
          } catch {
            // fallback
          }
        }

        // Auto open preview or unlock
        if (file.isProtected) {
          setUnlockTargetFile(file);
        } else {
          setUnlockedData(null);
          setPreviewTargetFile(file);
        }
      } catch (err) {
        console.error('Deep link resolution error:', err);
      }
    }

    loadTargetFile();
  }, []);

  const refreshData = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const folderParam = currentFolderId ? `?parentId=${currentFolderId}` : '?parentId=root';
        const fileFolderParam = currentFolderId ? `?folderId=${currentFolderId}` : '?folderId=root';
        const fileQuery = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : fileFolderParam;

        if (searchQuery) {
          const fileRes = await fetch(`/api/files${fileQuery}`);
          const fileData = await fileRes.json();
          if (!ignore) {
            setFiles(fileData.files || []);
            setFolders([]);
            setLoading(false);
          }
        } else {
          const [folderRes, fileRes] = await Promise.all([
            fetch(`/api/folders${folderParam}`),
            fetch(`/api/files${fileFolderParam}`),
          ]);

          const folderData = await folderRes.json();
          const fileData = await fileRes.json();

          if (!ignore) {
            setFolders(folderData.folders || []);
            setFiles(fileData.files || []);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to load storage items:', err);
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [currentFolderId, searchQuery, refreshKey]);

  const handleOpenFolder = (folder: IFolder) => {
    setLoading(true);
    setCurrentFolderId(folder._id);
    setBreadcrumbs((prev) => [...prev, { id: folder._id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = breadcrumbs[index];
    setLoading(true);
    setCurrentFolderId(target.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleOpenFile = (file: IFileItem) => {
    if (file.isProtected) {
      setUnlockTargetFile(file);
    } else {
      setUnlockedData(null);
      setPreviewTargetFile(file);
    }
  };

  const handleUnlockSuccess = (data: {
    url?: string;
    textContent?: string;
    password?: string;
  }) => {
    if (unlockTargetFile) {
      setUnlockedData(data);
      setPreviewTargetFile(unlockTargetFile);
      setUnlockTargetFile(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const endpoint =
        deleteTarget.type === 'folder'
          ? `/api/folders/${deleteTarget.id}`
          : `/api/files/${deleteTarget.id}`;

      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete item');
      }

      setDeleteTarget(null);
      refreshData();
    } catch (err) {
      console.error('Delete error', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileIcon = (file: IFileItem) => {
    if (file.isProtected) return <Lock className="w-4 h-4 text-zinc-400" />;
    const mime = file.mimeType.toLowerCase();
    if (mime.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-zinc-400" />;
    if (mime.startsWith('video/')) return <Video className="w-4 h-4 text-zinc-400" />;
    if (mime.startsWith('audio/')) return <Music className="w-4 h-4 text-zinc-400" />;
    if (file.storageType === 'mongodb_text') return <FileText className="w-4 h-4 text-zinc-400" />;
    return <File className="w-4 h-4 text-zinc-400" />;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col pb-20 sm:pb-8">
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setLoading(true);
          setSearchQuery(q);
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenNewFolder={() => setIsNewFolderOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 sm:py-6">
        {/* Breadcrumb Navigation & View Toggle */}
        <div className="flex items-center justify-between gap-2 mb-4">
          {!searchQuery ? (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 overflow-x-auto py-1">
              <button
                onClick={() => handleBreadcrumbClick(0)}
                className="flex items-center gap-1 hover:text-white transition-colors shrink-0 p-1"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>

              {breadcrumbs.slice(1).map((crumb, idx) => (
                <React.Fragment key={crumb.id || idx}>
                  <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                  <button
                    onClick={() => handleBreadcrumbClick(idx + 1)}
                    className={`hover:text-white transition-colors truncate max-w-[120px] sm:max-w-[200px] p-1 ${
                      idx + 1 === breadcrumbs.length - 1 ? 'font-medium text-white' : ''
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="text-xs text-zinc-400 flex items-center gap-2">
              <span>Results for &quot;{searchQuery}&quot;</span>
              <button
                onClick={() => {
                  setLoading(true);
                  setSearchQuery('');
                }}
                className="text-white underline text-xs"
              >
                Clear
              </button>
            </div>
          )}

          {/* List / Grid Toggle */}
          <div className="flex items-center border border-zinc-800 rounded-md p-0.5 shrink-0 bg-zinc-900">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mb-2" />
            <p className="text-xs">Loading...</p>
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-xl p-8">
            <FolderOpen className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-300">Folder is empty</p>
            <p className="text-xs text-zinc-500 mt-1">Upload a file or create a folder to begin</p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setIsNewFolderOpen(true)}
                className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white"
              >
                New Folder
              </button>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-3 py-1.5 rounded-md bg-white text-zinc-950 text-xs font-medium hover:bg-zinc-200"
              >
                Upload File
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Folders */}
            {folders.length > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  Folders
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {folders.map((folder) => (
                    <div
                      key={folder._id}
                      onClick={() => handleOpenFolder(folder)}
                      className="group flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-850 hover:border-zinc-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="text-xs font-medium text-zinc-200 truncate">
                          {folder.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({
                            type: 'folder',
                            id: folder._id,
                            title: folder.name,
                          });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files View */}
            {files.length > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  Files ({files.length})
                </h2>

                {viewMode === 'list' ? (
                  /* Clean Mobile-First List View */
                  <div className="border border-zinc-800 rounded-lg divide-y divide-zinc-800 bg-zinc-900/40 overflow-hidden">
                    {files.map((file) => (
                      <div
                        key={file._id}
                        onClick={() => handleOpenFile(file)}
                        className="group flex items-center justify-between p-3 hover:bg-zinc-900/80 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className="p-2 rounded bg-zinc-900 shrink-0 border border-zinc-800">
                            {getFileIcon(file)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs sm:text-sm font-medium text-zinc-100 truncate">
                                {file.title}
                              </p>
                              {file.isProtected && (
                                <span className="text-[10px] uppercase font-semibold text-zinc-400 bg-zinc-800 px-1 py-0.2 rounded">
                                  Locked
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                              {file.originalName} • {formatBytes(file.size)} •{' '}
                              {file.storageType === 'mongodb_text' ? 'DB Text' : 'Cloud'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => handleCopyLink(e, file._id)}
                            className="p-2 rounded text-zinc-400 hover:text-white"
                            title="Copy link"
                          >
                            {copiedFileId === file._id ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Link2 className="w-4 h-4" />
                            )}
                          </button>
                          <a
                            href={`/api/files/${file._id}/download`}
                            download={file.originalName}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (file.isProtected) {
                                e.preventDefault();
                                setUnlockTargetFile(file);
                              }
                            }}
                            className="p-2 rounded text-zinc-400 hover:text-white"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFile(file);
                            }}
                            className="p-2 rounded text-zinc-400 hover:text-white"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                type: 'file',
                                id: file._id,
                                title: file.title,
                              });
                            }}
                            className="p-2 rounded text-zinc-500 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Compact Grid View */
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {files.map((file) => (
                      <div
                        key={file._id}
                        onClick={() => handleOpenFile(file)}
                        className="group flex flex-col justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            {getFileIcon(file)}
                            {file.isProtected && (
                              <span className="text-[10px] text-zinc-400">Locked</span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-zinc-100 truncate">
                            {file.title}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                            {file.originalName}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
                          <span>{formatBytes(file.size)}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => handleCopyLink(e, file._id)}
                              className="text-zinc-400 hover:text-white"
                              title="Copy link"
                            >
                              {copiedFileId === file._id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={`/api/files/${file._id}/download`}
                              download={file.originalName}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (file.isProtected) {
                                  e.preventDefault();
                                  setUnlockTargetFile(file);
                                }
                              }}
                              className="text-zinc-400 hover:text-white"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({
                                  type: 'file',
                                  id: file._id,
                                  title: file.title,
                                });
                              }}
                              className="text-zinc-500 hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <footer className="pt-12 pb-4 text-center">
          <Link
            href="/privacy"
            className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Privacy Policy
          </Link>
        </footer>
      </main>

      {/* Mobile-First Sticky Bottom Action Bar (Thumb accessible) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-zinc-950/95 border-t border-zinc-800 flex items-center gap-2 z-20 backdrop-blur-md">
        <button
          onClick={() => setIsNewFolderOpen(true)}
          className="flex-1 py-2.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200 flex items-center justify-center gap-1.5"
        >
          <FolderPlus className="w-4 h-4 text-zinc-400" />
          <span>New Folder</span>
        </button>
        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex-1 py-2.5 px-3 rounded-lg bg-white text-zinc-950 text-xs font-medium flex items-center justify-center gap-1.5 shadow"
        >
          <Upload className="w-4 h-4 text-zinc-950" />
          <span>Upload File</span>
        </button>
      </div>

      {/* Simple Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70">
          <div className="w-full sm:max-w-xs bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-xl p-5 shadow-xl text-zinc-100">
            <h3 className="text-sm font-semibold text-white">Delete {deleteTarget.type}?</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Permanently remove <strong className="text-zinc-200">&quot;{deleteTarget.title}&quot;</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        currentFolderId={currentFolderId}
        onUploadSuccess={refreshData}
      />

      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        currentFolderId={currentFolderId}
        onFolderCreated={refreshData}
      />

      <UnlockModal
        isOpen={!!unlockTargetFile}
        file={unlockTargetFile}
        onClose={() => setUnlockTargetFile(null)}
        onUnlockSuccess={handleUnlockSuccess}
      />

      <PreviewModal
        isOpen={!!previewTargetFile}
        file={previewTargetFile}
        unlockedData={unlockedData}
        onClose={() => {
          setPreviewTargetFile(null);
          setUnlockedData(null);
        }}
      />
    </div>
  );
}
