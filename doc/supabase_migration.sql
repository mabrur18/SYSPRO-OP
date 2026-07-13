-- =============================================
-- EMS — Event Monitoring System Database Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Table: profiles (extends auth.users)
-- =============================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'admin', 'staff')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Table: projects
-- =============================================
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    client_name TEXT,
    location TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'ongoing', 'completed')),
    description TEXT,
    drive_folder_id TEXT,
    contract_file_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Table: project_assignments (many-to-many)
-- =============================================
CREATE TABLE public.project_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
);

-- =============================================
-- Table: items
-- =============================================
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    required_photo_count INTEGER NOT NULL DEFAULT 1,
    drive_folder_id TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Table: photos
-- =============================================
CREATE TABLE public.photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    drive_file_id TEXT NOT NULL,
    drive_file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'verified', 'revision_requested')),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Table: activity_logs
-- =============================================
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Policies: profiles
-- =============================================
-- Super admin can do everything
CREATE POLICY "Super admin can manage all profiles"
ON public.profiles
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

-- =============================================
-- Policies: projects
-- =============================================
-- Super admin can manage all projects
CREATE POLICY "Super admin can manage all projects"
ON public.projects
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- Admin can manage their own projects
CREATE POLICY "Admin can manage their own projects"
ON public.projects
FOR ALL
USING (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
)
WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- Staff can view assigned projects
CREATE POLICY "Staff can view assigned projects"
ON public.projects
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.project_assignments
        WHERE project_id = projects.id AND user_id = auth.uid()
    )
);

-- =============================================
-- Policies: project_assignments
-- =============================================
-- Super admin and admin can manage assignments
CREATE POLICY "Admin can manage project assignments"
ON public.project_assignments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'admin')
    )
);

-- Staff can view their own assignments
CREATE POLICY "Staff can view their own assignments"
ON public.project_assignments
FOR SELECT
USING (user_id = auth.uid());

-- =============================================
-- Policies: items
-- =============================================
-- Super admin and admin can manage items
CREATE POLICY "Admin can manage items"
ON public.items
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'admin')
    )
);

-- Staff can view items of assigned projects
CREATE POLICY "Staff can view items of assigned projects"
ON public.items
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.project_assignments
        WHERE project_id = items.project_id AND user_id = auth.uid()
    )
);

-- =============================================
-- Policies: photos
-- =============================================
-- Everyone can view photos
CREATE POLICY "Everyone can view photos"
ON public.photos
FOR SELECT
USING (true);

-- Staff can upload photos to assigned project items
CREATE POLICY "Staff can upload photos"
ON public.photos
FOR INSERT
WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.items
        JOIN public.project_assignments ON items.project_id = project_assignments.project_id
        WHERE items.id = photos.item_id AND project_assignments.user_id = auth.uid()
    )
);

-- Super admin and admin can update photo status
CREATE POLICY "Admin can update photo status"
ON public.photos
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'admin')
    )
);

-- =============================================
-- Policies: activity_logs
-- =============================================
-- Everyone can view activity logs
CREATE POLICY "Everyone can view activity logs"
ON public.activity_logs
FOR SELECT
USING (true);

-- Authenticated users can insert activity logs
CREATE POLICY "Authenticated users can insert activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- Trigger: Auto-create profile on user signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::text, 'staff'),
        'active'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
