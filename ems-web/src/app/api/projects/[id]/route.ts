import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ProjectStatus } from '@/types';

const allowedStatuses: ProjectStatus[] = ['not_started', 'ongoing', 'completed'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = body?.status as ProjectStatus | undefined;

    if (!id) {
      return NextResponse.json({ error: 'Project id tidak valid' }, { status: 400 });
    }

    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status project tidak valid' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
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

    if (profile.role !== 'super_admin' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Anda tidak memiliki izin mengubah status project' }, { status: 403 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan server' }, { status: 500 });
  }
}

