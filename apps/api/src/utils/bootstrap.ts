import bcrypt from 'bcryptjs'
import { prisma } from './db.js'

export async function ensureDefaultAdmin() {
  try {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true },
    })

    if (adminCount === 0) {
      const existingAdmin = await prisma.user.findUnique({
        where: { username: 'admin' },
      })

      const hashedPin = await bcrypt.hash('1234', 10)
      const hashedPassword = await bcrypt.hash('1234', 10)

      if (existingAdmin) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: {
            fullName: existingAdmin.fullName || 'Administrador Inicial',
            role: 'ADMIN',
            isActive: true,
            pin: hashedPin,
            password: hashedPassword,
          },
        })
        console.log(
          '[openkiosco] Usuario administrador predeterminado reactivado: admin (PIN: 1234 / Clave: 1234)',
        )
      } else {
        await prisma.user.create({
          data: {
            username: 'admin',
            fullName: 'Administrador Inicial',
            role: 'ADMIN',
            pin: hashedPin,
            password: hashedPassword,
            isActive: true,
          },
        })
        console.log(
          '[openkiosco] Usuario administrador inicial creado automáticamente: admin (PIN: 1234 / Clave: 1234)',
        )
      }
    }

    // Asegurar que exista al menos una categoría por defecto
    const categoryCount = await prisma.category.count()
    if (categoryCount === 0) {
      await prisma.category.create({
        data: {
          name: 'General',
          color: '#10B981',
          icon: 'tag',
        },
      })
    }
  } catch (err) {
    console.error('[openkiosco] Error en la inicialización automática de credenciales:', err)
  }
}
