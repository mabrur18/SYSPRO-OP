'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function ImportItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const projectId = id;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setSuccess(false);
      parseExcel(selectedFile);
    }
  };

  const parseExcel = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        setPreviewData(jsonData);
      } catch (err) {
        setError('Gagal memparsing file. Pastikan formatnya benar.');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleImport = async () => {
    if (!previewData.length) return;

    setLoading(true);
    setError(null);

    try {
      const itemsToInsert = previewData.map((row, index) => ({
        project_id: projectId,
        name: row.name || row.Name || row['Nama Item'] || '',
        description: row.description || row.Description || row.Deskripsi || '',
        category: row.category || row.Category || row.Kategori || '',
        required_photo_count: row.required_photo_count || row.requiredPhotoCount || row['Jumlah Foto'] || 1,
        order_index: row.order_index || row.orderIndex || row.Urutan || index,
      }));

      // Validate
      const invalid = itemsToInsert.some(item => !item.name);
      if (invalid) {
        throw new Error('Beberapa baris tidak memiliki nama item.');
      }

      const res = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: itemsToInsert }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal mengimport item.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Gagal mengimport items.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.back()}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          ← Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Import Items</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          Items berhasil diimport! Redirecting...
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pilih File Excel/CSV
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        <div className="text-sm text-gray-500">
          <p className="font-medium mb-1">Format File:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Kolom: name (Nama Item), description (Deskripsi), category (Kategori), required_photo_count (Jumlah Foto), order_index (Urutan)</li>
            <li>Nama kolom bisa berupa huruf kecil atau besar</li>
          </ul>
        </div>

        {previewData.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Preview Data ({previewData.length} items)</h3>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewData[0]).map((key) => (
                      <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.slice(0, 10).map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((value, i) => (
                        <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">Menampilkan 10 dari {previewData.length} baris...</p>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Mengimport...' : 'Import Items'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
