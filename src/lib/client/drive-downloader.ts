export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speedMbps: number;
}

export interface DriveDownloaderOptions {
  fileId: string;
  password?: string;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

// Window type augmentation for File System Access API
interface FileSystemHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemHandle>;
  }
}

export async function downloadFileStream(options: DriveDownloaderOptions): Promise<void> {
  const { fileId, password, onProgress, signal } = options;

  // 1. Get download authorization from server
  const initRes = await fetch(`/api/files/${fileId}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    signal,
  });

  const initData = await initRes.json();
  if (!initRes.ok) {
    throw new Error(initData.error || 'Failed to prepare download');
  }

  // 2. Handle MongoDB text storage directly
  if (initData.storageProvider === 'MONGODB') {
    const textBlob = new Blob([initData.textContent || ''], {
      type: initData.mimeType || 'text/plain;charset=utf-8',
    });
    const blobUrl = URL.createObjectURL(textBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = initData.fileName || 'download.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return;
  }

  // 3. Handle Google Drive direct-to-disk streaming
  const { downloadUrl, accessToken, fileName, size } = initData;
  const totalBytes = size || 0;

  // Primary Path: File System Access API (Zero RAM Buffering on Chrome / Edge / Brave / Opera)
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
      });

      const writable = await fileHandle.createWritable();
      const startTime = Date.now();
      let bytesDownloaded = 0;

      const driveRes = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal,
      });

      if (!driveRes.ok || !driveRes.body) {
        throw new Error(`Google Drive returned status ${driveRes.status}`);
      }

      const reader = driveRes.body.getReader();

      while (true) {
        if (signal?.aborted) {
          await writable.abort();
          throw new Error('Download aborted');
        }

        const { done, value } = await reader.read();
        if (done) break;

        await writable.write(value);
        bytesDownloaded += value.length;

        if (onProgress && totalBytes > 0) {
          const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const speedMbps = ((bytesDownloaded / elapsedSec) * 8) / (1024 * 1024);
          onProgress({
            bytesDownloaded,
            totalBytes,
            percentage: Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)),
            speedMbps: parseFloat(speedMbps.toFixed(2)),
          });
        }
      }

      await writable.close();
      return;
    } catch (pickerErr: unknown) {
      // User cancelled picker or permission denied -> don't fallback to blob if aborted
      if (pickerErr instanceof Error && pickerErr.name === 'AbortError') {
        return;
      }
      console.warn('File System Access API failed, falling back to Blob stream:', pickerErr);
    }
  }

  // Fallback Path: Stream into Blob for Safari/Firefox
  const startTime = Date.now();
  let bytesDownloaded = 0;

  const driveRes = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (!driveRes.ok || !driveRes.body) {
    throw new Error(`Google Drive download failed: ${driveRes.statusText}`);
  }

  const reader = driveRes.body.getReader();
  const chunks: BlobPart[] = [];

  while (true) {
    if (signal?.aborted) {
      throw new Error('Download aborted');
    }

    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    bytesDownloaded += value.length;

    if (onProgress && totalBytes > 0) {
      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      const speedMbps = ((bytesDownloaded / elapsedSec) * 8) / (1024 * 1024);
      onProgress({
        bytesDownloaded,
        totalBytes,
        percentage: Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)),
        speedMbps: parseFloat(speedMbps.toFixed(2)),
      });
    }
  }

  const blob = new Blob(chunks, { type: initData.mimeType || 'application/octet-stream' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
