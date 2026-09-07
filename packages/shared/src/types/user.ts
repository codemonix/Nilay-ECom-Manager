import type { StaffRole } from "../constants/caseEnums";

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
}
