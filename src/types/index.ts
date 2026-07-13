export type UserRole = 'super_admin' | 'admin' | 'staff';
export type UserStatus = 'active' | 'inactive';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export type ProjectStatus = 'not_started' | 'ongoing' | 'completed';

export interface Project {
  id: string;
  name: string;
  client_name: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  description: string | null;
  drive_folder_id: string | null;
  contract_file_url: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
}

export interface Item {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  category: string | null;
  required_photo_count: number;
  drive_folder_id: string | null;
  order_index: number;
  created_at: string;
}

export type PhotoStatus = 'pending_review' | 'verified' | 'revision_requested';

export interface Photo {
  id: string;
  item_id: string;
  uploaded_by: string;
  drive_file_id: string;
  drive_file_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  status: PhotoStatus;
  uploaded_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
}
