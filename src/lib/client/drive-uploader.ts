export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speedMbps: number;
  etaSeconds: number;
}

export interface DriveUploaderOptions {
  file: File;
  uploadSessionUrl: string;
  fileRecordId: string;
  chunkSize?: number;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

const DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB

export async function uploadDirectToDrive(options: DriveUploaderOptions): Promise<{ driveFileId: string }> {
  const {
    file,
    uploadSessionUrl,
    fileRecordId,
    chunkSize = DEFAULT_CHUNK_SIZE,
    onProgress,
    signal,
  } = options;

  const totalBytes = file.size;
  let startByte = 0;
  const startTime = Date.now();

  const queryDriveReceivedBytes = async (): Promise<number> => {
    try {
      const res = await fetch(uploadSessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes */${totalBytes}`,
        },
        signal,
      });

      if (res.status === 308) {
        const range = res.headers.get('Range');
        if (range) {
          const match = range.match(/bytes=0-(\d+)/);
          if (match && match[1]) {
            return parseInt(match[1], 10) + 1;
          }
        }
        return 0;
      }

      if (res.status === 200 || res.status === 201) {
        return totalBytes;
      }
    } catch {
      // ignore
    }
    return startByte;
  };

  while (startByte < totalBytes) {
    if (signal?.aborted) {
      throw new Error('Upload aborted');
    }

    const endByte = Math.min(startByte + chunkSize, totalBytes);
    const chunk = file.slice(startByte, endByte);
    const contentRange = `bytes ${startByte}-${endByte - 1}/${totalBytes}`;

    let attempt = 0;
    const maxRetries = 5;
    let chunkUploaded = false;
    let driveFileId: string | null = null;

    while (!chunkUploaded && attempt < maxRetries) {
      if (signal?.aborted) {
        throw new Error('Upload aborted');
      }

      try {
        const res = await fetch(uploadSessionUrl, {
          method: 'PUT',
          headers: {
            'Content-Range': contentRange,
          },
          body: chunk,
          signal,
        });

        if (res.status === 308) {
          // Chunk accepted, incomplete upload
          const range = res.headers.get('Range');
          if (range) {
            const match = range.match(/bytes=0-(\d+)/);
            if (match && match[1]) {
              startByte = parseInt(match[1], 10) + 1;
            } else {
              startByte = endByte;
            }
          } else {
            startByte = endByte;
          }
          chunkUploaded = true;
        } else if (res.status === 200 || res.status === 201) {
          // Upload complete!
          const data = await res.json();
          driveFileId = data.id;
          startByte = totalBytes;
          chunkUploaded = true;
        } else if (res.status === 404 || res.status === 410) {
          throw new Error('Upload session expired. Please restart upload.');
        } else {
          throw new Error(`Storage returned status ${res.status}`);
        }
      } catch (err) {
        if (signal?.aborted) {
          throw new Error('Upload aborted');
        }

        attempt++;
        if (attempt >= maxRetries) {
          throw err instanceof Error ? err : new Error('Network error uploading chunk to storage');
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));

        // Query Drive to find exact last received byte
        startByte = await queryDriveReceivedBytes();
      }
    }

    // Report progress
    const elapsedSeconds = Math.max(0.1, (Date.now() - startTime) / 1000);
    const speedBytesPerSec = startByte / elapsedSeconds;
    const speedMbps = (speedBytesPerSec * 8) / (1024 * 1024);
    const remainingBytes = Math.max(0, totalBytes - startByte);
    const etaSeconds = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;
    const percentage = Math.min(100, Math.round((startByte / totalBytes) * 100));

    if (onProgress) {
      onProgress({
        bytesUploaded: startByte,
        totalBytes,
        percentage,
        speedMbps: parseFloat(speedMbps.toFixed(2)),
        etaSeconds,
      });
    }

    if (driveFileId) {
      // Call server to complete & verify
      const compRes = await fetch('/api/files/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileRecordId,
          driveFileId,
        }),
      });

      if (!compRes.ok) {
        const compData = await compRes.json();
        throw new Error(compData.error || 'Failed to complete upload registration');
      }

      return { driveFileId };
    }
  }

  throw new Error('Upload finished without receiving file ID');
}
