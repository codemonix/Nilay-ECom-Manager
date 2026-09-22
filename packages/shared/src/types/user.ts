import type { StaffRole } from "../constants/caseEnums";
import type { MenuKey, PermissionKey } from "../constants/accessEnums";

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  permissions: PermissionKey[];
  quickAccessMenu: MenuKey[];
}
