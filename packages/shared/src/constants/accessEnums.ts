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
  // Synthetic grouping key for the Settings/Users/Logs section (labeled
  // "Administration" in the nav). Unlike the other keys, it's never stored
  // in a user's `permissions` and never checked by requirePermission -- it
  // exists only so the web app can offer "Administration" as a single
  // pinnable mobile quick-access tile instead of three. Whether a user may
  // use it is derived from the three real keys (see hasAdministrationAccess
  // below), so it's excluded from the assignable list on the Users page
  // (see ASSIGNABLE_MENU_KEY_VALUES) -- granting or revoking it would do
  // nothing.
  ADMINISTRATION: "administration",
} as const;
export type MenuKey = (typeof MenuKey)[keyof typeof MenuKey];
export const MENU_KEY_VALUES = Object.values(MenuKey);

/** MENU_KEY_VALUES minus the synthetic keys that don't represent a real,
 * independently-grantable permission (see MenuKey.ADMINISTRATION) -- the
 * list an admin can actually toggle per user on the Users page. */
export const ASSIGNABLE_MENU_KEY_VALUES = MENU_KEY_VALUES.filter((key) => key !== MenuKey.ADMINISTRATION);

/**
 * Starting permission set applied when a new user is created, before an
 * admin fine-tunes it on the Users page. Admins are not affected by this
 * table -- they always have access to every menu item (see hasMenuAccess).
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<StaffRole, MenuKey[]> = {
  [StaffRole.ADMIN]: ASSIGNABLE_MENU_KEY_VALUES,
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

/**
 * Whether the user may see/use the synthetic "Administration" grouping
 * (MenuKey.ADMINISTRATION) -- true iff they have real access to at least
 * one of the pages it groups (Settings/Users/Logs). Used instead of
 * hasMenuAccess for that key, since it's never itself stored as a
 * permission (see MenuKey.ADMINISTRATION).
 */
export function hasAdministrationAccess(user: { role: string; permissions?: string[] }): boolean {
  return (
    hasMenuAccess(user, MenuKey.SETTINGS) || hasMenuAccess(user, MenuKey.USERS) || hasMenuAccess(user, MenuKey.LOGS)
  );
}
