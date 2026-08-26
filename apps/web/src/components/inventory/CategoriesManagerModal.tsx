import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FolderPlus, Layers, Pencil, Plus, Tag, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Category } from "@/lib/types"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"
import { Badge } from "@/components/ui/Badge"

const PRESET_COLORS = [
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#64748b", // Slate
]

interface Props {
  open: boolean
  onClose: () => void
}

export function CategoriesManagerModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [moveToCatId, setMoveToCatId] = useState("")

  const catsQ = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/categories"),
    enabled: open,
  })

  const categories = catsQ.data?.categories ?? []

  const resetForm = () => {
    setEditingCat(null)
    setName("")
    setColor(PRESET_COLORS[0])
  }

  const startEdit = (cat: Category) => {
    setEditingCat(cat)
    setName(cat.name)
    setColor(cat.color || PRESET_COLORS[0])
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), color }
      return editingCat
        ? api.patch(`/categories/${editingCat.id}`, payload)
        : api.post("/categories", payload)
    },
    onSuccess: () => {
      toast.success(editingCat ? "Categoría actualizada" : "Categoría creada")
      void qc.invalidateQueries({ queryKey: ["categories"] })
      void qc.invalidateQueries({ queryKey: ["products"] })
      resetForm()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (catId: string) => {
      return api.delete(`/categories/${catId}`, {
        moveToCategoryId: moveToCatId || undefined,
      })
    },
    onSuccess: () => {
      toast.success("Categoría eliminada")
      setDeleteTarget(null)
      setMoveToCatId("")
      void qc.invalidateQueries({ queryKey: ["categories"] })
      void qc.invalidateQueries({ queryKey: ["products"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gestión de Categorías"
      icon={<Layers size={18} className="text-emerald-400" />}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Formulario de creación / edición */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) saveMutation.mutate()
          }}
          className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              {editingCat ? <Pencil size={13} /> : <FolderPlus size={13} />}
              {editingCat ? `Editar "${editingCat.name}"` : "Nueva categoría"}
            </span>
            {editingCat && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
              >
                <X size={12} /> Cancelar edición
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Nombre de categoría"
              placeholder="Ej: Lácteos, Golosinas, Cigarrillos..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              wrapperClassName="sm:col-span-2"
            />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Color distintivo</label>
              <div className="flex items-center gap-1.5 pt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-6 w-6 rounded-full border border-slate-700 transition hover:scale-110 relative"
                    style={{ backgroundColor: c }}
                  >
                    {color === c && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saveMutation.isPending}
              disabled={!name.trim()}
            >
              {editingCat ? "Actualizar categoría" : "Guardar categoría"}
            </Button>
          </div>
        </form>

        {/* Modal de confirmación de eliminación con reubicación de productos */}
        {deleteTarget && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-red-300">
                  ¿Eliminar categoría "{deleteTarget.name}"?
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tiene {deleteTarget._count?.products ?? 0} producto(s) asignados actualmente.
                </p>
              </div>
              <button
                onClick={() => {
                  setDeleteTarget(null)
                  setMoveToCatId("")
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {(deleteTarget._count?.products ?? 0) > 0 && (
              <div className="space-y-1">
                <label className="block text-xs text-slate-300">
                  ¿Qué hacer con los productos de esta categoría?
                </label>
                <select
                  value={moveToCatId}
                  onChange={(e) => setMoveToCatId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-100 focus:border-red-500 focus:outline-none"
                >
                  <option value="">Desvincular (dejar sin categoría)</option>
                  {categories
                    .filter((c) => c.id !== deleteTarget.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Mover a: {c.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleteTarget(null)
                  setMoveToCatId("")
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                Confirmar eliminación
              </Button>
            </div>
          </div>
        )}

        {/* Lista de categorías */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Categorías creadas ({categories.length})
          </span>

          {categories.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-500">
              No hay categorías creadas. Podés agregar la primera arriba.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3.5 py-2.5 transition hover:border-slate-700"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3.5 w-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: c.color || "#10b981" }}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-100">{c.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {c._count?.products ?? 0} producto(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Editar"
                      onClick={() => startEdit(c)}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Eliminar"
                      className="text-slate-500 hover:text-red-400"
                      onClick={() => setDeleteTarget(c)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
