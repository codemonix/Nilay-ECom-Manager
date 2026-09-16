import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type { PackageAttachmentDTO, PackageDTO, PackageEventDTO, PackageListQuery, PackageListResult } from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

/**
 * Same Package resource Purchasing's packagesApi reads/writes, exposed
 * through /api/receiving (gated by MenuKey.RECEIVING instead of
 * MenuKey.PURCHASING) since a different role confirms what physically
 * arrived than the one who assembled the package. Reuses the "Package"/
 * "PackageList"/"PackageEvents" tags so either feature's mutations
 * invalidate the other's cached queries.
 */
export const receivingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listReceivingPackages: builder.query<PackageListResult, PackageListQuery>({
      query: (params) => ({ url: "/receiving", params }),
      transformResponse: (
        response: ApiResponse<PackageDTO[]> & {
          meta?: { page: number; pageSize: number; total: number; totalPages: number };
        },
      ) => {
        const items = unwrap(response);
        const meta = response.meta;
        return {
          items,
          page: meta?.page ?? 1,
          pageSize: meta?.pageSize ?? items.length,
          total: meta?.total ?? items.length,
          totalPages: meta?.totalPages ?? 1,
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((p) => ({ type: "Package" as const, id: p.id })),
              { type: "PackageList" as const, id: "LIST" },
            ]
          : [{ type: "PackageList" as const, id: "LIST" }],
    }),

    getReceivingPackage: builder.query<PackageDTO, string>({
      query: (id) => `/receiving/${id}`,
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "Package", id }],
    }),

    getReceivingPackageEvents: builder.query<PackageEventDTO[], string>({
      query: (packageId) => `/receiving/${packageId}/events`,
      transformResponse: (response: ApiResponse<PackageEventDTO[]>) => unwrap(response),
      providesTags: (_r, _e, packageId) => [{ type: "PackageEvents", id: packageId }],
    }),

    listReceivingAttachments: builder.query<PackageAttachmentDTO[], string>({
      query: (packageId) => `/receiving/${packageId}/attachments`,
      transformResponse: (response: ApiResponse<PackageAttachmentDTO[]>) => unwrap(response),
      providesTags: (_r, _e, packageId) => [{ type: "PackageAttachments", id: packageId }],
    }),

    updateReceivedQuantity: builder.mutation<PackageDTO, { packageId: string; itemId: string; receivedQuantity: number }>({
      query: ({ packageId, itemId, receivedQuantity }) => ({
        url: `/receiving/${packageId}/items/${itemId}/received-quantity`,
        method: "PATCH",
        body: { receivedQuantity },
      }),
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { packageId }) => [
        { type: "Package", id: packageId },
        { type: "PackageEvents", id: packageId },
      ],
    }),

    confirmReceived: builder.mutation<PackageDTO, { packageId: string; markAllComplete?: boolean }>({
      query: ({ packageId, markAllComplete }) => ({
        url: `/receiving/${packageId}/confirm-received`,
        method: "POST",
        body: { markAllComplete },
      }),
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { packageId }) => [
        { type: "Package", id: packageId },
        { type: "PackageEvents", id: packageId },
        { type: "PackageList", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListReceivingPackagesQuery,
  useGetReceivingPackageQuery,
  useGetReceivingPackageEventsQuery,
  useListReceivingAttachmentsQuery,
  useUpdateReceivedQuantityMutation,
  useConfirmReceivedMutation,
} = receivingApi;
