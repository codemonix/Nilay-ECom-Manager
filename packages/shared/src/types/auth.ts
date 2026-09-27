import type { UserDTO } from "./user";
import type { MenuKey } from "../constants/accessEnums";

export interface LoginRequestDTO {
  email: string;
  password: string;
}

/**
 * Returned by POST /api/auth/login and /api/auth/refresh. `token` is the
 * short-lived access token; the refresh token is never in the body -- it is
 * set as an httpOnly cookie scoped to /api/auth.
 */
export interface AuthResponseDTO {
  token: string;
  user: UserDTO;
}

export interface ChangePasswordInputDTO {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateQuickAccessMenuInputDTO {
  quickAccessMenu: MenuKey[];
}
