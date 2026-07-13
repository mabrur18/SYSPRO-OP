# TRAE PROMPT — Setup Supabase Auth & Bootstrap User Pertama (Super Admin)
**EMS – Event Monitoring System | Optimum Production**

> Dokumen ini adalah prompt tambahan/pelengkap dari `TRAE-PROMPT-EMS.md`, khusus membahas **koneksi Supabase Auth ke aplikasi** (web & mobile) dan **cara membuat user pertama (Super Admin)** sebelum halaman login/aplikasi berfungsi penuh. Gunakan dokumen ini saat tahap setup awal database & auth.

---

## 0. Tujuan

Karena sistem EMS **tidak memiliki fitur self-register** (semua user dibuat oleh Admin/Super Admin lewat dashboard), maka perlu ada mekanisme untuk membuat **user pertama** (calon Super Admin) secara manual sebelum aplikasi web/mobile bisa dipakai untuk login. Dokumen ini menjelaskan:

1. Cara koneksi Supabase Auth ke Next.js (web) dan Flutter (mobile).
2. Cara membuat tabel `profiles` + trigger otomatis agar setiap user baru di `auth.users` selalu punya data role.
3. Cara bootstrap user Super Admin pertama, tanpa perlu halaman login/register yang sudah jadi.

---

## 1. Koneksi Supabase Auth ke Web (Next.js)

