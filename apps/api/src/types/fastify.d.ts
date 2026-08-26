import 'fastify'
import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; username: string; role: string }
    user: { id: string; username: string; role: 'ADMIN' | 'CASHIER' }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      req: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ) => Promise<void>
  }
}
