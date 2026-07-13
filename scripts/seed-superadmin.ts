import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SUPERADMIN_EMAIL = 'superadmin@optimum-production.com';
const SUPERADMIN_PASSWORD = 'GantiDenganPasswordKuat123!';
const SUPERADMIN_NAME = 'Super Admin Optimum Production';

async function seed() {
  console.log('Membuat Super Admin pertama...');
  console.log('URL Supabase:', SUPABASE_URL);

  if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'your_supabase_service_role_key') {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY belum diatur di .env.local!');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Buat user di auth.users (langsung confirmed, tanpa verifikasi email)
  const { data, error } = await supabase.auth.admin.createUser({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: SUPERADMIN_NAME },
  });

  if (error) {
    console.error('Gagal membuat user:', error.message);
    return;
  }

  console.log('User berhasil dibuat:', data.user.id);

  // 2. Trigger handle_new_user otomatis sudah membuat row di profiles dengan role 'staff'
  //    Sekarang update role-nya menjadi 'super_admin'
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'super_admin', status: 'active' })
    .eq('id', data.user.id);

  if (updateError) {
    console.error('Gagal update role:', updateError.message);
    return;
  }

  console.log('========================================');
  console.log('✅ Super Admin berhasil dibuat dan diaktifkan!');
  console.log('Email:', SUPERADMIN_EMAIL);
  console.log('Password:', SUPERADMIN_PASSWORD);
  console.log('Silakan ganti password ini setelah login pertama!');
  console.log('========================================');
}

seed().catch(console.error);
