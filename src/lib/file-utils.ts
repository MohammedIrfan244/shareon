const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'csv', 'log', 'xml', 'yaml', 'yml',
  'env', 'sql', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp',
  'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'sh', 'bash', 'zsh',
  'bat', 'ps1', 'ini', 'toml', 'html', 'css', 'scss', 'sass', 'less',
  'svg', 'dockerfile', 'gitignore'
]);

export function isTextFile(filename: string, mimeType: string): boolean {
  if (mimeType.startsWith('text/')) {
    return true;
  }
  if (
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/typescript' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/x-sh' ||
    mimeType === 'application/x-yaml'
  ) {
    return true;
  }

  const ext = getFileExtension(filename).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return parts.pop()?.toLowerCase() || '';
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
