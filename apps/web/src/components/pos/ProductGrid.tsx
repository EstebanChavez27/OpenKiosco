import { SearchX, Scale } from "lucide-react"
import type { Product } from "@/lib/types"
import { fmtMoney, fmtQty } from "@/lib/format"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"

interface Props {
  products: Product[] | undefined
  isLoading: boolean
  onPick: (p: Product) => void
}

function StockBadge({ product }: { product: Product }) {
  if (product.stock <= 0)
    return (
      <Badge variant="red" className="shrink-0">
        AGOTADO
      </Badge>
    )
  if (product.stock <= product.minStock)
    return (
      <Badge variant="amber" className="shrink-0">
        ×{fmtQty(product.stock)}
      </Badge>
    )
  return (
    <span className="shrink-0 font-mono text-[11px] text-slate-600">×{fmtQty(product.stock)}</span>
  )
}

export function ProductGrid({ products, isLoading, onPick }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40" />
        ))}
      </div>
    )
  }

  if (!products || products.length === 0) {
    return <EmptyState icon={SearchX} title="Sin productos" hint="Registrá productos desde la sección Stock." />
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {products.map((p) => (
        <button
          key={p.id}
          disabled={p.stock <= 0}
          onClick={() => onPick(p)}
          className="group relative flex h-28 flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-500/50 hover:bg-slate-900 hover:shadow-lg hover:shadow-emerald-500/5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 min-h-8 text-sm font-medium leading-tight">{p.name}</span>
            <StockBadge product={p} />
          </div>

          <div className="flex-1" />

          <div className="flex items-end justify-between gap-1">
            <span className="font-mono font-bold text-emerald-400">
              {fmtMoney(p.salePrice)}
              {p.isWeighted && <span className="ml-0.5 text-[10px] font-normal text-slate-500">/kg</span>}
            </span>
            {p.isWeighted && <Scale size={13} className="mb-1 shrink-0 text-slate-600" />}
          </div>

          <span className="mt-1 truncate font-mono text-[10px] text-slate-600">
            {p.barcode ?? p.category?.name ?? ""}
          </span>
        </button>
      ))}
    </div>
  )
}
