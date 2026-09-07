import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "../layouts/MainLayout";
import { CaseListPage } from "../features/complaints/pages/CaseListPage";
import { CaseDetailPage } from "../features/complaints/pages/CaseDetailPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export function AppRoutes() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/cases" replace />} />
        <Route path="/cases" element={<CaseListPage />} />
        <Route path="/cases/:caseId" element={<CaseDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MainLayout>
  );
}
