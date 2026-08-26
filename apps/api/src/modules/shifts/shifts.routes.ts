import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../utils/db.js'
import { fail } from '../../utils/errors.js'
import { r2 } from '../../utils/money.js'

const openSchema = z.object({
  initialCash: z.number().min(0).default(0),
})

const movementSchema = z.object({
  type: z.enum(['CASH_IN', 'CASH_OUT']),
  amount: z.number().positive(),
  reason: z.string().min(3, 'Describí el motivo del movimiento'),
})

const closeSchema = z.object({
  actualCash: z.number().min(0),
  notes: z.string().max(500).optional(),
})

async function getOpenShift() {
  return prisma.shift.findFirst({ where: { status: 'OPEN' }, orderBy: { openedAt: 'desc' } })
}

export async function shiftRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    await app.authenticate(req, reply)
  })

  app.post('/open', async (req) => {
    const dto = openSchema.parse(req.body)
    const open = await getOpenShift()
    if (open) fail(409, `Ya existe un turno abierto por ${open.userId === req.user.id ? 'vos' : 'otro usuario'} desde ${open.openedAt.toLocaleString('es-AR')}`)
    const shift = await prisma.shift.create({
      data: { userId: req.user.id, initialCash: r2(dto.initialCash) },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        _count: { select: { sales: true } },
      },
    })
    return { shift }
  })

  app.get('/current', async () => {
    const shift = await getOpenShift()
    if (!shift) return { shift: null }
    const full = await prisma.shift.findUnique({
      where: { id: shift.id },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        cashMovements: { orderBy: { createdAt: 'desc' }, take: 50 },
        _count: { select: { sales: true } },
      },
    })
    return { shift: full }
  })

  app.post('/cash-movement', async (req) => {
    const dto = movementSchema.parse(req.body)
    const open = await getOpenShift()
    if (!open) fail(409, 'No hay un turno abierto')
    const movement = await prisma.cashMovement.create({
      data: {
        shiftId: open.id,
        userId: req.user.id,
        type: dto.type,
        amount: r2(dto.amount),
        reason: dto.reason,
      },
    })
    return { movement }
  })

  app.post('/close', async (req) => {
    const dto = closeSchema.parse(req.body)
    const result = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findFirst({ where: { status: 'OPEN' } })
      if (!shift) fail(409, 'No hay un turno abierto')

      const sales = await tx.sale.findMany({
        where: { shiftId: shift.id },
        select: { payments: { select: { method: true, amount: true } } },
      })
      const movements = await tx.cashMovement.findMany({ where: { shiftId: shift.id } })

      let cashSales = 0
      let cashIn = 0
      let cashOut = 0
      const byMethod: Record<string, { amount: number; count: number }> = {}
      for (const s of sales) {
        for (const p of s.payments) {
          byMethod[p.method] ??= { amount: 0, count: 0 }
          byMethod[p.method].amount = r2(byMethod[p.method].amount + p.amount)
          byMethod[p.method].count += 1
          if (p.method === 'CASH') cashSales += p.amount
        }
      }
      for (const m of movements) {
        if (m.type === 'CASH_IN') cashIn += m.amount
        else cashOut += m.amount
      }

      const expectedCash = r2(shift.initialCash + cashSales + cashIn - cashOut)
      const difference = r2(dto.actualCash - expectedCash)

      const updated = await tx.shift.update({
        where: { id: shift.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          expectedCash,
          actualCash: r2(dto.actualCash),
          difference,
          notes: dto.notes,
        },
      })

      return {
        shift: updated,
        summary: {
          salesCount: sales.length,
          byMethod,
          cashIn: r2(cashIn),
          cashOut: r2(cashOut),
        },
      }
    })
    return result
  })

  app.get('/', async () => {
    const shifts = await prisma.shift.findMany({
      orderBy: { openedAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        _count: { select: { sales: true } },
      },
    })
    return { shifts }
  })

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string }
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        cashMovements: { orderBy: { createdAt: 'desc' } },
        _count: { select: { sales: true } },
      },
    })
    if (!shift) fail(404, 'Turno no encontrado')
    return { shift }
  })
}
