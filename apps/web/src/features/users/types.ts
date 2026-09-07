import type { UserDTO } from "@complaint-system/shared";

export type { UserDTO };

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions?: string[];
}

export interface UpdateUserPayload {
  id: string;
  name?: string;
  role?: string;
  active?: boolean;
  permissions?: string[];
}

export interface ResetPasswordPayload {
  id: string;
  newPassword: string;
}
