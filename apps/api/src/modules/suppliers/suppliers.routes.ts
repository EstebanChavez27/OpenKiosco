import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../utils/db.js'
import { fail } from '../../utils/errors.js'
import { r2 } from '../../utils/money.js'
import { requireAdmin } from '../../plugins/auth.js'

const supplierSchema = z.object({
  name: z.string().min(2, 'El nombre del proveedor es obligatorio'),
  contactName: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email('Email inválido').nullish().or(z.literal('')),
  address: z.string().nullish(),
  notes: z.string().nullish(),
})

const supplierUpdateSchema = supplierSchema.partial()

const purchaseItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.number().min(0, 'El costo unitario no puede ser negativo'),
})

const purchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().nullish(),
  notes: z.string().nullish(),
  paidWithCash: z.boolean().default(false),
  items: z.array(purchaseItemSchema).min(1, 'Indicá al menos un producto'),
})

export async function supplierRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    await app.authenticate(req, reply)
  })

  // Listar proveedores
  app.get('/', async (req) => {
    const q = ((req.query as Record<string, string | undefined>).q ?? '').trim().toLowerCase()
    const suppliers = await prisma.supplier.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { contactName: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
      orderBy: { name: 'asc' },
    })
    return { suppliers }
  })

  // Detalle de proveedor
  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string }
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            items: {
              include: { product: { select: { name: true, barcode: true } } },
            },
          },
        },
      },
    })
    if (!supplier) fail(404, 'Proveedor no encontrado')
    return { supplier }
  })

  // Crear proveedor
  app.post('/', { ...requireAdmin(app) }, async (req) => {
    const dto = supplierSchema.parse(req.body)
    const supplier = await prisma.supplier.create({
      data: {
        name: dto.name.trim(),
        contactName: dto.contactName?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        address: dto.address?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    })
    return { supplier }
  })

  // Modificar proveedor
  app.patch('/:id', { ...requireAdmin(app) }, async (req) => {
    const { id } = req.params as { id: string }
    const dto = supplierUpdateSchema.parse(req.body)
    const existing = await prisma.supplier.findUnique({ where: { id } })
    if (!existing) fail(404, 'Proveedor no encontrado')

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        contactName: dto.contactName === undefined ? undefined : (dto.contactName?.trim() || null),
        phone: dto.phone === undefined ? undefined : (dto.phone?.trim() || null),
        email: dto.email === undefined ? undefined : (dto.email?.trim() || null),
        address: dto.address === undefined ? undefined : (dto.address?.trim() || null),
        notes: dto.notes === undefined ? undefined : (dto.notes?.trim() || null),
      },
    })
    return { supplier }
  })

  // Eliminar proveedor
  app.delete('/:id', { ...requireAdmin(app) }, async (req) => {
    const { id } = req.params as { id: string }
    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { purchaseOrders: true } } },
    })
    if (!existing) fail(404, 'Proveedor no encontrado')
    if (existing._count.purchaseOrders > 0) {
      fail(409, 'No se puede eliminar un proveedor con órdenes de compra asociadas')
    }

    await prisma.supplier.delete({ where: { id } })
    return { success: true }
  })

  // Listar compras / recepciones de mercadería
  app.get('/purchases/list', async () => {
    const purchases = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, barcode: true, isWeighted: true } },
          },
        },
      },
    })
    return { purchases }
  })

  // Registrar compra / recepción de mercadería
  app.post('/purchases', { ...requireAdmin(app) }, async (req) => {
    const dto = purchaseOrderSchema.parse(req.body)

    const supplier = await prisma.supplier.findUnique({ where: { id: dto.supplierId } })
    if (!supplier) fail(404, 'Proveedor no encontrado')

    const result = await prisma.$transaction(async (tx) => {
      let openShiftId: string | null = null

      if (dto.paidWithCash) {
        const currentShift = await tx.shift.findFirst({ where: { status: 'OPEN' } })
        if (!currentShift) {
          fail(409, 'Se requiere un turno abierto para registrar egreso de caja en efectivo.')
        }
        openShiftId = currentShift.id
      }

      // Calcular subtotales y total
      let total = 0
      const processedItems = []
      for (const it of dto.items) {
        const p = await tx.product.findUnique({ where: { id: it.productId } })
        if (!p) fail(404, `Producto no encontrado (ID: ${it.productId})`)

        const subtotal = r2(it.quantity * it.unitCost)
        total = r2(total + subtotal)
        processedItems.push({
          productId: it.productId,
          quantity: r2(it.quantity),
          unitCost: r2(it.unitCost),
          subtotal,
          previousStock: p.stock,
          productName: p.name,
        })
      }

      const order = await tx.purchaseOrder.create({
        data: {
          supplierId: supplier.id,
          status: dto.paidWithCash ? 'PAID' : 'RECEIVED',
          total,
          invoiceNumber: dto.invoiceNumber || null,
          notes: dto.notes || null,
          paidWithCash: dto.paidWithCash,
          shiftId: openShiftId,
          items: {
            create: processedItems.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitCost: it.unitCost,
              subtotal: it.subtotal,
            })),
          },
        },
        include: {
          items: {
            include: { product: true },
          },
          supplier: true,
        },
      })

      // Actualizar stock y costo de cada producto
      for (const it of processedItems) {
        const newStock = r2(it.previousStock + it.quantity)
        await tx.product.update({
          where: { id: it.productId },
          data: {
            stock: newStock,
            costPrice: it.unitCost > 0 ? it.unitCost : undefined,
          },
        })

        await tx.stockMovement.create({
          data: {
            productId: it.productId,
            userId: req.user.id,
            type: 'PURCHASE',
            quantity: it.quantity,
            previousStock: it.previousStock,
            newStock,
            reason: `Compra #${order.id.slice(0, 8)} (${supplier.name})`,
          },
        })
      }

      // Si fue pagado en efectivo de caja, crear movimiento de egreso
      if (dto.paidWithCash && openShiftId) {
        await tx.cashMovement.create({
          data: {
            shiftId: openShiftId,
            userId: req.user.id,
            type: 'CASH_OUT',
            amount: total,
            reason: `Pago a proveedor: ${supplier.name} (Orden #${order.id.slice(0, 8)})`,
          },
        })
      }

      return order
    })

    return { purchaseOrder: result }
  })
}
