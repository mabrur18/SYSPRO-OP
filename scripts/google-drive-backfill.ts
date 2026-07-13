import { createClient } from '@supabase/supabase-js';
//import dotenv from 'dotenv';
import { createFolder, getGoogleDriveRootFolderId } from '../src/lib/googleDrive';

//dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function ensureProjectFolder(project: { id: string; name: string; drive_folder_id: string | null }) {
  if (project.drive_folder_id) {
    return project.drive_folder_id;
  }

  const folderId = await createFolder(`${project.name} - ${project.id.slice(0, 8)}`, getGoogleDriveRootFolderId());
  const { error } = await supabase
    .from('projects')
    .update({ drive_folder_id: folderId })
    .eq('id', project.id);

  if (error) {
    throw error;
  }

  return folderId;
}

async function ensureItemFolder(item: { id: string; name: string; drive_folder_id: string | null }, projectFolderId: string) {
  if (item.drive_folder_id) {
    return;
  }

  const folderId = await createFolder(item.name, projectFolderId);
  const { error } = await supabase
    .from('items')
    .update({ drive_folder_id: folderId })
    .eq('id', item.id);

  if (error) {
    throw error;
  }
}

async function main() {
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, drive_folder_id')
    .order('created_at', { ascending: true });

  if (projectsError) {
    throw projectsError;
  }

  let projectFoldersCreated = 0;
  let itemFoldersCreated = 0;

  for (const project of projects || []) {
    const hadProjectFolder = !!project.drive_folder_id;
    const projectFolderId = await ensureProjectFolder(project);

    if (!hadProjectFolder) {
      projectFoldersCreated += 1;
      console.log(`Project folder dibuat: ${project.name}`);
    }

    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, name, drive_folder_id')
      .eq('project_id', project.id)
      .order('order_index', { ascending: true });

    if (itemsError) {
      throw itemsError;
    }

    for (const item of items || []) {
      const hadItemFolder = !!item.drive_folder_id;
      await ensureItemFolder(item, projectFolderId);

      if (!hadItemFolder) {
        itemFoldersCreated += 1;
        console.log(`Item folder dibuat: ${project.name} -> ${item.name}`);
      }
    }
  }

  console.log('======================================');
  console.log('Backfill Google Drive selesai');
  console.log(`Project folder dibuat: ${projectFoldersCreated}`);
  console.log(`Item folder dibuat: ${itemFoldersCreated}`);
  console.log('======================================');
}

main().catch((error) => {
  console.error('Backfill gagal:', error);
  process.exit(1);
});
