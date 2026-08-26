import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { UserPlus } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Customer } from "@/lib/types"
import { num } from "@/lib/format"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (customer: Customer) => void
  initialName?: string
}

export function QuickCustomerModal({ open, onClose, onCreated, initialName = "" }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState("")
  const [creditLimit, setCreditLimit] = useState("0")

  useEffect(() => {
    if (open) {
      setName(initialName)
      setPhone("")
      setCreditLimit("0")
    }
  }, [open, initialName])

  const createM = useMutation({
    mutationFn: () =>
      api.post<{ customer: Customer }>("/customers", {
        name: name.trim(),
        phone: phone.trim() || null,
        creditLimit: num(creditLimit),
      }),
    onSuccess: (data) => {
      toast.success(`Cliente "${data.customer.name}" registrado`)
      void qc.invalidateQueries({ queryKey: ["customers"] })
      onCreated(data.customer)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo Cliente Rápido"
      icon={<UserPlus size={18} className="text-amber-400" />}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={createM.isPending}
            disabled={!name.trim()}
            onClick={() => createM.mutate()}
          >
            Guardar y Seleccionar
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) createM.mutate()
        }}
        className="space-y-3"
      >
        <Input
          label="Nombre y Apellido *"
          placeholder="Ej: Juan Pérez"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Teléfono / WhatsApp (opcional)"
          placeholder="Ej: 5491122334455"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Límite de Crédito para Fiados"
          placeholder="0 = sin tope"
          value={creditLimit}
          mono
          inputMode="decimal"
          onChange={(e) => setCreditLimit(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </form>
    </Modal>
  )
}
