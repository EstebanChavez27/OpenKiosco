import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Banknote,
  BookUser,
  CheckCircle2,
  CreditCard,
  Plus,
  QrCode,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { ApiError, api } from "@/lib/api"
import type { Customer, PaymentMethod, Sale } from "@/lib/types"
import { PAYMENT_METHODS, methodLabel } from "@/lib/constants"
import { cartSubtotal, cartTotal, useCartStore } from "@/stores/cart"
import { fmtMoney, num, r2 } from "@/lib/format"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Kbd } from "@/components/ui/Kbd"
import { Modal } from "@/components/ui/Modal"

interface PayRow {
  uid: number
  method: PaymentMethod
  amount: string
}

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD_DEBIT: CreditCard,
  CARD_CREDIT: CreditCard,
  QR_TRANSFER: QrCode,
  ON_ACCOUNT: BookUser,
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  CASH: "text-emerald-400",
  CARD_DEBIT: "text-sky-400",
  CARD_CREDIT: "text-violet-400",
  QR_TRANSFER: "text-indigo-400",
  ON_ACCOUNT: "text-amber-400",
}

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function CheckoutModal({ open, onClose, onDone }: Props) {
  const qc = useQueryClient()
  const items = useCartStore((s) => s.items)
  const discountPct = useCartStore((s) => s.discountPct)
  const clearCart = useCartStore((s) => s.clear)

  const [rows, setRows] = useState<PayRow[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQ, setPickerQ] = useState("")
  const [done, setDone] = useState<{ sale: Sale; change: number } | null>(null)
  const uidRef = useRef(1)

  const subtotal = cartSubtotal(items)
  const total = cartTotal(items, discountPct)

  useEffect(() => {
    if (open) {
      setCustomerId(null)
      setPickerOpen(false)
      setPickerQ("")
      setDone(null)
      setRows([{ uid: uidRef.current++, method: "CASH", amount: total.toFixed(2) }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<{ customers: Customer[] }>("/customers"),
    enabled: open && rows.some((r) => r.method === "ON_ACCOUNT"),
  })

  const hasFiado = rows.some((r) => r.method === "ON_ACCOUNT")
  const selectedCustomer = customersQ.data?.customers.find((c) => c.id === customerId) ?? null

  const cashTendered = r2(
    rows.filter((r) => r.method === "CASH").reduce((a, r) => a + num(r.amount), 0),
  )
  const nonCash = r2(
    rows.filter((r) => r.method !== "CASH").reduce((a, r) => a + num(r.amount), 0),
  )
  const paid = r2(cashTendered + nonCash)
  const remaining = r2(total - paid)
  const neededCash = r2(total - nonCash)
  const change = cashTendered > neededCash ? r2(cashTendered - neededCash) : 0
  const fiadoAmount = r2(rows.filter((r) => r.method === "ON_ACCOUNT").reduce((a, r) => a + num(r.amount), 0))

  const overLimit =
    !!selectedCustomer &&
    selectedCustomer.creditLimit > 0 &&
    r2(selectedCustomer.balance + fiadoAmount) > selectedCustomer.creditLimit

  const valid =
    remaining <= 0.005 &&
    nonCash <= total + 0.005 &&
    (!hasFiado || !!selectedCustomer) &&
    !overLimit &&
    items.length > 0

  const saleM = useMutation({
    mutationFn: () => {
      let pays = rows
        .map((r) => ({ method: r.method, amount: num(r.amount) }))
        .filter((p) => p.amount > 0)
      const merged: Array<{ method: PaymentMethod; amount: number }> = []
      for (const p of pays) {
        const existing = merged.find((m) => m.method === p.method)
        if (existing) existing.amount = r2(existing.amount + p.amount)
        else merged.push({ ...p })
      }
      const sumAll = r2(merged.reduce((a, m) => a + m.amount, 0))
      const excess = r2(sumAll - total)
      if (excess > 0) {
        for (let i = merged.length - 1; i >= 0; i--) {
          if (merged[i].method === "CASH") {
            merged[i].amount = r2(merged[i].amount - excess)
            break
          }
        }
      }
      pays = merged.filter((m) => m.amount > 0)
      return api.post<{ sale: Sale }>("/sales", {
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
        discount: r2(subtotal * (discountPct / 100)),
        customerId: hasFiado ? customerId : undefined,
        payments: pays,
      })
    },
    onSuccess: (data) => {
      setDone({ sale: data.sale, change })
      void qc.invalidateQueries({ queryKey: ["products"] })
      void qc.invalidateQueries({ queryKey: ["shift"] })
      void qc.invalidateQueries({ queryKey: ["customers"] })
      void qc.invalidateQueries({ queryKey: ["reports"] })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Error al registrar la venta"),
  })

  const finishNewSale = () => {
    clearCart()
    setDone(null)
    onClose()
    onDone()
  }

  useEffect(() => {
    if (!open || done) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && valid && !saleM.isPending) {
        e.preventDefault()
        saleM.mutate()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  })

  useEffect(() => {
    if (!open || !done) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        finishNewSale()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done])

  const addRow = (method: PaymentMethod) => {
    if (method === "ON_ACCOUNT" && rows.some((r) => r.method === "ON_ACCOUNT")) return
    setRows((rs) => [...rs, { uid: uidRef.current++, method, amount: Math.max(0, remaining).toFixed(2) }])
  }

  const updateRow = (uid: number, patch: Partial<PayRow>) =>
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)))

  const removeRow = (uid: number) => setRows((rs) => rs.filter((r) => r.uid !== uid))

  const fillRemainingWithCash = () => {
    setRows((rs) => {
      const idx = rs.findIndex((r) => r.method === "CASH")
      const amount = Math.max(0, remaining).toFixed(2)
      if (idx >= 0) {
        const copy = [...rs]
        copy[idx] = { ...copy[idx], amount }
        return copy
      }
      return [...rs, { uid: uidRef.current++, method: "CASH", amount }]
    })
  }

  const pickerList = (customersQ.data?.customers ?? []).filter((c) =>
    c.name.toLowerCase().includes(pickerQ.toLowerCase()),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? "Venta completada" : "Cobrar venta"}
      icon={
        done ? (
          <CheckCircle2 size={18} className="text-emerald-400" />
        ) : (
          <Banknote size={18} className="text-emerald-400" />
        )
      }
      footer={
        done ? (
          <Button variant="primary" onClick={finishNewSale}>
            Nueva venta <Kbd>Enter</Kbd>
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar <Kbd>Esc</Kbd>
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={!valid}
              loading={saleM.isPending}
              onClick={() => saleM.mutate()}
            >
              Cobrar {fmtMoney(total)}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <CheckCircle2 size={56} className="text-emerald-400" />
          <div>
            <p className="text-xl font-bold">Venta registrada</p>
            <p className="mt-1 font-mono text-3xl font-bold text-emerald-400">
              {fmtMoney(done.sale.total)}
            </p>
          </div>
          {done.change > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-8 py-3">
              <p className="text-xs uppercase tracking-wide text-amber-400">Vuelto a entregar</p>
              <p className="font-mono text-2xl font-bold text-amber-300">{fmtMoney(done.change)}</p>
            </div>
          )}
          <p className="font-mono text-xs text-slate-500">Ticket #{done.sale.id.slice(0, 8)}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-800/60 p-4">
            <div>
              <p className="text-sm font-semibold">{items.reduce((a, i) => a + i.quantity, 0)} artículos</p>
              {discountPct > 0 && (
                <p className="text-xs text-amber-400">
                  Subtotal {fmtMoney(subtotal)} · descuento {discountPct}%
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Total</p>
              <p className="font-mono text-2xl font-bold text-emerald-400">{fmtMoney(total)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PAYMENT_METHODS.map(({ value, label }) => {
              const Icon = METHOD_ICONS[value]
              return (
                <button
                  key={value}
                  onClick={() => addRow(value)}
                  disabled={value === "ON_ACCOUNT" && hasFiado}
                  className="flex h-auto flex-col items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/70 py-3 text-[11px] text-slate-300 transition hover:border-slate-500 hover:bg-slate-700 disabled:opacity-30"
                >
                  <Icon size={18} className={METHOD_COLORS[value]} />
                  {label}
                </button>
              )
            })}
          </div>

          <div className="space-y-2">
            {rows.map((row) => {
              const Icon = METHOD_ICONS[row.method]
              return (
                <div key={row.uid} className="flex items-center gap-2">
                  <span className="flex w-32 shrink-0 items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Icon size={14} className={METHOD_COLORS[row.method]} />
                    {methodLabel(row.method)}
                  </span>
                  <Input
                    mono
                    inputMode="decimal"
                    value={row.amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateRow(row.uid, { amount: e.target.value.replace(/[^\d.,]/g, "") })}
                    className="h-9 flex-1"
                    placeholder="0.00"
                  />
                  {row.method !== "CASH" || rows.length > 1 ? (
                    <button
                      onClick={() => removeRow(row.uid)}
                      className="rounded-lg p-1.5 text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
                      title="Quitar pago"
                    >
                      <X size={15} />
                    </button>
                  ) : (
                    <span className="w-7" />
                  )}
                </div>
              )
            })}
          </div>

          {!hasFiado && remaining > 0.005 && (
            <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <span className="text-sm text-amber-300">
                Falta <strong className="font-mono">{fmtMoney(remaining)}</strong>
              </span>
              <Button size="sm" variant="secondary" onClick={fillRemainingWithCash}>
                <Plus size={13} /> Completar con efectivo
              </Button>
            </div>
          )}
          {change > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <span className="text-sm text-emerald-300">Vuelto a entregar</span>
              <span className="font-mono text-lg font-bold text-emerald-400">{fmtMoney(change)}</span>
            </div>
          )}
          {overLimit && selectedCustomer && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {selectedCustomer.name} superaría su límite de crédito ({fmtMoney(selectedCustomer.creditLimit)}).
            </p>
          )}

          {hasFiado && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <BookUser size={14} /> Fiado: {fmtMoney(fiadoAmount)} en cuenta
                </span>
                {selectedCustomer ? (
                  <button
                    onClick={() => setCustomerId(null)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs transition hover:border-red-500/40"
                  >
                    {selectedCustomer.name}
                    <Badge variant={selectedCustomer.balance > 0 ? "amber" : "emerald"}>
                      {fmtMoney(selectedCustomer.balance)}
                    </Badge>
                    <X size={12} className="text-slate-500" />
                  </button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setPickerOpen(!pickerOpen)}>
                    Elegir cliente…
                  </Button>
                )}
              </div>

              {pickerOpen && !selectedCustomer && (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    placeholder="Buscar cliente por nombre..."
                    value={pickerQ}
                    onChange={(e) => setPickerQ(e.target.value)}
                    className="h-9"
                  />
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {pickerList.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id)
                          setPickerOpen(false)
                          setPickerQ("")
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-800"
                      >
                        <span>{c.name}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {c.phone && <span className="font-mono">{c.phone}</span>}
                          <Badge variant={c.balance > 0 ? "amber" : "slate"}>
                            debe {fmtMoney(c.balance)}
                          </Badge>
                          <Badge variant={c.creditLimit > 0 ? "indigo" : "slate"}>
                            límite {c.creditLimit > 0 ? fmtMoney(c.creditLimit) : "sin tope"}
                          </Badge>
                        </span>
                      </button>
                    ))}
                    {pickerList.length === 0 && (
                      <p className="py-2 text-center text-xs text-slate-500">Sin clientes que coincidan.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
