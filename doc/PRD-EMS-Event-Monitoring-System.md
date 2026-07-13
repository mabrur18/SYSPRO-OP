# PRD — EMS (Event Monitoring System)
**Optimum Production**

| | |
|---|---|
| **Dokumen** | Product Requirements Document (PRD) |
| **Produk** | EMS – Event Monitoring System |
| **Owner** | Optimum Production |
| **Versi** | 1.0 |
| **Tanggal** | 27 Juni 2026 |
| **Status** | Draft – Ready for Development |

---

## 1. Latar Belakang & Tujuan

Optimum Production menangani banyak project event (dekorasi, produksi, build-up venue, dsb) yang membutuhkan dokumentasi foto progres/hasil pekerjaan di lapangan untuk setiap item yang sudah disepakati dalam **dokumen quotation** atau **kontrak project**. Saat ini proses dokumentasi dan pelaporan foto masih manual, sehingga menyulitkan tim untuk:

- Memantau progres dokumentasi foto secara real-time per item pekerjaan.
- Memastikan semua item dalam kontrak/quotation sudah terdokumentasi dengan foto yang sesuai.
- Menyusun laporan akhir (PDF/PPT) project secara cepat dan rapi.
- Mengelola akses tim lapangan (staff) vs tim kantor (admin/super admin).

**EMS (Event Monitoring System)** dibangun untuk menjawab kebutuhan ini melalui dua aplikasi yang terintegrasi:

1. **EMS Mobile (Android – Flutter)** — digunakan oleh staff/tim lapangan untuk upload foto laporan event sesuai item yang sudah ditentukan.
2. **EMS Web Dashboard (Next.js)** — digunakan oleh admin & super admin untuk mengelola project, item mandatory, memonitor upload foto, dan generate laporan.

Seluruh foto disimpan di **Google Drive milik akun Optimum Production**, dan data aplikasi (user, project, item, log) disimpan di **Supabase (PostgreSQL)**.

---

## 2. Tujuan Produk (Goals)

1. Memastikan seluruh item pekerjaan dalam suatu project event terdokumentasi dengan foto yang valid.
2. Mempercepat proses monitoring lapangan oleh tim kantor secara real-time.
3. Menyediakan satu sumber data (single source of truth) untuk seluruh dokumentasi foto event, tersimpan rapi di Google Drive perusahaan.
4. Mengotomasi pembuatan laporan akhir project (foto + keterangan) dalam format PDF atau PowerPoint.
5. Menerapkan kontrol akses berjenjang (Super Admin, Admin, Staff) sesuai tanggung jawab masing-masing peran.

### Non-Goals (di luar scope versi 1.0)
- Tidak menangani modul keuangan/invoicing project.
- Tidak menangani aplikasi iOS (fokus Android dahulu).
- Tidak menangani approval workflow multi-level untuk foto (cukup status uploaded/verified).

---

## 3. Target Pengguna & Role

| Role | Platform | Deskripsi |
|---|---|---|
| **Super Admin** | Web | Akses penuh: kelola user, role, semua project, semua setting integrasi (Google Drive, Supabase), generate report semua project. |
| **Admin** | Web | Kelola project (CRUD), kelola item mandatory per project, monitor upload foto, generate report project yang menjadi tanggung jawabnya. |
| **Staff** | Web (view terbatas) & Mobile (utama) | Login di aplikasi Android, melihat list project yang ditugaskan, upload foto per item di project tersebut. |

---

## 4. Ringkasan Solusi

```
┌─────────────────────┐        ┌─────────────────────┐
│   EMS Mobile (Flutter)│        │  EMS Web Dashboard    │
│   - Login            │        │  (Next.js + Tailwind) │
│   - List Project      │◄──────┤  - Login              │
│   - Detail Project    │  API  │  - Dashboard Monitor   │
│   - Upload Foto/Item  │       │  - Kelola Project/Item │
└──────────┬───────────┘        │  - Generate Report     │
           │                    │  - Role Management     │
           │ Upload foto        │  - Setting Integrasi   │
           ▼                    └──────────┬─────────────┘
   ┌─────────────────┐                     │
   │  Google Drive     │◄────────────────────┘
   │  (Optimum Prod.)   │   (referensi link foto disimpan di Supabase)
   └─────────────────┘
           ▲
           │
   ┌─────────────────┐
   │    Supabase       │  (Auth, Database, Storage metadata)
   └─────────────────┘
```

