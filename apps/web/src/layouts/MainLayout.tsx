import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import BarChartIcon from "@mui/icons-material/BarChart";
import SettingsIcon from "@mui/icons-material/Settings";
import DiamondIcon from "@mui/icons-material/Diamond";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PeopleIcon from "@mui/icons-material/People";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { ThemeToggle } from "../components/ThemeToggle";
import { UserMenu } from "../features/auth/components/UserMenu";
import { useAppSelector } from "../app/hooks";
import { hasMenuAccess, MenuKey } from "@complaint-system/shared";

const DRAWER_WIDTH = 240;
const BOTTOM_NAV_HEIGHT = 64;
const ADMIN_MENU_EXPANDED_STORAGE_KEY = "complaint-system.adminMenuExpanded";

interface NavItem {
  key: MenuKey;
  icon: ReactNode;
  path?: string;
}

// Modules with day-to-day operational use get a flat top-level entry.
const PRIMARY_NAV_ITEMS: NavItem[] = [
  { key: MenuKey.CASES, icon: <AssignmentIcon />, path: "/cases" },
  { key: MenuKey.ORDER_CHECK, icon: <FactCheckIcon /> },
  { key: MenuKey.PACKING, icon: <Inventory2Icon /> },
  { key: MenuKey.PURCHASING, icon: <ShoppingCartIcon /> },
  { key: MenuKey.INVENTORY, icon: <WarehouseIcon /> },
  { key: MenuKey.REPORTING, icon: <BarChartIcon /> },
];

// Administrative tools live in their own retractable "Administration" group
// (see navList below) instead of the flat top-level list -- this is where
// every future admin-only screen (audit logs, permissions, etc.) belongs,
// keeping the primary nav from getting crowded as the admin surface grows.
const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: MenuKey.SETTINGS, icon: <SettingsIcon />, path: "/settings" },
  { key: MenuKey.USERS, icon: <PeopleIcon />, path: "/users" },
  { key: MenuKey.LOGS, icon: <ManageSearchIcon />, path: "/logs" },
];

// Primary destinations get their own thumb-reachable tab; everything else
// (including "coming soon" modules and the Administration group) lives
// behind "More" so the bottom bar never gets crowded as new modules ship.
const BOTTOM_NAV_PRIMARY_KEYS = ["cases", "settings"];

export function MainLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation(["navigation", "common"]);
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [moreOpen, setMoreOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(() => {
    try {
      return localStorage.getItem(ADMIN_MENU_EXPANDED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const user = useAppSelector((state) => state.auth.user);
  const primaryItems = user ? PRIMARY_NAV_ITEMS.filter((item) => hasMenuAccess(user, item.key)) : [];
  const adminItems = user ? ADMIN_NAV_ITEMS.filter((item) => hasMenuAccess(user, item.key)) : [];
  const visibleNavItems = [...primaryItems, ...adminItems];
  const isAdminSectionActive = adminItems.some(
    (item) => item.path && location.pathname.startsWith(item.path),
  );

  const toggleAdminExpanded = () => {
    setAdminExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ADMIN_MENU_EXPANDED_STORAGE_KEY, String(next));
      } catch {
        // Per-viewer convenience only; safe to ignore (private browsing, blocked storage, etc.).
      }
      return next;
    });
  };

  const renderNavItem = (item: NavItem, indent = false) => {
    const isActive = Boolean(item.path && location.pathname.startsWith(item.path));
    const content = (
      <ListItemButton
        key={item.key}
        component={item.path ? NavLink : "div"}
        to={item.path}
        disabled={!item.path}
        selected={isActive}
        onClick={() => setMoreOpen(false)}
        sx={{ borderRadius: 2, mb: 0.5, minHeight: 48, pl: indent ? 3.5 : 2 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
        <ListItemText primary={t(`navigation:modules.${item.key}`)} />
        {!item.path && (
          <Chip size="small" label={t("navigation:comingSoon")} variant="outlined" sx={{ fontWeight: 500 }} />
        )}
      </ListItemButton>
    );
    return !item.path ? (
      <Tooltip key={item.key} title={t("navigation:comingSoon")} placement="right">
        <span>{content}</span>
      </Tooltip>
    ) : (
      content
    );
  };

  const navList = (
    <List sx={{ px: 1 }}>
      {primaryItems.map((item) => renderNavItem(item))}

      {adminItems.length > 0 && (
        <>
          <ListItemButton onClick={toggleAdminExpanded} sx={{ borderRadius: 2, mb: 0.5, minHeight: 48 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AdminPanelSettingsIcon />
            </ListItemIcon>
            <ListItemText primary={t("navigation:administration")} />
            {adminExpanded || isAdminSectionActive ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={adminExpanded || isAdminSectionActive} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ px: 0 }}>
              {adminItems.map((item) => renderNavItem(item, true))}
            </List>
          </Collapse>
        </>
      )}
    </List>
  );

  const activePrimaryKey = BOTTOM_NAV_PRIMARY_KEYS.find((key) => {
    const item = visibleNavItems.find((n) => n.key === key);
    return item?.path && location.pathname.startsWith(item.path);
  });

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
            <DiamondIcon color="primary" />
            <Typography variant="h3" component="h1" noWrap sx={{ fontSize: "1.1rem" }}>
              {t("navigation:brand")}
            </Typography>
          </Stack>
          <ThemeToggle />
          <LanguageSwitcher />
          <UserMenu />
        </Toolbar>
      </AppBar>

      {isDesktop ? (
        <Drawer
          variant="permanent"
          open
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          <Toolbar />
          <Divider />
          {navList}
        </Drawer>
      ) : (
        <Drawer
          anchor="bottom"
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ [`& .MuiDrawer-paper`]: { borderRadius: "20px 20px 0 0", pb: "env(safe-area-inset-bottom)" } }}
        >
          <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5 }}>
            <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: "action.disabled" }} />
          </Box>
          <Divider sx={{ mb: 1 }} />
          {navList}
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        <Box
          sx={{
            p: { xs: 1.75, sm: 3 },
            pb: isDesktop ? { sm: 3 } : `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom) + 20px)`,
          }}
        >
          {children}
        </Box>
      </Box>

      {!isDesktop && (
        <Paper
          elevation={3}
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.drawer + 2,
            pb: "env(safe-area-inset-bottom)",
          }}
        >
          <BottomNavigation
            showLabels
            value={activePrimaryKey ?? (moreOpen ? "more" : false)}
            onChange={(_e, value) => {
              if (value === "more") {
                setMoreOpen(true);
                return;
              }
              const item = visibleNavItems.find((n) => n.key === value);
              if (item?.path) navigate(item.path);
            }}
          >
            {visibleNavItems.filter((item) => BOTTOM_NAV_PRIMARY_KEYS.includes(item.key)).map((item) => (
              <BottomNavigationAction
                key={item.key}
                value={item.key}
                label={t(`navigation:modules.${item.key}`)}
                icon={item.icon}
              />
            ))}
            <BottomNavigationAction value="more" label={t("navigation:more")} icon={<MoreHorizIcon />} />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
