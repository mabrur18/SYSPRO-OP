# TRAE PROMPT — EMS (Event Monitoring System)

> Gunakan dokumen ini sebagai prompt awal di TRAE untuk membangun project **EMS — Event Monitoring System** milik Optimum Production. Dokumen ini berisi konteks produk, spesifikasi teknis, dan instruksi pengembangan yang bisa langsung dijalankan/diikuti oleh AI coding agent.

---

## 0. Konteks Project

Saya ingin membangun sebuah sistem bernama **EMS (Event Monitoring System)** untuk perusahaan **Optimum Production**. Sistem ini terdiri dari **2 aplikasi terpisah** namun terintegrasi melalui database & storage yang sama:

1. **EMS Mobile** — Aplikasi Android (Flutter) untuk staff lapangan upload foto laporan event.
2. **EMS Web Dashboard** — Aplikasi web (Next.js + Tailwind) untuk admin & super admin mengelola project, monitoring, dan generate laporan.

**Backend & Database:** Supabase (PostgreSQL + Auth + Row Level Security)
**File Storage Foto:** Google Drive (akun milik Optimum Production), diakses via Google Drive API
**Tujuan utama:** Mendokumentasikan foto progres/hasil pekerjaan event sesuai item yang ditentukan dari dokumen quotation/kontrak, lalu memonitor dan menghasilkan laporan akhir (PDF/PPT).

Tolong bantu saya membangun project ini step by step, mulai dari setup struktur project, schema database, hingga implementasi fitur per fitur sesuai spesifikasi di bawah.

---

## 1. Tech Stack

### Mobile App
- Flutter (Dart), target Android min SDK 24
- State management: Riverpod
- HTTP client: Dio
- Auth & DB client: `supabase_flutter`
- Image: `image_picker`, `flutter_image_compress`
- Local cache: Hive

### Web Dashboard
- Next.js (App Router, latest stable)
- Tailwind CSS untuk styling
- Supabase JS client (`@supabase/supabase-js`, `@supabase/ssr`) untuk Auth & DB
- TanStack Query untuk data fetching/caching
- `googleapis` (Node.js Google APIs client) untuk integrasi Google Drive
- `pptxgenjs` untuk generate PowerPoint report
- `puppeteer` atau `@react-pdf/renderer` untuk generate PDF report
- `xlsx` (SheetJS) untuk import/export Excel, `papaparse` untuk CSV
- Email: Resend atau SendGrid untuk notifikasi custom (selain Supabase Auth email default)

### Database
- Supabase PostgreSQL dengan Row Level Security (RLS) aktif di semua tabel

---

## 2. Struktur Role & Akses

| Role | Akses |
|---|---|
| `super_admin` | Full access: user management, setting integrasi, semua project, generate report |
| `admin` | Kelola project & item miliknya, monitoring, generate report |
| `staff` | Login mobile, lihat project yang ditugaskan, upload foto per item |

Implementasikan RLS policy di Supabase agar:
- `staff` hanya bisa SELECT project & item yang ada di tabel `project_assignments` miliknya.
- `staff` hanya bisa INSERT ke tabel `photos` untuk item dalam project yang ditugaskan ke dia.
- `admin` hanya bisa CRUD project yang `created_by` = dirinya (kecuali super_admin yang bisa semua).

---

## 3. Database Schema (Supabase / PostgreSQL)

Buatkan migration SQL untuk tabel-tabel berikut:

```sql
-- users (extend dari auth.users via public.profiles)
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text not null,
  full_name text,
  role text check (role in ('super_admin','admin','staff')) not null default 'staff',
  status text check (status in ('active','inactive')) not null default 'active',
  created_at timestamptz default now()
);

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  location text,
  start_date date,
  end_date date,
  status text check (status in ('not_started','ongoing','completed')) default 'not_started',
  description text,
  drive_folder_id text,
  contract_file_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- project_assignments (many-to-many staff <-> project)
create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  unique(project_id, user_id)
);

-- items (item mandatory per project, dari quotation/kontrak)
create table public.items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  description text,
  category text,
  required_photo_count int default 1,
  drive_folder_id text,
  order_index int default 0,
  created_at timestamptz default now()
);

-- photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  drive_file_id text not null,
  drive_file_url text not null,
  thumbnail_url text,
  caption text,
  status text check (status in ('pending_review','verified','revision_requested')) default 'pending_review',
  uploaded_at timestamptz default now()
);

-- activity_logs
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  created_at timestamptz default now()
);
```

Tambahkan RLS policies sesuai aturan role di atas (gunakan `auth.uid()` untuk mapping ke `profiles.id`).

---

## 4. Spesifikasi Fitur — EMS Mobile (Flutter)

