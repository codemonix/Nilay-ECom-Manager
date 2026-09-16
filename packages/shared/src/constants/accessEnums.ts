import { StaffRole } from "./caseEnums";

/**
 * Every togglable section of the main menu. Both apps import this instead
 * of hardcoding menu keys, so a new module (see docs/future-modules.md)
 * only needs to extend this list to become access-controllable.
 */
export const MenuKey = {
  CASES: "cases",
  ORDER_CHECK: "orderCheck",
  PACKING: "packing",
  PURCHASING: "purchasing",
  RECEIVING: "receiving",
  INVENTORY: "inventory",
  REPORTING: "reporting",
  SETTINGS: "settings",
  USERS: "users",
  LOGS: "logs",
  DEV_TOOLS: "devTools",
} as const;
export type MenuKey = (typeof MenuKey)[keyof typeof MenuKey];
export const MENU_KEY_VALUES = Object.values(MenuKey);

/**
 * Starting permission set applied when a new user is created, before an
 * admin fine-tunes it on the Users page. Admins are not affected by this
 * table -- they always have access to every menu item (see hasMenuAccess).
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<StaffRole, MenuKey[]> = {
  [StaffRole.ADMIN]: MENU_KEY_VALUES,
  [StaffRole.CUSTOMER_SERVICE]: [MenuKey.CASES],
  [StaffRole.WAREHOUSE]: [MenuKey.ORDER_CHECK, MenuKey.PACKING, MenuKey.INVENTORY, MenuKey.RECEIVING],
  [StaffRole.MANAGER]: [MenuKey.CASES, MenuKey.REPORTING, MenuKey.SETTINGS],
  [StaffRole.PURCHASING]: [MenuKey.PURCHASING],
};

/**
 * Single source of truth for "can this user open this menu section",
 * shared by the API's requirePermission middleware and the web app's nav
 * filtering/route guards so the two can never drift apart. Admins bypass
 * the stored permission list entirely so an admin can never lock themself
 * (or every admin) out of the app by misconfiguring it.
 */
export function hasMenuAccess(user: { role: string; permissions?: string[] }, key: MenuKey): boolean {
  if (user.role === StaffRole.ADMIN) return true;
  return user.permissions?.includes(key) ?? false;
}
