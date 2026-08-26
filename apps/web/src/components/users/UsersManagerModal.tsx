import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Check,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Role, User } from "@/lib/types"
import { fmtDate } from "@/lib/format"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"
import { Spinner } from "@/components/ui/Spinner"

interface Props {
  open: boolean
  onClose: () => void
}

export function UsersManagerModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [userFormOpen, setUserFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [credTarget, setCredTarget] = useState<User | null>(null)

  const usersQ = useQuery({
    queryKey: ["users", "admin-list"],
    queryFn: () => api.get<{ users: User[] }>("/users"),
    enabled: open,
  })

  const users = usersQ.data?.users ?? []

  const toggleActiveM = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<{ user: User }>(`/users/${id}`, { isActive }),
    onSuccess: (data) => {
      toast.success(
        `Usuario "${data.user.username}" ${data.user.isActive ? "activado" : "desactivado"}`,
      )
      void qc.invalidateQueries({ queryKey: ["users"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Gestión de Usuarios y Personal (RBAC)"
        icon={<ShieldCheck size={18} className="text-indigo-400" />}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            <Button
              variant="primary"
              onClick={() => {
                setEditingUser(null)
                setUserFormOpen(true)
              }}
            >
              <UserPlus size={15} /> Nuevo Usuario / Cajero
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Administrá el personal, asigná roles (<span className="text-indigo-400 font-semibold">ADMIN</span> o <span className="text-emerald-400 font-semibold">CASHIER</span>), y reseteá credenciales o PIN de acceso.
          </p>

          {usersQ.isPending ? (
            <Spinner />
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              No hay usuarios registrados.
            </p>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900/80">
                  <tr>
                    <th className="px-3 py-2.5">Usuario / Nombre</th>
                    <th className="px-3 py-2.5">Rol</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-3 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 font-mono text-xs font-bold text-slate-300">
                            {u.username.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-200">{u.fullName}</p>
                            <p className="font-mono text-[11px] text-slate-500">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {u.role === "ADMIN" ? (
                          <Badge variant="indigo" className="flex items-center gap-1 w-fit">
                            <Shield size={11} /> Administrador
                          </Badge>
                        ) : (
                          <Badge variant="emerald" className="w-fit">Cajero</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {u.isActive !== false ? (
                          <Badge variant="emerald" className="flex items-center gap-1 w-fit">
                            <UserCheck size={11} /> Activo
                          </Badge>
                        ) : (
                          <Badge variant="red" className="flex items-center gap-1 w-fit">
                            <UserX size={11} /> Inactivo
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            title="Modificar PIN / Contraseña"
                            onClick={() => setCredTarget(u)}
                          >
                            <KeyRound size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Editar Datos"
                            onClick={() => {
                              setEditingUser(u)
                              setUserFormOpen(true)
                            }}
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title={u.isActive !== false ? "Desactivar" : "Activar"}
                            onClick={() =>
                              toggleActiveM.mutate({
                                id: u.id,
                                isActive: u.isActive === false,
                              })
                            }
                          >
                            {u.isActive !== false ? (
                              <UserX size={13} className="text-red-400" />
                            ) : (
                              <UserCheck size={13} className="text-emerald-400" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Alta / Edición de Usuario */}
      <UserFormModal
        open={userFormOpen}
        onClose={() => {
          setUserFormOpen(false)
          void qc.invalidateQueries({ queryKey: ["users"] })
        }}
        user={editingUser}
      />

      {/* Modal para Modificar PIN / Contraseña */}
      <CredentialsModal
        open={!!credTarget}
        onClose={() => setCredTarget(null)}
        user={credTarget}
      />
    </>
  )
}

function UserFormModal({
  open,
  onClose,
  user,
}: {
  open: boolean
  onClose: () => void
  user: User | null
}) {
  const editing = !!user
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<Role>("CASHIER")
  const [pin, setPin] = useState("")
  const [password, setPassword] = useState("")

  const [initialized, setInitialized] = useState(false)
  if (open && !initialized) {
    setUsername(user?.username ?? "")
    setFullName(user?.fullName ?? "")
    setRole(user?.role ?? "CASHIER")
    setPin("")
    setPassword("")
    setInitialized(true)
  }
  if (!open && initialized) {
    setInitialized(false)
  }

  const saveM = useMutation({
    mutationFn: () => {
      if (editing) {
        return api.patch(`/users/${user.id}`, {
          fullName: fullName.trim(),
          role,
        })
      }
      return api.post("/users", {
        username: username.trim(),
        fullName: fullName.trim(),
        role,
        pin: pin.trim(),
        password: password.trim() || undefined,
      })
    },
    onSuccess: () => {
      toast.success(editing ? "Usuario actualizado" : "Usuario creado exitosamente")
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid = editing
    ? fullName.trim().length >= 2
    : username.trim().length >= 3 &&
      fullName.trim().length >= 2 &&
      /^\d{4,6}$/.test(pin) &&
      (role !== "ADMIN" || password.length >= 6)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar Usuario @${user?.username}` : "Nuevo Usuario / Cajero"}
      icon={<UserPlus size={18} className="text-indigo-400" />}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={saveM.isPending}
            disabled={!valid}
            onClick={() => saveM.mutate()}
          >
            Guardar
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) saveM.mutate()
        }}
        className="space-y-3"
      >
        {!editing && (
          <Input
            label="Nombre de Usuario (Login) *"
            placeholder="Ej: juan, cajero2"
            value={username}
            autoFocus
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
          />
        )}

        <Input
          label="Nombre Completo *"
          placeholder="Ej: Juan Pérez"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-400">Rol del Usuario *</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-[42px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          >
            <option value="CASHIER">Cajero (Ventas, POS y Fiados)</option>
            <option value="ADMIN">Administrador (Control total + Configuración)</option>
          </select>
        </div>

        {!editing && (
          <>
            <Input
              label="PIN Numérico de Acceso Rápido (4 a 6 dígitos) *"
              type="password"
              placeholder="••••"
              value={pin}
              maxLength={6}
              mono
              inputMode="numeric"
              onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ""))}
            />

            {role === "ADMIN" && (
              <Input
                label="Contraseña de Administrador (mínimo 6 caracteres) *"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </>
        )}
      </form>
    </Modal>
  )
}

function CredentialsModal({
  open,
  onClose,
  user,
}: {
  open: boolean
  onClose: () => void
  user: User | null
}) {
  const [newPin, setNewPin] = useState("")
  const [newPassword, setNewPassword] = useState("")

  const [initialized, setInitialized] = useState(false)
  if (open && !initialized) {
    setNewPin("")
    setNewPassword("")
    setInitialized(true)
  }
  if (!open && initialized) {
    setInitialized(false)
  }

  const saveM = useMutation({
    mutationFn: () => {
      const payload: { pin?: string; password?: string } = {}
      if (newPin.trim()) payload.pin = newPin.trim()
      if (newPassword.trim()) payload.password = newPassword.trim()
      return api.put(`/users/${user!.id}/password-pin`, payload)
    },
    onSuccess: () => {
      toast.success(`Credenciales de @${user?.username} actualizadas`)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!user) return null

  const valid =
    (newPin.trim() ? /^\d{4,6}$/.test(newPin.trim()) : true) &&
    (newPassword.trim() ? newPassword.trim().length >= 6 : true) &&
    (!!newPin.trim() || !!newPassword.trim())

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Modificar PIN / Contraseña: @${user.username}`}
      icon={<KeyRound size={18} className="text-amber-400" />}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={saveM.isPending}
            disabled={!valid}
            onClick={() => saveM.mutate()}
          >
            Actualizar Credenciales
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) saveM.mutate()
        }}
        className="space-y-3"
      >
        <p className="text-xs text-slate-400">
          Completá el campo que desees restablecer para el usuario <strong className="text-slate-200">@{user.username}</strong>:
        </p>

        <Input
          label="Nuevo PIN Numérico (4 a 6 dígitos)"
          type="password"
          placeholder="Dejar vacío para no cambiar"
          value={newPin}
          maxLength={6}
          mono
          inputMode="numeric"
          onChange={(e) => setNewPin(e.target.value.replace(/[^\d]/g, ""))}
        />

        <Input
          label="Nueva Contraseña (mínimo 6 caracteres)"
          type="password"
          placeholder="Dejar vacío para no cambiar"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </form>
    </Modal>
  )
}
