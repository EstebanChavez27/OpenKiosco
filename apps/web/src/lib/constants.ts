import type { PaymentMethod } from "./types"

export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD_DEBIT", label: "Débito" },
  { value: "CARD_CREDIT", label: "Crédito" },
  { value: "QR_TRANSFER", label: "QR / Transf." },
  { value: "ON_ACCOUNT", label: "Fiado" },
]

export function methodLabel(m: PaymentMethod): string {
  return PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m
}