---

## 5. Modul 1 — EMS Mobile App (Android, Flutter)

### 5.1 Deskripsi Umum
Aplikasi Android yang digunakan oleh staff lapangan untuk mendokumentasikan progres/hasil pekerjaan event melalui foto, sesuai item yang telah ditentukan dari dokumen quotation/kontrak project. Aplikasi **hanya dapat diakses oleh user terdaftar** (tidak ada fitur registrasi mandiri/self sign-up di mobile).

### 5.2 Tech Stack
- **Framework:** Flutter (Dart) — target Android (minimum SDK 24 / Android 7.0+)
- **State Management:** Riverpod atau Bloc (disarankan Riverpod untuk kecepatan development)
- **Auth:** Supabase Auth (email + password)
- **Backend/API:** Supabase (PostgreSQL + REST/RPC) sebagai data layer; Google Drive API untuk upload file foto
- **Local Storage:** Hive/SharedPreferences untuk cache session & draft upload offline
- **HTTP Client:** Dio
- **Image Handling:** image_picker, image_cropper (opsional crop), flutter_image_compress (kompresi sebelum upload)

### 5.3 User Flow & Halaman

#### A. Halaman Login
- Input: Email, Password
- Autentikasi via **Supabase Auth**
- Validasi: hanya user dengan status `active` dan role `staff`/`admin` yang bisa login dari mobile
- Pesan error jelas: "Akun tidak ditemukan", "Password salah", "Akun belum diaktifkan"
- Opsi "Lupa Password" → trigger reset password via email (Supabase Auth reset flow)
- Tidak ada tombol "Daftar/Register" — user dibuat oleh Admin/Super Admin dari web dashboard

#### B. Halaman List Project
- Menampilkan daftar project yang **ditugaskan ke user yang login** (assigned projects)
- Setiap card project menampilkan:
  - Nama project
  - Klien
  - Lokasi event
  - Tanggal event
  - Status project (Belum Dimulai / Berjalan / Selesai)
  - Progress bar (jumlah item terupload / total item mandatory)
- Fitur:
  - Search project by nama
  - Filter by status
  - Pull to refresh
  - Badge notifikasi jika ada item yang belum diupload mendekati deadline

#### C. Halaman Detail Project
- Header: info project (nama, klien, lokasi, tanggal, deskripsi singkat)
- List item mandatory (diambil dari quotation/kontrak yang sudah diinput admin), masing-masing menampilkan:
  - Nama item (contoh: "Backdrop Stage Utama", "Booth Sponsor A", "Lighting Set", dsb)
  - Status: Belum Upload / Sudah Upload (dengan thumbnail preview) / Revisi Diminta
  - Jumlah foto yang sudah diupload untuk item tersebut (jika multiple foto per item diizinkan)
- Tap pada item → membuka **Bottom Sheet/Halaman Upload Foto**:
  - Ambil foto langsung dari kamera atau pilih dari galeri
  - Preview foto sebelum upload
  - Kompresi otomatis sebelum upload (agar hemat kuota & cepat)
  - Kolom catatan/keterangan (opsional) per foto
  - Tombol "Upload" → foto dikirim ke Google Drive (folder sesuai struktur project/item), metadata (link Drive, timestamp, uploader, item_id) disimpan ke Supabase
  - Progress indicator saat upload, retry otomatis jika koneksi gagal
  - Mendukung **multi-foto per item** jika dikonfigurasi demikian oleh admin

#### D. Halaman Profil (tambahan minor)
- Info user, project yang ditugaskan, tombol logout

