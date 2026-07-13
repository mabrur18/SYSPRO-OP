import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { testDriveConnection, getGoogleDriveRootFolderId } from '@/lib/googleDrive';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await testDriveConnection();

  return NextResponse.json({
    ...result,
    rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? null,
    hasRootFolderId: !!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
    configuredRootFolderId: (() => {
      try {
        return getGoogleDriveRootFolderId();
      } catch {
        return null;
      }
    })(),
  });
}
