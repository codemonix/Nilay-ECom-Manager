import { Navigate, Route, Routes } from "react-router-dom";
import { MenuKey } from "@complaint-system/shared";
import { MainLayout } from "../layouts/MainLayout";
import { CaseListPage } from "../features/complaints/pages/CaseListPage";
import { CaseDetailPage } from "../features/complaints/pages/CaseDetailPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { UsersPage } from "../features/users/pages/UsersPage";
import { LogsPage } from "../features/logs/pages/LogsPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { NoAccessPage } from "../pages/NoAccessPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RequireAuth, RequirePermission } from "./RequireAuth";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/cases" replace />} />
                <Route path="/no-access" element={<NoAccessPage />} />
                <Route
                  path="/cases"
                  element={
                    <RequirePermission menuKey={MenuKey.CASES}>
                      <CaseListPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/cases/:caseId"
                  element={
                    <RequirePermission menuKey={MenuKey.CASES}>
                      <CaseDetailPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequirePermission menuKey={MenuKey.SETTINGS}>
                      <SettingsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RequirePermission menuKey={MenuKey.USERS}>
                      <UsersPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/logs"
                  element={
                    <RequirePermission menuKey={MenuKey.LOGS}>
                      <LogsPage />
                    </RequirePermission>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </MainLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
