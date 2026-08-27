import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPin = await bcrypt.hash('1234', 10)
  const adminPass = await bcrypt.hash('1234', 10)
  const cashierPin = await bcrypt.hash('1111', 10)

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { pin: adminPin, password: adminPass, role: 'ADMIN' },
    create: {
      username: 'admin',
      fullName: 'Administrador',
      pin: adminPin,
      password: adminPass,
      role: 'ADMIN',
    },
  })

  await prisma.user.upsert({
    where: { username: 'caja1' },
    update: { pin: cashierPin },
    create: {
      username: 'caja1',
      fullName: 'Cajera de Turno',
      pin: cashierPin,
      role: 'CASHIER',
    },
  })

  const categoriesData = ['Bebidas', 'Almacén', 'Limpieza', 'Panadería']
  const categories: Record<string, string> = {}
  for (const name of categoriesData) {
    const cat = await prisma.category.upsert({ where: { name }, update: {}, create: { name } })
    categories[name] = cat.id
  }

  const products: Array<{
    barcode: string
    name: string
    cat?: string
    cost: number
    price: number
    stock: number
    min: number
    weighted?: boolean
  }> = [
    { barcode: '7790001000011', name: 'Coca-Cola 500ml', cat: 'Bebidas', cost: 900, price: 1250, stock: 40, min: 12 },
    { barcode: '7790002000022', name: 'Pepsi 500ml', cat: 'Bebidas', cost: 850, price: 1150, stock: 55, min: 12 },
    { barcode: '7790003000033', name: 'Agua mineral 600ml', cat: 'Bebidas', cost: 600, price: 900, stock: 80, min: 24 },
    { barcode: '7790004000044', name: 'Galletitas Oreo', cat: 'Almacén', cost: 450, price: 750, stock: 30, min: 10 },
    { barcode: '7790005000055', name: 'Yerba mate 1kg', cat: 'Almacén', cost: 2800, price: 3600, stock: 15, min: 5 },
    { barcode: '7790006000066', name: 'Azúcar 1kg', cat: 'Almacén', cost: 950, price: 1300, stock: 8, min: 6 },
    { barcode: '7790007000077', name: 'Fideos guiseros 500g', cat: 'Almacén', cost: 620, price: 950, stock: 25, min: 8 },
    { barcode: '7790008000088', name: 'Detergente 750ml', cat: 'Limpieza', cost: 1400, price: 1900, stock: 9, min: 6 },
    { barcode: '20', name: 'Pan por kilo', cat: 'Panadería', cost: 1500, price: 2300, stock: 12.5, min: 5, weighted: true },
    { barcode: '21', name: 'Medialunas por kilo', cat: 'Panadería', cost: 2200, price: 3400, stock: 3.2, min: 4, weighted: true },
    { barcode: '7790011001111', name: 'Alfajor simple', cat: 'Almacén', cost: 350, price: 600, stock: 48, min: 12 },
    { barcode: '7790013001333', name: 'Pilas AA x4', cat: 'Limpieza', cost: 900, price: 1500, stock: 3, min: 6 },
  ]

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { barcode: p.barcode } })
    if (!existing) {
      await prisma.product.create({
        data: {
          barcode: p.barcode,
          name: p.name,
          categoryId: p.cat ? categories[p.cat] : null,
          costPrice: p.cost,
          salePrice: p.price,
          stock: p.stock,
          minStock: p.min,
          isWeighted: !!p.weighted,
        },
      })
    }
  }

  const juanExists = await prisma.customer.findFirst({ where: { name: 'Juan Pérez' } })
  if (!juanExists) {
    const juan = await prisma.customer.create({
      data: { name: 'Juan Pérez', phone: '5491122334455', creditLimit: 50000, balance: 3500 },
    })
    await prisma.customerLedgerEntry.create({
      data: { customerId: juan.id, type: 'CHARGE', amount: 3500, description: 'Compra fiada inicial' },
    })
  }

  const mariaExists = await prisma.customer.findFirst({ where: { name: 'María Gómez' } })
  if (!mariaExists) {
    const maria = await prisma.customer.create({
      data: { name: 'María Gómez', phone: '5491188776655', creditLimit: 15000, balance: 6000 },
    })
    await prisma.customerLedgerEntry.create({
      data: { customerId: maria.id, type: 'CHARGE', amount: 6000, description: 'Compra fiada inicial' },
    })
  }

  const carlosExists = await prisma.customer.findFirst({ where: { name: 'Carlos Ruiz' } })
  if (!carlosExists) {
    await prisma.customer.create({
      data: { name: 'Carlos Ruiz', phone: null, creditLimit: 0, balance: 0 },
    })
  }

  console.log('')
  console.log('Seed completado.')
  console.log('  Admin  -> usuario: admin   | PIN: 1234 | contraseña: 1234')
  console.log('  Cajero -> usuario: caja1   | PIN: 1111')
  console.log(`  ${products.length} productos, ${categoriesData.length} categorías, 3 clientes demo.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
