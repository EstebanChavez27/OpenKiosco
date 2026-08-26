import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../utils/db.js'
import { fail } from '../../utils/errors.js'

const loginPinSchema = z.object({
  username: z.string().min(1),
  pin: z.string().regex(/^\d{4,6}$/, 'El PIN debe tener entre 4 y 6 dígitos'),
})

const loginAdminSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

function userDTO(u: { id: string; username: string; fullName: string; role: string }) {
  return { id: u.id, username: u.username, fullName: u.fullName, role: u.role as 'ADMIN' | 'CASHIER' }
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/users', async () => {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, username: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    })
    return { users: users.map(userDTO) }
  })

  app.post('/login-pin', async (req) => {
    const { username, pin } = loginPinSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !user.isActive) fail(401, 'Usuario o PIN incorrecto')
    const ok = await bcrypt.compare(pin, user.pin)
    if (!ok) fail(401, 'Usuario o PIN incorrecto')
    const token = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '12h' },
    )
    return { token, user: userDTO(user) }
  })

  app.post('/login-admin', async (req) => {
    const { username, password } = loginAdminSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !user.isActive || user.role !== 'ADMIN' || !user.password) {
      fail(401, 'Credenciales incorrectas')
    }
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) fail(401, 'Credenciales incorrectas')
    const token = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '12h' },
    )
    return { token, user: userDTO(user) }
  })

  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, fullName: true, role: true },
    })
    if (!user) fail(401, 'Usuario no encontrado')
    return { user: userDTO(user) }
  })
}