Bangun aplikasi Flutter dengan struktur folder berbasis feature (`features/auth`, `features/project_list`, `features/project_detail`, `features/photo_upload`).

### 4.1 Halaman Login
- Form email + password
- Login menggunakan `supabase_flutter` (`supabase.auth.signInWithPassword`)
- Setelah login sukses, cek `profiles.role` — hanya izinkan role `staff` atau `admin` masuk ke mobile, tolak jika `inactive`
- Sertakan flow "Lupa Password" (kirim reset link via Supabase)
- Simpan session menggunakan secure local storage

### 4.2 Halaman List Project
- Query project dari Supabase dengan filter: hanya project yang ada di `project_assignments` untuk user yang login
- Tampilkan: nama project, klien, lokasi, tanggal, status, progress bar (hitung dari jumlah `items` vs jumlah item yang sudah ada minimal 1 `photos` verified/pending)
- Implementasikan search bar & filter status
- Pull-to-refresh

### 4.3 Halaman Detail Project
- Tampilkan info project di header
- List semua `items` milik project tersebut (order by `order_index`)
- Setiap item baris menampilkan status (belum upload / sudah upload — dengan thumbnail / revisi diminta)
- Tap item → buka bottom sheet upload foto:
  - Ambil dari kamera (`image_picker`) atau galeri
  - Preview sebelum upload
  - Kompresi otomatis (`flutter_image_compress`, target max ~2MB)
  - Input caption opsional
  - Submit → upload file ke Google Drive (lihat section 6 — gunakan backend API route di Next.js sebagai proxy upload, JANGAN expose Service Account credentials di mobile app)
  - Setelah berhasil upload ke Drive, insert record ke tabel `photos` via Supabase client
  - Tampilkan progress indicator & retry mechanism jika gagal

> **Catatan arsitektur penting:** Karena kredensial Google Drive API (Service Account) sensitif, JANGAN simpan credential tersebut di aplikasi mobile. Buat **API route di Next.js** (misal `/api/upload-photo`) yang menerima file dari mobile (multipart/form-data) lalu melakukan upload ke Google Drive dari server, kemudian return `drive_file_id` & `drive_file_url` ke mobile untuk disimpan ke tabel `photos`.

---

## 5. Spesifikasi Fitur — EMS Web Dashboard (Next.js)

Struktur folder disarankan menggunakan App Router:
```
/app
  /(auth)/login
  /(dashboard)/dashboard
  /(dashboard)/projects
  /(dashboard)/projects/[id]
  /(dashboard)/projects/[id]/items
  /(dashboard)/users
  /(dashboard)/settings
  /api/upload-photo
  /api/google-drive
  /api/generate-report/pdf
  /api/generate-report/pptx
  /api/send-notification
```

### 5.1 Halaman Login
- Form email + password via Supabase Auth
- Redirect berdasarkan role: `super_admin`/`admin` → `/dashboard`, blokir `staff` dari akses penuh dashboard (atau beri view read-only sesuai kebutuhan)

### 5.2 Dashboard (Beranda)
- Card ringkasan: total project (per status), total user aktif
- Chart progress upload foto per project (gunakan `recharts` atau `chart.js`)
- Tabel aktivitas terbaru dari `activity_logs`

### 5.3 Manajemen Project
- List project dengan table (search, filter status, pagination)
- Form tambah/edit project:
  - Saat create project baru → panggil Google Drive API untuk membuat folder baru di dalam folder root `EMS Projects`, simpan `drive_folder_id` ke tabel `projects`
  - Upload dokumen quotation/kontrak (opsional) → simpan juga ke Drive
  - Assign staff ke project (multi-select dari tabel `profiles` role staff) → insert ke `project_assignments`
- Halaman detail project: lihat semua item, status upload foto tiap item, tombol generate report, tombol tandai selesai

### 5.4 Manajemen Item Mandatory
- Form tambah item manual (nama, deskripsi, kategori, jumlah foto wajib)
- Fitur import Excel/CSV:
  - Sediakan template download (kolom: `name, description, category, required_photo_count`)
  - Parse file menggunakan `xlsx`/`papaparse`
  - Tampilkan preview data sebelum konfirmasi simpan ke database
  - Saat item dibuat, otomatis buat subfolder di Google Drive di dalam folder project

### 5.5 Monitoring Foto
- Grid/list semua foto per project, filter by item/staff/tanggal/status
- Tombol "Minta Revisi" → update `photos.status` jadi `revision_requested` + trigger notifikasi (email/in-app) ke staff terkait
- Tombol "Verifikasi" → update status jadi `verified`

