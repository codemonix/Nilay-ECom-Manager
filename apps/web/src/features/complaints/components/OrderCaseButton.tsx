import { useState } from "react";
import Button, { type ButtonProps } from "@mui/material/Button";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import { useTranslation } from "react-i18next";
import type { CreateOrderCaseResultDTO } from "@complaint-system/shared";
import { CreateOrderCaseDialog } from "./CreateOrderCaseDialog";

interface OrderCaseButtonProps extends Pick<ButtonProps, "size" | "fullWidth" | "sx"> {
  orderNumber: string;
  /** Called once the case exists; `orderSynced` says whether the order really moved to "در حال پیگیری" on Shopfa. */
  onCreated: (result: CreateOrderCaseResultDTO) => void;
}

/** The "create case" entry point shown on every order screen, with its dialog. */
export function OrderCaseButton({ orderNumber, onCreated, size = "small", ...buttonProps }: OrderCaseButtonProps) {
  const { t } = useTranslation("complaints");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        {...buttonProps}
        size={size}
        variant="outlined"
        color="warning"
        startIcon={<ReportProblemIcon />}
        onClick={() => setOpen(true)}
      >
        {t("createCase")}
      </Button>
      <CreateOrderCaseDialog
        open={open}
        orderNumber={orderNumber}
        onClose={() => setOpen(false)}
        onCreated={(result) => {
          setOpen(false);
          onCreated(result);
        }}
      />
    </>
  );
}
