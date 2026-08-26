import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../utils/db.js'
import { fail } from '../../utils/errors.js'
import { EPS, r2, moneyEq } from '../../utils/money.js'

const createSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio'),
  phone: z.string().max(30).nullish(),
  creditLimit: z.number().min(0).default(0),
})

const updateSchema = createSchema.partial()

const paymentSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(200).optional(),
})

export async function customerRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    await app.authenticate(req, reply)
  })

  app.get('/', async (req) => {
    const q = ((req.query as Record<string, string | undefined>).q ?? '').trim()
    const customers = await prisma.customer.findMany({
      where: q ? { name: { contains: q } } : undefined,
      orderBy: [{ balance: 'desc' }, { name: 'asc' }],
      take: 200,
    })
    const lower = q.toLowerCase()
    const filtered = q
      ? customers.filter((c) => c.name.toLowerCase().includes(lower) || (c.phone ?? '').includes(q))
      : customers
    return { customers: filtered }
  })

  app.post('/', async (req) => {
    const dto = createSchema.parse(req.body)
    const customer = await prisma.customer.create({
      data: {
        name: dto.name,
        phone: dto.phone || null,
        creditLimit: r2(dto.creditLimit),
      },
    })
    return { customer }
  })

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string }
    const dto = updateSchema.parse(req.body)
    const existing = await prisma.customer.findUnique({ where: { id } })
    if (!existing) fail(404, 'Cliente no encontrado')
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone === undefined ? undefined : (dto.phone || null),
        creditLimit: dto.creditLimit === undefined ? undefined : r2(dto.creditLimit),
      },
    })
    return { customer }
  })

  app.get('/:id/statement', async (req) => {
    const { id } = req.params as { id: string }
    const customer = await prisma.customer.findUnique({ where: { id } })
    if (!customer) fail(404, 'Cliente no encontrado')
    const entries = await prisma.customerLedgerEntry.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    let charged = 0
    let paid = 0
    for (const e of entries) {
      if (e.type === 'CHARGE') charged += e.amount
      else paid += e.amount
    }
    return {
      customer,
      entries,
      totals: { charged: r2(charged), paid: r2(paid), balance: customer.balance },
    }
  })

  app.post('/:id/payments', async (req) => {
    const { id } = req.params as { id: string }
    const dto = paymentSchema.parse(req.body)
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id } })
      if (!customer) fail(404, 'Cliente no encontrado')
      if (dto.amount > customer.balance + EPS && !moneyEq(dto.amount, customer.balance)) {
        fail(400, `El pago (${dto.amount}) supera la deuda actual (${customer.balance})`)
      }
      const amount = moneyEq(dto.amount, customer.balance) ? customer.balance : r2(dto.amount)
      const entry = await tx.customerLedgerEntry.create({
        data: {
          customerId: id,
          type: 'PAYMENT',
          amount,
          description: dto.description?.trim() || 'Pago de cuenta corriente',
        },
      })
      const updated = await tx.customer.update({
        where: { id },
        data: { balance: { decrement: amount } },
      })
      return { customer: updated, entry }
    })
    return result
  })
}
