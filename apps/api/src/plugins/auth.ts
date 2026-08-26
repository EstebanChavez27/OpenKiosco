import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import jwt from '@fastify/jwt'
import { HttpError } from '../utils/errors.js'

export default fp(async (app: FastifyInstance) => {
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'openkiosco-dev-secret',
  })

  app.decorate('authenticate', async (req: FastifyRequest, _reply: FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch {
      throw new HttpError(401, 'Sesión inválida o expirada')
    }
  })
})

export function requireAdmin(app: FastifyInstance) {
  return {
    onRequest: [app.authenticate],
    preHandler: async (req: FastifyRequest) => {
      if (req.user.role !== 'ADMIN') throw new HttpError(403, 'Requiere rol administrador')
    },
  }
}
