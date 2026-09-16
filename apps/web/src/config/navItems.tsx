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
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import LinkIcon from "@mui/icons-material/Link";
import AllInboxIcon from "@mui/icons-material/AllInbox";
import { MenuKey } from "@complaint-system/shared";

export interface NavItem {
  key: MenuKey;
  icon: ReactNode;
  path?: string;
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

// Modules with day-to-day operational use get a flat top-level entry.
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { key: MenuKey.CASES, icon: <AssignmentIcon />, path: "/cases" },
  { key: MenuKey.ORDER_CHECK, icon: <FactCheckIcon />, path: "/order-precheck" },
  { key: MenuKey.PACKING, icon: <Inventory2Icon />, path: "/packing" },
  { key: MenuKey.PURCHASING, icon: <ShoppingCartIcon />, children: PURCHASING_CHILD_ITEMS },
  { key: MenuKey.RECEIVING, icon: <AllInboxIcon />, path: "/receiving" },
  { key: MenuKey.INVENTORY, icon: <WarehouseIcon /> },
  { key: MenuKey.REPORTING, icon: <BarChartIcon />, path: "/reporting/shortage" },
];

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
