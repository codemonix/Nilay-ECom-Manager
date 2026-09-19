import { Navigate, Route, Routes } from "react-router-dom";
import { MenuKey } from "@complaint-system/shared";
import { MainLayout } from "../layouts/MainLayout";
import { CaseListPage } from "../features/complaints/pages/CaseListPage";
import { CaseDetailPage } from "../features/complaints/pages/CaseDetailPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { UsersPage } from "../features/users/pages/UsersPage";
import { LogsPage } from "../features/logs/pages/LogsPage";
import { PackagesPage } from "../features/purchasing/pages/PackagesPage";
import { PackageDetailPage } from "../features/purchasing/pages/PackageDetailPage";
import { ReceiveItemsPage } from "../features/purchasing/pages/ReceiveItemsPage";
import { MatchRegisterPage } from "../features/purchasing/pages/MatchRegisterPage";
import { PurchasingOverviewPage } from "../features/purchasing/pages/PurchasingOverviewPage";
import { ReceivingListPage } from "../features/receiving/pages/ReceivingListPage";
import { ReceivingDetailPage } from "../features/receiving/pages/ReceivingDetailPage";
import { SoldQuantityCheckPage } from "../features/devTools/pages/SoldQuantityCheckPage";
import { TitleAsteriskCheckPage } from "../features/devTools/pages/TitleAsteriskCheckPage";
import { OrderAdminNotePage } from "../features/devTools/pages/OrderAdminNotePage";
import { ShortageReportPage } from "../features/reporting/pages/ShortageReportPage";
import { OrderPrecheckPage } from "../features/orderPrecheck/pages/OrderPrecheckPage";
import { PackingPage } from "../features/packing/pages/PackingPage";
import { PackingHistoryPage } from "../features/packing/pages/PackingHistoryPage";
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
                <Route
                  path="/purchasing/packages"
                  element={
                    <RequirePermission menuKey={MenuKey.PURCHASING}>
                      <PackagesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/purchasing/packages/:packageId"
                  element={
                    <RequirePermission menuKey={MenuKey.PURCHASING}>
                      <PackageDetailPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/purchasing/receive"
                  element={
                    <RequirePermission menuKey={MenuKey.PURCHASING}>
                      <ReceiveItemsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/purchasing/match"
                  element={
                    <RequirePermission menuKey={MenuKey.PURCHASING}>
                      <MatchRegisterPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/purchasing/overview"
                  element={
                    <RequirePermission menuKey={MenuKey.PURCHASING}>
                      <PurchasingOverviewPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/receiving"
                  element={
                    <RequirePermission menuKey={MenuKey.RECEIVING}>
                      <ReceivingListPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/receiving/:packageId"
                  element={
                    <RequirePermission menuKey={MenuKey.RECEIVING}>
                      <ReceivingDetailPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/dev-tools/sold-quantity"
                  element={
                    <RequirePermission menuKey={MenuKey.DEV_TOOLS}>
                      <SoldQuantityCheckPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/dev-tools/title-asterisk"
                  element={
                    <RequirePermission menuKey={MenuKey.DEV_TOOLS}>
                      <TitleAsteriskCheckPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/dev-tools/order-note"
                  element={
                    <RequirePermission menuKey={MenuKey.DEV_TOOLS}>
                      <OrderAdminNotePage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/reporting/shortage"
                  element={
                    <RequirePermission menuKey={MenuKey.REPORTING}>
                      <ShortageReportPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/order-precheck"
                  element={
                    <RequirePermission menuKey={MenuKey.ORDER_CHECK}>
                      <OrderPrecheckPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/packing"
                  element={
                    <RequirePermission menuKey={MenuKey.PACKING}>
                      <PackingPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/packing/history"
                  element={
                    <RequirePermission menuKey={MenuKey.PACKING}>
                      <PackingHistoryPage />
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
