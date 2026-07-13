-- Fix akses project untuk admin dan akses upload foto untuk admin/staff.
-- Jalankan file ini di Supabase SQL Editor.

BEGIN;

-- Projects: admin dapat membaca dan mengupdate semua project.
DROP POLICY IF EXISTS "Admin can manage their own projects" ON public.projects;
DROP POLICY IF EXISTS "Admin can read all projects" ON public.projects;
DROP POLICY IF EXISTS "Admin can update all projects" ON public.projects;
DROP POLICY IF EXISTS "Admin can insert projects" ON public.projects;

CREATE POLICY "Admin can read all projects"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_assignments
    WHERE project_id = projects.id
      AND user_id = auth.uid()
  )
);

CREATE POLICY "Admin can update all projects"
ON public.projects
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
  )
);

-- Optional: admin boleh membuat project baru jika dibutuhkan oleh aplikasi.
CREATE POLICY "Admin can insert projects"
ON public.projects
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
  )
);

-- Photos: admin/super_admin boleh upload foto ke item project apa pun.
DROP POLICY IF EXISTS "Staff can upload photos" ON public.photos;
DROP POLICY IF EXISTS "Assigned staff or admin can upload photos" ON public.photos;

CREATE POLICY "Assigned staff or admin can upload photos"
ON public.photos
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.items
      JOIN public.project_assignments
        ON items.project_id = project_assignments.project_id
      WHERE items.id = photos.item_id
        AND project_assignments.user_id = auth.uid()
    )
  )
);

COMMIT;
