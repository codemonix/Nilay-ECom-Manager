import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "../services/apiSlice";
import devUserReducer from "../store/devUserSlice";

export const store = configureStore({
  reducer: {
    devUser: devUserReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
