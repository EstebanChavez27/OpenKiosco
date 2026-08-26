import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Package } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Category, Product } from "@/lib/types"
import { num } from "@/lib/format"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"

interface Props {
  open: boolean
  onClose: () => void
  product?: Product | null
}

export function ProductFormModal({ open, onClose, product }: Props) {
  const qc = useQueryClient()
  const editing = !!product

  const catsQ = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/products/categories"),
    enabled: open,
  })

  const [f, setF] = useState({
    name: "",
    barcode: "",
    categoryId: "",
    costPrice: "0",
    salePrice: "",
    stock: "0",
    minStock: "5",
    isWeighted: false,
    isActive: true,
  })

  useEffect(() => {
    if (open) {
      setF({
        name: product?.name ?? "",
        barcode: product?.barcode ?? "",
        categoryId: product?.categoryId ?? "",
        costPrice: String(product?.costPrice ?? 0),
        salePrice: product ? String(product.salePrice) : "",
        stock: String(product?.stock ?? 0),
        minStock: String(product?.minStock ?? 5),
        isWeighted: product?.isWeighted ?? false,
        isActive: product?.isActive ?? true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const m = useMutation({
    mutationFn: () => {
      const dto = {
        name: f.name.trim(),
        barcode: f.barcode.trim() || null,
        categoryId: f.categoryId || null,
        costPrice: num(f.costPrice),
        salePrice: num(f.salePrice),
        minStock: num(f.minStock),
        isWeighted: f.isWeighted,
        ...(editing ? {} : { stock: num(f.stock) }),
      }
      return editing
        ? api.patch(`/products/${product!.id}`, { ...dto, isActive: f.isActive })
        : api.post("/products", dto)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] })
      void qc.invalidateQueries({ queryKey: ["categories"] })
      void qc.invalidateQueries({ queryKey: ["reports"] })
      toast.success(editing ? "Producto actualizado" : "Producto creado")
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid = f.name.trim().length >= 2 && num(f.salePrice) > 0

  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${product?.name}` : "Nuevo producto"}
      icon={<Package size={18} className="text-emerald-400" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={m.isPending} disabled={!valid} onClick={() => m.mutate()}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) m.mutate()
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Input label="Nombre *" value={f.name} autoFocus onChange={(e) => set({ name: e.target.value })} />
        <Input
          label="Código de barras"
          mono
          value={f.barcode}
          onChange={(e) => set({ barcode: e.target.value })}
        />
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-400">Categoría</label>
          <select
            value={f.categoryId}
            onChange={(e) => set({ categoryId: e.target.value })}
            className="h-[42px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="">Sin categoría</option>
            {(catsQ.data?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Precio de venta *"
          mono
          inputMode="decimal"
          value={f.salePrice}
          onChange={(e) => set({ salePrice: e.target.value.replace(/[^\d.,]/g, "") })}
        />
        <Input
          label="Costo"
          mono
          inputMode="decimal"
          value={f.costPrice}
          onChange={(e) => set({ costPrice: e.target.value.replace(/[^\d.,]/g, "") })}
        />
        <Input
          label="Stock mínimo"
          mono
          inputMode="decimal"
          value={f.minStock}
          onChange={(e) => set({ minStock: e.target.value.replace(/[^\d.,]/g, "") })}
        />
        {!editing && (
          <Input
            label="Stock inicial"
            mono
            inputMode="decimal"
            value={f.stock}
            onChange={(e) => set({ stock: e.target.value.replace(/[^\d.,]/g, "") })}
          />
        )}
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={f.isWeighted}
            onChange={(e) => set({ isWeighted: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
          Venta a granel / pesable ($/kg, permite decimales)
        </label>
        {editing && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => set({ isActive: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
            Activo en el POS
          </label>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
