import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookUser,
  Calendar,
  DollarSign,
  Download,
  Filter,
  Package,
  Printer,
  Receipt,
  RotateCcw,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react"
import { api } from "@/lib/api"
import type { DashboardReport, Sale, Shift } from "@/lib/types"
import { methodLabel, PAYMENT_METHODS } from "@/lib/constants"
import { fmtDate, fmtMoney, fmtTime } from "@/lib/format"
import { cn } from "@/lib/cn"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { ReceiptTicketModal } from "@/components/pos/ReceiptTicketModal"
import { CsvExportModal } from "@/components/reports/CsvExportModal"

type ViewMode = "today" | "all" | "range" | "shift"

export default function ReportsPage() {
  const [selectedTicketSale, setSelectedTicketSale] = useState<Sale | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>("today")
  const [selectedShiftId, setSelectedShiftId] = useState<string>("")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))

  const shiftsQ = useQuery({
    queryKey: ["shifts", "list"],
    queryFn: () => api.get<{ shifts: Shift[] }>("/shifts"),
  })

  const dashboardQuery = new URLSearchParams()
  if (viewMode === "shift" && selectedShiftId) {
    dashboardQuery.set("shiftId", selectedShiftId)
  } else if (viewMode === "range") {
    dashboardQuery.set("startDate", startDate)
    dashboardQuery.set("endDate", endDate)
  } else if (viewMode === "all") {
    dashboardQuery.set("mode", "all")
  } else {
    dashboardQuery.set("mode", "today")
  }

  const reportQ = useQuery({
    queryKey: ["reports", "dashboard", viewMode, selectedShiftId, startDate, endDate],
    queryFn: () => api.get<DashboardReport>(`/reports/dashboard?${dashboardQuery.toString()}`),
    refetchInterval: viewMode === "today" ? 30000 : undefined,
  })

  const shifts = shiftsQ.data?.shifts ?? []
  const selectedShift = shifts.find((s) => s.id === selectedShiftId) || reportQ.data?.shiftInfo

  const shiftLabel = selectedShift
    ? `Turno #${selectedShift.id.slice(0, 6)} - ${fmtDate(selectedShift.openedAt)} (${selectedShift.user?.fullName || "Cajero"})`
    : undefined

  if (reportQ.isPending && !reportQ.data) return <Spinner />

  const r = reportQ.data ?? {
    salesTotal: 0,
    salesCount: 0,
    averageTicket: 0,
    estimatedProfit: 0,
    byMethod: {},
    cashMovements: { cashIn: 0, cashOut: 0, count: 0, items: [] },
    lowStockCount: 0,
    lowStock: [],
    fiados: { total: 0, customers: 0 },
    openShift: null,
    sales: [],
  }

  const maxMethod = Math.max(1, ...Object.values(r.byMethod).map((m) => m.amount))
  const salesList = r.sales ?? []

  return (
    <div className="space-y-4">
      {/* Barra Superior de Filtros y Exportación */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Filter size={14} className="text-emerald-400" />
            <span>Filtro:</span>
          </div>

          <select
            value={viewMode === "shift" ? `shift:${selectedShiftId}` : viewMode}
            onChange={(e) => {
              const val = e.target.value
              if (val.startsWith("shift:")) {
                setViewMode("shift")
                setSelectedShiftId(val.replace("shift:", ""))
              } else {
                setViewMode(val as ViewMode)
                setSelectedShiftId("")
              }
            }}
            className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="today">📅 Ventas de Hoy (Por defecto)</option>
            <option value="all">🌐 Histórico Global Consolidado</option>
            <option value="range">📆 Rango de Fechas Personalizado</option>
            {shifts.length > 0 && <option disabled>────────── TURNOS RECIENTES ──────────</option>}
            {shifts.map((s) => (
              <option key={s.id} value={`shift:${s.id}`}>
                Turno #{s.id.slice(0, 6)} · {fmtDate(s.openedAt)} {fmtTime(s.openedAt)} · {s.user?.fullName || "Cajero"} {s.status === "OPEN" ? "🟢 (Abierto)" : "⚪ (Cerrado)"}
              </option>
            ))}
          </select>

          {viewMode === "range" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
              />
              <span className="text-xs text-slate-500">hasta</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          )}

          {viewMode !== "today" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode("today")
                setSelectedShiftId("")
              }}
              title="Restablecer a hoy"
            >
              <RotateCcw size={13} /> Restablecer
            </Button>
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setExportModalOpen(true)}
          className="shrink-0"
        >
          <Download size={14} /> Exportar Datos (CSV)
        </Button>
      </div>

      {/* Banner de Información de Turno Seleccionado */}
      {viewMode === "shift" && selectedShift && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-500/20 px-2 py-1 font-mono font-bold text-indigo-300">
                Turno #{selectedShift.id.slice(0, 8)}
              </span>
              <span className="font-semibold text-slate-200">
                {selectedShift.user?.fullName || "Cajero"}
              </span>
              {selectedShift.status === "OPEN" ? (
                <Badge variant="emerald">Abierto actualmente</Badge>
              ) : (
                <Badge variant="slate">Cerrado</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-slate-400 font-mono">
              <span>
                Apertura: <strong>{fmtDate(selectedShift.openedAt)} {fmtTime(selectedShift.openedAt)}</strong>
              </span>
              {selectedShift.closedAt && (
                <span>
                  Cierre: <strong>{fmtDate(selectedShift.closedAt)} {fmtTime(selectedShift.closedAt)}</strong>
                </span>
              )}
              <span>
                Fondo Inicial: <strong>{fmtMoney(selectedShift.initialCash)}</strong>
              </span>
              {selectedShift.difference !== null && (
                <span>
                  Diferencia Arqueo:{" "}
                  <strong className={selectedShift.difference >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {selectedShift.difference > 0 ? "+" : ""}{fmtMoney(selectedShift.difference)}
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas Principales */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Receipt}
          label={
            viewMode === "shift"
              ? "Ventas del turno"
              : viewMode === "range"
                ? "Ventas del período"
                : viewMode === "all"
                  ? "Ventas históricas"
                  : "Ventas de hoy"
          }
          value={fmtMoney(r.salesTotal)}
          sub={`${r.salesCount} tickets · promedio ${fmtMoney(r.averageTicket)}`}
          accent
        />
        <Stat
          icon={TrendingUp}
          label="Ganancia estimada"
          value={fmtMoney(r.estimatedProfit)}
          sub="Ventas - Costos de mercadería"
          indigo
        />
        <Stat
          icon={BookUser}
          label="En fiados actuales"
          value={fmtMoney(r.fiados.total)}
          sub={`${r.fiados.customers} clientes con deuda`}
          amber
        />
        <Stat
          icon={Package}
          label="Bajo stock"
          value={String(r.lowStockCount)}
          sub="productos a reponer"
          warn
        />
      </div>

      {/* Gráfico de Métodos de Pago y Resumen de Caja Chica */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Desglose por método de pago</h2>
          {Object.keys(r.byMethod).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Sin operaciones registradas para este filtro.
            </p>
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
                    <span className="w-24 text-right font-mono font-semibold">{fmtMoney(data.amount)}</span>
                    <span className="w-10 text-right text-xs text-slate-600">×{data.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Wallet size={16} className="text-amber-400" />
              Movimientos de Caja Chica
            </h2>
            <span className="text-xs text-slate-500">
              {r.cashMovements?.count ?? 0} movimiento(s)
            </span>
          </div>

          {(r.cashMovements?.items?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Sin ingresos ni retiros manuales en este período.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                  <span className="text-[10px] uppercase text-emerald-400 font-semibold block">Total Ingresos</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">+{fmtMoney(r.cashMovements.cashIn)}</span>
                </div>
                <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-center">
                  <span className="text-[10px] uppercase text-red-400 font-semibold block">Total Egresos</span>
                  <span className="font-mono font-bold text-red-400 text-sm">-{fmtMoney(r.cashMovements.cashOut)}</span>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {r.cashMovements.items?.slice(0, 10).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-1.5 text-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      {m.type === "CASH_IN" ? (
                        <ArrowDownLeft size={13} className="text-emerald-400 shrink-0" />
                      ) : (
                        <ArrowUpRight size={13} className="text-red-400 shrink-0" />
                      )}
                      <span className="text-slate-300 truncate">{m.reason}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold">
                        {m.type === "CASH_IN" ? "+" : "-"}{fmtMoney(m.amount)}
                      </span>
                      <span className="text-[10px] text-slate-500">{fmtTime(m.createdAt)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Reposición de Stock */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Package size={16} className="text-amber-400" />
            Alertas de Stock Crítico
          </h2>
          <Link to="/stock" className="text-xs text-emerald-400 hover:underline">
            Ver inventario completo →
          </Link>
        </div>

        {r.lowStock.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Todos los artículos cuentan con stock superior al mínimo.
          </p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {r.lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="flex items-center gap-2 shrink-0">
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

      {/* Ventas Filtradas con Impresión de Tickets */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Receipt size={16} className="text-emerald-400" />
            {viewMode === "shift"
              ? `Ventas del Turno #${selectedShiftId.slice(0, 6)}`
              : "Ventas Registradas"}
          </h2>
          <span className="text-xs text-slate-500">
            {salesList.length} venta(s) encontrada(s)
          </span>
        </div>

        {salesList.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Sin ventas registradas en esta vista.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900/50">
                <tr>
                  <th className="py-2.5 px-3">Ticket / Fecha</th>
                  <th className="py-2.5 px-3">Cajero</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {salesList.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-slate-200">
                        #{sale.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {fmtDate(sale.createdAt)} {fmtTime(sale.createdAt)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {sale.user?.fullName ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {sale.customer?.name ?? <span className="text-slate-600">Consumidor final</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                      {fmtMoney(sale.subtotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {fmtMoney(sale.total)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedTicketSale(sale)}
                      >
                        <Printer size={13} /> Ver Ticket / PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Detalle de Ticket Térmico */}
      <ReceiptTicketModal
        open={!!selectedTicketSale}
        onClose={() => setSelectedTicketSale(null)}
        sale={selectedTicketSale}
      />

      {/* Modal de Exportación CSV Granular */}
      <CsvExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        currentShiftId={viewMode === "shift" && selectedShiftId ? selectedShiftId : undefined}
        currentShiftLabel={shiftLabel}
      />
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  indigo,
  amber,
  warn,
}: {
  icon: typeof Receipt
  label: string
  value: string
  sub?: string
  accent?: boolean
  indigo?: boolean
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
              : indigo
                ? "bg-indigo-500/15 text-indigo-300"
                : amber
                  ? "bg-amber-500/15 text-amber-400"
                  : warn
                    ? "bg-red-500/15 text-red-400"
                    : "bg-slate-800 text-slate-300",
          )}
        >
          <Icon size={18} />
        </span>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className="font-mono text-xl font-bold">{value}</p>
      {sub && <p className="text-[11px] text-slate-600 truncate">{sub}</p>}
    </Card>
  )
}
