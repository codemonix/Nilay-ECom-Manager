import type { ApiResponse, UserDTO } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";

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
  }),
});

export const { useListUsersQuery } = usersApi;