### 5.6 Generate Report
- Endpoint `/api/generate-report/pdf`:
  - Ambil semua `items` + `photos` (status verified atau semua, sesuai pilihan user) dari project tertentu
  - Render layout HTML (nama item, foto, caption, uploader, tanggal) → convert ke PDF (puppeteer/`@react-pdf/renderer`)
- Endpoint `/api/generate-report/pptx`:
  - Generate slide per item menggunakan `pptxgenjs`, sertakan cover slide info project & logo Optimum Production
- Hasil report bisa didownload langsung dan/atau diupload kembali ke folder project di Drive

### 5.7 Manajemen User (Super Admin only)
- List user + role + status
- Form tambah user baru:
  - Create user via Supabase Admin API (`supabase.auth.admin.createUser`)
  - Insert row ke `profiles`
  - Trigger email notifikasi (Resend/SendGrid) berisi info akun & link set password
- Edit role, nonaktifkan/aktifkan user, assign ke project

### 5.8 Setting Integrasi (Super Admin only)
- Form konfigurasi Google Drive: input Service Account JSON / OAuth client credentials, pilih folder root, tombol "Test Koneksi"
- Status koneksi Supabase (read-only info, karena env var sudah terhubung di level deployment)
- Setting provider email (API key Resend/SendGrid)

---

## 6. Integrasi Google Drive API

- Gunakan **Service Account** Google Cloud dengan domain-wide delegation atau shared drive folder yang di-share ke service account email, supaya semua file tersimpan di akun Google Drive milik Optimum Production.
- Buat helper module di server (`/lib/googleDrive.ts`) dengan fungsi:
  - `createFolder(name, parentFolderId)`
  - `uploadFile(fileBuffer, fileName, mimeType, parentFolderId)`
  - `getFileUrl(fileId)` (generate shareable link / webViewLink)
- Semua endpoint yang berinteraksi dengan Google Drive berada di server-side (Next.js API routes), TIDAK pernah expose credential ke client (web maupun mobile).
- Mobile app memanggil endpoint `/api/upload-photo` (Next.js) sebagai proxy upload ke Drive.

---

## 7. Environment Variables yang Dibutuhkan

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Drive
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

# Email Provider
RESEND_API_KEY=   # atau SENDGRID_API_KEY=
EMAIL_FROM=noreply@optimum-production.com
```

---

## 8. Urutan Pengerjaan yang Disarankan untuk TRAE

Mohon bantu kerjakan secara bertahap dengan urutan berikut, dan tunggu konfirmasi saya di setiap akhir fase sebelum lanjut ke fase berikutnya:

1. **Setup awal:** Inisialisasi project Next.js (dengan Tailwind) dan project Flutter terpisah. Setup koneksi Supabase di kedua project.
2. **Database:** Buat migration SQL schema di atas + RLS policies, jalankan di Supabase.
3. **Auth:** Implementasi halaman login web & mobile, termasuk role-based redirect.
4. **Web — Core CRUD:** Manajemen project & item (manual + import Excel/CSV).
5. **Integrasi Google Drive:** Buat helper module & endpoint upload, test pembuatan folder otomatis.
6. **Mobile — Core Flow:** List project, detail project, upload foto (via proxy endpoint ke Drive).
7. **Monitoring Dashboard:** Halaman monitoring foto + fitur revisi/verifikasi.
8. **Generate Report:** Implementasi generate PDF & PPTX.
9. **User Management & Email Notifikasi:** Tambah user, kirim email otomatis.
10. **Setting Integrasi:** Halaman setting Google Drive & email provider di web.
11. **Testing & Polishing:** End-to-end testing seluruh flow, perbaikan UI/UX.

---

## 9. Catatan Tambahan untuk AI Agent (TRAE)

- Selalu validasi role di level **API/server**, jangan hanya mengandalkan validasi di sisi UI.
- Gunakan TypeScript di seluruh project Next.js untuk type-safety.
- Untuk Flutter, gunakan struktur clean architecture sederhana (data/domain/presentation) per feature agar mudah di-maintain.
- Pastikan semua kredensial sensitif (Google Service Account, Supabase service role key) hanya digunakan di server-side, tidak pernah dikirim ke client.
- Gunakan komponen UI Tailwind yang konsisten (buat design system dasar: button, input, card, modal, table) sebelum membangun halaman-halaman kompleks.
- Untuk Flutter, prioritaskan UX yang ringan dan cepat karena akan digunakan staff lapangan dengan kondisi koneksi internet yang mungkin tidak stabil (sertakan offline-friendly draft & retry upload).

---

*Dokumen ini siap digunakan sebagai prompt pengembangan di TRAE. Silakan mulai dari Fase 1 sesuai urutan pengerjaan di atas.*
