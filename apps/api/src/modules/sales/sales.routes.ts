import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../utils/db.js'
import { fail } from '../../utils/errors.js'
import { EPS, moneyEq, r2 } from '../../utils/money.js'

export const paymentMethodSchema = z.enum([
  'CASH',
  'CARD_DEBIT',
  'CARD_CREDIT',
  'QR_TRANSFER',
  'ON_ACCOUNT',
])

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive('La cantidad debe ser mayor a 0'),
      }),
    )
    .min(1, 'El carrito está vacío'),
  payments: z
    .array(
      z.object({
        method: paymentMethodSchema,
        amount: z.number().positive('El monto del pago debe ser mayor a 0'),
      }),
    )
    .min(1, 'Indicá al menos un método de pago'),
  discount: z.number().min(0).default(0),
  customerId: z.string().uuid().optional(),
})

export async function saleRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    await app.authenticate(req, reply)
  })

  app.post('/', async (req) => {
    const dto = saleSchema.parse(req.body)

    const merged = new Map<string, number>()
    for (const item of dto.items) {
      merged.set(item.productId, r2((merged.get(item.productId) ?? 0) + item.quantity))
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const shift = await tx.shift.findFirst({ where: { status: 'OPEN' } })
      if (!shift) fail(409, 'No hay un turno abierto. Abrí turno antes de vender.')

      const products = await tx.product.findMany({
        where: { id: { in: [...merged.keys()] } },
      })

      const lines: Array<{
        productId: string
        name: string
        quantity: number
        unitPrice: number
        costPrice: number
        subtotal: number
        previousStock: number
      }> = []
      let subtotal = 0

      for (const [productId, quantity] of merged) {
        const p = products.find((x) => x.id === productId)
        if (!p || !p.isActive) fail(400, 'Producto inexistente o inactivo', { productId })
        if (!p!.isWeighted && !Number.isInteger(quantity)) {
          fail(400, `${p!.name}: solo admite cantidades enteras`)
        }
        if (p!.stock + EPS < quantity) {
          fail(409, `Stock insuficiente de ${p!.name}`, {
            productId,
            available: p!.stock,
            requested: quantity,
          })
        }
        const lineSubtotal = r2(quantity * p!.salePrice)
        subtotal = r2(subtotal + lineSubtotal)
        lines.push({
          productId,
          name: p!.name,
          quantity,
          unitPrice: p!.salePrice,
          costPrice: p!.costPrice,
          subtotal: lineSubtotal,
          previousStock: p!.stock,
        })
      }

      if (dto.discount > subtotal + EPS) fail(400, 'El descuento no puede superar el subtotal')
      const discount = r2(dto.discount)
      const total = r2(subtotal - discount)

      const received = r2(dto.payments.reduce((acc, p) => acc + p.amount, 0))
      if (!moneyEq(received, total)) {
        fail(400, `Los pagos (${received.toFixed(2)}) no coinciden con el total (${total.toFixed(2)})`)
      }

      const fiadoAmount = r2(
        dto.payments.filter((p) => p.method === 'ON_ACCOUNT').reduce((a, p) => a + p.amount, 0),
      )
      let customer:
        | { id: string; name: string; balance: number; creditLimit: number }
        | null = null

      if (fiadoAmount > 0) {
        if (!dto.customerId) fail(400, 'Seleccioná un cliente para el pago en cuenta (fiado)')
        const c = await tx.customer.findUnique({ where: { id: dto.customerId } })
        if (!c) fail(404, 'Cliente no encontrado')
        if (c.creditLimit > 0 && r2(c.balance + fiadoAmount) > c.creditLimit + EPS) {
          fail(409, `Límite de crédito excedido para ${c.name}`, {
            limit: c.creditLimit,
            currentBalance: c.balance,
            attempted: fiadoAmount,
          })
        }
        customer = { id: c.id, name: c.name, balance: c.balance, creditLimit: c.creditLimit }
      }

      const sale = await tx.sale.create({
        data: {
          shiftId: shift.id,
          userId: req.user.id,
          customerId: customer?.id ?? null,
          subtotal,
          discount,
          total,
        },
      })

      await tx.saleItem.createMany({
        data: lines.map((l) => ({
          saleId: sale.id,
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          costPrice: l.costPrice,
          subtotal: l.subtotal,
        })),
      })

      await tx.salePayment.createMany({
        data: dto.payments.map((p) => ({
          saleId: sale.id,
          method: p.method,
          amount: r2(p.amount),
        })),
      })

      for (const line of lines) {
        const updated = await tx.product.updateMany({
          where: { id: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        })
        if (updated.count !== 1) fail(409, `El stock cambió durante la venta de ${line.name}. Reintentá.`)
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            userId: req.user.id,
            type: 'SALE',
            quantity: line.quantity,
            previousStock: line.previousStock,
            newStock: r2(line.previousStock - line.quantity),
          },
        })
      }

      let newBalance: number | undefined
      if (customer && fiadoAmount > 0) {
        const updatedCustomer = await tx.customer.update({
          where: { id: customer.id },
          data: { balance: { increment: fiadoAmount } },
        })
        newBalance = updatedCustomer.balance
        await tx.customerLedgerEntry.create({
          data: {
            customerId: customer.id,
            saleId: sale.id,
            type: 'CHARGE',
            amount: fiadoAmount,
            description: `Venta en cuenta #${sale.id.slice(0, 8)}`,
          },
        })
      }

      const fullSale = await tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: {
            include: { product: { select: { name: true, barcode: true, isWeighted: true } } },
          },
          payments: true,
          customer: { select: { id: true, name: true } },
          user: { select: { fullName: true } },
        },
      })

      return { sale: fullSale, customerBalance: newBalance }
    })

    return result
  })

  app.get('/', async () => {
    const sales = await prisma.sale.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        user: { select: { fullName: true } },
        customer: { select: { id: true, name: true } },
        items: true,
        payments: true,
      },
    })
    return { sales }
  })

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string }
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { name: true, barcode: true } } } },
        payments: true,
        customer: { select: { id: true, name: true } },
        user: { select: { fullName: true } },
      },
    })
    if (!sale) fail(404, 'Venta no encontrada')
    return { sale }
  })
}
