import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, FileSpreadsheet, Lock } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Shift } from "@/lib/types"
import { methodLabel } from "@/lib/constants"
import { fmtMoney, num } from "@/lib/format"
import { downloadReportCsv } from "@/lib/exportCsv"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"

interface CloseResult {
  shift: Shift
  summary: {
    salesCount: number
    byMethod: Record<string, { amount: number; count: number }>
    cashIn: number
    cashOut: number
  }
}

export function CloseShiftModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [actualCash, setActualCash] = useState("")
  const [notes, setNotes] = useState("")
  const [exporting, setExporting] = useState(false)

  const currentShiftQ = useQuery({
    queryKey: ["shifts", "current"],
    queryFn: () => api.get<{ shift: Shift | null }>("/shifts/current"),
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      setActualCash("")
      setNotes("")
    }
  }, [open])

  const closeM = useMutation({
    mutationFn: (dto: { actualCash: number; notes?: string }) =>
      api.post<CloseResult>("/shifts/close", dto),
    onSuccess: () => {
      qc.invalidateQueries()
      toast.success("Turno cerrado exitosamente")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const result = closeM.data
  const activeShiftId = result?.shift.id || currentShiftQ.data?.shift?.id

  const submit = () => {
    const amount = num(actualCash)
    if (amount < 0 || actualCash.trim() === "") return
    closeM.mutate({ actualCash: amount, notes: notes.trim() || undefined })
  }

  const handleExportShiftCsv = async () => {
    if (!activeShiftId) {
      toast.error("No se detectó un turno activo para exportar")
      return
    }

    setExporting(true)
    try {
      await downloadReportCsv({
        shiftId: activeShiftId,
        types: ["sales", "cash_movements", "purchases", "shifts"],
      })
      toast.success("Reporte del turno descargado en CSV")
    } catch (e: any) {
      toast.error(e.message || "Error al exportar reporte del turno")
    } finally {
      setExporting(false)
    }
  }

  const diffBadge = result?.shift.difference ?? null
  let diffVariant: "emerald" | "indigo" | "red" = "emerald"
  if (diffBadge !== null) {
    if (Math.abs(diffBadge) < 0.01) diffVariant = "emerald"
    else if (diffBadge > 0) diffVariant = "indigo"
    else diffVariant = "red"
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose()
        setTimeout(() => closeM.reset(), 200)
      }}
      title={result ? "Cierre de turno completado" : "Cerrar turno y arqueo"}
      icon={<Lock size={18} className="text-amber-400" />}
      size="md"
      footer={
        result ? (
          <div className="flex w-full items-center justify-between">
            <Button
              variant="secondary"
              loading={exporting}
              onClick={handleExportShiftCsv}
            >
              <Download size={14} /> Exportar Reporte del Turno (CSV)
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose()
                setTimeout(() => closeM.reset(), 200)
              }}
            >
              Finalizar
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between">
            {activeShiftId ? (
              <Button
                variant="secondary"
                size="sm"
                loading={exporting}
                onClick={handleExportShiftCsv}
                title="Descargar detalle actual del turno antes de cerrar"
              >
                <Download size={13} /> Exportar CSV
              </Button>
            ) : <span />}

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                loading={closeM.isPending}
                disabled={actualCash.trim() === "" || num(actualCash) < 0}
                onClick={submit}
              >
                Confirmar cierre
              </Button>
            </div>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Ventas del turno" value={String(result.summary.salesCount)} />
            <Row label="Efectivo esperado" value={fmtMoney(result.shift.expectedCash ?? 0)} mono />
            <Row label="Contado por el cajero" value={fmtMoney(result.shift.actualCash ?? 0)} mono />
            <div className="flex items-center justify-between rounded-lg bg-slate-800/60 p-3">
              <span className="text-slate-400">Diferencia</span>
              <Badge variant={diffVariant}>
                {result.shift.difference === null
                  ? "-"
                  : Math.abs(result.shift.difference) < 0.01
                    ? "Cuadrado"
                    : `${result.shift.difference > 0 ? "+" : "-"}${fmtMoney(Math.abs(result.shift.difference))}`}
              </Badge>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Por método de pago
            </p>
            <div className="space-y-1">
              {Object.entries(result.summary.byMethod).map(([method, data]) => (
                <div key={method} className="flex justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-sm">
                  <span className="text-slate-300">
                    {methodLabel(method as never)}{" "}
                    <span className="text-xs text-slate-500">({data.count})</span>
                  </span>
                  <span className="font-mono font-semibold">{fmtMoney(data.amount)}</span>
                </div>
              ))}
              {result.summary.cashIn > 0 && (
                <div className="flex justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-sm">
                  <span className="text-slate-300">Ingresos manuales</span>
                  <span className="font-mono text-emerald-400">+{fmtMoney(result.summary.cashIn)}</span>
                </div>
              )}
              {result.summary.cashOut > 0 && (
                <div className="flex justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-sm">
                  <span className="text-slate-300">Extracciones manuales</span>
                  <span className="font-mono text-red-400">-{fmtMoney(result.summary.cashOut)}</span>
                </div>
              )}
            </div>
          </div>

          {result.shift.notes && (
            <p className="rounded-lg bg-slate-800/40 p-3 text-xs text-slate-400">
              Notas: {result.shift.notes}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <Lock size={20} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="text-sm">
              <p className="font-semibold text-amber-300">Arqueo a ciegas</p>
              <p className="mt-1 text-slate-300">
                Contá el efectivo físico de la caja e ingresalo acá. El total esperado se revela
                recién después de tu conteo.
              </p>
            </div>
          </div>

          <Input
            label="Efectivo contado en caja *"
            mono
            inputMode="decimal"
            autoFocus
            placeholder="0.00"
            className="h-14 text-2xl font-bold"
            value={actualCash}
            onChange={(e) => setActualCash(e.target.value.replace(/[^\d.,]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          <textarea
            placeholder="Notas del cierre (opcional)"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      )}
    </Modal>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-800/60 p-3">
      <span className="text-slate-400">{label}</span>
      <span className={mono ? "font-mono font-semibold text-slate-200" : "font-semibold text-slate-200"}>
        {value}
      </span>
    </div>
  )
}
