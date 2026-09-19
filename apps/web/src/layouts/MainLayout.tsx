import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
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
import IconButton from "@mui/material/IconButton";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import DiamondIcon from "@mui/icons-material/Diamond";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CloseIcon from "@mui/icons-material/Close";
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
import { BOTTOM_NAV_HEIGHT, DRAWER_WIDTH } from "./layoutMetrics";
import { hasAdministrationAccess, hasMenuAccess, MenuKey } from "@complaint-system/shared";
import { ADMIN_NAV_ITEMS, ADMINISTRATION_GROUP_ITEM, PRIMARY_NAV_ITEMS, type NavItem } from "../config/navItems";

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
  // Set when a quick-access tab that has no direct destination of its own
  // (an expandable group like Purchasing) is tapped -- opens a small sheet
  // listing just that group's own pages instead of navigating.
  const [quickAccessGroupKey, setQuickAccessGroupKey] = useState<MenuKey | null>(null);
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
  const administrationGroupVisible = user ? hasAdministrationAccess(user) : false;
  // The bottom-nav/quick-access item for Administration lists only the
  // sub-pages this user actually has (adminItems), not the full
  // ADMIN_NAV_ITEMS -- same per-item filtering the full nav drawer's
  // Administration group already applies below.
  const visibleNavItems = [
    ...primaryItems,
    ...adminItems,
    ...(administrationGroupVisible ? [{ ...ADMINISTRATION_GROUP_ITEM, children: adminItems }] : []),
  ];
  // A quick-access tab is valid if it has either a direct destination or
  // (like Purchasing and Administration) its own sub-pages -- tapping the
  // latter opens a small sheet of those sub-pages instead of navigating
  // (see quickAccessGroupItem).
  const quickAccessKeys = (user?.quickAccessMenu?.length ? user.quickAccessMenu : DEFAULT_QUICK_ACCESS_KEYS).filter(
    (key) => visibleNavItems.some((item) => item.key === key && (item.path || item.children)),
  );
  const quickAccessGroupItem = quickAccessGroupKey
    ? (visibleNavItems.find((item) => item.key === quickAccessGroupKey) ?? null)
    : null;
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

  // Auto-expand a group when navigation lands on one of its pages, without
  // permanently forcing it open -- otherwise a manual collapse (the ^
  // toggle) would be undone on every render for as long as the user stays
  // on that page, since the group's "expanded" condition would still be
  // true from the active-section check alone.
  useEffect(() => {
    if (isAdminSectionActive) setAdminExpanded(true);
  }, [isAdminSectionActive]);
  useEffect(() => {
    if (isPurchasingSectionActive) setPurchasingExpanded(true);
  }, [isPurchasingSectionActive]);
  useEffect(() => {
    if (isDevToolsSectionActive) setDevToolsExpanded(true);
  }, [isDevToolsSectionActive]);

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

  const renderNavItem = (item: NavItem, indent = false, onSelect: () => void = () => setMoreOpen(false)) => {
    const isActive = Boolean(item.path && location.pathname.startsWith(item.path));
    const itemKey = item.path ?? item.labelKey ?? item.key;
    const content = (
      <ListItemButton
        key={itemKey}
        component={item.path ? NavLink : "div"}
        to={item.path}
        disabled={!item.path}
        selected={isActive}
        onClick={onSelect}
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
            {purchasingExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={purchasingExpanded} timeout="auto" unmountOnExit>
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
            {devToolsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={devToolsExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ px: 0 }}>
              {DEV_TOOLS_CHILD_ITEMS.map((item) => renderNavItem(item, true))}
            </List>
          </Collapse>
        </>
      )}

      {adminItems.length > 0 && (
        <>
          <ListItemButton onClick={toggleAdminExpanded} sx={{ borderRadius: "10px", mb: 0.5, minHeight: 48 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>{ADMINISTRATION_GROUP_ITEM.icon}</ListItemIcon>
            <ListItemText primary={t(`navigation:modules.${MenuKey.ADMINISTRATION}`)} />
            {adminExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={adminExpanded} timeout="auto" unmountOnExit>
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
    if (!item) return false;
    if (item.path) return location.pathname.startsWith(item.path);
    return (item.children ?? []).some((child) => child.path && location.pathname.startsWith(child.path));
  });

  // MUI's temporary Drawer defaults to zIndex.drawer (1200), same tier as --
  // and painted before -- the fixed AppBar (drawer + 1) and BottomNavigation
  // bar (drawer + 2) below, so without this override the bottom nav bar
  // renders on top of a bottom sheet's lower portion, covering its last
  // item(s) and swallowing taps meant for them. Shared by the "More" sheet
  // and the per-group quick-access sheet (e.g. Purchasing) below.
  const mobileSheetSx = {
    zIndex: (t: typeof theme) => t.zIndex.drawer + 3,
    [`& .MuiDrawer-paper`]: {
      zIndex: (t: typeof theme) => t.zIndex.drawer + 3,
      borderRadius: "20px 20px 0 0",
      maxHeight: "80vh",
      display: "flex",
      flexDirection: "column",
    },
  };

  const renderSheetHeader = (onClose: () => void) => (
    <>
      <Box sx={{ position: "relative", display: "flex", justifyContent: "center", pt: 1.5, flexShrink: 0 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: "action.disabled" }} />
        <IconButton
          onClick={onClose}
          aria-label={t("common:actions.close")}
          size="small"
          sx={{ position: "absolute", right: 4, top: 4 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 1, flexShrink: 0 }} />
    </>
  );

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
          sx={mobileSheetSx}
        >
          {renderSheetHeader(() => setMoreOpen(false))}
          <Box sx={{ overflowY: "auto", pb: "env(safe-area-inset-bottom)" }}>{navList}</Box>
        </Drawer>
      )}

      {!isDesktop && (
        <Drawer
          anchor="bottom"
          open={Boolean(quickAccessGroupItem)}
          onClose={() => setQuickAccessGroupKey(null)}
          ModalProps={{ keepMounted: true }}
          sx={mobileSheetSx}
        >
          {renderSheetHeader(() => setQuickAccessGroupKey(null))}
          <Box sx={{ overflowY: "auto", pb: "env(safe-area-inset-bottom)" }}>
            {quickAccessGroupItem && (
              <List sx={{ px: 1 }}>
                <ListItem sx={{ px: 2, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>{quickAccessGroupItem.icon}</ListItemIcon>
                  <ListItemText
                    primary={t(`navigation:modules.${quickAccessGroupItem.key}`)}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                </ListItem>
                {(quickAccessGroupItem.children ?? []).map((child) =>
                  renderNavItem(child, false, () => setQuickAccessGroupKey(null)),
                )}
              </List>
            )}
          </Box>
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
            value={quickAccessGroupItem ? quickAccessGroupItem.key : (activePrimaryKey ?? (moreOpen ? "more" : false))}
            onChange={(_e, value) => {
              if (value === "more") {
                setMoreOpen(true);
                return;
              }
              const item = visibleNavItems.find((n) => n.key === value);
              if (!item) return;
              // A quick-access group (e.g. Purchasing) has no page of its
              // own -- open a sheet of its sub-pages instead of navigating.
              if (item.children) {
                setQuickAccessGroupKey(item.key);
                return;
              }
              if (item.path) navigate(item.path);
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
