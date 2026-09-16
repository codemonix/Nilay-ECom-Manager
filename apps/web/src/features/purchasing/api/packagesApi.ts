import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type {
  MatchPreviewDTO,
  PackageAttachmentDTO,
  PackageDTO,
  PackageEventDTO,
  PackageListQuery,
  PackageListResult,
} from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export interface ReceiveItemArgs {
  packageId: string;
  quantity: number;
  unitPrice: number;
  description?: string;
  variantLabel?: string;
  notes?: string;
  photo: File;
}

export interface UpdateItemArgs {
  packageId: string;
  itemId: string;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  variantLabel?: string;
  notes?: string;
}

export const packagesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listPackages: builder.query<PackageListResult, PackageListQuery>({
      query: (params) => ({ url: "/packages", params }),
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

    getPackage: builder.query<PackageDTO, string>({
      query: (id) => `/packages/${id}`,
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "Package", id }],
    }),

    getOpenDraftPackage: builder.query<PackageDTO, void>({
      query: () => "/packages/open-draft",
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      providesTags: (result) => (result ? [{ type: "Package", id: result.id }] : []),
    }),

    createDraftPackage: builder.mutation<PackageDTO, { supplierName?: string } | void>({
      query: (body) => ({ url: "/packages", method: "POST", body: body ?? {} }),
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      invalidatesTags: [{ type: "PackageList", id: "LIST" }],
    }),

    getPackageEvents: builder.query<PackageEventDTO[], string>({
      query: (packageId) => `/packages/${packageId}/events`,
      transformResponse: (response: ApiResponse<PackageEventDTO[]>) => unwrap(response),
      providesTags: (_r, _e, packageId) => [{ type: "PackageEvents", id: packageId }],
    }),

    receiveItem: builder.mutation<PackageDTO, ReceiveItemArgs>({
      query: ({ packageId, photo, ...fields }) => {
        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
          if (value !== undefined) formData.append(key, String(value));
        });
        formData.append("photo", photo);
        return { url: `/packages/${packageId}/items`, method: "POST", body: formData };
      },
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { packageId }) => [
        { type: "Package", id: packageId },
        { type: "PackageEvents", id: packageId },
        { type: "PackageList", id: "LIST" },
      ],
    }),

    updateItem: builder.mutation<PackageDTO, UpdateItemArgs>({
      query: ({ packageId, itemId, ...body }) => ({
        url: `/packages/${packageId}/items/${itemId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { packageId }) => [
        { type: "Package", id: packageId },
        { type: "PackageEvents", id: packageId },
      ],
    }),

    removeItem: builder.mutation<PackageDTO, { packageId: string; itemId: string }>({
      query: ({ packageId, itemId }) => ({ url: `/packages/${packageId}/items/${itemId}`, method: "DELETE" }),
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { packageId }) => [
        { type: "Package", id: packageId },
        { type: "PackageEvents", id: packageId },
      ],
    }),

    /** Read-only Shopfa lookup -- no cache tags, since nothing is persisted until matchItem confirms it. */
    previewMatchItem: builder.mutation<MatchPreviewDTO, { packageId: string; itemId: string; productCode: string }>({
      query: ({ packageId, itemId, productCode }) => ({
        url: `/packages/${packageId}/items/${itemId}/match/preview`,
        method: "POST",
        body: { productCode },
      }),
      transformResponse: (response: ApiResponse<MatchPreviewDTO>) => unwrap(response),
    }),

    matchItem: builder.mutation<PackageDTO, { packageId: string; itemId: string; productCode: string }>({
      query: ({ packageId, itemId, productCode }) => ({
        url: `/packages/${packageId}/items/${itemId}/match`,
        method: "POST",
        body: { productCode },
      }),
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { packageId }) => [
        { type: "Package", id: packageId },
        { type: "PackageEvents", id: packageId },
        { type: "PackageList", id: "LIST" },
      ],
    }),

    unmatchItem: builder.mutation<PackageDTO, { packageId: string; itemId: string }>({
      query: ({ packageId, itemId }) => ({ url: `/packages/${packageId}/items/${itemId}/unmatch`, method: "POST" }),
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { packageId }) => [
        { type: "Package", id: packageId },
        { type: "PackageEvents", id: packageId },
        { type: "PackageList", id: "LIST" },
      ],
    }),

    changePackageStatus: builder.mutation<PackageDTO, { packageId: string; status: string; reason?: string }>({
      query: ({ packageId, ...body }) => ({ url: `/packages/${packageId}/status`, method: "POST", body }),
      transformResponse: (response: ApiResponse<PackageDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { packageId }) => [
        { type: "Package", id: packageId },
        { type: "PackageEvents", id: packageId },
        { type: "PackageList", id: "LIST" },
      ],
    }),

    listPackageAttachments: builder.query<PackageAttachmentDTO[], string>({
      query: (packageId) => `/packages/${packageId}/attachments`,
      transformResponse: (response: ApiResponse<PackageAttachmentDTO[]>) => unwrap(response),
      providesTags: (_r, _e, packageId) => [{ type: "PackageAttachments", id: packageId }],
    }),

    uploadPackageAttachment: builder.mutation<PackageAttachmentDTO, { packageId: string; file: File }>({
      query: ({ packageId, file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return { url: `/packages/${packageId}/attachments`, method: "POST", body: formData };
      },
      transformResponse: (response: ApiResponse<PackageAttachmentDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { packageId }) => [
        { type: "PackageAttachments", id: packageId },
        { type: "PackageEvents", id: packageId },
        { type: "Package", id: packageId },
      ],
    }),
  }),
});

export const {
  useListPackagesQuery,
  useGetPackageQuery,
  useGetOpenDraftPackageQuery,
  useCreateDraftPackageMutation,
  useGetPackageEventsQuery,
  useReceiveItemMutation,
  useUpdateItemMutation,
  useRemoveItemMutation,
  usePreviewMatchItemMutation,
  useMatchItemMutation,
  useUnmatchItemMutation,
  useChangePackageStatusMutation,
  useListPackageAttachmentsQuery,
  useUploadPackageAttachmentMutation,
} = packagesApi;
