import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    redirect('/login');
  }

  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true });

  const { count: activeUserCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { data: recentActivities } = await supabase
    .from('activity_logs')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Selamat datang, {profile?.full_name || profile?.email}!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Total Projects</div>
          <div className="text-3xl font-bold text-blue-600">{projectCount || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Active Users</div>
          <div className="text-3xl font-bold text-green-600">{activeUserCount || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Projects Ongoing</div>
          <div className="text-3xl font-bold text-yellow-600">0</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Projects Completed</div>
          <div className="text-3xl font-bold text-purple-600">0</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Aktivitas Terbaru</h2>
        {recentActivities && recentActivities.length > 0 ? (
          <ul className="space-y-4">
            {recentActivities.map((activity) => (
              <li key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <div className="font-medium">{activity.action}</div>
                  <div className="text-sm text-gray-500">
                    {activity.profiles?.full_name || activity.profiles?.email} • {new Date(activity.created_at).toLocaleString('id-ID')}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Belum ada aktivitas.</p>
        )}
      </div>
    </div>
  );
}
