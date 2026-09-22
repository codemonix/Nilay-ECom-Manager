import type { ReactNode } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import BarChartIcon from "@mui/icons-material/BarChart";
import SettingsIcon from "@mui/icons-material/Settings";
import PeopleIcon from "@mui/icons-material/People";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import LinkIcon from "@mui/icons-material/Link";
import AllInboxIcon from "@mui/icons-material/AllInbox";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import InsightsIcon from "@mui/icons-material/Insights";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import FilterListIcon from "@mui/icons-material/FilterList";
import { MenuKey, ReportKey } from "@complaint-system/shared";

export interface NavItem {
  key: MenuKey;
  icon: ReactNode;
  path?: string;
  /** For Reports children: the individual report permission gating this entry (see ReportKey) -- all of them share MenuKey.REPORTING as their group key. */
  reportKey?: ReportKey;
  /** Overrides the default `modules.<key>` translation lookup -- needed when several items share one MenuKey (see PURCHASING_CHILD_ITEMS, whose 5 entries all gate on MenuKey.PURCHASING but need distinct labels). */
  labelKey?: string;
  /** Sub-destinations rendered in a retractable group under this item (see PURCHASING below), same pattern as ADMIN_NAV_ITEMS. */
  children?: NavItem[];
}

// Purchasing's five screens all share the MenuKey.PURCHASING permission --
// there is no finer-grained per-screen permission in this codebase yet, so
// access is gated once at the group level, same as Administration below.
export const PURCHASING_CHILD_ITEMS: NavItem[] = [
  {
    key: MenuKey.PURCHASING,
    labelKey: "navigation:purchasingNav.packages",
    icon: <Inventory2Icon />,
    path: "/purchasing/packages",
  },
  {
    key: MenuKey.PURCHASING,
    labelKey: "navigation:purchasingNav.receiveItems",
    icon: <PhotoCameraIcon />,
    path: "/purchasing/receive",
  },
  {
    key: MenuKey.PURCHASING,
    labelKey: "navigation:purchasingNav.matchRegister",
    icon: <LinkIcon />,
    path: "/purchasing/match",
  },
  {
    key: MenuKey.PURCHASING,
    labelKey: "navigation:purchasingNav.overview",
    icon: <BarChartIcon />,
    path: "/purchasing/overview",
  },
];

// The "Orders" master menu: everything about working an order through the
// warehouse. Each page keeps its own permission (unlike Purchasing's shared
// one) -- the group shows for a user iff they can open at least one of them
// (see hasOrdersMenuAccess), and MainLayout/QuickAccessMenuDialog filter the
// children per user.
export const ORDERS_CHILD_ITEMS: NavItem[] = [
  {
    key: MenuKey.ORDER_CHECK,
    labelKey: "navigation:ordersNav.precheck",
    icon: <FactCheckIcon />,
    path: "/order-precheck",
  },
  {
    key: MenuKey.PACKING,
    labelKey: "navigation:ordersNav.packing",
    icon: <Inventory2Icon />,
    path: "/packing",
  },
  {
    key: MenuKey.ORDERS_BY_STATUS,
    labelKey: "navigation:ordersNav.byStatus",
    icon: <FilterListIcon />,
    path: "/orders/by-status",
  },
];

// The whole Orders menu as one pinnable mobile quick-access group, like
// ADMINISTRATION_GROUP_ITEM. Its `key` (MenuKey.ORDERS) is synthetic --
// never stored as a permission.
export const ORDERS_GROUP_ITEM: NavItem = {
  key: MenuKey.ORDERS,
  icon: <ReceiptLongIcon />,
  children: ORDERS_CHILD_ITEMS,
};

// Modules with day-to-day operational use get a flat top-level entry.
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { key: MenuKey.CASES, icon: <AssignmentIcon />, path: "/cases" },
  { key: MenuKey.PURCHASING, icon: <ShoppingCartIcon />, children: PURCHASING_CHILD_ITEMS },
  { key: MenuKey.RECEIVING, icon: <AllInboxIcon />, path: "/receiving" },
  { key: MenuKey.INVENTORY, icon: <WarehouseIcon /> },
];

// Every report is individually access-controlled (ReportKey), unlike
// Purchasing's screens which share one permission -- the Reports group and
// each of its entries are filtered per user in MainLayout/QuickAccessMenuDialog.
export const REPORT_CHILD_ITEMS: NavItem[] = [
  {
    key: MenuKey.REPORTING,
    reportKey: ReportKey.CUSTOMER,
    labelKey: "navigation:reportsNav.customer",
    icon: <PersonSearchIcon />,
    path: "/reporting/customer",
  },
  {
    key: MenuKey.REPORTING,
    reportKey: ReportKey.ITEM_SALES,
    labelKey: "navigation:reportsNav.itemSales",
    icon: <QueryStatsIcon />,
    path: "/reporting/item-sales",
  },
  {
    key: MenuKey.REPORTING,
    reportKey: ReportKey.CATEGORY_TRENDS,
    labelKey: "navigation:reportsNav.categoryTrends",
    icon: <InsightsIcon />,
    path: "/reporting/category-trends",
  },
  {
    key: MenuKey.REPORTING,
    reportKey: ReportKey.SHORTAGE,
    labelKey: "navigation:reportsNav.shortage",
    icon: <ReportProblemIcon />,
    path: "/reporting/shortage",
  },
];

// The whole Reports menu as one pinnable mobile quick-access group, like
// ADMINISTRATION_GROUP_ITEM. Its `key` (MenuKey.REPORTING) is derived, not
// stored: whether a user has it depends on hasReportsMenuAccess.
export const REPORTS_GROUP_ITEM: NavItem = {
  key: MenuKey.REPORTING,
  icon: <BarChartIcon />,
  children: REPORT_CHILD_ITEMS,
};

// Administrative tools live in their own retractable "Administration" group
// (see MainLayout's navList) instead of the flat top-level list -- this is
// where every future admin-only screen (audit logs, permissions, etc.)
// belongs, keeping the primary nav from getting crowded as the admin
// surface grows.
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: MenuKey.SETTINGS, icon: <SettingsIcon />, path: "/settings" },
  { key: MenuKey.USERS, icon: <PeopleIcon />, path: "/users" },
  { key: MenuKey.LOGS, icon: <ManageSearchIcon />, path: "/logs" },
];

// Lets the whole Administration section be pinned as ONE mobile
// quick-access tab (like Purchasing) instead of three separate ones --
// tapping it opens a sheet of just the pages in ADMIN_NAV_ITEMS the user
// actually has. MenuKey.ADMINISTRATION is synthetic (see accessEnums.ts):
// whether a user may pick this is governed by hasAdministrationAccess, not
// hasMenuAccess, since it isn't itself a real stored permission.
export const ADMINISTRATION_GROUP_ITEM: NavItem = {
  key: MenuKey.ADMINISTRATION,
  icon: <AdminPanelSettingsIcon />,
  children: ADMIN_NAV_ITEMS,
};
