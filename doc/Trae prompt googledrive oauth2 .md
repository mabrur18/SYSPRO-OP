# TRAE PROMPT — Google Drive OAuth2 Integration (Personal My Drive)
**EMS – Event Monitoring System | Optimum Production**

> Dokumen ini adalah prompt tambahan/pelengkap dari `TRAE-PROMPT-EMS.md` dan `TRAE-PROMPT-Supabase-Auth-Setup.md`, khusus membahas **integrasi Google Drive menggunakan OAuth2 Stored Refresh Token** untuk akun Google personal (My Drive) milik Optimum Production. Gunakan dokumen ini menggantikan pendekatan Service Account yang hanya kompatibel dengan Google Workspace/Shared Drive.

---

## 0. Konteks & Alasan Perubahan Arsitektur

Akun Google milik Optimum Production adalah **akun personal (non-Workspace)**, sehingga:

- **Service Account tidak bisa mengakses "My Drive"** personal — Service Account hanya bekerja pada Google Workspace Shared Drive atau file yang di-share secara eksplisit ke email service account.
- Solusi yang tepat adalah **OAuth2 dengan Stored Refresh Token**: sistem melakukan otorisasi satu kali sebagai akun `optimumproduction@gmail.com`, menyimpan refresh token di server, lalu seluruh operasi upload/folder dilakukan atas nama akun tersebut secara permanen.
- **Tidak ada user lain (staff/admin) yang perlu mengotorisasi Google** — semua aktifitas Drive dilakukan oleh server menggunakan token akun Optimum Production.

### Perbandingan Arsitektur

| Aspek | Service Account ❌ | OAuth2 Stored Token ✅ |
|---|---|---|
| Kompatibel dengan My Drive personal | Tidak | **Ya** |
| Upload dilakukan sebagai | Email service account anonim | **Akun Optimum Production langsung** |
| User lain perlu otorisasi Google | Tidak | **Tidak** |
| Setup awal | Upload JSON key | Jalankan script one-time OAuth |
| Credential disimpan sebagai | JSON string di env var | 3 env var terpisah |
| Refresh token expired? | Tidak berlaku | Tidak expire jika app aktif dipakai |

### Alur Arsitektur Baru

```
[Staff/Admin]
     │
     │  upload foto via
     ▼
[EMS Mobile (Flutter)]
     │
     │  POST multipart/form-data ke
     ▼
[Next.js API Route: /api/upload-photo]   ← validasi Supabase Auth user
     │
     │  upload file menggunakan
     ▼
[Google Drive API via OAuth2 Client]     ← pakai refresh token akun Optimum Production
     │
     │  simpan ke
     ▼
[My Drive: optimumproduction@gmail.com]
     │
     │  return fileId + webViewLink
     ▼
[Supabase — tabel photos]                ← simpan metadata foto
```

**Poin penting:** Credential Google (client_id, client_secret, refresh_token) **hanya ada di server** (environment variable Next.js). Tidak pernah dikirim ke client web maupun mobile.

---

## 1. Setup Google Cloud Project & OAuth2 Credentials (Satu Kali)

### 1.1 Buat Project di Google Cloud Console

