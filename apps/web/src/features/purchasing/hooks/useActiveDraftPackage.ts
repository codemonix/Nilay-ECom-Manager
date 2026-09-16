import { useGetOpenDraftPackageQuery } from "../api/packagesApi";

/** Resolves (creating if needed) the single shared open Draft package used by the Receive Items flow. */
export function useActiveDraftPackage() {
  const { data, isLoading, isError, refetch } = useGetOpenDraftPackageQuery();
  return { draftPackage: data, isLoading, isError, refetch };
}
