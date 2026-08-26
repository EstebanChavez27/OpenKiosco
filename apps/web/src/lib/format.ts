const moneyFmt = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const qtyFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 })

export const fmtMoney = (n: number): string => "$ " + moneyFmt.format(n)

export const fmtQty = (n: number): string => qtyFmt.format(n)

export const fmtTime = (d: string | Date | number): string =>
  new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })

export const fmtDate = (d: string | Date | number): string =>
  new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })

export const fmtDateTime = (d: string | Date | number): string =>
  `${fmtDate(d)} ${fmtTime(d)}`

export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export const num = (s: string): number => parseFloat(s.replace(",", ".")) || 0

export const initials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

export function fmtDuration(from: string | Date, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`
}
