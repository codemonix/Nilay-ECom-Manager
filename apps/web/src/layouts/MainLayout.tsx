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
import DiamondIcon from "@mui/icons-material/Diamond";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BuildIcon from "@mui/icons-material/Build";
import NumbersIcon from "@mui/icons-material/Numbers";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { ThemeToggle } from "../components/ThemeToggle";
import { UserMenu } from "../features/auth/components/UserMenu";
import { useAppSelector } from "../app/hooks";
import { hasMenuAccess, MenuKey } from "@complaint-system/shared";
import { ADMIN_NAV_ITEMS, PRIMARY_NAV_ITEMS, type NavItem } from "../config/navItems";

const DRAWER_WIDTH = 240;
const BOTTOM_NAV_HEIGHT = 64;
const ADMIN_MENU_EXPANDED_STORAGE_KEY = "complaint-system.adminMenuExpanded";
const PURCHASING_MENU_EXPANDED_STORAGE_KEY = "complaint-system.purchasingMenuExpanded";
const DEV_TOOLS_MENU_EXPANDED_STORAGE_KEY = "complaint-system.devToolsMenuExpanded";

// Internal test/debug pages live in their own retractable "Development
// Tools" group, gated by the single MenuKey.DEV_TOOLS permission -- same
// pattern as Purchasing's children above. New test pages just get appended
// here.
const DEV_TOOLS_CHILD_ITEMS: NavItem[] = [
  {
    key: MenuKey.DEV_TOOLS,
    labelKey: "navigation:devToolsNav.soldQuantity",
    icon: <NumbersIcon />,
    path: "/dev-tools/sold-quantity",
  },
  {
    key: MenuKey.DEV_TOOLS,
    labelKey: "navigation:devToolsNav.titleAsterisk",
    icon: <TextFieldsIcon />,
    path: "/dev-tools/title-asterisk",
  },
  {
    key: MenuKey.DEV_TOOLS,
    labelKey: "navigation:devToolsNav.orderNote",
    icon: <StickyNote2Icon />,
    path: "/dev-tools/order-note",
  },
];

