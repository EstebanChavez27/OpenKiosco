import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Wallet } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Shift } from "@/lib/types"
import { fmtDate, num } from "@/lib/format"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"

export function OpenShiftView() {
  const qc = useQueryClient()
  const [initialCash, setInitialCash] = useState("")

  const lastShiftQ = useQuery({
    queryKey: ["shifts", "last"],
    queryFn: () => api.get<{ shifts: Shift[] }>("/shifts"),
  })
  const lastClosed = lastShiftQ.data?.shifts.find((s) => s.status === "CLOSED")

  const openM = useMutation({
    mutationFn: (dto: { initialCash: number }) =>
      api.post<{ shift: Shift }>("/shifts/open", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift"] })
      toast.success("Turno abierto")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submit = () => {
    const amount = initialCash.trim() === "" ? 0 : num(initialCash)
    if (amount < 0 || isNaN(amount)) return
    openM.mutate({ initialCash: amount })
  }

  return (
    <div className="mx-auto mt-10 max-w-md">
      <Card className="space-y-5 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-emerald-500/15 p-4 text-emerald-400">
            <Wallet size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Abrir turno</h1>
            <p className="mt-1 text-sm text-slate-400">
              Ingresá el efectivo con el que arranca la caja para habilitar la venta.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="space-y-4"
        >
          <Input
            label="Efectivo inicial"
            mono
            inputMode="decimal"
            autoFocus
            placeholder="0.00"
            className="h-12 text-xl"
            value={initialCash}
            onChange={(e) => setInitialCash(e.target.value.replace(/[^\d.,]/g, ""))}
            suffix={<Wallet size={16} />}
          />
          <Button type="submit" variant="primary" size="xl" className="w-full" loading={openM.isPending}>
            Abrir turno
          </Button>
          <p className="text-center text-[11px] text-slate-600">
            Presioná Enter para confirmar
          </p>
        </form>

        {lastClosed && (
          <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-xs text-slate-400">
            <span>
              Último turno cerrado: {fmtDate(lastClosed.closedAt ?? lastClosed.openedAt)}
            </span>
            {lastClosed.difference !== null && (
              <Badge variant={Math.abs(lastClosed.difference) < 0.01 ? "emerald" : "amber"}>
                {lastClosed.difference > 0 ? "+" : ""}
                {(lastClosed.difference ?? 0).toFixed(2)}
              </Badge>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
