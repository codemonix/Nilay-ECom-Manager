import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import { useTranslation } from "react-i18next";
import { useListPackagesQuery } from "../api/packagesApi";
import { ItemMatchCard } from "../components/ItemMatchCard";
import { EmptyState } from "../../../components/EmptyState";

/** Matching a Shopfa code isn't gated by package status -- it can happen while draft, in transit, or already received -- so this lists unmatched items across every package, not just one status. */
export function MatchRegisterPage() {
  const { t } = useTranslation("purchasing");
  const { data, isFetching } = useListPackagesQuery({ page: 1, pageSize: 100 });

  const pendingCards = (data?.items ?? []).flatMap((pkg) =>
    pkg.items
      .filter((item) => !item.matchedAt)
      .map((item) => ({ packageId: pkg.id, packageNumber: pkg.packageNumber, item })),
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h1">{t("matchRegister.title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("matchRegister.description")}
      </Typography>

      {isFetching && !data ? (
        <Stack spacing={1.5}>
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} variant="rounded" height={120} />
          ))}
        </Stack>
      ) : pendingCards.length === 0 ? (
        <EmptyState message={t("matchRegister.empty")} />
      ) : (
        <Stack spacing={1.5}>
          {pendingCards.map(({ packageId, packageNumber, item }) => (
            <ItemMatchCard key={item.id} packageId={packageId} packageNumber={packageNumber} item={item} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
