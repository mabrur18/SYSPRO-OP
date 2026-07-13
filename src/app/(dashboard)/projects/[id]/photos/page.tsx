'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Photo, Item } from '@/types';

export default function ProjectPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [photos, setPhotos] = useState<(Photo & { items?: Item; profiles?: { full_name: string; email: string } })[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const projectId = id;

  useEffect(() => {
    fetchData();
  }, [selectedItem, selectedStatus]);

  const fetchData = async () => {
    try {
      // Fetch items
      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('project_id', projectId);
      setItems(itemsData || []);

      // Fetch photos with filters
      let query = supabase
        .from('photos')
        .select('*, items(*), profiles(full_name, email)')
        .in('item_id', (itemsData || []).map(i => i.id))
        .order('uploaded_at', { ascending: false });

      if (selectedItem) {
        query = query.eq('item_id', selectedItem);
      }

      if (selectedStatus) {
        query = query.eq('status', selectedStatus);
      }

      const { data: photosData } = await query;
      setPhotos(photosData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (photoId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('photos')
        .update({ status: newStatus })
        .eq('id', photoId);

      if (error) throw error;

      // Refresh photos
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Gagal mengupdate status foto.');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      pending_review: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending Review' },
      verified: { color: 'bg-green-100 text-green-800', label: 'Verified' },
      revision_requested: { color: 'bg-red-100 text-red-800', label: 'Revision Requested' },
    };
    const config = statusMap[status] || statusMap.pending_review;
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-6">
        <Link href={`/projects/${projectId}`} className="mr-4 text-gray-600 hover:text-gray-900">
          ← Kembali ke Project
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Monitoring Foto</h1>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Item</label>
          <select
            value={selectedItem || ''}
            onChange={(e) => setSelectedItem(e.target.value || null)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500"
          >
            <option value="">Semua Item</option>
            {items.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Status</label>
          <select
            value={selectedStatus || ''}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500"
          >
            <option value="">Semua Status</option>
            <option value="pending_review">Pending Review</option>
            <option value="verified">Verified</option>
            <option value="revision_requested">Revision Requested</option>
          </select>
        </div>
      </div>

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">Belum ada foto yang diupload.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {photos.map((photo) => (
            <div key={photo.id} className="bg-white shadow rounded-lg overflow-hidden">
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                <a
                  href={photo.drive_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {photo.thumbnail_url ? (
                    <img
                      src={photo.thumbnail_url}
                      alt={photo.caption || 'Photo'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>Lihat Foto</span>
                  )}
                </a>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {photo.items?.name}
                  </span>
                  {getStatusBadge(photo.status)}
                </div>
                {photo.caption && (
                  <p className="text-sm text-gray-600 mb-3">{photo.caption}</p>
                )}
                <p className="text-xs text-gray-500 mb-3">
                  Uploaded by {photo.profiles?.full_name || photo.profiles?.email}
                </p>
                <div className="flex space-x-2">
                  {photo.status !== 'verified' && (
                    <button
                      onClick={() => handleUpdateStatus(photo.id, 'verified')}
                      className="flex-1 px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                    >
                      Verifikasi
                    </button>
                  )}
                  {photo.status !== 'revision_requested' && (
                    <button
                      onClick={() => handleUpdateStatus(photo.id, 'revision_requested')}
                      className="flex-1 px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                    >
                      Minta Revisi
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
