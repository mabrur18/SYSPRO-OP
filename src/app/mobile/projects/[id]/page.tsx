
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Project, Item } from '@/types';

export default function MobileProjectDetailPage() {
  const params = useParams();
  const { id } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      setProject(projectData);

      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('project_id', id)
        .order('order_index', { ascending: true });
      setItems(itemsData || []);
      setLoading(false);
    };

    if (id) {
      fetchData();
    }
  }, [id, supabase]);

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
          <h1 className="text-xl font-bold text-gray-900">{project?.name}</h1>
          {project?.client_name && (
            <p className="text-gray-600 text-sm">{project.client_name}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Link 
            key={item.id} 
            href={`/mobile/projects/${id}/items/${item.id}`}
          >
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  {item.description && (
                    <p className="text-gray-600 text-sm mt-1">{item.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500">
                    Foto: {item.required_photo_count}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