### 1.1 Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...        # aman dipakai di client
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...            # RAHASIA, hanya dipakai di server/API routes
```

### 1.2 Setup Client (Client-side)
Buat file `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```
Dipakai di halaman login, form, dan komponen client lain untuk `signInWithPassword`, `signOut`, dsb.

### 1.3 Setup Client (Server-side, untuk Middleware & Server Components)
Buat file `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### 1.4 Setup Admin Client (khusus operasi privileged: create user, dsb)
Buat file `lib/supabase/admin.ts` — **hanya boleh diimport di file server/API route**, tidak pernah di komponen client:
```typescript
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

### 1.5 Middleware untuk Proteksi Route
Buat `middleware.ts` di root project untuk mengecek session di setiap request ke `/dashboard/*`, redirect ke `/login` jika belum login. Sertakan juga pengecekan role dari tabel `profiles` agar role `staff` tidak bisa mengakses halaman khusus admin.

---

## 2. Koneksi Supabase Auth ke Mobile (Flutter)

### 2.1 Dependency (`pubspec.yaml`)
```yaml
dependencies:
  supabase_flutter: ^2.0.0
```

### 2.2 Inisialisasi (`main.dart`)
```dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  await Supabase.initialize(
    url: 'https://xxxxx.supabase.co',
    anonKey: 'eyJhbGciOi...', // SAMA dengan NEXT_PUBLIC_SUPABASE_ANON_KEY di web
  );
  runApp(const MyApp());
}

final supabase = Supabase.instance.client;
```

> Catatan: mobile **hanya** memakai anon key (sama seperti client-side web), tidak pernah memakai service role key. Operasi privileged (create user, dsb) tetap lewat backend Next.js API route.

### 2.3 Login di Mobile
```dart
final response = await supabase.auth.signInWithPassword(
  email: emailController.text,
  password: passwordController.text,
);

final userId = response.user?.id;
final profile = await supabase
    .from('profiles')
    .select()
    .eq('id', userId)
    .single();

if (profile['status'] != 'active' || profile['role'] == 'super_admin') {
  // tolak akses dari mobile jika nonaktif, atau batasi super_admin hanya di web
}
```

---

## 3. Tabel `profiles` + Trigger Otomatis

Jalankan SQL berikut di **Supabase SQL Editor** (sekali saja, sebagai bagian dari migration awal):

```sql
-- 1. Tabel profiles (data tambahan di luar auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role text check (role in ('super_admin','admin','staff')) not null default 'staff',
  status text check (status in ('active','inactive')) not null default 'active',
  created_at timestamptz default now()
);

-- 2. Aktifkan Row Level Security
alter table public.profiles enable row level security;

-- 3. Policy: user boleh baca profile miliknya sendiri
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- 4. Policy: super_admin boleh baca & ubah semua profile
create policy "Super admin full access to profiles"
  on public.profiles for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );

-- 5. Function: otomatis insert ke profiles setiap kali ada user baru di auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'staff',      -- default role untuk user baru, diubah manual jika perlu
    'active'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 6. Trigger: jalankan function di atas setiap kali ada insert ke auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Penjelasan untuk AI Agent (TRAE):**
- Trigger ini membuat setiap user baru (dibuat lewat cara apapun: Dashboard, Admin API, atau aplikasi) otomatis punya row di `profiles` dengan role default `staff`.
- Role `super_admin` / `admin` ditentukan secara manual (oleh Super Admin lewat dashboard, atau manual SQL untuk user pertama).

---

## 4. Bootstrap User Pertama (Super Admin) — Tanpa Halaman Login

Karena belum ada Super Admin yang bisa membuat Super Admin lain lewat dashboard, lakukan **salah satu** dari 3 metode berikut untuk membuat user pertama:

### Metode A — Lewat Supabase Dashboard (paling cepat, direkomendasikan untuk setup awal)

**Langkah:**
1. Buka **Supabase Dashboard → Project Anda → Authentication → Users**
2. Klik **"Add User"** → isi:
   - Email: `superadmin@optimum-production.com`
   - Password: (buat password kuat sementara)
   - Centang **"Auto Confirm User"** agar tidak perlu verifikasi email
3. Klik **Create User** — Supabase otomatis membuat row di `auth.users`, dan trigger di Section 3 otomatis membuat row di `profiles` dengan role default `staff`.
4. Buka **SQL Editor**, jalankan query berikut untuk menjadikan user ini Super Admin:

```sql
update public.profiles
set role = 'super_admin'
where email = 'superadmin@optimum-production.com';
```

5. Selesai — user ini sekarang bisa login ke web dashboard EMS dan langsung mendapat akses Super Admin penuh, termasuk untuk membuat user-user lain selanjutnya lewat halaman Manajemen User.

---

### Metode B — Lewat Script Seed (Node.js), dijalankan manual sekali dari terminal

Gunakan ini jika ingin proses bootstrap lebih terdokumentasi/reproducible (misalnya untuk environment staging baru).

Buat file `scripts/seed-superadmin.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SUPERADMIN_EMAIL = 'superadmin@optimum-production.com';
const SUPERADMIN_PASSWORD = 'GantiDenganPasswordKuat123!';
const SUPERADMIN_NAME = 'Super Admin Optimum Production';

async function seed() {
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

  console.log('Super Admin berhasil dibuat dan diaktifkan:', SUPERADMIN_EMAIL);
}

seed();
```

**Cara menjalankan:**
```bash
npx tsx scripts/seed-superadmin.ts
```

**Catatan penting untuk AI Agent (TRAE):**
- Script ini memakai `SUPABASE_SERVICE_ROLE_KEY`, **jangan** pernah dijadikan API endpoint publik (`/api/...`) yang bisa diakses tanpa autentikasi — risiko keamanan besar karena siapapun bisa membuat Super Admin baru.
- Script ini hanya dijalankan **sekali**, manual dari terminal developer/server, bukan bagian dari runtime aplikasi production.
- Setelah dijalankan, sebaiknya hapus/comment kredensial password di atas dari source code, atau pindahkan ke environment variable terpisah yang tidak ikut di-commit.

---

### Metode C — Lewat SQL Editor Penuh (jika ingin satu langkah via SQL saja)

Supabase tidak mengizinkan insert langsung ke `auth.users` dengan password terenkripsi secara manual via SQL biasa (karena hashing password dikelola internal oleh GoTrue/Supabase Auth). Oleh karena itu, **Metode A atau B tetap diperlukan** untuk membuat user di `auth.users`. SQL Editor hanya dipakai untuk langkah lanjutan (update role), seperti pada Metode A langkah 4.

---

## 5. Ringkasan Keputusan

| Kebutuhan | Rekomendasi |
|---|---|
| Membuat tabel `profiles` + trigger otomatis | Wajib, jalankan sekali di awal (Section 3) — bagian dari migration |
| Membuat user Super Admin pertama (sekali saja, di awal project) | **Metode A** (Supabase Dashboard) — paling simpel, tidak perlu tulis script |
| Membuat user Super Admin pertama (jika butuh reproducible/staging environment) | **Metode B** (script seed Node.js) |
| Membuat user admin/staff selanjutnya (setelah Super Admin pertama ada) | **Tidak lagi manual** — gunakan halaman **Manajemen User** di web dashboard EMS yang memanggil `supabase.auth.admin.createUser()` di server-side API route, dilengkapi trigger email notifikasi otomatis |

---

## 6. Instruksi untuk AI Agent (TRAE)

Saat mengeksekusi setup project ini, mohon ikuti urutan berikut:

1. Jalankan SQL di **Section 3** (tabel `profiles`, RLS policy, function, trigger) sebagai bagian dari file migration pertama.
2. Setup file koneksi Supabase di Next.js (**Section 1.2 – 1.4**) dan Flutter (**Section 2**).
3. Setelah environment Supabase aktif dan migration berhasil dijalankan, informasikan kepada saya bahwa sistem **siap untuk bootstrap user pertama**, dan tunggu konfirmasi saya apakah ingin memakai Metode A (manual via Dashboard) atau Metode B (script seed) sebelum melanjutkan ke pengembangan halaman login.
4. Jangan pernah membuat endpoint publik yang memungkinkan pembuatan user dengan role `super_admin` tanpa autentikasi/otorisasi yang valid.

---

*Dokumen ini melengkapi `TRAE-PROMPT-EMS.md` dan `PRD-EMS-Event-Monitoring-System.md`. Gunakan ketiganya secara bersamaan saat memulai sesi development di TRAE.*
