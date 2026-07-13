
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Project, Profile } from '@/types';

export default function MobileHomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/mobile/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        router.push('/mobile/login');
        return;
      }

      setProfile(profileData);

      if (profileData.role === 'super_admin' || profileData.role === 'admin') {
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        setProjects(projectsData || []);
        setLoading(false);
        return;
      }

      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('project_id');

      if (assignments && assignments.length > 0) {
        const projectIds = assignments.map((assignment) => assignment.project_id);
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*')
          .in('id', projectIds)
          .order('created_at', { ascending: false });

        setProjects(projectsData || []);
      }

      setLoading(false);
    };

    init();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/mobile/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proyek Saya</h1>
          <p className="text-gray-600 text-sm mt-1">
            {profile?.full_name || profile?.email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Tidak ada proyek yang ditugaskan</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Link href={`/mobile/projects/${project.id}`} key={project.id}>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
                {project.client_name && (
                  <p className="text-gray-600 text-sm mt-1">{project.client_name}</p>
                )}
                <div className="flex justify-between items-center mt-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    project.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                    project.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {project.status === 'not_started' ? 'Belum Mulai' :
                     project.status === 'ongoing' ? 'Berlangsung' : 'Selesai'}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {project.location}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