### 5.4 Struktur Penyimpanan Google Drive
```
[Drive Optimum Production]
 └── EMS Projects
      └── {Nama Project} - {ID Project}
           └── {Nama Item 1}
                ├── foto1.jpg
                ├── foto2.jpg
           └── {Nama Item 2}
                ├── foto1.jpg
```
- Folder dibuat otomatis oleh sistem (via Google Drive API) saat project & item dibuat dari web dashboard.
- Permission folder: shared dengan service account / akun Optimum Production, akses read-only link bisa digenerate untuk kebutuhan report.

### 5.5 Functional Requirements (Mobile)

| ID | Requirement |
|---|---|
| FR-M01 | User hanya bisa login dengan akun yang sudah didaftarkan oleh Admin/Super Admin |
| FR-M02 | User hanya melihat project yang ditugaskan kepadanya (assigned) |
| FR-M03 | User dapat melihat seluruh item mandatory dalam project beserta status uploadnya |
| FR-M04 | User dapat mengupload satu atau lebih foto per item |
| FR-M05 | Foto yang diupload otomatis tersimpan ke folder Google Drive sesuai struktur project/item |
| FR-M06 | Sistem menyimpan metadata foto (link drive, waktu upload, user, item) ke database Supabase |
| FR-M07 | User dapat melihat progress (%) penyelesaian upload foto per project |
| FR-M08 | Aplikasi mendukung mode upload ulang/replace jika admin meminta revisi foto |
| FR-M09 | Aplikasi melakukan kompresi gambar otomatis sebelum upload |
| FR-M10 | Aplikasi menampilkan notifikasi/badge jika ada item yang belum lengkap |

### 5.6 Non-Functional Requirements (Mobile)
- Upload foto maksimal retry 3x otomatis jika gagal karena koneksi.
- Ukuran foto dikompresi ke maksimal ±2MB per foto sebelum upload.
- UI responsif untuk berbagai ukuran layar Android (phone, minimal resolusi HD 720p).
- Waktu loading list project < 2 detik pada koneksi 4G normal.

---

## 6. Modul 2 — EMS Web Dashboard (Next.js + Tailwind + Supabase)

### 6.1 Deskripsi Umum
Web dashboard digunakan oleh Super Admin, Admin, dan Staff (akses terbatas) untuk mengelola project, item mandatory, memonitor hasil upload foto dari lapangan, serta menghasilkan laporan akhir.

### 6.2 Tech Stack
- **Framework:** Next.js (App Router, versi terbaru)
- **Styling:** Tailwind CSS
- **Auth & Database:** Supabase (Auth + PostgreSQL + Row Level Security)
- **File Storage Eksternal:** Google Drive API (OAuth2 / Service Account)
- **State/Data Fetching:** TanStack Query (React Query) + Supabase JS Client
- **Report Generation:**
  - PDF: `pdf-lib` atau `puppeteer` (render HTML ke PDF) di server-side (API Route/Edge Function)
  - PowerPoint: `pptxgenjs`
- **Excel/CSV Import:** `xlsx` (SheetJS) atau `papaparse` untuk parsing CSV
- **Email Notifikasi:** Supabase Auth email hooks atau integrasi Resend/SendGrid untuk notifikasi custom
- **Hosting:** Vercel (disarankan, native untuk Next.js) atau VPS dengan Node.js runtime

### 6.3 Role & Permission Matrix

| Fitur | Super Admin | Admin | Staff (web, view terbatas) |
|---|---|---|---|
| Kelola User & Role | ✅ | ❌ | ❌ |
| Setting Integrasi (Google Drive, Supabase) | ✅ | ❌ | ❌ |
| Kelola semua Project | ✅ | ✅ (project miliknya) | ❌ |
| Input Project Baru | ✅ | ✅ | ❌ |
| Input Item Mandatory (manual/excel/csv) | ✅ | ✅ | ❌ |
| Monitoring Upload Foto | ✅ (semua project) | ✅ (project miliknya) | ✅ (project ditugaskan, read-only) |
| Generate Report (PDF/PPT) | ✅ | ✅ | ❌ |
| Approve/Reminder Revisi Foto | ✅ | ✅ | ❌ |

### 6.4 Halaman & Fitur Utama

#### A. Halaman Login
- Login dengan email & password (Supabase Auth)
- Redirect sesuai role setelah login
- Link "Lupa Password"

