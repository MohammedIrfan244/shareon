interface CachedToken {
  token: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

export async function getDriveAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if valid for more than 2 minutes
  if (tokenCache && tokenCache.expiresAt - now > 120_000) {
    return tokenCache.token;
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive credentials missing from environment variables');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error('Failed to refresh Google Drive token:', data);
    throw new Error(data.error_description || data.error || 'Failed to authenticate with Google Drive');
  }

  const expiresIn = (data.expires_in || 3600) * 1000;
  tokenCache = {
    token: data.access_token,
    expiresAt: now + expiresIn,
  };

  return data.access_token;
}

export async function initiateResumableUpload(params: {
  fileName: string;
  mimeType: string;
  fileSize: number;
  origin: string;
}): Promise<string> {
  const accessToken = await getDriveAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const metadata: Record<string, unknown> = {
    name: params.fileName,
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType,
        'X-Upload-Content-Length': params.fileSize.toString(),
        Origin: params.origin,
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to initiate resumable upload:', response.status, errorText);
    throw new Error(`Google Drive upload init failed: ${response.statusText}`);
  }

  const location = response.headers.get('Location');
  if (!location) {
    throw new Error('Google Drive did not return a resumable upload Location header');
  }

  return location;
}

export async function verifyDriveFile(driveFileId: string): Promise<{
  id: string;
  size: number;
  mimeType: string;
  name: string;
}> {
  const accessToken = await getDriveAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=id,size,mimeType,name`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to verify Drive file:', response.status, errorText);
    throw new Error(`Failed to verify file in Google Drive: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    size: data.size ? Number(data.size) : 0,
    mimeType: data.mimeType || 'application/octet-stream',
    name: data.name || '',
  };
}

export async function deleteDriveFile(driveFileId: string): Promise<boolean> {
  try {
    const accessToken = await getDriveAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 204 No Content is success, 404 means it's already gone
    if (response.status === 204 || response.status === 404) {
      return true;
    }

    const errText = await response.text();
    console.error(`Failed to delete Drive file ${driveFileId}:`, response.status, errText);
    return false;
  } catch (err) {
    console.error(`Error deleting Drive file ${driveFileId}:`, err);
    return false;
  }
}

export async function getDriveStorageQuota(): Promise<{
  usage: number;
  limit: number;
  remaining: number;
}> {
  const accessToken = await getDriveAccessToken();

  const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to retrieve Google Drive storage quota');
  }

  const data = await response.json();
  const quota = data.storageQuota || {};

  const usage = quota.usage ? Number(quota.usage) : 0;
  const limit = quota.limit ? Number(quota.limit) : 16106127360; // default 15GB if unlimited
  const remaining = Math.max(0, limit - usage);

  return { usage, limit, remaining };
}
