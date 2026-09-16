import type { UserDTO } from "./user";
import type { MenuKey } from "../constants/accessEnums";

export interface LoginRequestDTO {
  email: string;
  password: string;
}

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
