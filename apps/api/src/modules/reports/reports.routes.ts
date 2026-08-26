import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/db.js'
import { r2 } from '../../utils/money.js'

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    await app.authenticate(req, reply)
  })

  app.get('/today', async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: start } },
      select: { total: true, payments: { select: { method: true, amount: true } } },
    })

    let revenue = 0
    const byMethod: Record<string, { amount: number; count: number }> = {}
    for (const s of sales) {
      revenue += s.total
      for (const p of s.payments) {
        byMethod[p.method] ??= { amount: 0, count: 0 }
        byMethod[p.method].amount = r2(byMethod[p.method].amount + p.amount)
        byMethod[p.method].count += 1
      }
    }
    revenue = r2(revenue)

    const lowStockProducts = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { stock: 'asc' },
      take: 500,
    })
    const lowStock = lowStockProducts.filter((p) => p.stock <= p.minStock).slice(0, 10)
    const lowStockCount = lowStockProducts.filter((p) => p.stock <= p.minStock).length

    const debtors = await prisma.customer.aggregate({
      _sum: { balance: true },
      _count: true,
      where: { balance: { gt: 0.009 } },
    })

    const openShift = await prisma.shift.findFirst({
      where: { status: 'OPEN' },
      include: { user: { select: { fullName: true } }, _count: { select: { sales: true } } },
    })

    return {
      salesTotal: revenue,
      salesCount: sales.length,
      averageTicket: sales.length ? r2(revenue / sales.length) : 0,
      byMethod,
      lowStockCount,
      lowStock,
      fiados: { total: r2(debtors._sum.balance ?? 0), customers: debtors._count },
      openShift,
    }
  })
}
