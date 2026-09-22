import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { ASSIGNABLE_MENU_KEY_VALUES, REPORT_KEY_VALUES } from "@complaint-system/shared";

interface PermissionsChecklistProps {
  selected: string[];
  onToggle: (key: string) => void;
}

/** "report:customer" -> "customer", the suffix used by the `navigation:reportsNav.*` labels. */
function reportLabelKey(key: string): string {
  return key.slice(key.indexOf(":") + 1);
}

/** Menu-section checkboxes followed by a "Reports" sub-list -- each report is granted individually (see ReportKey), the Reports menu itself appears for anyone holding at least one. */
export function PermissionsChecklist({ selected, onToggle }: PermissionsChecklistProps) {
  const { t } = useTranslation(["users", "navigation"]);
  return (
    <FormGroup>
      {ASSIGNABLE_MENU_KEY_VALUES.map((key) => (
        <FormControlLabel
          key={key}
          control={<Checkbox checked={selected.includes(key)} onChange={() => onToggle(key)} />}
          label={t(`navigation:modules.${key}`)}
        />
      ))}
      <Typography variant="subtitle2" sx={{ mt: 1 }}>
        {t("users:permissions.reportsHeading")}
      </Typography>
      <Box sx={{ pl: 2, display: "flex", flexDirection: "column" }}>
        {REPORT_KEY_VALUES.map((key) => (
          <FormControlLabel
            key={key}
            control={<Checkbox checked={selected.includes(key)} onChange={() => onToggle(key)} />}
            label={t(`navigation:reportsNav.${reportLabelKey(key)}`)}
          />
        ))}
      </Box>
    </FormGroup>
  );
}
