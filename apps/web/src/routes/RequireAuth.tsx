import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { hasMenuAccess, type MenuKey } from "@complaint-system/shared";
import { useAppSelector } from "../app/hooks";

export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.auth.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function RequirePermission({ menuKey, children }: { menuKey: MenuKey; children: ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);

  if (!user || !hasMenuAccess(user, menuKey)) {
    return <Navigate to="/no-access" replace />;
  }
  return <>{children}</>;
}
