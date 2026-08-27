import { useState } from "react"
import { CheckSquare, Download, FileSpreadsheet, Square } from "lucide-react"
import { toast } from "sonner"
import { downloadReportCsv } from "@/lib/exportCsv"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"

interface Props {
  open: boolean
  onClose: () => void
  currentShiftId?: string | null
  currentShiftLabel?: string
}

const EXPORT_OPTIONS = [
  { id: "sales", label: "Ventas y detalle de items cobrados" },
  { id: "purchases", label: "Compras y recepción a proveedores" },
  { id: "stock", label: "Movimientos y ajustes de stock" },
  { id: "cash_movements", label: "Entradas y salidas manuales de caja (Cash in / out)" },
  { id: "shifts", label: "Resumen histórico de turnos y arqueos (Sobrante/Faltante)" },
]

export function CsvExportModal({ open, onClose, currentShiftId, currentShiftLabel }: Props) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "sales",
    "purchases",
    "stock",
    "cash_movements",
    "shifts",
  ])
  const [scope, setScope] = useState<"shift" | "range" | "all">(
    currentShiftId ? "shift" : "all",
  )
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [downloading, setDownloading] = useState(false)

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  const selectAll = () => setSelectedTypes(EXPORT_OPTIONS.map((o) => o.id))
  const deselectAll = () => setSelectedTypes([])

  const handleDownload = async () => {
    if (selectedTypes.length === 0) {
      toast.error("Seleccioná al menos un tipo de dato para exportar")
      return
    }

    setDownloading(true)
    try {
      await downloadReportCsv({
        shiftId: scope === "shift" && currentShiftId ? currentShiftId : undefined,
        startDate: scope === "range" ? startDate : undefined,
        endDate: scope === "range" ? endDate : undefined,
        types: selectedTypes,
      })
      toast.success("Archivo CSV generado y descargado correctamente")
      onClose()
    } catch (e: any) {
      toast.error(e.message || "Error al descargar el archivo CSV")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportación Avanzada de Datos (CSV)"
      icon={<FileSpreadsheet size={18} className="text-emerald-400" />}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={downloading}
            disabled={selectedTypes.length === 0}
            onClick={handleDownload}
          >
            <Download size={15} /> Descargar Archivo CSV
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Selector de Alcance */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Alcance del reporte
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {currentShiftId && (
              <button
                type="button"
                onClick={() => setScope("shift")}
                className={`rounded-lg border p-2.5 text-left text-xs transition ${
                  scope === "shift"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <div className="font-bold">Turno Filtrado</div>
                <div className="truncate text-[10px] text-slate-500">
                  {currentShiftLabel || `#${currentShiftId.slice(0, 8)}`}
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setScope("range")}
              className={`rounded-lg border p-2.5 text-left text-xs transition ${
                scope === "range"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <div className="font-bold">Rango de Fechas</div>
              <div className="text-[10px] text-slate-500">Personalizado (Desde/Hasta)</div>
            </button>

            <button
              type="button"
              onClick={() => setScope("all")}
              className={`rounded-lg border p-2.5 text-left text-xs transition ${
                scope === "all"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <div className="font-bold">Histórico Global</div>
              <div className="text-[10px] text-slate-500">Todos los datos registrados</div>
            </button>
          </div>

          {scope === "range" && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Input
                label="Fecha Desde"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                label="Fecha Hasta"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Checkboxes de Entidades */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Datos a incluir en el archivo
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Seleccionar todo
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-[11px] text-slate-400 hover:underline"
              >
                Deseleccionar
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-slate-900/50">
            {EXPORT_OPTIONS.map((opt) => {
              const checked = selectedTypes.includes(opt.id)
              return (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center justify-between px-3.5 py-2.5 transition hover:bg-slate-800/40"
                >
                  <span className="text-xs text-slate-200">{opt.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(opt.id)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30"
                  />
                </label>
              )
            })}
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          El archivo se descargará en formato <strong className="text-slate-400">CSV con codificación UTF-8 BOM</strong>, compatible con Microsoft Excel, Google Sheets y LibreOffice Calc.
        </p>
      </div>
    </Modal>
  )
}
