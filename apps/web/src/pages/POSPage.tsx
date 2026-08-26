import { useCallback, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Layers, Tag } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Category, Product, Shift } from "@/lib/types"
import { useCartStore } from "@/stores/cart"
import { useDebounce } from "@/hooks/useDebounce"
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { Spinner } from "@/components/ui/Spinner"
import { OpenShiftView } from "@/components/shifts/OpenShiftView"
import { SearchBar } from "@/components/pos/SearchBar"
import { ProductGrid } from "@/components/pos/ProductGrid"
import { CartPanel } from "@/components/pos/CartPanel"
import { CheckoutModal } from "@/components/pos/CheckoutModal"
import { CashMovementModal } from "@/components/pos/CashMovementModal"

export default function POSPage() {
  const shiftQ = useQuery({
    queryKey: ["shift", "current"],
    queryFn: () => api.get<{ shift: Shift | null }>("/shifts/current"),
  })

  if (shiftQ.isLoading) return <Spinner />
  const shift = shiftQ.data?.shift ?? null

  if (!shift) return <OpenShiftView />

  return <PosTerminal key={shift.id} shift={shift} />
}

function PosTerminal({ shift }: { shift: Shift }) {
  const items = useCartStore((s) => s.items)
  const add = useCartStore((s) => s.add)
  const clear = useCartStore((s) => s.clear)

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cashMoveOpen, setCashMoveOpen] = useState(false)
  const [rawQuery, setRawQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [qtyPrefix, setQtyPrefix] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(rawQuery, 200)

  const catsQ = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/categories"),
  })

  const productsQ = useQuery({
    queryKey: ["products", "search", debouncedQuery, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams()
      if (debouncedQuery) params.set("q", debouncedQuery)
      if (selectedCategory) params.set("categoryId", selectedCategory)
      return api.get<{ products: Product[] }>(`/products/search?${params.toString()}`)
    },
    staleTime: 10000,
  })

  const addProduct = useCallback(
    (p: Product, qty: number) => {
      if (p.stock <= 0) {
        toast.error(`${p.name} sin stock`)
        return
      }
      add(p, qty)
    },
    [add],
  )

  const handleSubmit = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    let q = trimmed
    let qty = qtyPrefix ?? 1
    const m = q.match(/^(\d+(?:[.,]\d+)?)\s*[x*]\s*(.+)$/i)
    if (m) {
      qty = parseFloat(m[1].replace(",", "."))
      q = m[2].trim()
    }
    const list = productsQ.data?.products ?? []
    const found =
      list.find((p) => p.barcode === q) ||
      list.find((p) => p.name.toLowerCase() === q.toLowerCase()) ||
      list[0]
    if (found) {
      addProduct(found, qty)
      setRawQuery("")
      setQtyPrefix(null)
    } else {
      toast.info(`Sin resultados para "${q}"`)
    }
  }

  const handleScan = useCallback(
    (code: string) => {
      api
        .get<{ products: Product[] }>(`/products/search?q=${encodeURIComponent(code)}`)
        .then((data) => {
          const p = data.products.find((x) => x.barcode === code) ?? data.products[0]
          if (p) {
            addProduct(p, qtyPrefix ?? 1)
            setQtyPrefix(null)
            searchRef.current?.focus()
          } else {
            toast.info(`Código ${code} no registrado`)
          }
        })
        .catch(() => toast.error("No se pudo buscar el código"))
    },
    [qtyPrefix, addProduct],
  )

  useBarcodeScanner(handleScan)

  useKeyboardShortcuts(
    {
      F2: () => searchRef.current?.focus(),
      F4: () => setCashMoveOpen(true),
      F9: () => {
        if (items.length > 0) setCheckoutOpen(true)
      },
      " ": () => {
        if (items.length > 0) setCheckoutOpen(true)
      },
      Escape: () => {
        if (items.length > 0) {
          clear()
          toast("Carrito vaciado")
        }
      },
    },
    [items.length],
  )

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[480px] flex-col gap-4 lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <SearchBar
          inputRef={searchRef}
          value={rawQuery}
          onChange={setRawQuery}
          onSubmit={handleSubmit}
          qtyPrefix={qtyPrefix}
          onClearQty={() => setQtyPrefix(null)}
        />

        {/* Barra de Filtro de Categorías */}
        {(catsQ.data?.categories?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition shrink-0 ${
                selectedCategory === null
                  ? "bg-emerald-500 text-slate-950 font-semibold shadow-sm"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <Layers size={13} />
              Todas
            </button>
            {catsQ.data?.categories.map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  setSelectedCategory(selectedCategory === c.id ? null : c.id)
                }
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition shrink-0 ${
                  selectedCategory === c.id
                    ? "bg-emerald-500 text-slate-950 font-semibold shadow-sm"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.color || "#10b981" }}
                />
                {c.name}
              </button>
            ))}
          </div>
        )}

        <p className="hidden shrink-0 items-center gap-3 text-[11px] text-slate-600 xl:flex">
          <span><kbd className="rounded bg-slate-800 px-1 font-mono">F2</kbd> buscar</span>
          <span><kbd className="rounded bg-slate-800 px-1 font-mono">F4</kbd> caja</span>
          <span><kbd className="rounded bg-slate-800 px-1 font-mono">F9</kbd> cobrar</span>
          <span><kbd className="rounded bg-slate-800 px-1 font-mono">ESC</kbd> vaciar</span>
          <span>· tip: <kbd className="rounded bg-slate-800 px-1 font-mono">3*</kbd> agrega 3 unidades</span>
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-1">
          <ProductGrid
            products={productsQ.data?.products}
            isLoading={productsQ.isPending}
            onPick={(p) => {
              addProduct(p, qtyPrefix ?? 1)
              setQtyPrefix(null)
              searchRef.current?.focus()
            }}
          />
        </div>
      </section>

      <aside className="flex min-h-0 w-full shrink-0 flex-col rounded-2xl border border-slate-800 bg-slate-950/70 lg:w-[400px]">
        <CartPanel onCheckout={() => setCheckoutOpen(true)} />
      </aside>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onDone={() => searchRef.current?.focus()}
      />
      <CashMovementModal open={cashMoveOpen} onClose={() => setCashMoveOpen(false)} shift={shift} />
    </div>
  )
}