#### B. Email Notifikasi Register User Baru
- Saat Super Admin/Admin membuat user baru (staff/admin), sistem otomatis:
  - Membuat akun di Supabase Auth
  - Mengirim email notifikasi berisi: kredensial awal/link set password, info role, link download aplikasi mobile (jika role staff)
- Menggunakan Supabase Auth email template atau integrasi pihak ketiga (Resend/SendGrid) agar desain email lebih custom dan branded Optimum Production

#### C. Dashboard (Beranda)
- Ringkasan jumlah project aktif, selesai, belum dimulai
- Grafik progres upload foto per project (chart bar/donut)
- List aktivitas terbaru (upload foto terbaru oleh staff)
- Filter berdasarkan rentang tanggal & status project

#### D. Halaman Manajemen Project
- List semua project (table dengan search, filter status, sort)
- **Tambah Project Baru:**
  - Nama project, klien, lokasi, tanggal mulai-selesai, deskripsi
  - Upload dokumen quotation/kontrak (opsional, sebagai referensi/lampiran, disimpan di Drive juga)
  - Assign staff yang bertugas di project ini
  - Sistem otomatis membuat folder project di Google Drive
- **Edit/Hapus Project**
- **Detail Project:**
  - Info umum
  - List item mandatory beserta status upload (real-time monitoring)
  - Preview thumbnail tiap foto yang sudah diupload (klik untuk lihat ukuran penuh / buka di Drive)
  - Tombol "Generate Report"
  - Tombol "Tandai Selesai" (mengubah status project menjadi selesai)

#### E. Halaman Manajemen Item Mandatory
- Tambah item secara **manual** (form: nama item, deskripsi, jumlah foto wajib, kategori)
- Tambah item secara **bulk** via **upload Excel/CSV** dengan template yang disediakan (download template tersedia)
  - Validasi otomatis saat import (kolom wajib, duplikasi nama item, dsb)
  - Preview data sebelum konfirmasi simpan
- Edit/hapus item per project
- Reorder/urutan item (drag and drop, opsional nice-to-have)

#### F. Halaman Monitoring Foto
- Tampilan grid/list seluruh foto yang sudah diupload per project
- Filter berdasarkan item, staff pengupload, tanggal upload, status
- Fitur "Minta Revisi" pada foto tertentu (mengirim notifikasi ke staff terkait via mobile/email agar upload ulang)
- Fitur approve/verifikasi foto (status: Pending Review → Verified)

#### G. Generate Report
- Generate laporan foto project dalam format:
  - **PDF**: layout per item (nama item + foto + keterangan + metadata uploader/tanggal)
  - **PowerPoint (PPTX)**: 1 slide per item atau grouping sesuai kategori, dengan cover slide berisi info project
- Opsi kustomisasi sebelum generate: pilih item yang disertakan, sertakan/tidak sertakan keterangan/watermark logo Optimum Production
- File hasil generate dapat didownload langsung atau otomatis tersimpan juga ke folder project di Google Drive

#### H. Halaman Manajemen User & Role (khusus Super Admin)
- List user (nama, email, role, status aktif/nonaktif, project yang di-assign)
- Tambah user baru → trigger email notifikasi otomatis
- Edit role/reset password/nonaktifkan user
- Assign/unassign user ke project tertentu

#### I. Halaman Setting Integrasi (khusus Super Admin)
- **Google Drive API:**
  - Hubungkan akun Google Drive Optimum Production (OAuth2 flow atau Service Account JSON key)
  - Pilih/atur folder root tempat semua project disimpan
  - Test koneksi
- **Supabase:**
  - Konfigurasi koneksi project Supabase (URL & API Key) — umumnya sudah default dari environment, tapi disediakan halaman status koneksi & health check
- Setting email notifikasi (SMTP/API key provider email)

### 6.5 Functional Requirements (Web)

