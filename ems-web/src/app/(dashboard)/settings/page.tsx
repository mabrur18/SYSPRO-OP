'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [driveStatus, setDriveStatus] = useState<{
    status: 'checking' | 'connected' | 'disconnected' | 'error';
    email: string | null;
    message: string;
    rootFolderId: string | null;
    hasRootFolderId: boolean;
  }>({
    status: 'checking',
    email: null,
    message: 'Memeriksa koneksi Google Drive...',
    rootFolderId: null,
    hasRootFolderId: false,
  });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    void checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'super_admin') {
        router.push('/dashboard');
        return;
      }

      setIsSuperAdmin(true);
      await loadDriveStatus();
    } catch (error) {
      console.error('Error checking role:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadDriveStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/settings/drive-status');
      const result = await res.json();

      if (!res.ok) {
        setDriveStatus({
          status: 'error',
          email: null,
          message: result.error || 'Gagal memeriksa koneksi Google Drive.',
          rootFolderId: null,
          hasRootFolderId: false,
        });
        return;
      }

      setDriveStatus({
        status: result.status ?? 'disconnected',
        email: result.email ?? null,
        message: result.message ?? 'Status Google Drive tidak diketahui.',
        rootFolderId: result.rootFolderId ?? null,
        hasRootFolderId: !!result.hasRootFolderId,
      });
    } catch (error: any) {
      setDriveStatus({
        status: 'error',
        email: null,
        message: error.message || 'Terjadi kesalahan saat memeriksa Google Drive.',
        rootFolderId: null,
        hasRootFolderId: false,
      });
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integrasi Google Drive</h1>
        <p className="text-gray-600 mt-1">
          Integrasi sekarang memakai OAuth2 stored refresh token akun Google Optimum Production untuk web dan PWA.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Status Integrasi</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <span className="font-medium">Status:</span>{' '}
                {driveStatus.status === 'connected' ? 'Terhubung' :
                  driveStatus.status === 'checking' ? 'Memeriksa...' :
                  driveStatus.status === 'error' ? 'Error' : 'Belum terhubung'}
              </p>
              <p>
                <span className="font-medium">Akun Google:</span> {driveStatus.email || '-'}
              </p>
              <p>
                <span className="font-medium">Root Folder ID:</span> {driveStatus.rootFolderId || '-'}
              </p>
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                {driveStatus.message}
              </p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void loadDriveStatus()}
                disabled={statusLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {statusLoading ? 'Memeriksa...' : 'Refresh Status'}
              </button>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Tahapan Setup OAuth2</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>1. Buka <a href="https://console.cloud.google.com/" target="_blank" className="underline">Google Cloud Console</a></li>
              <li>2. Buat OAuth Client ID untuk aplikasi web dan aktifkan Google Drive API</li>
              <li>3. Aktifkan Google Drive API di Google Cloud Console</li>
              <li>4. Jalankan script `npm run google:oauth-setup` untuk mengambil refresh token akun Optimum Production</li>
              <li>5. Simpan `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, dan `GOOGLE_DRIVE_ROOT_FOLDER_ID` ke environment variable server</li>
              <li>6. Gunakan folder root di My Drive akun Optimum Production, misalnya folder `EMS Projects`</li>
              <li className="mt-2 pt-2 border-t border-blue-200">
                <strong>CATATAN PENTING:</strong> Credential Google sekarang tidak lagi disimpan di database aplikasi. Semua credential dibaca dari environment variable server.
              </li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-6">Checklist</h3>
            <div className="flex items-center space-x-3 mb-4">
              {driveStatus.status === 'checking' && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
              )}
              {driveStatus.status === 'connected' && (
                <div className="h-5 w-5 text-green-600">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {(driveStatus.status === 'disconnected' || driveStatus.status === 'error') && (
                <div className="h-5 w-5 text-red-600">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 101.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <span className="text-sm font-medium text-gray-900">
                {driveStatus.status === 'checking' ? 'Memeriksa koneksi...' :
                driveStatus.status === 'connected' ? 'Terhubung ke Google Drive' :
                driveStatus.status === 'error' ? 'Gagal terhubung' :
                'Belum terhubung'}
              </span>
            </div>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>{driveStatus.email ? 'OK' : 'Belum'} akun Google OAuth2 terhubung</li>
              <li>{driveStatus.hasRootFolderId ? 'OK' : 'Belum'} `GOOGLE_DRIVE_ROOT_FOLDER_ID` tersedia</li>
              <li>Jalankan script setup satu kali dari terminal lokal</li>
              <li>Restart server setelah mengubah `.env.local`</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
