export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  user_id: string;
  username: string;
  display_name: string;
};

export type UserProfile = {
  user_id: string;
  username: string;
  display_name: string;
  is_active: boolean;
};

export type Project = {
  project_id: string;
  name: string;
  description?: string;
  created_at?: string;
};

export type ApiErrorBody = {
  detail?: unknown;
  message?: string;
  error_code?: string;
};
