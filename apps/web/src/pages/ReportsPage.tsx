import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BookUser, Package, Receipt, Wallet } from "lucide-react"
import { api } from "@/lib/api"
import type { Shift, TodayReport } from "@/lib/types"
import { methodLabel, PAYMENT_METHODS } from "@/lib/constants"
import { fmtDate, fmtMoney, fmtTime } from "@/lib/format"
import { cn } from "@/lib/cn"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Spinner } from "@/components/ui/Spinner"

export default function ReportsPage() {
  const todayQ = useQuery({
    queryKey: ["reports", "today"],
    queryFn: () => api.get<TodayReport>("/reports/today"),
    refetchInterval: 60000,
  })
  const shiftsQ = useQuery({
    queryKey: ["shifts", "list"],
    queryFn: () => api.get<{ shifts: Shift[] }>("/shifts"),
  })

  if (todayQ.isPending || !todayQ.data) return <Spinner />

  const r = todayQ.data
  const maxMethod = Math.max(1, ...Object.values(r.byMethod).map((m) => m.amount))
  const shifts = (shiftsQ.data?.shifts ?? []).slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Receipt} label="Ventas de hoy" value={fmtMoney(r.salesTotal)} sub={`${r.salesCount} tickets · promedio ${fmtMoney(r.averageTicket)}`} accent />
        <Stat icon={BookUser} label="En fiados" value={fmtMoney(r.fiados.total)} sub={`${r.fiados.customers} clientes con deuda`} amber />
        <Stat icon={Package} label="Bajo stock" value={String(r.lowStockCount)} sub="productos a reponer" warn />
        <Stat
          icon={Wallet}
          label="Turno actual"
          value={r.openShift ? fmtTime(r.openShift.openedAt) : "—"}
          sub={
            r.openShift
              ? `${r.openShift.user.fullName} · ${r.openShift._count.sales} ventas`
              : "Sin turno abierto"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Ventas de hoy por método</h2>
          {Object.keys(r.byMethod).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Todavía no hay ventas hoy.</p>
          ) : (
            <div className="space-y-2">
              {PAYMENT_METHODS.filter((m) => r.byMethod[m.value]).map(({ value }) => {
                const data = r.byMethod[value]
                return (
                  <div key={value} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-slate-400">{methodLabel(value)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(data.amount / maxMethod) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 text-right font-mono">{fmtMoney(data.amount)}</span>
                    <span className="w-10 text-right text-xs text-slate-600">×{data.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Últimos turnos</h2>
            <Link to="/" className="text-xs text-emerald-400 hover:underline">
              Ir al POS →
            </Link>
          </div>
          {shifts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin turnos registrados.</p>
          ) : (
            <div className="space-y-1.5">
              {shifts.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2 text-xs">
                  <span className="flex-1 truncate">
                    <span className="font-medium text-slate-200">{s.user?.fullName ?? s.userId}</span>
                    <span className="text-slate-500"> · {fmtDate(s.openedAt)} {fmtTime(s.openedAt)}</span>
                    {s.status === "OPEN" && <Badge variant="emerald" className="ml-1">abierto</Badge>}
                  </span>
                  <span className="font-mono text-slate-400">{s._count?.sales ?? 0} v.</span>
                  {s.status === "CLOSED" && s.difference !== null && (
                    <Badge variant={Math.abs(s.difference) < 0.01 ? "emerald" : s.difference > 0 ? "indigo" : "red"}>
                      {Math.abs(s.difference) < 0.01
                        ? "cuadrado"
                        : `${s.difference > 0 ? "+" : "-"}${Math.abs(s.difference).toFixed(2)}`}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          Reponer stock
          <Link to="/stock" className="text-xs text-emerald-400 hover:underline">
            ver todo →
          </Link>
        </h2>
        {r.lowStock.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nada por debajo del mínimo. Bien ahí.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {r.lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{fmtMoney(p.salePrice)}</span>
                  <Badge variant={p.stock <= 0 ? "red" : "amber"}>
                    queda {p.stock} · mín {p.minStock}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  amber,
  warn,
}: {
  icon: typeof Receipt
  label: string
  value: string
  sub?: string
  accent?: boolean
  amber?: boolean
  warn?: boolean
}) {
  return (
    <Card className="space-y-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-lg p-2",
            accent
              ? "bg-emerald-500/15 text-emerald-400"
              : amber
                ? "bg-amber-500/15 text-amber-400"
                : warn
                  ? "bg-red-500/15 text-red-400"
                  : "bg-indigo-500/15 text-indigo-300",
          )}
        >
          <Icon size={18} />
        </span>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className="font-mono text-xl font-bold">{value}</p>
      {sub && <p className="text-[11px] text-slate-600">{sub}</p>}
    </Card>
  )
}
