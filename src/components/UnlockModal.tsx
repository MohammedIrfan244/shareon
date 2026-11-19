'use client';

import React, { useState } from 'react';
import { X, Lock, Loader2 } from 'lucide-react';
import { IFileItem } from '@/types';

interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: IFileItem | null;
  onUnlockSuccess: (unlockedData: { url?: string; textContent?: string; password?: string }) => void;
}

export default function UnlockModal({
  isOpen,
  onClose,
  file,
  onUnlockSuccess,
}: UnlockModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !file) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Enter the password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/files/${file._id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Password incorrect');
      }

      onUnlockSuccess({
        url: data.url,
        textContent: data.textContent,
        password: password,
      });

      setPassword('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70">
      <div className="w-full sm:max-w-sm bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-xl p-5 shadow-xl text-zinc-100">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">Protected File</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
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

        <p className="mt-3 text-xs text-zinc-400">
          Enter the password to access <strong className="text-zinc-200">{file.title}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-300 mb-1">Password</label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="File password"
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" /> : null}
              <span>Unlock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
