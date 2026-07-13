import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabaseAdmin = createAdminClient();

  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, status')
      .eq('id', userData.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    if (profile.status !== 'active' || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName,
        role: body.role,
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: createError.status ?? 500 });
    }

    if (!createdUser.user) {
      return NextResponse.json({ error: 'User gagal dibuat' }, { status: 500 });
    }

    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: createdUser.user.id,
        email: body.email,
        full_name: body.fullName || body.email,
        role: body.role,
        status: 'active',
      });

    if (profileUpsertError) {
      return NextResponse.json({ error: profileUpsertError.message }, { status: 500 });
    }

    if (body.role !== 'staff') {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: body.role })
        .eq('id', createdUser.user.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ user: createdUser.user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan server' }, { status: 500 });
  }
}
