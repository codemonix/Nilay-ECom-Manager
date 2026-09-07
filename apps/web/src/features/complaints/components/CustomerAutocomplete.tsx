import { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { CustomerSearchResultDTO } from "@complaint-system/shared";
import { useLazySearchCustomersQuery } from "../../customers/api/customersApi";

interface CustomerAutocompleteProps {
  value: CustomerSearchResultDTO | null;
  onChange: (customer: CustomerSearchResultDTO | null) => void;
  error?: boolean;
  helperText?: string;
}

export function CustomerAutocomplete({ value, onChange, error, helperText }: CustomerAutocompleteProps) {
  const { t } = useTranslation("complaints");
  const [inputValue, setInputValue] = useState("");
  const [trigger, { data: options = [], isFetching }] = useLazySearchCustomersQuery();

  useEffect(() => {
    const handle = setTimeout(() => {
      if (inputValue.trim().length >= 2) void trigger(inputValue.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [inputValue, trigger]);

  const optionLabel = useMemo(
    () => (option: CustomerSearchResultDTO) => `${option.name}${option.phone ? ` · ${option.phone}` : ""}`,
    [],
  );

  return (
    <Autocomplete
      value={value}
      onChange={(_e, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={(_e, newInputValue) => setInputValue(newInputValue)}
      options={options}
      loading={isFetching}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(option, val) => option.externalCustomerId === val.externalCustomerId}
      filterOptions={(x) => x}
      renderOption={(props, option) => (
        <li {...props} key={option.externalCustomerId}>
          <Stack>
            <Typography variant="body2">{option.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {option.phone} {option.email ? `· ${option.email}` : ""}
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
                  {isFetching && <CircularProgress color="inherit" size={16} />}
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
