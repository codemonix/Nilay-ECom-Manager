import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * V1 has no real authentication (see docs/architecture.md). This slice
 * backs the "development user selector" in the header: whichever seeded
 * staff member is selected becomes the actor for case events, sent on
 * every API request via the x-user-id header (see services/apiSlice.ts).
 */
export const DEV_USER_STORAGE_KEY = "complaint-system.selectedUserId";

export interface DevUserState {
  selectedUserId: string | null;
}

function loadInitialUserId(): string | null {
  try {
    return localStorage.getItem(DEV_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

const initialState: DevUserState = {
  selectedUserId: loadInitialUserId(),
};

const devUserSlice = createSlice({
  name: "devUser",
  initialState,
  reducers: {
    setSelectedUserId(state, action: PayloadAction<string | null>) {
      state.selectedUserId = action.payload;
      try {
        if (action.payload) localStorage.setItem(DEV_USER_STORAGE_KEY, action.payload);
        else localStorage.removeItem(DEV_USER_STORAGE_KEY);
      } catch {
        // localStorage unavailable (private browsing); selection still works for this session.
      }
    },
  },
});

export const { setSelectedUserId } = devUserSlice.actions;
export default devUserSlice.reducer;
