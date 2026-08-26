import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowDownCircle, ArrowUpCircle, Banknote } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { CashMovementType, Shift } from "@/lib/types"
import { fmtMoney, fmtTime, num } from "@/lib/format"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"

export function CashMovementModal({
  open,
  onClose,
  shift,
}: {
  open: boolean
  onClose: () => void
  shift: Shift
}) {
  const qc = useQueryClient()
  const [type, setType] = useState<CashMovementType>("CASH_IN")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")

  const m = useMutation({
    mutationFn: () =>
      api.post("/shifts/cash-movement", { type, amount: num(amount), reason: reason.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["shift"] })
      toast.success(type === "CASH_IN" ? "Ingreso registrado" : "Extracción registrada")
      setAmount("")
      setReason("")
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid = num(amount) > 0 && reason.trim().length >= 3

  const movements = (shift.cashMovements ?? []).slice(0, 8)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Movimiento de caja"
      icon={<Banknote size={18} className="text-emerald-400" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar <span className="sr-only">Esc</span>
          </Button>
          <Button variant="primary" loading={m.isPending} disabled={!valid} onClick={() => m.mutate()}>
            Registrar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setType("CASH_IN")}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border py-3 text-sm font-medium transition",
              type === "CASH_IN"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                : "border-slate-700 text-slate-400 hover:border-slate-500",
            )}
          >
            <ArrowDownCircle size={20} />
            Ingreso a caja
          </button>
          <button
            onClick={() => setType("CASH_OUT")}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border py-3 text-sm font-medium transition",
              type === "CASH_OUT"
                ? "border-red-500 bg-red-500/10 text-red-400"
                : "border-slate-700 text-slate-400 hover:border-slate-500",
            )}
          >
            <ArrowUpCircle size={20} />
            Extracción
          </button>
        </div>

        <Input
          label="Monto"
          mono
          inputMode="decimal"
          autoFocus
          placeholder="0.00"
          className="h-12 text-xl"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />

        <Input
          label="Motivo"
          placeholder={type === "CASH_IN" ? "Ej: vuelto adicional" : "Ej: pago a proveedor"}
          value={reason}
          maxLength={120}
          onChange={(e) => setReason(e.target.value)}
          hint="Mínimo 3 caracteres"
        />

        {movements.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              Últimos movimientos del turno
            </p>
            <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
              {movements.map((mv) => (
                <div key={mv.id} className="flex items-center justify-between rounded-md bg-slate-800/50 px-2.5 py-1.5 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-400">
                    {mv.type === "CASH_IN" ? (
                      <ArrowDownCircle size={13} className="shrink-0 text-emerald-500" />
                    ) : (
                      <ArrowUpCircle size={13} className="shrink-0 text-red-500" />
                    )}
                    <span className="truncate">{mv.reason}</span>
                    <span className="shrink-0 text-slate-600">· {fmtTime(mv.createdAt)}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono font-medium",
                      mv.type === "CASH_IN" ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {mv.type === "CASH_IN" ? "+" : "-"}
                    {fmtMoney(mv.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
