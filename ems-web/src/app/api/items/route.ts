import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createFolder } from '@/lib/googleDrive';

type ItemPayload = {
  project_id: string;
  name: string;
  description?: string;
  category?: string;
  required_photo_count?: number;
  order_index?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [body];

    if (!items.length) {
      return NextResponse.json({ error: 'Data item tidak boleh kosong.' }, { status: 400 });
    }

    const projectId = items[0]?.project_id;
    if (!projectId || items.some((item: any) => item.project_id !== projectId)) {
      return NextResponse.json({ error: 'Semua item harus memiliki project_id yang sama.' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const supabaseAdmin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.status !== 'active' || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, drive_folder_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });
    }

    const rowsToInsert = [] as ItemPayload[];

    for (const item of items) {
      let driveFolderId: string | null = null;

      if (project.drive_folder_id) {
        try {
          driveFolderId = await createFolder(item.name, project.drive_folder_id);
        } catch (error) {
          console.log('Failed to create Google Drive folder for item, continuing without it', error);
        }
      }

      rowsToInsert.push({
        project_id: projectId,
        name: item.name,
        description: item.description ?? '',
        category: item.category ?? '',
        required_photo_count: item.required_photo_count ?? 1,
        order_index: item.order_index ?? 0,
        drive_folder_id: driveFolderId,
      } as ItemPayload & { drive_folder_id: string | null });
    }

    const { data, error } = await supabaseAdmin
      .from('items')
      .insert(rowsToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, items: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat item.' }, { status: 500 });
  }
}
