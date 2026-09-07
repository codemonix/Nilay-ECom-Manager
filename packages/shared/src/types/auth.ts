import type { UserDTO } from "./user";

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
