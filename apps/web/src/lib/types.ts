export type Role = "ADMIN" | "CASHIER"
export type PaymentMethod = "CASH" | "CARD_DEBIT" | "CARD_CREDIT" | "QR_TRANSFER" | "ON_ACCOUNT"
export type CashMovementType = "CASH_IN" | "CASH_OUT"
export type StockAdjustType = "PURCHASE" | "ADJUSTMENT" | "WASTE"
export type LedgerEntryType = "CHARGE" | "PAYMENT"

export interface User {
  id: string
  username: string
  fullName: string
  role: Role
}

export interface Category {
  id: string
  name: string
  _count?: { products: number }
}

export interface Product {
  id: string
  barcode: string | null
  name: string
  description: string | null
  categoryId: string | null
  category?: Category | null
  costPrice: number
  salePrice: number
  stock: number
  minStock: number
  isWeighted: boolean
  isActive: boolean
  updatedAt: string
}

export interface CashMovement {
  id: string
  type: CashMovementType
  amount: number
  reason: string
  createdAt: string
  userId: string
}

export interface Shift {
  id: string
  userId: string
  user?: { id: string; fullName: string; username: string }
  openedAt: string
  closedAt: string | null
  status: "OPEN" | "CLOSED"
  initialCash: number
  expectedCash: number | null
  actualCash: number | null
  difference: number | null
  notes: string | null
  cashMovements?: CashMovement[]
  _count?: { sales: number }
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  creditLimit: number
  balance: number
}

export interface LedgerEntry {
  id: string
  type: LedgerEntryType
  amount: number
  description: string
  createdAt: string
  saleId: string | null
}

export interface SaleItemDTO {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  subtotal: number
  product?: { name: string; barcode: string | null; isWeighted?: boolean }
}

export interface SalePaymentDTO {
  id: string
  method: PaymentMethod
  amount: number
}

export interface Sale {
  id: string
  subtotal: number
  discount: number
  total: number
  createdAt: string
  items: SaleItemDTO[]
  payments: SalePaymentDTO[]
  customer?: { id: string; name: string } | null
  user?: { fullName: string }
}

export interface TodayReport {
  salesTotal: number
  salesCount: number
  averageTicket: number
  byMethod: Record<string, { amount: number; count: number }>
  lowStockCount: number
  lowStock: Product[]
  fiados: { total: number; customers: number }
  openShift: {
    id: string
    openedAt: string
    user: { fullName: string }
    _count: { sales: number }
  } | null
}
