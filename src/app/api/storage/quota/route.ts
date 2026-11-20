import { NextResponse } from 'next/server';
import { getDriveStorageQuota } from '@/lib/google-drive';

export async function GET(request: Request) {
  try {
    void request.url;
    const quota = await getDriveStorageQuota();
    return NextResponse.json(quota);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    console.error('Storage quota error:', error);
    return NextResponse.json({ error: 'Failed to retrieve storage quota' }, { status: 500 });
  }
}
