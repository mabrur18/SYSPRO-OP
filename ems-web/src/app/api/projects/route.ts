import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createFolder, getGoogleDriveRootFolderId } from '@/lib/googleDrive';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createServerSupabaseClient();
    const supabaseAdmin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create google drive folder for project
    let driveFolderId = null;
    try {
      driveFolderId = await createFolder(
        `${body.name} - ${new Date().toISOString().split('T')[0]}`,
        getGoogleDriveRootFolderId()
      );
    } catch (e) {
      console.log('Failed to create Google Drive folder, continuing without it', e);
    }

    // Insert to projects table
    const { data: project, error: insertError } = await supabaseAdmin
      .from('projects')
      .insert([
        {
          ...body,
          created_by: userId,
          drive_folder_id: driveFolderId,
        },
      ])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
