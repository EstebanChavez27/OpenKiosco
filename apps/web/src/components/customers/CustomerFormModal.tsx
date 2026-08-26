import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BookUser } from "lucide-react"
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
  customer?: Customer | null
}

export function CustomerFormModal({ open, onClose, customer }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [creditLimit, setCreditLimit] = useState("0")

  useEffect(() => {
    if (open) {
      setName(customer?.name ?? "")
      setPhone(customer?.phone ?? "")
      setCreditLimit(String(customer?.creditLimit ?? 0))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const m = useMutation({
    mutationFn: () => {
      const dto = { name: name.trim(), phone: phone.trim() || null, creditLimit: num(creditLimit) }
      return customer
        ? api.patch(`/customers/${customer.id}`, dto)
        : api.post("/customers", dto)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] })
      toast.success(customer ? "Cliente actualizado" : "Cliente creado")
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid = name.trim().length >= 2

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Editar cliente" : "Nuevo cliente"}
      icon={<BookUser size={18} className="text-indigo-400" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={m.isPending} disabled={!valid} onClick={() => m.mutate()}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) m.mutate()
        }}
        className="space-y-4"
      >
        <Input
          label="Nombre y apellido"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Juan Pérez"
        />
        <Input
          label="Teléfono (WhatsApp)"
          mono
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
          placeholder="Ej: 5491122334455"
          hint="Formato internacional sin espacios para poder enviar resúmenes por WhatsApp."
        />
        <Input
          label="Límite de crédito"
          mono
          inputMode="decimal"
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value.replace(/[^\d.,]/g, ""))}
          hint="0 = sin tope de fiado configurado."
        />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
