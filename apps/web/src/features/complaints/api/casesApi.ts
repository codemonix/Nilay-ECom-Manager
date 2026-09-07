import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type {
  AttachmentDTO,
  CaseDTO,
  CaseEventDTO,
  CaseListQuery,
  CaseListResult,
  CreateCasePayload,
} from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export const casesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listCases: builder.query<CaseListResult, CaseListQuery>({
      query: (params) => ({ url: "/cases", params }),
      transformResponse: (
        response: ApiResponse<CaseDTO[]> & {
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
              ...result.items.map((c) => ({ type: "Case" as const, id: c.id })),
              { type: "CaseList" as const, id: "LIST" },
            ]
          : [{ type: "CaseList" as const, id: "LIST" }],
    }),

    getCase: builder.query<CaseDTO, string>({
      query: (id) => `/cases/${id}`,
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "Case", id }],
    }),

    createCase: builder.mutation<CaseDTO, CreateCasePayload>({
      query: (body) => ({ url: "/cases", method: "POST", body }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: [{ type: "CaseList", id: "LIST" }],
    }),

    getCaseEvents: builder.query<CaseEventDTO[], string>({
      query: (caseId) => `/cases/${caseId}/events`,
      transformResponse: (response: ApiResponse<CaseEventDTO[]>) => unwrap(response),
      providesTags: (_result, _error, caseId) => [{ type: "CaseEvents", id: caseId }],
    }),

    addNote: builder.mutation<CaseDTO, { caseId: string; body: string; visibility: "internal" | "customer" }>({
      query: ({ caseId, ...body }) => ({ url: `/cases/${caseId}/notes`, method: "POST", body }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Case", id: caseId },
        { type: "CaseEvents", id: caseId },
        { type: "CaseList", id: "LIST" },
      ],
    }),

    changeStatus: builder.mutation<CaseDTO, { caseId: string; status: string; reason?: string }>({
      query: ({ caseId, ...body }) => ({ url: `/cases/${caseId}/status`, method: "POST", body }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Case", id: caseId },
        { type: "CaseEvents", id: caseId },
        { type: "CaseList", id: "LIST" },
      ],
    }),

    changePriority: builder.mutation<CaseDTO, { caseId: string; priority: string }>({
      query: ({ caseId, ...body }) => ({ url: `/cases/${caseId}/priority`, method: "POST", body }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Case", id: caseId },
        { type: "CaseEvents", id: caseId },
        { type: "CaseList", id: "LIST" },
      ],
    }),

    assignCase: builder.mutation<CaseDTO, { caseId: string; assignedTo: string | null }>({
      query: ({ caseId, assignedTo }) => ({ url: `/cases/${caseId}/assign`, method: "POST", body: { assignedTo } }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Case", id: caseId },
        { type: "CaseEvents", id: caseId },
        { type: "CaseList", id: "LIST" },
      ],
    }),

    changeContactPoint: builder.mutation<
      CaseDTO,
      { caseId: string; contactPoint: { platform: string; contactId?: string } }
    >({
      query: ({ caseId, contactPoint }) => ({
        url: `/cases/${caseId}/contact-point`,
        method: "POST",
        body: { contactPoint },
      }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Case", id: caseId },
        { type: "CaseEvents", id: caseId },
      ],
    }),

    linkOrder: builder.mutation<CaseDTO, { caseId: string; externalOrderId: string; orderNumber: string }>({
      query: ({ caseId, ...body }) => ({ url: `/cases/${caseId}/orders`, method: "POST", body }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Case", id: caseId },
        { type: "CaseEvents", id: caseId },
      ],
    }),

    linkItem: builder.mutation<CaseDTO, { caseId: string; externalItemId: string; sku: string; title: string }>({
      query: ({ caseId, ...body }) => ({ url: `/cases/${caseId}/items`, method: "POST", body }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Case", id: caseId },
        { type: "CaseEvents", id: caseId },
      ],
    }),

    addTag: builder.mutation<CaseDTO, { caseId: string; tag: string }>({
      query: ({ caseId, tag }) => ({ url: `/cases/${caseId}/tags`, method: "POST", body: { tag } }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Case", id: caseId },
        { type: "CaseEvents", id: caseId },
      ],
    }),

    removeTag: builder.mutation<CaseDTO, { caseId: string; tag: string }>({
      query: ({ caseId, tag }) => ({ url: `/cases/${caseId}/tags`, method: "DELETE", body: { tag } }),
      transformResponse: (response: ApiResponse<CaseDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Case", id: caseId },
        { type: "CaseEvents", id: caseId },
      ],
    }),

    listAttachments: builder.query<AttachmentDTO[], string>({
      query: (caseId) => `/cases/${caseId}/attachments`,
      transformResponse: (response: ApiResponse<AttachmentDTO[]>) => unwrap(response),
      providesTags: (_r, _e, caseId) => [{ type: "Attachments", id: caseId }],
    }),

    uploadAttachment: builder.mutation<AttachmentDTO, { caseId: string; file: File }>({
      query: ({ caseId, file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return { url: `/cases/${caseId}/attachments`, method: "POST", body: formData };
      },
      transformResponse: (response: ApiResponse<AttachmentDTO>) => unwrap(response),
      invalidatesTags: (_r, _e, { caseId }) => [
        { type: "Attachments", id: caseId },
        { type: "CaseEvents", id: caseId },
        { type: "Case", id: caseId },
      ],
    }),
  }),
});

export const {
  useListCasesQuery,
  useGetCaseQuery,
  useCreateCaseMutation,
  useGetCaseEventsQuery,
  useAddNoteMutation,
  useChangeStatusMutation,
  useChangePriorityMutation,
  useChangeContactPointMutation,
  useAssignCaseMutation,
  useLinkOrderMutation,
  useLinkItemMutation,
  useAddTagMutation,
  useRemoveTagMutation,
  useListAttachmentsQuery,
  useUploadAttachmentMutation,
} = casesApi;
