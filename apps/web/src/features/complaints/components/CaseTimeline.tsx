import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import { useTranslation } from "react-i18next";
import type { CaseEventDTO } from "../types";
import { describeActor, describeEvent } from "../utils/eventFormatting";
import { EmptyState } from "../../../components/EmptyState";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const EVENT_DOT_COLOR: Record<string, string> = {
  created: "primary.main",
  resolved: "success.main",
  reopened: "warning.main",
  closed: "grey.500",
  status_changed: "info.main",
  priority_changed: "warning.main",
};

interface CaseTimelineProps {
  events: CaseEventDTO[] | undefined;
  isLoading: boolean;
}

export function CaseTimeline({ events, isLoading }: CaseTimelineProps) {
  const { t } = useTranslation("complaints");
  const language = useActiveLanguage();

  if (isLoading) {
    return (
      <Stack spacing={2}>
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} variant="rounded" height={56} />
        ))}
      </Stack>
    );
  }

  if (!events || events.length === 0) {
    return <EmptyState message={t("detail.sections.timeline")} />;
  }

  return (
    <Stack spacing={0} component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const body = event.body;
        return (
          <Stack direction="row" spacing={2} key={event.id} component="li">
            <Stack alignItems="center" sx={{ width: 20, flexShrink: 0 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: EVENT_DOT_COLOR[event.type] ?? "grey.400",
                  mt: 0.7,
                  flexShrink: 0,
                }}
              />
              {!isLast && <Box sx={{ flexGrow: 1, width: 2, bgcolor: "divider", minHeight: 28 }} />}
            </Stack>
            <Box sx={{ pb: 3, flexGrow: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(event.createdAt, language)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  · {describeActor(event, t)}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                {describeEvent(event, t)}
              </Typography>
              {body && (
                <Paper
                  variant="outlined"
                  sx={{ mt: 0.75, p: 1.25, bgcolor: "background.default", whiteSpace: "pre-wrap" }}
                >
                  <Typography variant="body2">{body}</Typography>
                </Paper>
              )}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
