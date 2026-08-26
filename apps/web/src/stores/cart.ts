import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { Product } from "@/lib/types"
import { r2 } from "@/lib/format"

export interface CartItem {
  productId: string
  name: string
  unitPrice: number
  isWeighted: boolean
  stock: number
  quantity: number
}

interface CartState {
  shiftId: string | null
  items: CartItem[]
  discountPct: number
  add: (p: Product, qty?: number) => void
  setQuantity: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
  setDiscountPct: (v: number) => void
  startShift: (shiftId: string) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      shiftId: null,
      items: [],
      discountPct: 0,
      add: (p, qty = 1) =>
        set((s) => {
          const items = [...s.items]
          const idx = items.findIndex((it) => it.productId === p.id)
          if (idx >= 0) {
            items[idx] = { ...items[idx], quantity: r2(items[idx].quantity + qty) }
          } else {
            items.push({
              productId: p.id,
              name: p.name,
              unitPrice: p.salePrice,
              isWeighted: p.isWeighted,
              stock: p.stock,
              quantity: qty,
            })
          }
          return { items }
        }),
      setQuantity: (productId, qty) =>
        set((s) => {
          if (qty <= 0 || isNaN(qty)) return { items: s.items.filter((i) => i.productId !== productId) }
          return {
            items: s.items.map((i) =>
              i.productId === productId ? { ...i, quantity: r2(qty) } : i,
            ),
          }
        }),
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => ({ items: [], discountPct: 0 }),
      setDiscountPct: (v) => ({ discountPct: Math.min(100, Math.max(0, v)) }),
      startShift: (shiftId) => {
        if (get().shiftId !== shiftId) set({ shiftId, items: [], discountPct: 0 })
      },
    }),
    {
      name: "openkiosco-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ shiftId: s.shiftId, items: s.items, discountPct: s.discountPct }),
    },
  ),
)

export const cartSubtotal = (items: CartItem[]): number =>
  r2(items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0))

export const cartTotal = (items: CartItem[], discountPct: number): number =>
  r2(cartSubtotal(items) * (1 - discountPct / 100))
