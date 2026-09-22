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
  ORDERS_BY_STATUS: "ordersByStatus",
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
  // Synthetic grouping key for the "Orders" master menu (Order Pre-Check,
  // Packing, Orders by status) -- like ADMINISTRATION, never stored in a
  // user's permissions; whether a user sees the menu is derived from the
  // three real keys (see hasOrdersMenuAccess).
  ORDERS: "orders",
} as const;
export type MenuKey = (typeof MenuKey)[keyof typeof MenuKey];
export const MENU_KEY_VALUES = Object.values(MenuKey);

/**
 * Every individual report under the "Reports" menu. Each is its own
 * permission, stored in a user's `permissions` array alongside the MenuKey
 * values (see PermissionKey), so an admin can grant e.g. the customer
 * report without the shortage report. Adding a report = add a key here,
 * gate its API route with requireReportAccess and its web route with
 * RequireReportAccess, and give it a nav entry.
 */
export const ReportKey = {
  SHORTAGE: "report:shortage",
  CUSTOMER: "report:customer",
  ITEM_SALES: "report:itemSales",
  CATEGORY_TRENDS: "report:categoryTrends",
} as const;
export type ReportKey = (typeof ReportKey)[keyof typeof ReportKey];
export const REPORT_KEY_VALUES = Object.values(ReportKey);

/** Anything that can appear in a user's `permissions` array. */
export type PermissionKey = MenuKey | ReportKey;
export const PERMISSION_KEY_VALUES: PermissionKey[] = [...MENU_KEY_VALUES, ...REPORT_KEY_VALUES];

/** MENU_KEY_VALUES minus the keys that aren't independently-grantable
 * menu permissions -- the synthetic MenuKey.ADMINISTRATION (see above), and
 * MenuKey.REPORTING, whose visibility is now derived from holding at least
 * one ReportKey (see hasReportsMenuAccess). Report keys are offered
 * separately (REPORT_KEY_VALUES) -- this is the plain-menu half of the list
 * an admin toggles per user on the Users page. */
export const ASSIGNABLE_MENU_KEY_VALUES = MENU_KEY_VALUES.filter(
  (key) => key !== MenuKey.ADMINISTRATION && key !== MenuKey.REPORTING && key !== MenuKey.ORDERS,
);

/**
 * Starting permission set applied when a new user is created, before an
 * admin fine-tunes it on the Users page. Admins are not affected by this
 * table -- they always have access to every menu item (see hasMenuAccess).
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<StaffRole, PermissionKey[]> = {
  [StaffRole.ADMIN]: [...ASSIGNABLE_MENU_KEY_VALUES, ...REPORT_KEY_VALUES],
  [StaffRole.CUSTOMER_SERVICE]: [MenuKey.CASES],
  [StaffRole.WAREHOUSE]: [
    MenuKey.ORDER_CHECK,
    MenuKey.PACKING,
    MenuKey.ORDERS_BY_STATUS,
    MenuKey.INVENTORY,
    MenuKey.RECEIVING,
  ],
  [StaffRole.MANAGER]: [MenuKey.CASES, ...REPORT_KEY_VALUES, MenuKey.SETTINGS],
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

/** Whether the user may see the synthetic "Orders" master menu -- true iff they can open at least one of the pages it groups (Order Pre-Check, Packing, Orders by status). */
export function hasOrdersMenuAccess(user: { role: string; permissions?: string[] }): boolean {
  return (
    hasMenuAccess(user, MenuKey.ORDER_CHECK) ||
    hasMenuAccess(user, MenuKey.PACKING) ||
    hasMenuAccess(user, MenuKey.ORDERS_BY_STATUS)
  );
}

/**
 * Whether the user may open one specific report. Admins always may. A user
 * who still carries the legacy all-reports grant (MenuKey.REPORTING, from
 * before reports had individual keys) and has not yet been given any
 * individual report key keeps access to every report until an admin
 * assigns specific ones -- so existing managers don't silently lose the
 * shortage report when this permission model was introduced.
 */
export function hasReportAccess(user: { role: string; permissions?: string[] }, key: ReportKey): boolean {
  if (user.role === StaffRole.ADMIN) return true;
  const permissions = user.permissions ?? [];
  if (permissions.includes(key)) return true;
  const holdsAnyReportKey = REPORT_KEY_VALUES.some((reportKey) => permissions.includes(reportKey));
  return !holdsAnyReportKey && permissions.includes(MenuKey.REPORTING);
}

/** Whether the "Reports" menu should show for this user -- true iff they can open at least one report. */
export function hasReportsMenuAccess(user: { role: string; permissions?: string[] }): boolean {
  return REPORT_KEY_VALUES.some((key) => hasReportAccess(user, key));
}
