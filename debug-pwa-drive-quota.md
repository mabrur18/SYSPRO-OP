# Debug Session: pwa-drive-quota
- **Status**: [OPEN]
- **Issue**: Upload foto dari PWA dengan akun admin gagal dengan error quota service account Google Drive
- **Debug Server**: Running on `http://127.0.0.1:7777`
- **Log File**: `.dbg/trae-debug-log-pwa-drive-quota.ndjson`

## Reproduction Steps
1. Login ke PWA dengan akun admin.
2. Buka item project lalu upload foto.
3. Amati error: service account tidak memiliki storage quota.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Upload diarahkan ke lokasi Drive biasa yang tidak kompatibel dengan service account | High | Low | Confirmed |
| B | `drive_root_folder_id` bukan folder Shared Drive | High | Low | Strongly supported |
| C | Service account belum diberi akses ke Shared Drive/folder target | High | Low | Pending user verification |
| D | Otorisasi aplikasi sudah benar, kegagalan murni terjadi saat `drive.files.create()` | High | Low | Confirmed |
| E | PWA admin mengirim request valid, tetapi konfigurasi settings Google Drive belum lengkap | Med | Low | Confirmed |

## Log Evidence
- Log `upload config resolved` menunjukkan service account email, private key, dan root folder ID semuanya terisi.
- Log `before drive create` menunjukkan endpoint sudah sampai ke tahap `drive.files.create()` dengan `parentFolderId=1WtzSeKWe3xP42vnl3620JY2Q9EHtE3Gb`.
- Log `upload failed` menunjukkan Google mengembalikan `403 storageQuotaExceeded` dengan pesan `Service Accounts do not have storage quota`.
- Ini menegaskan bahwa auth aplikasi berhasil, tetapi target Google Drive saat ini tidak sesuai untuk service account.
- Perbaikan kode yang diterapkan: validasi root folder sebagai folder Shared Drive, `supportsAllDrives: true`, dan pesan error settings yang lebih jelas.

## Verification Conclusion
- Root cause terkonfirmasi berada pada konfigurasi Google Drive/service account, bukan pada role admin aplikasi atau otorisasi PWA.
- Verifikasi akhir masih menunggu user mengubah root folder ke Shared Drive dan mencoba upload ulang.
