import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../utils/db.js'
import { fail } from '../../utils/errors.js'
import { requireAdmin } from '../../plugins/auth.js'

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(50),
  color: z.string().nullish(),
  icon: z.string().nullish(),
})

const categoryUpdateSchema = categorySchema.partial()

export async function categoryRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    await app.authenticate(req, reply)
  })

  // Listar todas las categorías con conteo de productos
  app.get('/', async () => {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
    })
    return { categories }
  })

  // Crear categoría
  app.post('/', { ...requireAdmin(app) }, async (req) => {
    const dto = categorySchema.parse(req.body)
    const exists = await prisma.category.findUnique({ where: { name: dto.name.trim() } })
    if (exists) fail(409, 'Ya existe una categoría con ese nombre')

    const category = await prisma.category.create({
      data: {
        name: dto.name.trim(),
        color: dto.color || null,
        icon: dto.icon || null,
      },
    })
    return { category }
  })

  // Modificar categoría
  app.patch('/:id', { ...requireAdmin(app) }, async (req) => {
    const { id } = req.params as { id: string }
    const dto = categoryUpdateSchema.parse(req.body)

    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing) fail(404, 'Categoría no encontrada')

    if (dto.name && dto.name.trim() !== existing.name) {
      const dup = await prisma.category.findUnique({ where: { name: dto.name.trim() } })
      if (dup) fail(409, 'Ya existe una categoría con ese nombre')
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        color: dto.color === undefined ? undefined : (dto.color || null),
        icon: dto.icon === undefined ? undefined : (dto.icon || null),
      },
    })
    return { category }
  })

  // Eliminar categoría (desvincular o mover productos)
  app.delete('/:id', { ...requireAdmin(app) }, async (req) => {
    const { id } = req.params as { id: string }
    const query = (req.query as Record<string, string | undefined>) ?? {}
    const body = (req.body as Record<string, string | undefined>) ?? {}
    const moveToCategoryId = query.moveToCategoryId || body.moveToCategoryId

    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing) fail(404, 'Categoría no encontrada')

    try {
      await prisma.$transaction(async (tx) => {
        if (moveToCategoryId && moveToCategoryId !== id) {
          const target = await tx.category.findUnique({ where: { id: moveToCategoryId } })
          if (!target) fail(404, 'Categoría de destino no encontrada')
          await tx.product.updateMany({
            where: { categoryId: id },
            data: { categoryId: moveToCategoryId },
          })
        } else {
          await tx.product.updateMany({
            where: { categoryId: id },
            data: { categoryId: null },
          })
        }

        await tx.category.delete({ where: { id } })
      })
    } catch (e) {
      req.log.error(e)
      throw e
    }

    return { success: true, deletedId: id }
  })
}
