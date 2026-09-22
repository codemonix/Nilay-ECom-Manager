import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "../utils/apiError";
import { getAutoRetryDelaySeconds, getUpstreamErrorKind } from "../utils/upstreamError";

interface UpstreamErrorAlertProps {
  /** The RTK Query error to describe. */
  error: unknown;
  /** Message shown for errors that aren't connectivity problems and have no server-provided text. */
  fallbackMessage: string;
  /** Re-runs the failed request. */
  onRetry: () => void;
  /** True while a retry is in flight; pauses the countdown and disables the button. */
  isRetrying: boolean;
}

/**
 * Error banner for data loads that depend on the Shopfa store. For
 * connectivity failures (our API can't reach Shopfa, or the browser can't
 * reach our API) it shows a friendly explanation, a Retry button, and a
 * live countdown to an automatic retry with growing delays (see
 * AUTO_RETRY_DELAYS_SECONDS); once those are used up it stops and waits for
 * the button. Other errors get a plain banner with the server's message.
 * Render it only while `error` is set: unmounting resets the retry count.
 */
export function UpstreamErrorAlert({ error, fallbackMessage, onRetry, isRetrying }: UpstreamErrorAlertProps) {
  const { t } = useTranslation("common");
  const kind = getUpstreamErrorKind(error);
  const attemptRef = useRef(0);
  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Each failed attempt yields a new `error` object, which restarts the countdown for the next delay.
  useEffect(() => {
    if (!kind || isRetrying) {
      setSecondsLeft(null);
      return;
    }
    const delay = getAutoRetryDelaySeconds(attemptRef.current);
    if (delay === null) {
      setSecondsLeft(null);
      return;
    }
    const deadline = Date.now() + delay * 1000;
    setSecondsLeft(delay);
    const timer = window.setInterval(() => {
      const remaining = Math.ceil((deadline - Date.now()) / 1000);
      if (remaining <= 0) {
        window.clearInterval(timer);
        attemptRef.current += 1;
        setSecondsLeft(null);
        onRetryRef.current();
      } else {
        setSecondsLeft(remaining);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [error, kind, isRetrying]);

  const handleManualRetry = () => {
    attemptRef.current = 0;
    onRetry();
  };

  if (!kind) {
    return <Alert severity="error">{getApiErrorMessage(error) ?? fallbackMessage}</Alert>;
  }

  return (
    <Alert
      severity="warning"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={handleManualRetry}
          disabled={isRetrying}
          startIcon={isRetrying ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
        >
          {t("upstreamError.retry")}
        </Button>
      }
    >
      <AlertTitle>{t(`upstreamError.${kind}.title`)}</AlertTitle>
      {t(`upstreamError.${kind}.body`)}
      {isRetrying
        ? ` ${t("upstreamError.retrying")}`
        : secondsLeft !== null
          ? ` ${t("upstreamError.autoRetryIn", { count: secondsLeft })}`
          : ` ${t("upstreamError.autoRetryStopped")}`}
    </Alert>
  );
}
