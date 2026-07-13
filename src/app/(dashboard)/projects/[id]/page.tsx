'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Project, Item } from '@/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState<'pdf' | 'pptx' | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const projectId = id;

  useEffect(() => {
    fetchProject();
    fetchItems();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      router.push('/projects');
    }
  };

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Yakin ingin menghapus item ini?')) return;

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Refresh items list
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Gagal menghapus item.');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      not_started: { color: 'bg-gray-100 text-gray-800', label: 'Belum Dimulai' },
      ongoing: { color: 'bg-yellow-100 text-yellow-800', label: 'Berlangsung' },
      completed: { color: 'bg-green-100 text-green-800', label: 'Selesai' },
    };
    const config = statusMap[status] || statusMap.not_started;
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleDownloadReport = async (format: 'pdf' | 'pptx') => {
    try {
      setDownloadingReport(format);
      const res = await fetch(`/api/generate-report/${format}?projectId=${projectId}`);

      if (!res.ok) {
        const result = await res.json().catch(() => ({ error: `Gagal mengunduh ${format.toUpperCase()}.` }));
        throw new Error(result.error || `Gagal mengunduh ${format.toUpperCase()}.`);
      }

      const blob = await res.blob();
      const fileName = `${project?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'project'}_report.${format}`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      console.error(`Error downloading ${format.toUpperCase()}:`, error);
      alert(error.message || `Gagal mengunduh ${format.toUpperCase()}.`);
    } finally {
      setDownloadingReport(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return <div>Project tidak ditemukan.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <button
            onClick={() => router.back()}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            ← Kembali
          </button>
        </div>
        <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.client_name && (
                <p className="text-gray-600 mt-1">{project.client_name}</p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href={`/projects/${projectId}/photos`}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700"
              >
                Monitoring Foto
              </Link>
              <button
                onClick={() => handleDownloadReport('pptx')}
                disabled={downloadingReport !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded hover:bg-orange-700"
              >
                {downloadingReport === 'pptx' ? 'Menyiapkan PPTX...' : 'Download PPTX'}
              </button>
              <button
                onClick={() => handleDownloadReport('pdf')}
                disabled={downloadingReport !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
              >
                {downloadingReport === 'pdf' ? 'Menyiapkan PDF...' : 'Download PDF'}
              </button>
              {getStatusBadge(project.status)}
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
                Edit Project
              </button>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Detail Project</h2>
            <div className="space-y-4">
              {project.location && (
                <div>
                  <span className="text-gray-500 text-sm">Lokasi</span>
                  <p>{project.location}</p>
                </div>
              )}
              {(project.start_date || project.end_date) && (
                <div>
                  <span className="text-gray-500 text-sm">Tanggal</span>
                  <p>
                    {project.start_date && new Date(project.start_date).toLocaleDateString('id-ID')}
                    {project.end_date && ` - ${new Date(project.end_date).toLocaleDateString('id-ID')}`}
                  </p>
                </div>
              )}
              {project.description && (
                <div>
                  <span className="text-gray-500 text-sm">Deskripsi</span>
                  <p>{project.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Items</h2>
            <div className="flex space-x-3">
              <Link
                href={`/projects/${projectId}/items/import`}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Import Excel/CSV
              </Link>
              <Link
                href={`/projects/${projectId}/items/new`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Tambah Item
              </Link>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada item untuk project ini.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-gray-500">{item.description}</p>
                      )}
                      {item.category && (
                        <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mt-1">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">
                        0/{item.required_photo_count} foto
                      </span>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