1. Buka [https://console.cloud.google.com](https://console.cloud.google.com)
2. Klik dropdown project di kiri atas → **"New Project"**
3. Isi nama project: `EMS-Optimum-Production` → Create
4. Pastikan project baru ini aktif/terpilih

### 1.2 Enable Google Drive API

1. Masuk ke **APIs & Services → Library**
2. Cari **"Google Drive API"** → klik → **Enable**

### 1.3 Konfigurasi OAuth Consent Screen

1. Masuk ke **APIs & Services → OAuth consent screen**
2. Pilih **External** → Create
3. Isi form:
   - App name: `EMS Optimum Production`
   - User support email: email akun Optimum Production
   - Developer contact: email yang sama
4. Klik **Save and Continue** sampai selesai (scopes dan test users bisa dilewati untuk sekarang)
5. Di bagian **Publishing status**: biarkan **Testing** dulu (cukup untuk penggunaan internal)

> Catatan: Karena app berstatus "Testing", refresh token tidak akan expire selama akun Optimum Production terdaftar sebagai test user. Tambahkan email `optimumproduction@gmail.com` di bagian **Test Users**.

### 1.4 Buat OAuth2 Client ID

1. Masuk ke **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
2. Application type: **Web application**
3. Name: `EMS Server Client`
4. Authorized redirect URIs: tidak perlu diisi (kita pakai mode `oob` di script terminal)
5. Klik **Create**
6. Catat `Client ID` dan `Client Secret` yang muncul

---

## 2. Setup One-Time Authorization (Mendapatkan Refresh Token)

Proses ini hanya dilakukan **satu kali** oleh developer/owner, di komputer lokal, untuk mendapatkan refresh token akun Optimum Production yang akan disimpan permanen di server.

### 2.1 Install Dependency

```bash
npm install googleapis
npm install -D tsx
```

### 2.2 Buat Script (`scripts/google-oauth-setup.ts`)

```typescript
import { google } from 'googleapis';
import * as readline from 'readline';

// Isi dengan credential dari Google Cloud Console
const CLIENT_ID = 'xxxx.apps.googleusercontent.com';
const CLIENT_SECRET = 'GOCSPX-xxxx';

// Mode OOB: otorisasi selesai di browser, kode ditampilkan di halaman Google,
// lalu di-paste manual ke terminal — tidak butuh redirect server
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Scope: akses penuh ke seluruh Google Drive akun Optimum Production
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // wajib agar Google menyertakan refresh_token
  prompt: 'consent',      // wajib agar refresh_token selalu disertakan meski sudah pernah auth
  scope: SCOPES,
});

console.log('\n======================================');
console.log('  GOOGLE DRIVE OAUTH2 — SETUP AWAL  ');
console.log('======================================\n');
console.log('Langkah 1: Buka URL berikut di browser.');
console.log('           PASTIKAN login sebagai akun Optimum Production sebelum membuka URL ini.\n');
console.log(authUrl);
console.log('\nLangkah 2: Klik "Allow/Izinkan" pada halaman consent Google.');
console.log('Langkah 3: Google akan menampilkan kode otorisasi. Copy kode tersebut.');
console.log('Langkah 4: Paste kode di bawah ini lalu tekan Enter.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Masukkan kode otorisasi: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());

    if (!tokens.refresh_token) {
      console.error('\n[ERROR] Refresh token tidak ditemukan.');
      console.error('Kemungkinan penyebab: akun ini sudah pernah mengotorisasi app ini sebelumnya.');
      console.error('Solusi: Cabut akses app di https://myaccount.google.com/permissions lalu jalankan script ini lagi.\n');
      return;
    }

    console.log('\n======================================');
    console.log('  BERHASIL! Simpan 3 env var berikut  ');
    console.log('======================================\n');
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n[PENTING]');
    console.log('- Simpan nilai di atas ke .env.local (development) dan environment variable deployment (Vercel/VPS).');
    console.log('- Jangan commit file .env.local ke repository (pastikan ada di .gitignore).');
    console.log('- Refresh token ini tidak punya tanggal kadaluarsa, simpan baik-baik.\n');
  } catch (err) {
    console.error('\n[ERROR] Gagal menukar kode dengan token:', err);
  }
});
```

### 2.3 Jalankan Script

```bash
npx tsx scripts/google-oauth-setup.ts
```

Ikuti instruksi di terminal. Setelah selesai, script akan mencetak 3 baris environment variable yang siap disalin.

---

## 3. Struktur Environment Variables

Tambahkan ke `.env.local` (development) dan environment variable di platform deployment:

```env
# Google Drive OAuth2 — akun Optimum Production
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_REFRESH_TOKEN=1//xxxx-xxxx-xxxx-xxxx

# ID folder root di My Drive Optimum Production
# Buat folder bernama "EMS Projects" di My Drive, lalu ambil ID-nya dari URL:
# https://drive.google.com/drive/folders/{FOLDER_ID_ADA_DI_SINI}
GOOGLE_DRIVE_ROOT_FOLDER_ID=xxxx
```

### Cara mendapatkan `GOOGLE_DRIVE_ROOT_FOLDER_ID`:
1. Login ke [drive.google.com](https://drive.google.com) sebagai akun Optimum Production
2. Buat folder baru bernama **"EMS Projects"**
3. Buka folder tersebut → lihat URL browser: `https://drive.google.com/drive/folders/1aBcDeFgHiJkLmN...`
4. Salin bagian setelah `/folders/` — itulah ID folder root

---

## 4. Helper Module Google Drive (`lib/googleDrive.ts`)

Buat file ini di project Next.js. File ini **hanya boleh diimport dari server-side** (API routes, Server Components, Server Actions) — tidak pernah dari client component.

```typescript
import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Inisialisasi OAuth2 client menggunakan stored credentials akun Optimum Production.
 * Access token di-refresh otomatis oleh library googleapis saat expired (tiap 1 jam).
 */
function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: getOAuth2Client() });
}

/**
 * Membuat folder di Google Drive.
 * Dipakai saat: membuat folder project baru, membuat subfolder per item.
 */
export async function createFolder(
  name: string,
  parentFolderId: string
): Promise<string> {
  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  });

  return res.data.id!;
}

/**
 * Upload file (foto) ke folder tertentu di My Drive Optimum Production.
 * Return: fileId, webViewLink (untuk preview di dashboard), thumbnailLink.
 */
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  parentFolderId: string
): Promise<{
  fileId: string;
  webViewLink: string;
  thumbnailLink: string;
}> {
  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, webViewLink, thumbnailLink',
  });

  // Set permission "anyone with link can view"
  // Diperlukan agar thumbnail & preview bisa ditampilkan di dashboard tanpa login Google
  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  const fileId = res.data.id!;
  const webViewLink = res.data.webViewLink!;

  // Thumbnail dari Drive API kadang tidak langsung tersedia — fallback ke URL thumbnail manual
  const thumbnailLink =
    res.data.thumbnailLink ??
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;

  return { fileId, webViewLink, thumbnailLink };
}

/**
 * Menghapus file dari Drive.
 * Dipakai saat foto dihapus dari sistem EMS.
 */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

/**
 * Mendapatkan info file (nama, ukuran, link) dari Drive.
 * Dipakai untuk verifikasi atau re-fetch metadata.
 */
export async function getFileInfo(fileId: string) {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, size, webViewLink, thumbnailLink, createdTime',
  });
  return res.data;
}

/**
 * Test koneksi ke Google Drive dan verifikasi akun yang aktif.
 * Dipakai di halaman Setting dashboard untuk konfirmasi status integrasi.
 */
export async function testDriveConnection(): Promise<{
  status: 'connected' | 'disconnected';
  email: string | null;
  message: string;
}> {
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: getOAuth2Client() });
    const res = await oauth2.userinfo.get();
    return {
      status: 'connected',
      email: res.data.email ?? null,
      message: `Terhubung sebagai ${res.data.email}`,
    };
  } catch (err: any) {
    return {
      status: 'disconnected',
      email: null,
      message: err.message ?? 'Gagal terhubung ke Google Drive',
    };
  }
}
```

---

## 5. API Route Upload Foto (`app/api/upload-photo/route.ts`)

Endpoint ini dipanggil oleh **EMS Mobile (Flutter)** maupun **web dashboard** untuk mengupload foto ke Drive melalui server Next.js.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '@/lib/googleDrive';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  // 1. Validasi: hanya user yang sudah login (Supabase Auth) yang bisa upload
  const supabase = createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse form data
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const itemId = formData.get('item_id') as string | null;
  const caption = formData.get('caption') as string | null;

  if (!file || !itemId) {
    return NextResponse.json(
      { error: 'Field "file" dan "item_id" wajib diisi' },
      { status: 400 }
    );
  }

  // 3. Ambil drive_folder_id item dari Supabase
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('id, name, drive_folder_id, project_id')
    .eq('id', itemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 });
  }

  if (!item.drive_folder_id) {
    return NextResponse.json(
      { error: 'Folder Drive untuk item ini belum dibuat. Hubungi admin.' },
      { status: 422 }
    );
  }

  // 4. Upload ke My Drive Optimum Production via OAuth2
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() ?? 'jpg';
    const fileName = `${timestamp}-${itemId.slice(0, 8)}.${ext}`;

    const { fileId, webViewLink, thumbnailLink } = await uploadFile(
      buffer,
      fileName,
      file.type || 'image/jpeg',
      item.drive_folder_id
    );

    // 5. Simpan metadata foto ke tabel photos di Supabase
    const { data: photo, error: insertError } = await supabase
      .from('photos')
      .insert({
        item_id: itemId,
        uploaded_by: user.id,
        drive_file_id: fileId,
        drive_file_url: webViewLink,
        thumbnail_url: thumbnailLink,
        caption: caption ?? null,
        status: 'pending_review',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, photo });

  } catch (err: any) {
    console.error('[upload-photo] Google Drive error:', err.message);
    return NextResponse.json(
      { error: 'Upload ke Google Drive gagal: ' + err.message },
      { status: 500 }
    );
  }
}
```

---

## 6. API Route Cek Status Koneksi Drive (`app/api/settings/drive-status/route.ts`)

Dipakai oleh halaman **Setting → Integrasi Google Drive** di web dashboard:

```typescript
import { NextResponse } from 'next/server';
import { testDriveConnection } from '@/lib/googleDrive';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  // Hanya super_admin yang boleh mengakses
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await testDriveConnection();
  return NextResponse.json(result);
}
```

---

## 7. Struktur Folder di My Drive Optimum Production

Sistem akan membuat dan mengelola struktur folder berikut secara otomatis:

```
My Drive (optimumproduction@gmail.com)
└── EMS Projects                          ← dibuat manual sekali, ID disimpan di env var
     ├── Nama Project A - {project_id}    ← dibuat otomatis saat project baru dibuat di dashboard
     │    ├── Backdrop Stage Utama        ← dibuat otomatis saat item dibuat/diimport
     │    │    ├── 1719123456-a1b2c3d4.jpg
     │    │    └── 1719123789-a1b2c3d4.jpg
     │    ├── Booth Sponsor A
     │    │    └── 1719124000-e5f6g7h8.jpg
     │    └── Lighting Set
     ├── Nama Project B - {project_id}
     │    └── ...
     └── ...
