import { useEffect, useState } from "react"
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cartSubtotal, cartTotal, useCartStore } from "@/stores/cart"
import type { CartItem } from "@/stores/cart"
import { fmtMoney, r2 } from "@/lib/format"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { KbdDark } from "@/components/ui/Kbd"

export function CartPanel({ onCheckout }: { onCheckout: () => void }) {
  const items = useCartStore((s) => s.items)
  const discountPct = useCartStore((s) => s.discountPct)
  const setDiscountPct = useCartStore((s) => s.setDiscountPct)
  const clear = useCartStore((s) => s.clear)

  const subtotal = cartSubtotal(items)
  const total = cartTotal(items, discountPct)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <ShoppingCart size={18} className="text-emerald-400" />
        <h2 className="font-semibold">Venta actual</h2>
        <Badge variant={items.length ? "emerald" : "slate"}>{items.length}</Badge>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={!items.length}
          onClick={() => {
            clear()
            toast("Carrito vaciado")
          }}
        >
          <Trash2 size={14} />
          Vaciar
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Carrito vacío"
            hint="Escaneá un producto [F2] o tocá la grilla para empezar."
          />
        ) : (
          items.map((item) => <CartItemRow key={item.productId} item={item} />)
        )}
      </div>

      <div className="space-y-3 border-t border-slate-800 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Descuento</span>
          <div className="flex items-center gap-1.5">
            <input
              value={discountPct || ""}
              onChange={(e) => setDiscountPct(parseFloat(e.target.value.replace(",", ".")) || 0)}
              onBlur={(e) => {
                if (e.target.value === "") setDiscountPct(0)
              }}
              inputMode="decimal"
              placeholder="0"
              disabled={!items.length}
              className="h-8 w-16 rounded-md border border-slate-700 bg-slate-900 text-center font-mono text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-40"
            />
            <span className="text-slate-500">%</span>
          </div>
        </div>

        <div className="flex justify-between text-sm text-slate-400">
          <span>Subtotal</span>
          <span className="font-mono">{fmtMoney(subtotal)}</span>
        </div>
        {discountPct > 0 && (
          <div className="flex justify-between text-sm text-amber-400">
            <span>Descuento ({discountPct}%)</span>
            <span className="font-mono">-{fmtMoney(r2(subtotal - total))}</span>
          </div>
        )}

        <div className="border-t border-slate-800 pt-3">
          <div className="flex items-end justify-between">
            <span className="text-sm font-semibold tracking-wide text-slate-300">TOTAL</span>
            <span className="font-mono text-3xl font-bold text-emerald-400">{fmtMoney(total)}</span>
          </div>
        </div>

        <Button
          variant="primary"
          size="xl"
          className="w-full justify-between"
          disabled={!items.length}
          onClick={onCheckout}
        >
          Cobrar
          <KbdDark>F9</KbdDark>
        </Button>
        <p className="text-center text-[11px] text-slate-600">
          ESPACIO o F9 para cobrar · ESC vacía el carrito
        </p>
      </div>
    </div>
  )
}

function CartItemRow({ item }: { item: CartItem }) {
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)
  const step = item.isWeighted ? 0.5 : 1

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="font-mono text-[11px] text-slate-500">
          {fmtMoney(item.unitPrice)} {item.isWeighted ? "/kg ×" : "×"}
        </p>
      </div>

      <QtyBox item={item} step={step} onChange={setQuantity} onRemove={() => remove(item.productId)} />

      <span className="w-20 text-right font-mono text-sm text-slate-200">
        {fmtMoney(r2(item.quantity * item.unitPrice))}
      </span>

      <button
        onClick={() => remove(item.productId)}
        className="rounded-lg p-1.5 text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
        title="Quitar"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

function QtyBox({
  item,
  step,
  onChange,
  onRemove,
}: {
  item: CartItem
  step: number
  onChange: (id: string, qty: number) => void
  onRemove: () => void
}) {
  const [val, setVal] = useState(String(item.quantity))

  useEffect(() => {
    setVal(String(item.quantity))
  }, [item.quantity])

  const commit = () => {
    const n = parseFloat(val.replace(",", "."))
    if (isNaN(n) || n <= 0) onRemove()
    else onChange(item.productId, item.isWeighted ? n : Math.max(1, Math.round(n)))
  }

  return (
    <div className="flex items-center rounded-md border border-slate-700 bg-slate-800">
      <button
        onClick={() => onChange(item.productId, r2(item.quantity - step))}
        className="rounded-l-md px-1.5 py-1 text-slate-400 hover:text-emerald-400"
        title="Menos"
      >
        <Minus size={14} />
      </button>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        onFocus={(e) => e.target.select()}
        inputMode="decimal"
        className="w-11 bg-transparent py-1 text-center font-mono text-sm outline-none"
      />
      <button
        onClick={() => onChange(item.productId, r2(item.quantity + step))}
        className="rounded-r-md px-1.5 py-1 text-slate-400 hover:text-emerald-400"
        title="Más"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
