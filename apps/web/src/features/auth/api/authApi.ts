import type {
  ApiResponse,
  AuthResponseDTO,
  ChangePasswordInputDTO,
  LoginRequestDTO,
  UpdateQuickAccessMenuInputDTO,
  UserDTO,
} from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponseDTO, LoginRequestDTO>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      transformResponse: (response: ApiResponse<AuthResponseDTO>) => unwrap(response),
    }),

    getCurrentUser: builder.query<UserDTO, void>({
      query: () => "/auth/me",
      transformResponse: (response: ApiResponse<UserDTO>) => unwrap(response),
      providesTags: [{ type: "User", id: "ME" }],
    }),

    changePassword: builder.mutation<{ changed: boolean }, ChangePasswordInputDTO>({
      query: (body) => ({ url: "/auth/change-password", method: "POST", body }),
      transformResponse: (response: ApiResponse<{ changed: boolean }>) => unwrap(response),
    }),

    updateQuickAccessMenu: builder.mutation<UserDTO, UpdateQuickAccessMenuInputDTO>({
      query: (body) => ({ url: "/auth/me/quick-access-menu", method: "PATCH", body }),
      transformResponse: (response: ApiResponse<UserDTO>) => unwrap(response),
      invalidatesTags: [{ type: "User", id: "ME" }],
    }),
  }),
});

export const {
  useLoginMutation,
  useGetCurrentUserQuery,
  useChangePasswordMutation,
  useUpdateQuickAccessMenuMutation,
} = authApi;
