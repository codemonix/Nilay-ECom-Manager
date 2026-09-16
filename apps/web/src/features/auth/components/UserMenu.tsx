import { useState, type MouseEvent } from "react";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import LockResetIcon from "@mui/icons-material/LockReset";
import LogoutIcon from "@mui/icons-material/Logout";
import AppsIcon from "@mui/icons-material/Apps";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { logout } from "../../../store/authSlice";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { QuickAccessMenuDialog } from "./QuickAccessMenuDialog";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu() {
  const { t } = useTranslation(["auth", "common"]);
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);

  if (!user) return null;

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <IconButton onClick={handleOpen} size="small" aria-label={t("auth:userMenu.label")}>
        <Avatar sx={{ width: 32, height: 32, fontSize: 13 }}>{initials(user.name)}</Avatar>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {user.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {t(`common:roles.${user.role}`)}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            handleClose();
            setChangePasswordOpen(true);
          }}
        >
          <ListItemIcon>
            <LockResetIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("auth:userMenu.changePassword")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            setQuickAccessOpen(true);
          }}
        >
          <ListItemIcon>
            <AppsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("auth:userMenu.quickAccessMenu")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            dispatch(logout());
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("auth:userMenu.logout")}</ListItemText>
        </MenuItem>
      </Menu>
      <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      <QuickAccessMenuDialog open={quickAccessOpen} onClose={() => setQuickAccessOpen(false)} />
    </>
  );
}
