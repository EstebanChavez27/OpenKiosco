import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../utils/db.js'
import { fail } from '../../utils/errors.js'
import { EPS, r2 } from '../../utils/money.js'
import { requireAdmin } from '../../plugins/auth.js'

const productBodySchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio'),
  barcode: z.string().min(1).nullish(),
  description: z.string().nullish(),
  categoryId: z.string().uuid().nullish(),
  costPrice: z.number().min(0).default(0),
  salePrice: z.number().positive('El precio de venta debe ser mayor a 0'),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(5),
  isWeighted: z.boolean().default(false),
})

const productUpdateSchema = productBodySchema.partial().extend({
  isActive: z.boolean().optional(),
})

const adjustSchema = z.object({
  type: z.enum(['PURCHASE', 'ADJUSTMENT', 'WASTE']),
  quantity: z.number().positive(),
  reason: z.string().max(200).optional(),
})

export async function productRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    await app.authenticate(req, reply)
  })

  app.get('/categories', async () => {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return { categories }
  })

  app.post('/categories', { ...requireAdmin(app) }, async (req) => {
    const dto = z.object({ name: z.string().min(2) }).parse(req.body)
    const exists = await prisma.category.findUnique({ where: { name: dto.name } })
    if (exists) fail(409, 'Ya existe una categoría con ese nombre')
    const category = await prisma.category.create({ data: { name: dto.name } })
    return { category }
  })

  app.get('/search', async (req) => {
    const q = ((req.query as Record<string, string | undefined>).q ?? '').trim()
    if (!q) {
      const latest = await prisma.product.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { name: 'asc' },
        take: 30,
      })
      return { products: latest }
    }

    const exact = await prisma.product.findFirst({
      where: { barcode: q, isActive: true },
      include: { category: true },
    })
    if (exact) return { products: [exact] }

    let rows = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [{ name: { contains: q } }, { barcode: { contains: q } }],
      },
      include: { category: true },
      orderBy: { name: 'asc' },
      take: 30,
    })

    if (rows.length === 0) {
      const lower = q.toLowerCase()
      const all = await prisma.product.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { name: 'asc' },
        take: 500,
      })
      rows = all
        .filter((p) => p.name.toLowerCase().includes(lower))
        .slice(0, 30)
    }

    return { products: rows }
  })

  app.get('/', async (req) => {
    const query = req.query as Record<string, string | undefined>
    const q = query.q?.trim()
    const lowStock = query.lowStock === '1'
    const showAll = query.all === '1'
    const page = Math.max(1, Number(query.page ?? 1))
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 50)))

    let rows = await prisma.product.findMany({
      where: {
        ...(showAll ? {} : { isActive: true }),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { barcode: { contains: q } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    })

    if (!q && !showAll) {
      const extra = await prisma.product.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { name: 'asc' },
        take: 1000,
      })
      rows = extra
    } else if (q) {
      const lower = q.toLowerCase()
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          (p.barcode ?? '').toLowerCase().includes(lower),
      )
    }

    if (lowStock) rows = rows.filter((p) => p.stock <= p.minStock + EPS)

    const total = rows.length
    const products = rows.slice((page - 1) * pageSize, page * pageSize)
    return { products, total, page, pageSize }
  })

  app.post('/', { ...requireAdmin(app) }, async (req) => {
    const dto = productBodySchema.parse(req.body)
    if (dto.barcode) {
      const dup = await prisma.product.findUnique({ where: { barcode: dto.barcode } })
      if (dup) fail(409, 'Ya existe un producto con ese código de barras')
    }
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: dto.name,
          barcode: dto.barcode || null,
          description: dto.description || null,
          categoryId: dto.categoryId || null,
          costPrice: r2(dto.costPrice),
          salePrice: r2(dto.salePrice),
          stock: r2(dto.stock),
          minStock: dto.minStock,
          isWeighted: dto.isWeighted,
        },
      })
      if (dto.stock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            userId: req.user.id,
            type: 'ADJUSTMENT',
            quantity: r2(dto.stock),
            previousStock: 0,
            newStock: r2(dto.stock),
            reason: 'Stock inicial',
          },
        })
      }
      return created
    })
    return { product }
  })

  app.patch('/:id', { ...requireAdmin(app) }, async (req) => {
    const { id } = req.params as { id: string }
    const dto = productUpdateSchema.parse(req.body)
    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) fail(404, 'Producto no encontrado')
    if (dto.barcode != null && dto.barcode !== existing.barcode) {
      const dup = await prisma.product.findUnique({ where: { barcode: dto.barcode } })
      if (dup) fail(409, 'Ya existe un producto con ese código de barras')
    }
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        barcode: dto.barcode === null ? null : (dto.barcode || null),
        description: dto.description === undefined ? undefined : (dto.description || null),
        categoryId: dto.categoryId === undefined ? undefined : (dto.categoryId || null),
        costPrice: dto.costPrice === undefined ? undefined : r2(dto.costPrice),
        salePrice: dto.salePrice === undefined ? undefined : r2(dto.salePrice),
        minStock: dto.minStock,
        isWeighted: dto.isWeighted,
        isActive: dto.isActive,
      },
    })
    return { product }
  })

  app.delete('/:id', { ...requireAdmin(app) }, async (req) => {
    const { id } = req.params as { id: string }
    const product = await prisma.product.update({ where: { id }, data: { isActive: false } })
    return { product }
  })

  app.post('/:id/stock', { ...requireAdmin(app) }, async (req) => {
    const { id } = req.params as { id: string }
    const dto = adjustSchema.parse(req.body)
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } })
      if (!product) fail(404, 'Producto no encontrado')

      const prev = product.stock
      let newStock: number
      if (dto.type === 'PURCHASE') newStock = r2(prev + dto.quantity)
      else if (dto.type === 'WASTE') {
        newStock = r2(prev - dto.quantity)
        if (newStock < -EPS) fail(400, `La merma supera el stock actual (${prev})`)
      } else newStock = r2(dto.quantity)

      await tx.product.update({ where: { id }, data: { stock: newStock } })
      const movement = await tx.stockMovement.create({
        data: {
          productId: id,
          userId: req.user.id,
          type: dto.type,
          quantity: r2(dto.quantity),
          previousStock: prev,
          newStock,
          reason: dto.reason,
        },
      })
      return { movement, newStock }
    })
    return result
  })
}
