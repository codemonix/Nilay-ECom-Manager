import { useState, type MouseEvent, type ReactNode } from "react";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import CheckIcon from "@mui/icons-material/Check";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import type { ThemeModePreference } from "../theme/colorModeStore";
import { useColorMode } from "../theme/useColorMode";

const MODE_ICONS: Record<ThemeModePreference, ReactNode> = {
  light: <LightModeIcon fontSize="small" />,
  dark: <DarkModeIcon fontSize="small" />,
  system: <SettingsBrightnessIcon fontSize="small" />,
};

const MODES: ThemeModePreference[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const { t } = useTranslation("common");
  const { preference, resolvedMode, setPreference } = useColorMode();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleSelect = (mode: ThemeModePreference) => {
    setPreference(mode);
    handleClose();
  };

  return (
    <>
      <Tooltip title={`${t("theme.label")}: ${t(`theme.${preference}`)}`}>
        <IconButton onClick={handleOpen} color="inherit" aria-haspopup="menu" aria-label={t("theme.label")}>
          {resolvedMode === "dark" ? <DarkModeIcon /> : <LightModeIcon />}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        {MODES.map((mode) => (
          <MenuItem key={mode} selected={mode === preference} onClick={() => handleSelect(mode)}>
            <ListItemIcon>{MODE_ICONS[mode]}</ListItemIcon>
            <ListItemText>{t(`theme.${mode}`)}</ListItemText>
            {mode === preference && <CheckIcon fontSize="small" color="primary" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
