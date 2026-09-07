import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import BarChartIcon from "@mui/icons-material/BarChart";
import DiamondIcon from "@mui/icons-material/Diamond";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { DevUserSelector } from "../dev/DevUserSelector";

const DRAWER_WIDTH = 240;

interface NavItem {
  key: string;
  icon: ReactNode;
  path?: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "cases", icon: <AssignmentIcon />, path: "/cases" },
  { key: "orderCheck", icon: <FactCheckIcon /> },
  { key: "packing", icon: <Inventory2Icon /> },
  { key: "purchasing", icon: <ShoppingCartIcon /> },
  { key: "inventory", icon: <WarehouseIcon /> },
  { key: "reporting", icon: <BarChartIcon /> },
];

export function MainLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation(["navigation", "common"]);
  const theme = useTheme();
  const location = useLocation();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const navList = (
    <List sx={{ px: 1 }}>
      {NAV_ITEMS.map((item) => {
        const isActive = Boolean(item.path && location.pathname.startsWith(item.path));
        const content = (
          <ListItemButton
            key={item.key}
            component={item.path ? NavLink : "div"}
            to={item.path}
            disabled={!item.path}
            selected={isActive}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 1, mb: 0.5 }}
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
      })}
    </List>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="menu">
              <MenuIcon />
            </IconButton>
          )}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
            <DiamondIcon color="primary" />
            <Typography variant="h3" component="h1" sx={{ fontSize: "1.1rem" }}>
              {t("navigation:brand")}
            </Typography>
          </Stack>
          <DevUserSelector />
          <LanguageSwitcher />
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? "permanent" : "temporary"}
        open={isDesktop ? true : mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
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

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        <Box sx={{ p: { xs: 1.5, sm: 3 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
