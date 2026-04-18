import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.js";
import LoginPage from "./pages/LoginPage.js";
import SalesShell from "./layouts/SalesShell.js";
import AdminShell from "./layouts/AdminShell.js";
import HeatmapPage from "./pages/sales/HeatmapPage.js";
import BlockPage from "./pages/sales/BlockPage.js";
import MyBlockingsPage from "./pages/sales/MyBlockingsPage.js";
import AdminHomePage from "./pages/admin/AdminHomePage.js";
import StockAdminPage from "./pages/admin/StockAdminPage.js";
import AllBlockingsPage from "./pages/admin/AllBlockingsPage.js";
import ConfigPage from "./pages/admin/ConfigPage.js";
import AnalyticsPage from "./pages/admin/AnalyticsPage.js";
import UsersPage from "./pages/admin/UsersPage.js";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background font-headline text-primary">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireSales({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (!user || user.role !== "SALES_MANAGER") return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (!user || user.role !== "ADMIN") return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === "ADMIN" ? "/admin" : "/sales/dashboard"} /> : <LoginPage />} />

      <Route
        path="/sales"
        element={
          <RequireAuth>
            <RequireSales>
              <SalesShell />
            </RequireSales>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<HeatmapPage />} />
        <Route path="block" element={<BlockPage />} />
        <Route path="blockings" element={<MyBlockingsPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminShell />
            </RequireAdmin>
          </RequireAuth>
        }
      >
        <Route index element={<AdminHomePage />} />
        <Route path="stock" element={<StockAdminPage />} />
        <Route path="blockings" element={<AllBlockingsPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
