
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { uploadFile } from '@/lib/googleDrive';

async function debugReport(hypothesisId: string, msg: string, data: Record<string, unknown>) {
  // #region debug-point pwa-drive-quota
  await fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'pwa-drive-quota',
      runId: 'pre-fix',
      hypothesisId,
      location: 'src/app/api/upload-photo/route.ts',
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => null);
  // #endregion
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const itemId = formData.get('itemId') as string;
    const projectId = formData.get('projectId') as string;
    const caption = formData.get('caption') as string;

    if (!file || !itemId || !projectId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .select('id, project_id')
      .eq('id', itemId)
      .eq('project_id', projectId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item tidak valid' }, { status: 404 });
    }

    if (profile.role === 'staff') {
      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from('project_assignments')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (assignmentError || !assignment) {
        return NextResponse.json({ error: 'Anda tidak memiliki akses ke project ini' }, { status: 403 });
      }
    }

    const { data: itemDetail, error: itemDetailError } = await supabaseAdmin
      .from('items')
      .select('id, name, drive_folder_id')
      .eq('id', itemId)
      .single();

    if (itemDetailError || !itemDetail) {
      return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 });
    }

    await debugReport('E', '[DEBUG] upload config resolved', {
      hasItemDriveFolderId: !!itemDetail.drive_folder_id,
      role: profile.role,
      userId: user.id,
      projectId,
      itemId,
    });

    if (!itemDetail.drive_folder_id) {
      return NextResponse.json({
        error: 'Folder Google Drive untuk item ini belum dibuat. Perbarui konfigurasi OAuth2 lalu buat ulang item atau siapkan folder item terlebih dahulu.',
      }, { status: 422 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await debugReport('D', '[DEBUG] before drive create', {
      parentFolderId: itemDetail.drive_folder_id,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    });

    const timestamp = Date.now();
    const ext = file.name.split('.').pop() ?? 'jpg';
    const safeFileName = `${timestamp}-${itemId.slice(0, 8)}.${ext}`;
    const uploadResult = await uploadFile(
      buffer,
      safeFileName,
      file.type || 'image/jpeg',
      itemDetail.drive_folder_id
    );

    const { data: photo, error: photoError } = await supabaseAdmin
      .from('photos')
      .insert({
        item_id: itemId,
        uploaded_by: user.id,
        drive_file_id: uploadResult.fileId,
        drive_file_url: uploadResult.webViewLink,
        thumbnail_url: uploadResult.thumbnailLink,
        caption: caption || null,
        status: 'pending_review',
      })
      .select()
      .single();

    if (photoError) throw photoError;

    return NextResponse.json({ success: true, photo });
  } catch (error: any) {
    await debugReport('A', '[DEBUG] upload failed', {
      message: error?.message ?? null,
      code: error?.code ?? null,
      status: error?.status ?? null,
      errors: error?.errors ?? null,
      responseData: error?.response?.data ?? null,
    });
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
