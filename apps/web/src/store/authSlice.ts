import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UserDTO } from "@complaint-system/shared";

export const AUTH_STORAGE_KEY = "complaint-system.auth";

export interface AuthState {
  token: string | null;
  user: UserDTO | null;
}

function loadInitialState(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw) as AuthState;
    return { token: parsed.token ?? null, user: parsed.user ?? null };
  } catch {
    return { token: null, user: null };
  }
}

function persist(state: AuthState) {
  try {
    if (state.token && state.user) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private browsing); session still works for this tab.
  }
}

const initialState: AuthState = loadInitialState();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; user: UserDTO }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      persist(state);
    },
    setCurrentUser(state, action: PayloadAction<UserDTO>) {
      state.user = action.payload;
      persist(state);
    },
    logout(state) {
      state.token = null;
      state.user = null;
      persist(state);
    },
  },
});

export const { setCredentials, setCurrentUser, logout } = authSlice.actions;
export default authSlice.reducer;
