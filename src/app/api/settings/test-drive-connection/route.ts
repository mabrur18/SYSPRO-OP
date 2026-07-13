import { NextRequest, NextResponse } from 'next/server';
import { testDriveConnection } from '@/lib/googleDrive';

export async function POST(request: NextRequest) {
  try {
    await request.json().catch(() => null);
    const result = await testDriveConnection();
    return NextResponse.json({
      success: result.status === 'connected',
      message: result.message,
      email: result.email,
      rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to connect to Google Drive', details: error.stack }, { status: 500 });
  }
}
