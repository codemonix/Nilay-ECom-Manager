import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { MatchedCustomerOrder } from "../types";
import { useOrderCustomerSearch } from "../hooks/useOrderCustomerSearch";
import { formatDate } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";
import { Ltr } from "../../../components/Ltr";

interface CustomerOrderAutocompleteProps {
  value: MatchedCustomerOrder | null;
  onChange: (match: MatchedCustomerOrder | null) => void;
  error?: boolean;
  helperText?: string;
}

/**
 * Finds a customer by searching their orders (name, phone, or order id),
 * not Shopfa's registered-user list -- see useOrderCustomerSearch for why.
 * Selecting an option identifies the customer *and* the order the case is
 * about in one step.
 */
export function CustomerOrderAutocomplete({ value, onChange, error, helperText }: CustomerOrderAutocompleteProps) {
  const { t } = useTranslation("complaints");
  const language = useActiveLanguage();
  const [inputValue, setInputValue] = useState("");
  const { options, isLoading } = useOrderCustomerSearch(inputValue);

  return (
    <Autocomplete
      value={value}
      onChange={(_e, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={(_e, newInputValue) => setInputValue(newInputValue)}
      options={options}
      loading={isLoading}
      getOptionLabel={(option) => option.customerName}
      isOptionEqualToValue={(option, val) => option.externalOrderId === val.externalOrderId}
      filterOptions={(x) => x}
      renderOption={(props, option) => (
        <li {...props} key={option.externalOrderId}>
          <Stack sx={{ width: "100%" }}>
            <Typography variant="body2">{option.customerName}</Typography>
            <Typography variant="caption" color="text.secondary">
              <Ltr>{option.orderNumber}</Ltr>
              {" · "}
              {option.purchaseDate ? formatDate(option.purchaseDate, language) : "—"}
              {option.customerPhone ? ` · ${option.customerPhone}` : ""}
            </Typography>
          </Stack>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("form.customer")}
          helperText={helperText ?? t("form.customerHelp")}
          error={error}
          required
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {isLoading && <CircularProgress color="inherit" size={16} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
