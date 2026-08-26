import { useEffect, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BarChart3, BookUser, LogOut, Package, ShieldCheck, Store, Timer, Truck, Users } from "lucide-react"
import { api } from "@/lib/api"
import type { Shift } from "@/lib/types"
import { useAuthStore } from "@/stores/auth"
import { useUiStore } from "@/stores/ui"
import { useOnline } from "@/hooks/useOnline"
import { fmtDuration, fmtTime, initials } from "@/lib/format"
import { cn } from "@/lib/cn"
import { CloseShiftModal } from "./CloseShiftModal"
import { UsersManagerModal } from "../users/UsersManagerModal"

const navItems = [
  { to: "/", label: "POS", icon: Store, end: true },
  { to: "/fiados", label: "Fiados", icon: BookUser, end: false },
  { to: "/stock", label: "Stock", icon: Package, end: false },
  { to: "/proveedores", label: "Proveedores", icon: Truck, end: false },
  { to: "/reportes", label: "Reportes", icon: BarChart3, end: false },
]

export function Layout() {
  useOnline()
  const [closeOpen, setCloseOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [tick, setTick] = useState(Date.now())
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const online = useUiStore((s) => s.online)
  const lastSync = useUiStore((s) => s.lastSync)

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const shiftQ = useQuery({
    queryKey: ["shift", "current"],
    queryFn: () => api.get<{ shift: Shift | null }>("/shifts/current"),
    refetchInterval: 60000,
  })
  const shift = shiftQ.data?.shift ?? null

  const handleLogout = () => {
    logout()
    qc.clear()
    navigate("/login")
  }

  return (
    <div className="flex min-h-screen flex-col">
      {!online && (
        <div className="bg-amber-500 px-4 py-1 text-center text-xs font-semibold text-slate-950">
          Sin conexión con el servidor · último sync {fmtTime(lastSync)}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-500 p-1.5 text-slate-950">
              <Store size={18} />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-100">
              Open<span className="text-emerald-400">Kiosco</span>
            </span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100",
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span
              title={online ? "Conectado" : "Sin conexión"}
              className={cn(
                "hidden h-2 w-2 rounded-full sm:block",
                online ? "bg-emerald-400" : "bg-red-500",
              )}
            />
            {shift && (
              <button
                onClick={() => setCloseOpen(true)}
                className="hidden items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-amber-500/50 hover:text-amber-400 md:flex"
                title={`Turno abierto ${fmtTime(shift.openedAt)}`}
              >
                <Timer size={14} />
                <span>{fmtDuration(shift.openedAt, tick)}</span>
                <span className="text-slate-600">|</span>
                <span>Cerrar turno</span>
              </button>
            )}
            {user?.role === "ADMIN" && (
              <button
                onClick={() => setUsersOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/20 hover:text-indigo-200"
                title="Gestión de Usuarios y Personal"
              >
                <Users size={14} />
                <span className="hidden sm:inline">Usuarios</span>
              </button>
            )}

            <div className="hidden text-right lg:block">
              <p className="text-xs font-medium text-slate-200">{user?.fullName}</p>
              <p className="text-[10px] uppercase tracking-wide text-emerald-400">{user?.role}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
              {user ? initials(user.fullName) : "?"}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-red-400"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
        <Outlet />
      </main>

      <CloseShiftModal open={closeOpen} onClose={() => setCloseOpen(false)} />
      <UsersManagerModal open={usersOpen} onClose={() => setUsersOpen(false)} />
    </div>
  )
}
