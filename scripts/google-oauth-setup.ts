import { createServer } from 'http';
import { AddressInfo } from 'net';
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID_FOR_SETUP ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET_FOR_SETUP ?? '';
const CALLBACK_HOST = '127.0.0.1';
const CALLBACK_PORT = 53682;
const REDIRECT_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('GOOGLE_CLIENT_ID_FOR_SETUP dan GOOGLE_CLIENT_SECRET_FOR_SETUP wajib diisi sebelum menjalankan script ini.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function waitForAuthorizationCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const requestUrl = new URL(req.url || '/', REDIRECT_URI);

      if (requestUrl.pathname !== '/oauth2callback') {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }

      const error = requestUrl.searchParams.get('error');
      const code = requestUrl.searchParams.get('code');

      if (error) {
        res.statusCode = 400;
        res.end(`OAuth error: ${error}`);
        server.close();
        reject(new Error(`Google OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.statusCode = 400;
        res.end('Authorization code tidak ditemukan.');
        server.close();
        reject(new Error('Authorization code tidak ditemukan.'));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 24px;">
            <h2>OAuth berhasil</h2>
            <p>Kembali ke terminal TRAE. Anda boleh menutup halaman ini.</p>
          </body>
        </html>
      `);

      server.close();
      resolve(code);
    });

    server.on('error', reject);

    server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
      const address = server.address() as AddressInfo;
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
      });

      console.log('\n======================================');
      console.log('  GOOGLE DRIVE OAUTH2 - SETUP AWAL  ');
      console.log('======================================\n');
      console.log('Tambahkan redirect URI berikut ke Google Cloud Console terlebih dahulu:');
      console.log(`${REDIRECT_URI}\n`);
      console.log(`Callback server aktif di ${address.address}:${address.port}`);
      console.log('Buka URL berikut di browser dan login sebagai akun Google Optimum Production:\n');
      console.log(authUrl);
      console.log('\nSetelah klik "Allow/Izinkan", Google akan redirect ke localhost dan script akan menangkap kode otomatis.\n');
    });
  });
}

async function main() {
  try {
    const code = await waitForAuthorizationCode();
    const { tokens } = await oauth2Client.getToken(code.trim());

    if (!tokens.refresh_token) {
      console.error('\n[ERROR] Refresh token tidak ditemukan.');
      console.error('Cabut akses app di https://myaccount.google.com/permissions lalu jalankan script ini lagi.\n');
      return;
    }

    console.log('\n======================================');
    console.log('  BERHASIL! Simpan env var berikut   ');
    console.log('======================================\n');
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n[PENTING]');
    console.log('- Salin nilai di atas ke .env.local atau environment variable server.');
    console.log('- Jangan commit secret ke repository.');
    console.log('- Isi GOOGLE_DRIVE_ROOT_FOLDER_ID dengan folder root My Drive Optimum Production.\n');
  } catch (error) {
    console.error('\n[ERROR] Gagal setup OAuth2:', error);
    process.exit(1);
  }
}

void main();