| ID | Requirement |
|---|---|
| FR-W01 | Sistem mendukung 3 role: Super Admin, Admin, Staff dengan permission berbeda |
| FR-W02 | Admin/Super Admin dapat membuat project baru beserta otomatisasi folder Google Drive |
| FR-W03 | Admin/Super Admin dapat input item mandatory secara manual maupun import Excel/CSV |
| FR-W04 | Sistem menampilkan dashboard monitoring real-time progress upload foto |
| FR-W05 | Sistem dapat generate laporan PDF dan PPTX berdasarkan foto yang sudah diupload |
| FR-W06 | Sistem mengirim email notifikasi otomatis saat user baru didaftarkan |
| FR-W07 | Super Admin dapat mengatur koneksi API Google Drive dan Supabase melalui halaman setting |
| FR-W08 | Sistem mendukung fitur minta revisi foto dan verifikasi/approve foto |
| FR-W09 | Seluruh halaman web menggunakan styling Tailwind CSS dan dibangun dengan Next.js |
| FR-W10 | Sistem menerapkan Row Level Security agar staff hanya bisa lihat data project yang ditugaskan |

### 6.6 Non-Functional Requirements (Web)
- Responsive design (desktop-first, tetap baik di tablet).
- Generate report PDF/PPTX untuk project dengan ±50 item & foto selesai dalam < 30 detik.
- Sistem harus aman: validasi role di setiap API route (tidak hanya di UI), gunakan Supabase RLS policies.
- Semua kredensial (Google Drive Service Account, Supabase keys) disimpan sebagai environment variables, tidak hardcode.

---

## 7. Skema Data (High-Level)

### Tabel Utama (Supabase/PostgreSQL)

**users**
`id, email, full_name, role (super_admin/admin/staff), status (active/inactive), created_at`

**projects**
`id, name, client_name, location, start_date, end_date, status (not_started/ongoing/completed), description, drive_folder_id, contract_file_url, created_by, created_at`

**project_assignments**
`id, project_id, user_id` (relasi many-to-many staff ↔ project)

**items**
`id, project_id, name, description, category, required_photo_count, drive_folder_id, order_index`

**photos**
`id, item_id, uploaded_by, drive_file_id, drive_file_url, thumbnail_url, caption, status (pending_review/verified/revision_requested), uploaded_at`

**activity_logs**
`id, user_id, action, target_type, target_id, created_at`

---

## 8. Integrasi Pihak Ketiga

| Integrasi | Fungsi |
|---|---|
| **Supabase** | Auth (login, reset password), Database (PostgreSQL), Row Level Security, Realtime (opsional untuk live monitoring) |
| **Google Drive API** | Storage seluruh foto laporan event, terorganisir per folder project/item |
| **Email Provider** (Resend/SendGrid/Supabase Email) | Notifikasi register user baru, notifikasi reset password, notifikasi permintaan revisi foto |

---

## 9. Roadmap Pengembangan (Saran Bertahap)

| Fase | Scope |
|---|---|
| **Fase 1 — Foundation** | Setup Supabase project (Auth + DB schema), setup Next.js project + Tailwind, setup koneksi Google Drive API, halaman login web & mobile |
| **Fase 2 — Core Web** | CRUD Project, CRUD Item (manual & import Excel/CSV), Role management, assign staff ke project |
| **Fase 3 — Core Mobile** | List project, detail project, upload foto ke Google Drive + simpan metadata |
| **Fase 4 — Monitoring & Report** | Dashboard monitoring, fitur revisi/verifikasi foto, generate report PDF & PPTX |
| **Fase 5 — Polishing** | Email notifikasi, setting integrasi di web, optimasi performa, testing end-to-end |

---

## 10. Kriteria Keberhasilan (Success Metrics)
- 100% item mandatory pada setiap project dapat terdokumentasi fotonya melalui aplikasi mobile.
- Waktu pembuatan laporan akhir project berkurang signifikan (dari manual menjadi otomatis < 1 menit generate).
- Tim kantor (admin/super admin) dapat memonitor progres dokumentasi lapangan secara real-time tanpa perlu menghubungi staff secara manual.

---

*Dokumen ini merupakan PRD versi awal (v1.0) dan dapat disesuaikan lebih lanjut sesuai hasil diskusi teknis dengan tim development.*
