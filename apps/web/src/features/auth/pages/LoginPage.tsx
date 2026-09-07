import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import DiamondIcon from "@mui/icons-material/Diamond";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { setCredentials } from "../../../store/authSlice";
import { useLoginMutation } from "../api/authApi";
import { getApiErrorMessage } from "../../../utils/apiError";

export function LoginPage() {
  const { t } = useTranslation(["auth", "common"]);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAppSelector((state) => state.auth.token);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = useLoginMutation();

  if (token) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { token: newToken, user } = await login({ email, password }).unwrap();
      dispatch(setCredentials({ token: newToken, user }));
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch {
      // error state is surfaced via the `error` value from the mutation hook
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper variant="outlined" sx={{ p: 4, width: "100%", maxWidth: 380 }}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit}>
          <Stack spacing={1} alignItems="center">
            <DiamondIcon color="primary" fontSize="large" />
            <Typography variant="h1" sx={{ fontSize: "1.4rem" }}>
              {t("common:app.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("auth:login.subtitle")}
            </Typography>
          </Stack>

          <TextField
            label={t("auth:login.email")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label={t("auth:login.password")}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />

          {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("auth:login.error")}</Alert>}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isLoading ? t("auth:login.submitting") : t("auth:login.submit")}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
