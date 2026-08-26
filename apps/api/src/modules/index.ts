import type { FastifyInstance } from 'fastify'
import { authRoutes } from './auth/auth.routes.js'
import { shiftRoutes } from './shifts/shifts.routes.js'
import { productRoutes } from './products/products.routes.js'
import { categoryRoutes } from './categories/categories.routes.js'
import { customerRoutes } from './customers/customers.routes.js'
import { supplierRoutes } from './suppliers/suppliers.routes.js'
import { saleRoutes } from './sales/sales.routes.js'
import { reportRoutes } from './reports/reports.routes.js'
import { userRoutes } from './users/users.routes.js'

export async function registerModules(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(shiftRoutes, { prefix: '/shifts' })
  await app.register(productRoutes, { prefix: '/products' })
  await app.register(categoryRoutes, { prefix: '/categories' })
  await app.register(customerRoutes, { prefix: '/customers' })
  await app.register(supplierRoutes, { prefix: '/suppliers' })
  await app.register(saleRoutes, { prefix: '/sales' })
  await app.register(reportRoutes, { prefix: '/reports' })
  await app.register(userRoutes, { prefix: '/users' })
}
