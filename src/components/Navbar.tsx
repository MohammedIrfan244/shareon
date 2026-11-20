'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FolderPlus, LogOut, Search, X, HardDrive } from 'lucide-react';
import { formatBytes } from '@/lib/file-utils';
import { StorageQuota } from '@/types';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenUpload: () => void;
  onOpenNewFolder: () => void;
  refreshTrigger?: number;
}

export default function Navbar({
  searchQuery,
  onSearchChange,
  onOpenUpload,
  onOpenNewFolder,
  refreshTrigger,
}: NavbarProps) {
  const router = useRouter();
  const [quota, setQuota] = useState<StorageQuota | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadQuota() {
      try {
        const res = await fetch('/api/storage/quota');
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.limit) {
            setQuota(data);
          }
        }
      } catch {
        // ignore
      }
    }
    loadQuota();
    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  const usedPercent = quota ? Math.min(100, Math.round((quota.usage / quota.limit) * 100)) : 0;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-white" />
          <span className="text-sm font-semibold tracking-tight text-white">ShareOn</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-8 pr-7 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Storage Quota (Desktop & Tablet) */}
        {quota && (
          <div
            title={`Private Storage: ${formatBytes(quota.usage)} of ${formatBytes(quota.limit)} used (${usedPercent}%)`}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 shrink-0"
          >
            <HardDrive className="w-3 h-3 text-zinc-500" />
            <span>
              {formatBytes(quota.usage, 1)} / {formatBytes(quota.limit, 0)}
            </span>
            <div className="w-12 bg-zinc-800 h-1.5 rounded-full overflow-hidden ml-1">
              <div
                className="bg-zinc-400 h-full rounded-full"
                style={{ width: `${Math.max(2, usedPercent)}%` }}
              />
            </div>
          </div>
        )}

        {/* Desktop actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenNewFolder}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-zinc-400" />
            <span>New Folder</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
