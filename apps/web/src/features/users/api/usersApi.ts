import type { ApiResponse, UserDTO } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type { CreateUserPayload, ResetPasswordPayload, UpdateUserPayload } from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listUsers: builder.query<UserDTO[], void>({
      query: () => "/users",
      transformResponse: (response: ApiResponse<UserDTO[]>) => unwrap(response),
      providesTags: [{ type: "User", id: "LIST" }],
    }),

    listAllUsers: builder.query<UserDTO[], void>({
      query: () => "/users/all",
      transformResponse: (response: ApiResponse<UserDTO[]>) => unwrap(response),
      providesTags: [{ type: "User", id: "LIST" }],
    }),

    createUser: builder.mutation<UserDTO, CreateUserPayload>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      transformResponse: (response: ApiResponse<UserDTO>) => unwrap(response),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),

    updateUser: builder.mutation<UserDTO, UpdateUserPayload>({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: "PATCH", body }),
      transformResponse: (response: ApiResponse<UserDTO>) => unwrap(response),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),

    resetUserPassword: builder.mutation<{ reset: boolean }, ResetPasswordPayload>({
      query: ({ id, newPassword }) => ({ url: `/users/${id}/reset-password`, method: "POST", body: { newPassword } }),
      transformResponse: (response: ApiResponse<{ reset: boolean }>) => unwrap(response),
    }),
  }),
});

export const {
  useListUsersQuery,
  useListAllUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useResetUserPasswordMutation,
} = usersApi;
