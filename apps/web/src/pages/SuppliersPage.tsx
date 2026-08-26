import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  PackagePlus,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Search,
  Trash2,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Product, PurchaseOrder, Supplier } from "@/lib/types"
import { useDebounce } from "@/hooks/useDebounce"
import { fmtDate, fmtMoney, fmtQty, fmtTime, num } from "@/lib/format"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"
import { Spinner } from "@/components/ui/Spinner"
import { EmptyState } from "@/components/ui/EmptyState"

export default function SuppliersPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<"suppliers" | "purchases">("suppliers")
  const [rawQuery, setRawQuery] = useState("")
  const q = useDebounce(rawQuery, 250)

  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [selectedSupplierForPurchase, setSelectedSupplierForPurchase] = useState<Supplier | null>(null)

  // Consultar proveedores
  const suppliersQ = useQuery({
    queryKey: ["suppliers", "list", q],
    queryFn: () =>
      api.get<{ suppliers: Supplier[] }>(`/suppliers?q=${encodeURIComponent(q)}`),
  })

  // Consultar compras
  const purchasesQ = useQuery({
    queryKey: ["purchases", "list"],
    queryFn: () => api.get<{ purchases: PurchaseOrder[] }>("/suppliers/purchases/list"),
    enabled: activeTab === "purchases",
  })

  const suppliers = suppliersQ.data?.suppliers ?? []
  const purchases = purchasesQ.data?.purchases ?? []

  return (
    <div className="space-y-4">
      {/* Barra superior de pestañas y acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1">
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "suppliers"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users size={14} /> Agenda de Proveedores ({suppliers.length})
          </button>
          <button
            onClick={() => setActiveTab("purchases")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "purchases"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Receipt size={14} /> Historial de Compras
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setEditSupplier(null)
              setSupplierModalOpen(true)
            }}
          >
            <UserPlus size={15} /> Nuevo proveedor
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setSelectedSupplierForPurchase(null)
              setPurchaseModalOpen(true)
            }}
          >
            <PackagePlus size={15} /> Cargar compra / Recepción
          </Button>
        </div>
      </div>

      {activeTab === "suppliers" ? (
        <div className="space-y-4">
          {/* Buscador */}
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, contacto o teléfono..."
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
            />
          </div>

          {suppliersQ.isPending ? (
            <Spinner />
          ) : suppliers.length === 0 ? (
            <Card>
              <EmptyState
                icon={Truck}
                title="Sin proveedores registrados"
                hint="Agregá tus proveedores para gestionar compras, actualizar costos y controlar contactos."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suppliers.map((s) => {
                const cleanPhone = s.phone?.replace(/[^\d]/g, "")
                const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null

                return (
                  <Card key={s.id} className="flex flex-col justify-between space-y-3 p-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-100 text-base">{s.name}</p>
                          {s.contactName && (
                            <p className="text-xs text-slate-400">Contacto: {s.contactName}</p>
                          )}
                        </div>
                        <Badge variant="slate">
                          {s._count?.purchaseOrders ?? 0} compras
                        </Badge>
                      </div>

                      <div className="space-y-1 text-xs text-slate-400">
                        {s.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="text-slate-500 shrink-0" />
                            <span className="font-mono">{s.phone}</span>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-auto flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20"
                                title="Abrir chat de WhatsApp"
                              >
                                <MessageCircle size={12} /> WhatsApp
                              </a>
                            )}
                          </div>
                        )}

                        {s.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={13} className="text-slate-500 shrink-0" />
                            <a
                              href={`mailto:${s.email}`}
                              className="text-slate-300 hover:text-emerald-400 truncate"
                            >
                              {s.email}
                            </a>
                          </div>
                        )}

                        {s.address && (
                          <div className="flex items-center gap-2">
                            <MapPin size={13} className="text-slate-500 shrink-0" />
                            <span className="truncate">{s.address}</span>
                          </div>
                        )}

                        {s.notes && (
                          <p className="rounded-lg bg-slate-900/60 p-2 text-[11px] text-slate-400 italic">
                            "{s.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedSupplierForPurchase(s)
                          setPurchaseModalOpen(true)
                        }}
                      >
                        <PackagePlus size={13} /> Cargar compra
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Editar"
                          onClick={() => {
                            setEditSupplier(s)
                            setSupplierModalOpen(true)
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Pestaña de Historial de Compras */
        <div className="space-y-4">
          {purchasesQ.isPending ? (
            <Spinner />
          ) : purchases.length === 0 ? (
            <Card>
              <EmptyState
                icon={Receipt}
                title="Sin compras registradas"
                hint="Cuando registres recepciones de mercadería, aparecerán en este listado."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {purchases.map((p) => (
                <PurchaseCard key={p.id} purchase={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Proveedor (Alta / Edición) */}
      <SupplierFormModal
        open={supplierModalOpen}
        onClose={() => {
          setSupplierModalOpen(false)
          void qc.invalidateQueries({ queryKey: ["suppliers"] })
        }}
        supplier={editSupplier}
      />

      {/* Modal de Carga de Compra / Recepción */}
      <PurchaseOrderModal
        open={purchaseModalOpen}
        onClose={() => {
          setPurchaseModalOpen(false)
          setSelectedSupplierForPurchase(null)
          void qc.invalidateQueries({ queryKey: ["purchases"] })
          void qc.invalidateQueries({ queryKey: ["products"] })
          void qc.invalidateQueries({ queryKey: ["suppliers"] })
          void qc.invalidateQueries({ queryKey: ["shift"] })
        }}
        initialSupplier={selectedSupplierForPurchase}
        suppliers={suppliers}
      />
    </div>
  )
}

function PurchaseCard({ purchase }: { purchase: PurchaseOrder }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="p-4 space-y-3 transition hover:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Truck size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-100">{purchase.supplier?.name ?? "Proveedor"}</p>
              {purchase.invoiceNumber && (
                <span className="font-mono text-xs text-slate-500">
                  Doc #{purchase.invoiceNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{fmtDate(purchase.createdAt)} {fmtTime(purchase.createdAt)}</span>
              <span>•</span>
              <span className="font-mono">ID #{purchase.id.slice(0, 8)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Total Compra</p>
            <p className="font-mono text-lg font-bold text-emerald-400">
              {fmtMoney(purchase.total)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {purchase.paidWithCash ? (
              <Badge variant="amber" className="flex items-center gap-1">
                <Wallet size={12} /> Pagado caja
              </Badge>
            ) : (
              <Badge variant="slate">Recepcionado</Badge>
            )}

            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {purchase.notes && (
        <p className="text-xs text-slate-400 italic bg-slate-900/60 p-2 rounded-lg">
          Nota: {purchase.notes}
        </p>
      )}

      {/* Detalle de items de la compra */}
      {expanded && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Productos Ingresados ({purchase.items.length})
          </p>
          <div className="divide-y divide-slate-800/60 text-xs">
            {purchase.items.map((it) => (
              <div key={it.id} className="py-2 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-200">
                    {it.product?.name ?? "Producto"}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {it.product?.barcode ?? "sin código"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-slate-300">
                    {fmtQty(it.quantity)} un. × {fmtMoney(it.unitCost)}
                  </span>
                  <span className="mx-2 text-slate-600">=</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {fmtMoney(it.subtotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function SupplierFormModal({
  open,
  onClose,
  supplier,
}: {
  open: boolean
  onClose: () => void
  supplier: Supplier | null
}) {
  const editing = !!supplier
  const [name, setName] = useState("")
  const [contactName, setContactName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")

  const [initialized, setInitialized] = useState(false)
  if (open && !initialized) {
    setName(supplier?.name ?? "")
    setContactName(supplier?.contactName ?? "")
    setPhone(supplier?.phone ?? "")
    setEmail(supplier?.email ?? "")
    setAddress(supplier?.address ?? "")
    setNotes(supplier?.notes ?? "")
    setInitialized(true)
  }
  if (!open && initialized) {
    setInitialized(false)
  }

  const saveM = useMutation({
    mutationFn: () => {
      const dto = {
        name: name.trim(),
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      }
      return editing
        ? api.patch(`/suppliers/${supplier!.id}`, dto)
        : api.post("/suppliers", dto)
    },
    onSuccess: () => {
      toast.success(editing ? "Proveedor actualizado" : "Proveedor creado")
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${supplier?.name}` : "Nuevo Proveedor"}
      icon={<Truck size={18} className="text-emerald-400" />}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={saveM.isPending}
            disabled={!name.trim()}
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
          if (name.trim()) saveM.mutate()
        }}
        className="space-y-3"
      >
        <Input
          label="Nombre de la Empresa / Proveedor *"
          placeholder="Ej: Distribuidora Norte"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Persona de contacto"
            placeholder="Ej: Roberto"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <Input
            label="Teléfono / WhatsApp"
            placeholder="Ej: 5491122334455"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            placeholder="pedidos@proveedor.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Dirección / Localidad"
            placeholder="Calle 123"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <Input
          label="Notas adicionales"
          placeholder="Días de reparto, condiciones de pago, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  )
}

interface PurchaseItemRow {
  productId: string
  productName: string
  barcode: string | null
  currentCost: number
  unitCost: string
  quantity: string
}

function PurchaseOrderModal({
  open,
  onClose,
  initialSupplier,
  suppliers,
}: {
  open: boolean
  onClose: () => void
  initialSupplier: Supplier | null
  suppliers: Supplier[]
}) {
  const [supplierId, setSupplierId] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [paidWithCash, setPaidWithCash] = useState(false)
  const [items, setItems] = useState<PurchaseItemRow[]>([])

  const [productSearch, setProductSearch] = useState("")
  const debouncedProductSearch = useDebounce(productSearch, 200)

  const [initialized, setInitialized] = useState(false)
  if (open && !initialized) {
    setSupplierId(initialSupplier?.id ?? (suppliers[0]?.id || ""))
    setInvoiceNumber("")
    setNotes("")
    setPaidWithCash(false)
    setItems([])
    setProductSearch("")
    setInitialized(true)
  }
  if (!open && initialized) {
    setInitialized(false)
  }

  // Buscar productos para agregar a la compra
  const productsQ = useQuery({
    queryKey: ["products", "search", debouncedProductSearch],
    queryFn: () =>
      api.get<{ products: Product[] }>(
        `/products/search?q=${encodeURIComponent(debouncedProductSearch)}`,
      ),
    enabled: open && debouncedProductSearch.trim().length > 0,
  })

  const addProductToPurchase = (p: Product) => {
    if (items.some((it) => it.productId === p.id)) {
      toast.info(`${p.name} ya está en la lista`)
      return
    }
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        barcode: p.barcode,
        currentCost: p.costPrice,
        unitCost: String(p.costPrice > 0 ? p.costPrice : p.salePrice * 0.7),
        quantity: "1",
      },
    ])
    setProductSearch("")
  }

  const updateItem = (productId: string, patch: Partial<PurchaseItemRow>) => {
    setItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, ...patch } : it)),
    )
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId))
  }

  const total = items.reduce(
    (acc, it) => acc + num(it.quantity) * num(it.unitCost),
    0,
  )

  const saveM = useMutation({
    mutationFn: () => {
      const payload = {
        supplierId,
        invoiceNumber: invoiceNumber.trim() || null,
        notes: notes.trim() || null,
        paidWithCash,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: num(it.quantity),
          unitCost: num(it.unitCost),
        })),
      }
      return api.post("/suppliers/purchases", payload)
    },
    onSuccess: () => {
      toast.success("Compra y recepción de mercadería registrada con éxito")
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid = supplierId && items.length > 0 && items.every((it) => num(it.quantity) > 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cargar Compra / Recepción de Mercadería"
      icon={<PackagePlus size={18} className="text-emerald-400" />}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-left">
            <span className="text-xs text-slate-400">Total a ingresar:</span>
            <p className="font-mono text-xl font-bold text-emerald-400">{fmtMoney(total)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={saveM.isPending}
              disabled={!valid}
              onClick={() => saveM.mutate()}
            >
              Confirmar Recepción {fmtMoney(total)}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Cabecera de la compra */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Proveedor *</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="h-[42px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Seleccionar proveedor...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="N° Factura / Remito (opcional)"
            placeholder="Ej: A-0001-00004523"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />

          <Input
            label="Observaciones"
            placeholder="Ej: Reparto semanal"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Opción de egreso de caja */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <input
            type="checkbox"
            id="payCash"
            checked={paidWithCash}
            onChange={(e) => setPaidWithCash(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          <label htmlFor="payCash" className="text-xs text-slate-200 cursor-pointer">
            <span className="font-semibold text-emerald-400">Pagar con efectivo de caja</span> · Registrar automáticamente un movimiento de egreso (<span className="font-mono text-amber-400">CASH_OUT</span>) en el turno actual.
          </label>
        </div>

        {/* Buscador de productos para agregar */}
        <div className="relative">
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Agregar productos a la recepción
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              className="pl-9"
              placeholder="Buscar por código de barras o nombre del producto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>

          {productSearch.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-1">
              {(productsQ.data?.products ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProductToPurchase(p)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-800 transition"
                >
                  <div>
                    <p className="font-medium text-slate-100">{p.name}</p>
                    <p className="font-mono text-slate-500">{p.barcode ?? "sin código"}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-slate-400">Costo act: {fmtMoney(p.costPrice)}</span>
                    <span className="block font-mono text-emerald-400">Stock: {fmtQty(p.stock)}</span>
                  </div>
                </button>
              ))}
              {productsQ.data?.products?.length === 0 && (
                <p className="py-2 text-center text-xs text-slate-500">
                  No se encontraron productos coincidentes.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tabla de items agregados */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900/80">
              <tr>
                <th className="px-3 py-2.5">Producto</th>
                <th className="px-3 py-2.5 text-right w-24">Cant. Recibida</th>
                <th className="px-3 py-2.5 text-right w-32">Nuevo Costo Unit.</th>
                <th className="px-3 py-2.5 text-right w-28">Subtotal</th>
                <th className="px-3 py-2.5 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.map((it) => {
                const sub = num(it.quantity) * num(it.unitCost)
                return (
                  <tr key={it.productId} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-200">{it.productName}</p>
                      {it.barcode && (
                        <p className="font-mono text-[10px] text-slate-500">{it.barcode}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        mono
                        inputMode="decimal"
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(it.productId, {
                            quantity: e.target.value.replace(/[^\d.,]/g, ""),
                          })
                        }
                        className="h-8 text-right font-mono"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        mono
                        inputMode="decimal"
                        value={it.unitCost}
                        onChange={(e) =>
                          updateItem(it.productId, {
                            unitCost: e.target.value.replace(/[^\d.,]/g, ""),
                          })
                        }
                        className="h-8 text-right font-mono"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                      {fmtMoney(sub)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(it.productId)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 text-xs">
                    Buscá productos arriba para agregarlos a esta orden de compra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
