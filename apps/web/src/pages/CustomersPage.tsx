import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BookUser, ChevronDown, Coins, MessageCircle, Pencil, Plus, Users } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Customer, LedgerEntry } from "@/lib/types"
import { useDebounce } from "@/hooks/useDebounce"
import { fmtDate, fmtMoney, fmtTime } from "@/lib/format"
import { cn } from "@/lib/cn"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { EmptyState } from "@/components/ui/EmptyState"
import { PaymentModal } from "@/components/customers/PaymentModal"
import { CustomerFormModal } from "@/components/customers/CustomerFormModal"

interface StatementData {
  customer: Customer
  entries: LedgerEntry[]
  totals: { charged: number; paid: number; balance: number }
}

export default function CustomersPage() {
  const qc = useQueryClient()
  const [rawQuery, setRawQuery] = useState("")
  const q = useDebounce(rawQuery, 250)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [payTarget, setPayTarget] = useState<Customer | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [busyWa, setBusyWa] = useState<string | null>(null)

  const customersQ = useQuery({
    queryKey: ["customers", q],
    queryFn: () => api.get<{ customers: Customer[] }>(`/customers?q=${encodeURIComponent(q)}`),
  })

  const customers = customersQ.data?.customers ?? []
  const totalDebt = customers.reduce((a, c) => a + Math.max(0, c.balance), 0)
  const debtors = customers.filter((c) => c.balance > 0.009).length

  const sendWhatsApp = async (customer: Customer) => {
    if (!customer.phone) return
    setBusyWa(customer.id)
    try {
      const st = await api.get<StatementData>(`/customers/${customer.id}/statement`)
      const last5 = st.entries.slice(0, 5)
      const lines = last5
        .map(
          (e) =>
            `${fmtDateTimeShort(e.createdAt)} ${e.type === "CHARGE" ? "+" : "-"}${e.amount.toFixed(2)} · ${e.description}`,
        )
        .join("\n")
      const text = [
        `Hola ${customer.name}! Te comparto tu estado de cuenta en OpenKiosco.`,
        `Saldo actual: $${st.totals.balance.toFixed(2)}`,
        last5.length ? `\nUltimos movimientos:\n${lines}` : "",
        "\nCuando quieras podes acercarte a abonar. Gracias!",
      ].join("\n")
      const phone = customer.phone.replace(/\D/g, "")
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
    } catch {
      toast.error("No se pudo armar el resumen")
    } finally {
      setBusyWa(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            placeholder="Buscar cliente por nombre o teléfono..."
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditTarget(null)
            setFormOpen(true)
          }}
        >
          <Plus size={16} /> Nuevo cliente
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Coins} label="Total fiado" value={fmtMoney(totalDebt)} accent />
        <StatCard icon={Users} label="Clientes con deuda" value={String(debtors)} />
        <StatCard icon={BookUser} label="Total clientes" value={String(customers.length)} />
      </div>

      {customersQ.isPending ? (
        <Spinner />
      ) : customers.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookUser}
            title="Sin clientes"
            hint="Creá tu primera libreta de fiados con el botón Nuevo cliente."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditTarget(null)
                  setFormOpen(true)
                }}
              >
                <Plus size={14} /> Nuevo cliente
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-slate-800 p-0">
          {customers.map((c) => (
            <CustomerRow
              key={c.id}
              customer={c}
              expanded={expandedId === c.id}
              busyWa={busyWa === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onPay={() => setPayTarget(c)}
              onWhatsApp={() => void sendWhatsApp(c)}
              onEdit={() => {
                setEditTarget(c)
                setFormOpen(true)
              }}
            />
          ))}
        </Card>
      )}

      <PaymentModal open={!!payTarget} onClose={() => setPayTarget(null)} customer={payTarget} />
      <CustomerFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          void qc.invalidateQueries({ queryKey: ["customers"] })
        }}
        customer={editTarget}
      />
    </div>
  )
}

function CustomerRow({
  customer,
  expanded,
  busyWa,
  onToggle,
  onPay,
  onWhatsApp,
  onEdit,
}: {
  customer: Customer
  expanded: boolean
  busyWa: boolean
  onToggle: () => void
  onPay: () => void
  onWhatsApp: () => void
  onEdit: () => void
}) {
  return (
    <>
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-800/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-300">
          {customer.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{customer.name}</p>
          <p className="truncate text-xs text-slate-500">
            {customer.phone ? `+${customer.phone}` : "sin teléfono"} · límite{" "}
            {customer.creditLimit > 0 ? fmtMoney(customer.creditLimit) : "sin tope"}
          </p>
        </div>
        <Badge variant={customer.balance > 0.009 ? "amber" : "emerald"}>
          {fmtMoney(customer.balance)}
        </Badge>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onWhatsApp()
          }}
          disabled={!customer.phone || busyWa}
          title={customer.phone ? "Enviar resumen por WhatsApp" : "El cliente no tiene teléfono"}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <MessageCircle size={17} />
        </button>
        <Button
          size="sm"
          variant="outline"
          disabled={customer.balance <= 0.009}
          onClick={(e) => {
            e.stopPropagation()
            onPay()
          }}
        >
          Cobrar
        </Button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-700 hover:text-slate-200"
          title="Editar"
        >
          <Pencil size={15} />
        </button>
        <ChevronDown
          size={16}
          className={cn("text-slate-600 transition-transform", expanded && "rotate-180")}
        />
      </div>
      {expanded && <Statement customerId={customer.id} />}
    </>
  )
}

function Statement({ customerId }: { customerId: string }) {
  const stQ = useQuery({
    queryKey: ["customer-statement", customerId],
    queryFn: () => api.get<StatementData>(`/customers/${customerId}/statement`),
  })

  if (stQ.isPending) return <div className="px-4 pb-4"><Spinner /></div>

  const entries = stQ.data?.entries ?? []

  return (
    <div className="space-y-1 px-4 pb-4 pl-16">
      {entries.length === 0 && <p className="py-2 text-xs text-slate-500">Sin movimientos registrados.</p>}
      {entries.map((e) => (
        <div key={e.id} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-1.5 text-xs">
          <span className="flex items-center gap-2 text-slate-400">
            <Badge variant={e.type === "CHARGE" ? "red" : "emerald"}>
              {e.type === "CHARGE" ? "Fiado" : "Pago"}
            </Badge>
            <span className="max-w-56 truncate">{e.description}</span>
            <span className="text-slate-600">
              {fmtDate(e.createdAt)} {fmtTime(e.createdAt)}
            </span>
          </span>
          <span className={cn("font-mono font-medium", e.type === "CHARGE" ? "text-red-400" : "text-emerald-400")}>
            {e.type === "CHARGE" ? "+" : "-"}
            {fmtMoney(e.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Card className="flex items-center gap-3">
      <span
        className={cn(
          "rounded-lg p-2.5",
          accent ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-400",
        )}
      >
        <Icon size={20} />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-mono text-xl font-bold">{value}</p>
      </div>
    </Card>
  )
}

function fmtDateTimeShort(d: string): string {
  const date = new Date(d)
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}
