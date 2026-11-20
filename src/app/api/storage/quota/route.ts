import { NextResponse } from 'next/server';
import { getDriveStorageQuota } from '@/lib/google-drive';

export async function GET() {
  try {
    const quota = await getDriveStorageQuota();
    return NextResponse.json(quota);
  } catch (error: unknown) {
    console.error('Storage quota error:', error);
    return NextResponse.json({ error: 'Failed to retrieve storage quota' }, { status: 500 });
  }
}
