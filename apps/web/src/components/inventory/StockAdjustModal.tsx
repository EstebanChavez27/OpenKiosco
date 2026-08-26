import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Equal, MinusCircle, PlusCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Product, StockAdjustType } from "@/lib/types"
import { fmtQty, num } from "@/lib/format"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"

const TYPES: Array<{ value: StockAdjustType; icon: LucideIcon; title: string; desc: string; color: string }> = [
  {
    value: "PURCHASE",
    icon: PlusCircle,
    title: "Compra",
    desc: "Ingresa mercadería al stock",
    color: "text-emerald-400",
  },
  {
    value: "WASTE",
    icon: MinusCircle,
    title: "Merma",
    desc: "Roturas, vencimientos, pérdidas",
    color: "text-red-400",
  },
  {
    value: "ADJUSTMENT",
    icon: Equal,
    title: "Conteo",
    desc: "El stock pasa a valer lo ingresado",
    color: "text-indigo-400",
  },
]

export function StockAdjustModal({
  open,
  onClose,
  product,
}: {
  open: boolean
  onClose: () => void
  product: Product | null
}) {
  const qc = useQueryClient()
  const [type, setType] = useState<StockAdjustType>("PURCHASE")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")

  useEffect(() => {
    if (open) {
      setType("PURCHASE")
      setQuantity("")
      setReason("")
    }
  }, [open])

  const m = useMutation({
    mutationFn: () =>
      api.post<{ newStock: number }>(`/products/${product!.id}/stock`, {
        type,
        quantity: num(quantity),
        reason: reason.trim() || undefined,
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["products"] })
      void qc.invalidateQueries({ queryKey: ["reports"] })
      toast.success(`Stock actualizado: ahora hay ${fmtQty(data.newStock)} unidades`)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid =
    !!product &&
    quantity.trim() !== "" &&
    !(type === "WASTE" && num(quantity) > product.stock + 1e-9)

  const qtyLabel =
    type === "PURCHASE" ? "Cantidad a ingresar" : type === "WASTE" ? "Cantidad perdida" : "Stock contado"

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ajustar stock · ${product?.name ?? ""}`}
      icon={<PlusCircle size={18} className="text-emerald-400" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={m.isPending} disabled={!valid} onClick={() => m.mutate()}>
            Aplicar ajuste
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(({ value, icon: Icon, title, desc, color }) => (
            <button
              key={value}
              onClick={() => setType(value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                type === value
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-700 hover:border-slate-500",
              )}
            >
              <Icon size={20} className={color} />
              <span className="text-sm font-semibold">{title}</span>
              <span className="text-[11px] leading-tight text-slate-500">{desc}</span>
            </button>
          ))}
        </div>

        <Input
          label={`${qtyLabel}${type !== "PURCHASE" && product?.isWeighted ? " (admite decimales)" : ""}`}
          mono
          inputMode="decimal"
          autoFocus
          className="h-12 text-xl"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value.replace(product?.isWeighted ? /[^\d.,]/g : /[^\d]/g, ""))}
        />
        {product && (
          <p className="text-xs text-slate-500">
            Stock actual: <span className="font-mono">{fmtQty(product.stock)}</span> · mínimo:{" "}
            <span className="font-mono">{fmtQty(product.minStock)}</span>
          </p>
        )}

        <Input
          label="Motivo (opcional)"
          placeholder="Ej: entrega proveedor / paquete vencido"
          value={reason}
          maxLength={120}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  )
}
