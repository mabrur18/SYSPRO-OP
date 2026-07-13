import { NextRequest, NextResponse } from 'next/server';
import { testDriveConnection } from '@/lib/googleDrive';

export async function GET() {
  try {
    const driveStatus = await testDriveConnection();
    return NextResponse.json({
      success: true,
      settings: {
        google_client_id: process.env.GOOGLE_CLIENT_ID ? 'configured' : '',
        google_client_secret: process.env.GOOGLE_CLIENT_SECRET ? 'configured' : '',
        google_refresh_token: process.env.GOOGLE_REFRESH_TOKEN ? 'configured' : '',
        drive_root_folder_id: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '',
      },
      driveStatus,
    });
  } catch (error: any) {
    console.error('Error loading settings:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await request.json().catch(() => null);
    return NextResponse.json({
      success: false,
      message: 'Konfigurasi Google Drive sekarang dibaca dari environment variable server, bukan disimpan lewat database.',
    }, { status: 400 });
  } catch (error: any) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
