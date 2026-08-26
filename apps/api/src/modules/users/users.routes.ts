import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../utils/db.js'
import { fail } from '../../utils/errors.js'
import { requireAdmin } from '../../plugins/auth.js'

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'El usuario solo puede contener letras, números y guiones'),
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  role: z.enum(['ADMIN', 'CASHIER']).default('CASHIER'),
  pin: z.string().regex(/^\d{4,6}$/, 'El PIN debe tener entre 4 y 6 dígitos numéricos'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().nullable(),
})

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'CASHIER']).optional(),
  isActive: z.boolean().optional(),
})

const updateCredentialsSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'El PIN debe tener entre 4 y 6 dígitos numéricos').optional().nullable(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().nullable(),
})

function userDTO(u: {
  id: string
  username: string
  fullName: string
  role: string
  isActive: boolean
  createdAt: Date
}) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role as 'ADMIN' | 'CASHIER',
    isActive: u.isActive,
    createdAt: u.createdAt,
  }
}

export async function userRoutes(app: FastifyInstance) {
  // Listar todos los usuarios (solo ADMIN)
  app.get('/', { ...requireAdmin(app) }, async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { fullName: 'asc' },
    })
    return { users: users.map(userDTO) }
  })

  // Crear nuevo usuario (solo ADMIN)
  app.post('/', { ...requireAdmin(app) }, async (req) => {
    const dto = createUserSchema.parse(req.body)
    const normalizedUsername = dto.username.toLowerCase().trim()

    const existing = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    })
    if (existing) {
      fail(409, 'Ya existe un usuario con ese nombre de usuario')
    }

    if (dto.role === 'ADMIN' && !dto.password) {
      fail(400, 'Los usuarios administradores requieren una contraseña')
    }

    const hashedPin = await bcrypt.hash(dto.pin, 10)
    const hashedPassword = dto.password ? await bcrypt.hash(dto.password, 10) : null

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        fullName: dto.fullName.trim(),
        role: dto.role,
        pin: hashedPin,
        password: hashedPassword,
        isActive: true,
      },
    })

    return { user: userDTO(user) }
  })

  // Modificar datos básicos y estado (solo ADMIN)
  app.patch('/:id', { ...requireAdmin(app) }, async (req) => {
    const { id } = req.params as { id: string }
    const dto = updateUserSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) fail(404, 'Usuario no encontrado')

    // Evitar desactivar al último administrador
    if (dto.isActive === false && existing.role === 'ADMIN') {
      const activeAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      })
      if (activeAdmins <= 1) {
        fail(400, 'No puedes desactivar al único administrador activo del sistema')
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        role: dto.role,
        isActive: dto.isActive,
      },
    })

    return { user: userDTO(user) }
  })

  // Modificar PIN o contraseña (solo ADMIN)
  app.put('/:id/password-pin', { ...requireAdmin(app) }, async (req) => {
    const { id } = req.params as { id: string }
    const dto = updateCredentialsSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) fail(404, 'Usuario no encontrado')

    if (!dto.pin && !dto.password) {
      fail(400, 'Debes ingresar un nuevo PIN o una nueva contraseña')
    }

    const data: { pin?: string; password?: string } = {}
    if (dto.pin) {
      data.pin = await bcrypt.hash(dto.pin, 10)
    }
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10)
    }

    await prisma.user.update({
      where: { id },
      data,
    })

    return { success: true, message: 'Credenciales actualizadas correctamente' }
  })
}
