import { useRef, useState } from "react"
import { Download, Printer, Receipt, X } from "lucide-react"
import type { Sale } from "@/lib/types"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { ThermalTicket } from "./ThermalTicket"

interface Props {
  open: boolean
  onClose: () => void
  sale: Sale | null
  change?: number
}

export function ReceiptTicketModal({ open, onClose, sale, change = 0 }: Props) {
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm")
  const ticketRef = useRef<HTMLDivElement>(null)

  if (!sale) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Comprobante de Venta (Ticket Térmico)"
      icon={<Receipt size={18} className="text-emerald-400" />}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between">
          {/* Selector de ancho de papel */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-xs">
            <button
              onClick={() => setPaperWidth("58mm")}
              className={`rounded px-2 py-1 font-medium transition ${
                paperWidth === "58mm"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              58 mm
            </button>
            <button
              onClick={() => setPaperWidth("80mm")}
              className={`rounded px-2 py-1 font-medium transition ${
                paperWidth === "80mm"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              80 mm
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            <Button variant="primary" onClick={handlePrint}>
              <Printer size={15} /> Imprimir / PDF
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400 text-center">
          Optimizado para impresoras térmicas de tickets y guardado en PDF:
        </p>

        {/* Contenedor del Ticket Térmico con fondo para emular papel */}
        <div className="max-h-[500px] overflow-y-auto rounded-xl bg-slate-950/80 p-4 flex justify-center border border-slate-800">
          <ThermalTicket
            ref={ticketRef}
            sale={sale}
            paperWidth={paperWidth}
            change={change}
          />
        </div>
      </div>
    </Modal>
  )
}
