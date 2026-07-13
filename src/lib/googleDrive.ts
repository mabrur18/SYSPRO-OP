import { google } from 'googleapis';
import { Readable } from 'stream';

const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const DRIVE_SCOPE = ['https://www.googleapis.com/auth/drive'];

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    getRequiredEnv('GOOGLE_CLIENT_ID'),
    getRequiredEnv('GOOGLE_CLIENT_SECRET'),
    REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: getRequiredEnv('GOOGLE_REFRESH_TOKEN'),
  });

  return oauth2Client;
}

function getDriveClient() {
  return google.drive({
    version: 'v3',
    auth: getOAuth2Client(),
  });
}

export function getGoogleDriveRootFolderId() {
  return getRequiredEnv('GOOGLE_DRIVE_ROOT_FOLDER_ID');
}

export async function createFolder(name: string, parentFolderId: string): Promise<string> {
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

  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  const fileId = res.data.id!;
  const webViewLink = res.data.webViewLink!;
  const thumbnailLink =
    res.data.thumbnailLink ?? `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;

  return { fileId, webViewLink, thumbnailLink };
}

export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

export async function getFileInfo(fileId: string) {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, size, webViewLink, thumbnailLink, createdTime',
  });

  return res.data;
}

export async function testDriveConnection(): Promise<{
  status: 'connected' | 'disconnected';
  email: string | null;
  message: string;
}> {
  try {
    const auth = getOAuth2Client();
    await auth.getAccessToken();
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.about.get({
      fields: 'user(emailAddress,displayName)',
    });
    const email = res.data.user?.emailAddress ?? null;

    return {
      status: 'connected',
      email,
      message: email ? `Terhubung sebagai ${email}` : 'Terhubung ke Google Drive',
    };
  } catch (error: any) {
    return {
      status: 'disconnected',
      email: null,
      message: error?.message ?? 'Gagal terhubung ke Google Drive',
    };
  }
}

export const googleDriveScopes = DRIVE_SCOPE;
