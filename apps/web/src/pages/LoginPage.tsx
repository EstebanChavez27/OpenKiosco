import { useEffect, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Delete, KeyRound, Lock, ScanLine, Store, Wallet } from "lucide-react"
import { toast } from "sonner"
import { ApiError, api } from "@/lib/api"
import type { User } from "@/lib/types"
import { useAuthStore } from "@/stores/auth"
import { cn } from "@/lib/cn"
import { initials } from "@/lib/format"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"

export default function LoginPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const login = useAuthStore((s) => s.login)

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [pin, setPin] = useState("")
  const [shakeKey, setShakeKey] = useState(0)
  const [adminMode, setAdminMode] = useState(false)
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const usersQ = useQuery({
    queryKey: ["auth", "users"],
    queryFn: () => api.get<{ users: User[] }>("/auth/users"),
    staleTime: Infinity,
    retry: false,
    enabled: !adminMode,
  })

  useEffect(() => {
    if (!adminMode && usersQ.data?.users.length && !selectedUser) {
      setSelectedUser(usersQ.data.users[0])
    }
  }, [usersQ.data, adminMode, selectedUser])

  useEffect(() => {
    if (token) navigate("/", { replace: true })
  }, [token, navigate])

  const fail = () => {
    setShakeKey((k) => k + 1)
    setPin("")
  }

  const doPinLogin = async (target: User | null, code: string) => {
    if (!target || busy) return
    setBusy(true)
    try {
      const res = await api.post<{ token: string; user: User }>("/auth/login-pin", {
        username: target.username,
        pin: code,
      })
      qc.clear()
      login(res.token, res.user)
      navigate("/", { replace: true })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Error de conexión")
      fail()
    } finally {
      setBusy(false)
    }
  }

  const submitAdmin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy || !username || !password) return
    setBusy(true)
    try {
      const res = await api.post<{ token: string; user: User }>("/auth/login-admin", {
        username,
        password,
      })
      qc.clear()
      login(res.token, res.user)
      navigate("/", { replace: true })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Error de conexión")
      fail()
    } finally {
      setBusy(false)
    }
  }

  const pressDigit = (d: string) => {
    setPin((p) => (p.length >= 6 ? p : p + d))
  }

  useEffect(() => {
    if (pin.length === 6 && selectedUser) void doPinLogin(selectedUser, pin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  useEffect(() => {
    if (adminMode) return
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
      if (/^[0-9]$/.test(e.key)) pressDigit(e.key)
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1))
      else if (e.key === "Enter" && pin.length >= 4) void doPinLogin(selectedUser, pin)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, selectedUser, adminMode])

  if (token) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-slate-800 bg-slate-900/40 p-10 lg:flex">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="rounded-xl bg-emerald-500 p-2 text-slate-950">
            <Store size={24} />
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">
              Open<span className="text-emerald-400">Kiosco</span>
            </p>
            <p className="text-xs text-slate-500">POS libre para almacenes de barrio</p>
          </div>
        </div>
        <ul className="relative space-y-5">
          <Feature icon={ScanLine} title="Cero fricción en el mostrador" desc="Escáner, búsqueda instantánea y todo el flujo desde el teclado." />
          <Feature icon={Wallet} title="Pagos mixtos y fiados" desc="Efectivo, tarjeta, QR y cuenta corriente en la misma venta." />
          <Feature icon={Lock} title="Arqueo a ciegas por turno" desc="Controlá la caja sin que el cajero vea lo esperado." />
        </ul>
        <p className="relative text-[11px] text-slate-600">Open source · v0.1.0</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:hidden">
            <p className="text-xl font-bold tracking-tight">
              Open<span className="text-emerald-400">Kiosco</span>
            </p>
          </div>

          {!adminMode ? (
            <div key={shakeKey} className={cn("space-y-5", shakeKey > 0 && "animate-shake")}>
              <div className="text-center">
                <h1 className="text-lg font-semibold">Ingresar al sistema</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Elegí tu usuario y escribí tu PIN numérico
                </p>
              </div>

              {usersQ.isLoading ? (
                <Spinner />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {(usersQ.data?.users ?? []).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u)
                          setPin("")
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                          selectedUser?.id === u.id
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-slate-700 hover:border-slate-500",
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-300">
                          {initials(u.fullName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{u.fullName}</span>
                          <span className="text-[10px] uppercase tracking-wide text-emerald-400">
                            {u.role}
                          </span>
                        </span>
                      </button>
                    ))}
                    {(usersQ.data?.users.length ?? 0) === 0 && (
                      <p className="col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-300">
                        No hay usuarios activos. Ejecutá el seed del backend.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-center gap-2.5">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-3.5 w-3.5 rounded-full border transition-all",
                          i < pin.length
                            ? "scale-110 border-emerald-400 bg-emerald-400"
                            : "border-slate-600 bg-transparent",
                        )}
                      />
                    ))}
                  </div>

                  <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                      <button
                        key={d}
                        onClick={() => pressDigit(d)}
                        className="h-14 rounded-xl border border-slate-700 bg-slate-800/60 font-mono text-xl font-semibold transition hover:border-emerald-500/60 hover:bg-slate-700 active:scale-95"
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      onClick={() => setPin("")}
                      className="h-14 rounded-xl border border-slate-700 bg-slate-800/40 text-xs font-medium text-slate-400 transition hover:bg-slate-700 active:scale-95"
                    >
                      BORRAR
                    </button>
                    <button
                      onClick={() => pressDigit("0")}
                      className="h-14 rounded-xl border border-slate-700 bg-slate-800/60 font-mono text-xl font-semibold transition hover:border-emerald-500/60 hover:bg-slate-700 active:scale-95"
                    >
                      0
                    </button>
                    <button
                      onClick={() => setPin((p) => p.slice(0, -1))}
                      className="flex h-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/40 text-slate-400 transition hover:bg-slate-700 active:scale-95"
                    >
                      <Delete size={18} />
                    </button>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={busy}
                    disabled={pin.length < 4 || !selectedUser}
                    onClick={() => void doPinLogin(selectedUser, pin)}
                  >
                    Entrar
                  </Button>
                </>
              )}

              <div className="text-center">
                <button
                  onClick={() => setAdminMode(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-emerald-400"
                >
                  <KeyRound size={13} /> Acceso administrador con contraseña
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitAdmin} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="text-center">
                <h1 className="text-lg font-semibold">Acceso administrador</h1>
                <p className="mt-1 text-sm text-slate-500">Usuario y contraseña de gestión</p>
              </div>
              <Input label="Usuario" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
                Iniciar sesión
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setAdminMode(false)}
                  className="text-xs text-slate-500 transition hover:text-emerald-400"
                >
                  Volver al ingreso por PIN
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Lock; title: string; desc: string }) {
  return (
    <li className="flex gap-4">
      <span className="rounded-lg bg-emerald-500/15 p-2.5 text-emerald-400">
        <Icon size={20} />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
    </li>
  )
}
