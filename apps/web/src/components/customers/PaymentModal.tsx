import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Coins } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Customer } from "@/lib/types"
import { fmtMoney, num } from "@/lib/format"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"

export function PaymentModal({
  open,
  onClose,
  customer,
}: {
  open: boolean
  onClose: () => void
  customer: Customer | null
}) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")

  useEffect(() => {
    if (open && customer) {
      setAmount(customer.balance.toFixed(2))
      setNote("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const m = useMutation({
    mutationFn: () =>
      api.post(`/customers/${customer!.id}/payments`, {
        amount: num(amount),
        description: note.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] })
      void qc.invalidateQueries({ queryKey: ["customer-statement"] })
      void qc.invalidateQueries({ queryKey: ["reports"] })
      toast.success("Pago registrado")
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid = !!customer && num(amount) > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registrar pago · ${customer?.name ?? ""}`}
      icon={<Coins size={18} className="text-amber-400" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="amber" loading={m.isPending} disabled={!valid} onClick={() => m.mutate()}>
            Cobrar {fmtMoney(num(amount))}
          </Button>
        </>
      }
    >
      {customer && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-800/60 p-3 text-sm">
            <span className="text-slate-400">Deuda actual</span>
            <Badge variant={customer.balance > 0 ? "amber" : "emerald"}>
              {fmtMoney(customer.balance)}
            </Badge>
          </div>

          <Input
            label="Monto recibido"
            mono
            inputMode="decimal"
            autoFocus
            className="h-12 text-xl"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          />

          <div className="flex gap-2">
            <Button size="sm" onClick={() => setAmount(customer.balance.toFixed(2))}>
              Todo ({fmtMoney(customer.balance)})
            </Button>
            <Button size="sm" onClick={() => setAmount((customer.balance / 2).toFixed(2))}>
              Mitad
            </Button>
          </div>

          <Input
            label="Nota (opcional)"
            placeholder="Ej: abona parte de la compra del sábado"
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
    </Modal>
  )
}
