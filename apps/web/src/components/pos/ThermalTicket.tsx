import React from "react"
import type { Sale } from "@/lib/types"
import { fmtDate, fmtMoney, fmtTime } from "@/lib/format"
import { methodLabel } from "@/lib/constants"

interface Props {
  sale: Sale
  paperWidth?: "58mm" | "80mm"
  change?: number
  businessName?: string
  businessAddress?: string
  businessPhone?: string
}

export const ThermalTicket = React.forwardRef<HTMLDivElement, Props>(function ThermalTicket(
  {
    sale,
    paperWidth = "80mm",
    change = 0,
    businessName = "OpenKiosco",
    businessAddress = "Av. Principal 123",
    businessPhone = "Tel: 11 2345-6789",
  },
  ref,
) {
  const is58 = paperWidth === "58mm"
  const divider = is58 ? "--------------------------------" : "------------------------------------------------"
  const doubleDivider = is58 ? "================================" : "================================================"

  return (
    <div
      ref={ref}
      id="printable-thermal-ticket"
      style={{ width: is58 ? "58mm" : "80mm" }}
      className="mx-auto bg-white text-black p-3 font-mono text-[11px] leading-tight select-none shadow-md print:shadow-none print:m-0 print:p-1"
    >
      {/* Encabezado del comercio */}
      <div className="text-center space-y-0.5">
        <p className="text-sm font-bold uppercase tracking-wider">{businessName}</p>
        <p className="text-[10px] text-slate-700">{businessAddress}</p>
        <p className="text-[10px] text-slate-700">{businessPhone}</p>
        <p className="text-[10px] font-bold mt-1 text-slate-900">
          *** DOCUMENTO NO VÁLIDO COMO FACTURA ***
        </p>
      </div>

      <div className="my-1.5 text-center text-[10px] overflow-hidden whitespace-nowrap">
        {doubleDivider}
      </div>

      {/* Datos del Ticket */}
      <div className="space-y-0.5 text-[10px]">
        <div className="flex justify-between">
          <span>TICKET: #{sale.id.slice(0, 8).toUpperCase()}</span>
          <span>{fmtDate(sale.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>CAJERO: {sale.user?.fullName ?? "General"}</span>
          <span>{fmtTime(sale.createdAt)}</span>
        </div>
        {sale.customer && (
          <div className="flex justify-between font-semibold">
            <span>CLIENTE:</span>
            <span>{sale.customer.name}</span>
          </div>
        )}
      </div>

      <div className="my-1.5 text-center text-[10px] overflow-hidden whitespace-nowrap">
        {divider}
      </div>

      {/* Cabecera de Items */}
      <div className="flex justify-between text-[10px] font-bold border-b border-black/30 pb-0.5 mb-1">
        <span className="w-10">CANT</span>
        <span className="flex-1 px-1">DETALLE</span>
        <span className="w-16 text-right">TOTAL</span>
      </div>

      {/* Lista de Items */}
      <div className="space-y-1 text-[10px]">
        {sale.items.map((it) => (
          <div key={it.id} className="flex justify-between items-start">
            <span className="w-10 font-bold shrink-0">
              {it.quantity}
              {it.product?.isWeighted ? "k" : ""}
            </span>
            <div className="flex-1 px-1 truncate">
              <p className="truncate font-medium">{it.product?.name ?? "Artículo"}</p>
              <p className="text-[9px] text-slate-600">
                @{fmtMoney(it.unitPrice)}
              </p>
            </div>
            <span className="w-16 text-right font-bold shrink-0">
              {fmtMoney(it.subtotal)}
            </span>
          </div>
        ))}
      </div>

      <div className="my-1.5 text-center text-[10px] overflow-hidden whitespace-nowrap">
        {divider}
      </div>

      {/* Totales */}
      <div className="space-y-0.5 text-[11px]">
        {sale.discount > 0 && (
          <>
            <div className="flex justify-between text-[10px] text-slate-700">
              <span>SUBTOTAL:</span>
              <span>{fmtMoney(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-700">
              <span>DESCUENTO:</span>
              <span>-{fmtMoney(sale.discount)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-xs font-bold pt-0.5">
          <span>TOTAL:</span>
          <span>{fmtMoney(sale.total)}</span>
        </div>
      </div>

      <div className="my-1.5 text-center text-[10px] overflow-hidden whitespace-nowrap">
        {divider}
      </div>

      {/* Desglose de Medios de Pago */}
      <div className="space-y-0.5 text-[10px]">
        <p className="font-bold text-[9px] uppercase text-slate-800">Forma de Pago:</p>
        {sale.payments.map((p) => (
          <div key={p.id} className="flex justify-between">
            <span>• {methodLabel(p.method)}:</span>
            <span className="font-medium">{fmtMoney(p.amount)}</span>
          </div>
        ))}
        {change > 0 && (
          <div className="flex justify-between font-bold pt-0.5 text-slate-900">
            <span>VUELTO:</span>
            <span>{fmtMoney(change)}</span>
          </div>
        )}
      </div>

      <div className="my-1.5 text-center text-[10px] overflow-hidden whitespace-nowrap">
        {doubleDivider}
      </div>

      {/* Pie de ticket */}
      <div className="text-center text-[10px] space-y-1 pt-1">
        <p className="font-bold">¡GRACIAS POR SU COMPRA!</p>
        <p className="text-[9px] text-slate-600">Conserve este comprobante</p>
      </div>
    </div>
  )
})
