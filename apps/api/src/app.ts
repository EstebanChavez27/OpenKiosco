import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import fs from 'node:fs'
import path from 'node:path'
import { ZodError } from 'zod'
import { HttpError } from './utils/errors.js'
import authPlugin from './plugins/auth.js'
import { registerModules } from './modules/index.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
    },
  })

  await app.register(cors, { origin: true })
  await app.register(authPlugin)

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ message: 'Datos inválidos', issues: err.flatten() })
    }
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ message: err.message, details: err.details })
    }
    app.log.error(err)
    return reply.code(500).send({ message: 'Error interno del servidor' })
  })

  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }))

  await app.register(registerModules, { prefix: '/api' })

  const publicDir = process.env.PUBLIC_DIR
  if (publicDir && fs.existsSync(publicDir)) {
    await app.register(fastifyStatic, { root: path.resolve(publicDir) })
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api')) {
        return reply.code(404).send({ message: 'No encontrado' })
      }
      return reply.sendFile('index.html')
    })
  }

  return app
}
