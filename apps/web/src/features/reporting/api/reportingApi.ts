import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type { ShortageReportRangeDays, ShortageReportResultDTO } from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export interface GetShortageReportArgs {
  statusCodes: number[];
  days: ShortageReportRangeDays;
}

export const reportingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /** Scans every order in the given Shopfa status codes, within the given time window, for a shortage signal in its admin note -- see ShortageReportResultDTO. */
    getShortageReport: builder.query<ShortageReportResultDTO, GetShortageReportArgs>({
      query: ({ statusCodes, days }) => ({
        url: "/reporting/shortage",
        params: { statusCodes: statusCodes.join(","), days },
      }),
      transformResponse: (response: ApiResponse<ShortageReportResultDTO>) => unwrap(response),
    }),
  }),
});

export const { useLazyGetShortageReportQuery } = reportingApi;