```

### Fungsi yang memicu pembuatan folder otomatis:

| Aksi di Dashboard | Fungsi Drive yang Dipanggil |
|---|---|
| Admin membuat project baru | `createFolder(namaProject, GOOGLE_DRIVE_ROOT_FOLDER_ID)` → simpan ID ke `projects.drive_folder_id` |
| Admin menambah item (manual/import) | `createFolder(namaItem, project.drive_folder_id)` → simpan ID ke `items.drive_folder_id` |
| Staff upload foto via mobile | `uploadFile(buffer, fileName, mimeType, item.drive_folder_id)` |

---

## 8. Integrasi di Flutter (Mobile) — Cara Memanggil API Upload

Di sisi mobile, tidak ada interaksi langsung dengan Google Drive API. Flutter cukup mengirim foto ke endpoint Next.js sebagai multipart form:

```dart
import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

Future<void> uploadPhoto({
  required String itemId,
  required XFile imageFile,
  String? caption,
}) async {
  // 1. Kompresi foto sebelum upload (target max ~1.5MB)
  final compressedBytes = await FlutterImageCompress.compressWithFile(
    imageFile.path,
    quality: 75,
    minWidth: 1280,
    minHeight: 720,
  );

  if (compressedBytes == null) throw Exception('Gagal mengompresi gambar');

  // 2. Kirim ke Next.js API route sebagai multipart form
  final dio = Dio();

  // Sertakan Supabase session token di header untuk autentikasi
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw Exception('Belum login');

  final formData = FormData.fromMap({
    'file': MultipartFile.fromBytes(
      compressedBytes,
      filename: '${DateTime.now().millisecondsSinceEpoch}.jpg',
      contentType: DioMediaType('image', 'jpeg'),
    ),
    'item_id': itemId,
    if (caption != null) 'caption': caption,
  });

  final response = await dio.post(
    'https://ems.optimum-production.com/api/upload-photo', // ganti dengan URL deployment
    data: formData,
    options: Options(
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
      },
      receiveTimeout: const Duration(seconds: 60),
      sendTimeout: const Duration(seconds: 60),
    ),
  );

  if (response.statusCode != 200) {
    throw Exception('Upload gagal: ${response.data['error']}');
  }
}
```

---

## 9. Hal yang Perlu Diperhatikan

### Kondisi Refresh Token Bisa Invalid
Refresh token yang sudah disimpan bisa menjadi tidak valid jika:

| Penyebab | Solusi |
|---|---|
| Password akun Optimum Production diganti | Jalankan ulang `scripts/google-oauth-setup.ts`, update env var |
| Akses app EMS dicabut manual di [myaccount.google.com/permissions](https://myaccount.google.com/permissions) | Sama seperti di atas |
| Lebih dari 50 refresh token aktif untuk 1 akun (jarang terjadi) | Cabut semua di pengaturan Google, lalu re-auth |
| App masih berstatus "Testing" & melewati batas waktu 7 hari sejak token terakhir digunakan | Pastikan OAuth consent screen dipublish ke "Production" atau pastikan akun Optimum Production terdaftar sebagai Test User |

### Rekomendasi OAuth Consent Status
Karena ini aplikasi internal (hanya dipakai oleh Optimum Production), tidak perlu proses verifikasi Google. Cukup:
- Biarkan status **Testing**
- Pastikan email `optimumproduction@gmail.com` didaftarkan sebagai **Test User** di OAuth consent screen
- Dengan ini refresh token tidak akan expired selama aplikasi aktif digunakan

### Keamanan Credential
- `GOOGLE_REFRESH_TOKEN` adalah credential setara password — jangan pernah expose di logs, response API, atau client-side code.
- Pastikan `.env.local` ada di `.gitignore`.
- Di Vercel, simpan sebagai **Environment Variable** (bukan di repository).

---

## 10. Instruksi untuk AI Agent (TRAE)

Saat mengimplementasikan integrasi Google Drive di project EMS, ikuti urutan berikut:

1. **Install dependency** di project Next.js: `npm install googleapis`
2. **Buat file** `lib/googleDrive.ts` sesuai kode di Section 4 — ini adalah satu-satunya file yang berinteraksi dengan Google Drive API.
3. **Buat API route** `app/api/upload-photo/route.ts` sesuai Section 5.
4. **Buat API route** `app/api/settings/drive-status/route.ts` sesuai Section 6.
5. **Pastikan** setiap fungsi yang memanggil `lib/googleDrive.ts` **hanya dipanggil dari server-side** (API routes, Server Components, Server Actions) — tidak pernah dari client component atau Flutter secara langsung.
6. **Untuk setup awal**, informasikan kepada saya bahwa file `scripts/google-oauth-setup.ts` sudah siap, lalu **tunggu konfirmasi** bahwa saya sudah menjalankan script tersebut dan menyimpan env var sebelum melanjutkan implementasi fitur yang bergantung pada Google Drive (create project folder, upload foto, dsb).
7. **Jangan hardcode** nilai `CLIENT_ID`, `CLIENT_SECRET`, atau `REFRESH_TOKEN` di dalam kode — selalu baca dari `process.env`.
8. Struktur folder di Drive dibuat **otomatis oleh sistem** setiap kali project atau item baru dibuat — implementasikan ini di API route create project dan create/import item.

---

## 11. Referensi Dokumen EMS Lainnya

| Dokumen | Isi |
|---|---|
| `PRD-EMS-Event-Monitoring-System.md` | PRD lengkap: latar belakang, fitur, schema, roadmap |
| `TRAE-PROMPT-EMS.md` | Prompt utama untuk memulai development di TRAE |
| `TRAE-PROMPT-Supabase-Auth-Setup.md` | Setup Supabase Auth, tabel profiles, trigger, dan bootstrap user pertama |
| `TRAE-PROMPT-GoogleDrive-OAuth2.md` | **Dokumen ini** — integrasi Google Drive via OAuth2 Stored Token |

---

*Dokumen ini melengkapi set referensi TRAE untuk project EMS Optimum Production. Gunakan bersama ketiga dokumen lainnya saat memulai atau melanjutkan sesi development di TRAE.*