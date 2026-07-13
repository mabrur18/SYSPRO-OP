
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import type { Item, Project, Photo } from '@/types';

export default function MobileItemUploadPage() {
  const params = useParams();
  const { id: projectId, itemId } = params;
  const [item, setItem] = useState<Item | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      setProject(projectData);

      const { data: itemData } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();
      setItem(itemData);

      const { data: photosData } = await supabase
        .from('photos')
        .select('*')
        .eq('item_id', itemId)
        .order('uploaded_at', { ascending: false });
      setPhotos(photosData || []);
      
      setLoading(false);
    };

    if (projectId && itemId) {
      fetchData();
    }
  }, [projectId, itemId, supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('itemId', itemId as string);
      formData.append('projectId', projectId as string);
      formData.append('caption', caption);

      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({ error: 'Upload gagal.' }));
        throw new Error(result.error || 'Upload gagal.');
      }

      const { data: photosData } = await supabase
        .from('photos')
        .select('*')
        .eq('item_id', itemId)
        .order('uploaded_at', { ascending: false });
      setPhotos(photosData || []);
      setSelectedFile(null);
      setCaption('');
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Upload gagal.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center mb-6">
        <button onClick={() => router.back()} className="mr-4 p-2 text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{item?.name}</h1>
          <p className="text-gray-600 text-sm">{project?.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Upload Foto</h2>
        
        {selectedFile ? (
          <div className="mb-3">
            <img
              src={URL.createObjectURL(selectedFile)}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              onClick={() => setSelectedFile(null)}
              className="mt-2 text-sm text-red-600"
            >
              Hapus
            </button>
          </div>
        ) : (
          <label className="block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500">
              <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="mt-2 text-sm text-gray-600">Tap untuk memilih foto</p>
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}

        {selectedFile && (
          <>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caption (Opsional)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Tambahkan keterangan..."
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Foto'}
            </button>
          </>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Foto Sudah Diunggah</h3>
        {photos.length === 0 ? (
          <p className="text-gray-500 text-sm">Belum ada foto</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
                <a href={photo.drive_file_url} target="_blank" rel="noopener noreferrer">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    <span className="text-xs text-gray-400">Foto</span>
                  </div>
                </a>
                <div className="p-2">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                    photo.status === 'verified' ? 'bg-green-100 text-green-800' :
                    photo.status === 'revision_requested' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {photo.status === 'pending_review' ? 'Menunggu' :
                     photo.status === 'verified' ? 'Terverifikasi' : 'Revisi'}
                  </span>
                  {photo.caption && (
                    <p className="text-xs text-gray-600 mt-1">{photo.caption}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
