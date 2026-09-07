import { useState, type MouseEvent } from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import CheckIcon from "@mui/icons-material/Check";
import TranslateIcon from "@mui/icons-material/Translate";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n/i18n";
import { useActiveLanguage } from "../i18n/useActiveLanguage";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const activeLanguage = useActiveLanguage();

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleSelect = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
    handleClose();
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        startIcon={<TranslateIcon />}
        color="inherit"
        aria-haspopup="menu"
        aria-label={`${t("language.label")}: ${t(`language.${activeLanguage}`)}`}
      >
        {t(`language.${activeLanguage}`)}
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        {SUPPORTED_LANGUAGES.map((language) => (
          <MenuItem key={language} selected={language === activeLanguage} onClick={() => handleSelect(language)}>
            <ListItemIcon>{language === activeLanguage ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            {t(`language.${language}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