// Fallback bottom-tab selection for a user who hasn't customized their
// quick access menu yet (see UserMenu > "Mobile quick access"). Once a user
// picks their own set (User.quickAccessMenu), that replaces this default.
const DEFAULT_QUICK_ACCESS_KEYS: MenuKey[] = [MenuKey.CASES, MenuKey.SETTINGS];

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
  const [purchasingExpanded, setPurchasingExpanded] = useState(() => {
    try {
      return localStorage.getItem(PURCHASING_MENU_EXPANDED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [devToolsExpanded, setDevToolsExpanded] = useState(() => {
    try {
      return localStorage.getItem(DEV_TOOLS_MENU_EXPANDED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const user = useAppSelector((state) => state.auth.user);
  const primaryItems = user ? PRIMARY_NAV_ITEMS.filter((item) => hasMenuAccess(user, item.key)) : [];
  const adminItems = user ? ADMIN_NAV_ITEMS.filter((item) => hasMenuAccess(user, item.key)) : [];
  const devToolsVisible = user ? hasMenuAccess(user, MenuKey.DEV_TOOLS) : false;
  const visibleNavItems = [...primaryItems, ...adminItems];
  const quickAccessKeys = (user?.quickAccessMenu?.length ? user.quickAccessMenu : DEFAULT_QUICK_ACCESS_KEYS).filter(
    (key) => visibleNavItems.some((item) => item.key === key && item.path),
  );
  const isAdminSectionActive = adminItems.some(
    (item) => item.path && location.pathname.startsWith(item.path),
  );
  const purchasingItem = primaryItems.find((item) => item.children);
  const isPurchasingSectionActive = (purchasingItem?.children ?? []).some(
    (item) => item.path && location.pathname.startsWith(item.path),
  );
  const isDevToolsSectionActive = DEV_TOOLS_CHILD_ITEMS.some(
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

  const togglePurchasingExpanded = () => {
    setPurchasingExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PURCHASING_MENU_EXPANDED_STORAGE_KEY, String(next));
      } catch {
        // Per-viewer convenience only; safe to ignore (private browsing, blocked storage, etc.).
      }
      return next;
    });
  };

  const toggleDevToolsExpanded = () => {
    setDevToolsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DEV_TOOLS_MENU_EXPANDED_STORAGE_KEY, String(next));
      } catch {
        // Per-viewer convenience only; safe to ignore (private browsing, blocked storage, etc.).
      }
      return next;
    });
  };

  const renderNavItem = (item: NavItem, indent = false) => {
    const isActive = Boolean(item.path && location.pathname.startsWith(item.path));
    const itemKey = item.path ?? item.labelKey ?? item.key;
    const content = (
      <ListItemButton
        key={itemKey}
        component={item.path ? NavLink : "div"}
        to={item.path}
        disabled={!item.path}
        selected={isActive}
        onClick={() => setMoreOpen(false)}
        sx={{ borderRadius: "10px", mb: 0.5, minHeight: 48, pl: indent ? 3.5 : 2 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
        <ListItemText primary={t(item.labelKey ?? `navigation:modules.${item.key}`)} />
        {!item.path && (
          <Chip size="small" label={t("navigation:comingSoon")} variant="outlined" sx={{ fontWeight: 500 }} />
        )}
      </ListItemButton>
    );
    return !item.path ? (
      <Tooltip key={itemKey} title={t("navigation:comingSoon")} placement="right">
        <span>{content}</span>
      </Tooltip>
    ) : (
      content
    );
  };

  const navList = (
    <List sx={{ px: 1 }}>
      {primaryItems.filter((item) => !item.children).map((item) => renderNavItem(item))}

      {purchasingItem && (
        <>
          <ListItemButton onClick={togglePurchasingExpanded} sx={{ borderRadius: "10px", mb: 0.5, minHeight: 48 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>{purchasingItem.icon}</ListItemIcon>
            <ListItemText primary={t(`navigation:modules.${purchasingItem.key}`)} />
            {purchasingExpanded || isPurchasingSectionActive ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={purchasingExpanded || isPurchasingSectionActive} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ px: 0 }}>
              {(purchasingItem.children ?? []).map((item) => renderNavItem(item, true))}
            </List>
          </Collapse>
        </>
      )}

      {devToolsVisible && (
        <>
          <ListItemButton onClick={toggleDevToolsExpanded} sx={{ borderRadius: "10px", mb: 0.5, minHeight: 48 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <BuildIcon />
            </ListItemIcon>
            <ListItemText primary={t("navigation:modules.devTools")} />
            {devToolsExpanded || isDevToolsSectionActive ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={devToolsExpanded || isDevToolsSectionActive} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ px: 0 }}>
              {DEV_TOOLS_CHILD_ITEMS.map((item) => renderNavItem(item, true))}
            </List>
          </Collapse>
        </>
      )}

      {adminItems.length > 0 && (
        <>
          <ListItemButton onClick={toggleAdminExpanded} sx={{ borderRadius: "10px", mb: 0.5, minHeight: 48 }}>
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

  const activePrimaryKey = quickAccessKeys.find((key) => {
    const item = visibleNavItems.find((n) => n.key === key);
    return item?.path && location.pathname.startsWith(item.path);
  });

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        background: (theme) =>
          theme.palette.mode === "dark"
            ? "radial-gradient(circle at top, rgba(139, 92, 246, 0.18), transparent 35%), #0f172a"
            : "radial-gradient(circle at top, rgba(79, 70, 229, 0.10), transparent 32%), #f5f7ff",
      }}
    >
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5, px: { xs: 1.5, sm: 2 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                color: "white",
              }}
            >
              <DiamondIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography variant="h3" component="h1" noWrap sx={{ fontSize: "1.08rem" }}>
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
            p: { xs: 1.5, sm: 3 },
            pb: isDesktop ? { sm: 3 } : `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom) + 20px)`,
          }}
        >
          <Box
            sx={{
              maxWidth: 1500,
              mx: "auto",
            }}
          >
            {children}
          </Box>
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
            {visibleNavItems.filter((item) => quickAccessKeys.includes(item.key)).map((item) => (
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
