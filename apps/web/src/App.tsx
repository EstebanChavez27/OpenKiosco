import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import type { ReactNode } from "react"
import { useAuthStore } from "@/stores/auth"
import { Layout } from "@/components/layout/Layout"
import LoginPage from "@/pages/LoginPage"
import POSPage from "@/pages/POSPage"
import CustomersPage from "@/pages/CustomersPage"
import InventoryPage from "@/pages/InventoryPage"
import SuppliersPage from "@/pages/SuppliersPage"
import ReportsPage from "@/pages/ReportsPage"

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<POSPage />} />
          <Route path="/fiados" element={<CustomersPage />} />
          <Route path="/stock" element={<InventoryPage />} />
          <Route path="/proveedores" element={<SuppliersPage />} />
          <Route path="/reportes" element={<ReportsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
