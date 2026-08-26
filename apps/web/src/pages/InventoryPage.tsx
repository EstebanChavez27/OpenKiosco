import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Boxes, Filter, PackageSearch, Pencil, Plus, Search } from "lucide-react"
import { api } from "@/lib/api"
import type { Product } from "@/lib/types"
import { useDebounce } from "@/hooks/useDebounce"
import { fmtMoney, fmtQty } from "@/lib/format"
import { cn } from "@/lib/cn"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { EmptyState } from "@/components/ui/EmptyState"
import { ProductFormModal } from "@/components/inventory/ProductFormModal"
import { StockAdjustModal } from "@/components/inventory/StockAdjustModal"

export default function InventoryPage() {
  const qc = useQueryClient()
  const [rawQuery, setRawQuery] = useState("")
  const q = useDebounce(rawQuery, 250)
  const [lowOnly, setLowOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null)

  const productsQ = useQuery({
    queryKey: ["products", "list", q, lowOnly],
    queryFn: () =>
      api.get<{ products: Product[]; total: number }>(
        `/products?q=${encodeURIComponent(q)}&lowStock=${lowOnly ? "1" : "0"}&pageSize=200`,
      ),
  })

  const products = productsQ.data?.products ?? []

  const marginOf = (p: Product) =>
    p.costPrice > 0 ? Math.round(((p.salePrice - p.costPrice) / p.costPrice) * 100) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            wrapperClassName="flex-1 min-w-[220px]"
            className="pl-9"
            placeholder="Buscar por nombre o código..."
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
          />
        </div>
        <Button
          variant={lowOnly ? "primary" : "secondary"}
          onClick={() => setLowOnly(!lowOnly)}
        >
          <Filter size={15} /> Bajo stock
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            setEditTarget(null)
            setFormOpen(true)
          }}
        >
          <Plus size={16} /> Nuevo producto
        </Button>
      </div>

      {productsQ.isPending ? (
        <Spinner />
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageSearch}
            title="Sin productos"
            hint={
              lowOnly
                ? "No hay productos con bajo stock. Buen trabajo."
                : "Creá tu catálogo con el botón Nuevo producto."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 text-right font-medium">Costo / Precio</th>
                <th className="px-4 py-3 text-right font-medium">Margen</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {products.map((p) => {
                const margin = marginOf(p)
                const low = p.stock <= p.minStock
                return (
                  <tr key={p.id} className={cn("transition hover:bg-slate-800/30", !p.isActive && "opacity-40")}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{p.barcode ?? "sin código"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="slate">{p.category?.name ?? "—"}</Badge>
                      {p.isWeighted && (
                        <Badge variant="sky" className="ml-1">
                          $/kg
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-xs text-slate-500">{fmtMoney(p.costPrice)}</span>
                      <span className="mx-1 text-slate-600">→</span>
                      <span className="font-mono font-semibold text-emerald-400">{fmtMoney(p.salePrice)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {margin === null ? (
                        <span className="text-xs text-slate-600">—</span>
                      ) : (
                        <Badge variant={margin >= 30 ? "emerald" : margin >= 15 ? "amber" : "red"}>
                          {margin}%
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            low ? "text-amber-400" : "text-slate-200",
                          )}
                        >
                          {fmtQty(p.stock)}
                        </span>
                        <span className="text-[10px] text-slate-600">mín {fmtQty(p.minStock)}</span>
                        {!p.isActive && <Badge variant="red">Inactivo</Badge>}
                      </div>
                      <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={cn("h-full rounded-full", low ? "bg-amber-500" : "bg-emerald-500")}
                          style={{
                            width: `${Math.min(100, (p.stock / Math.max(1, p.minStock * 2)) * 100)}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Ajustar stock"
                          onClick={() => {
                            void qc.invalidateQueries({ queryKey: ["categories"] })
                            setAdjustTarget(p)
                          }}
                        >
                          <Boxes size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Editar"
                          onClick={() => {
                            void qc.invalidateQueries({ queryKey: ["categories"] })
                            setEditTarget(p)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ProductFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          void qc.invalidateQueries({ queryKey: ["products"] })
        }}
        product={editTarget}
      />
      <StockAdjustModal
        open={!!adjustTarget}
        onClose={() => {
          setAdjustTarget(null)
          void qc.invalidateQueries({ queryKey: ["products"] })
        }}
        product={adjustTarget}
      />
    </div>
  )
}
