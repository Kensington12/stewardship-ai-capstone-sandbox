import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { CapturePage } from "./pages/CapturePage";
import { RecordsPage } from "./pages/RecordsPage";
import { ReportDetailPage } from "./pages/ReportDetailPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SyncPage } from "./pages/SyncPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/capture" replace />} />
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/records/:id/edit" element={<CapturePage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:id" element={<ReportDetailPage />} />
        <Route path="*" element={<Navigate to="/capture" replace />} />
      </Routes>
    </AppShell>
  );
}
