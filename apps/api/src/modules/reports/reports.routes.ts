import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/db.js'
import { r2 } from '../../utils/money.js'
import { fail } from '../../utils/errors.js'

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsvRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(',')
}

function formatDate(d: Date | string | null): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(d: Date | string | null): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    await app.authenticate(req, reply)
  })

  // Dashboard con soporte para filtros por turno, rango de fechas o histórico
  app.get('/dashboard', async (req) => {
    const q = req.query as {
      shiftId?: string
      startDate?: string
      endDate?: string
      mode?: 'today' | 'shift' | 'range' | 'all'
    }

    const whereSale: Record<string, unknown> = {}
    const whereCashMovement: Record<string, unknown> = {}
    let shiftInfo = null

    if (q.shiftId) {
      whereSale.shiftId = q.shiftId
      whereCashMovement.shiftId = q.shiftId
      shiftInfo = await prisma.shift.findUnique({
        where: { id: q.shiftId },
        include: {
          user: { select: { id: true, fullName: true, username: true } },
          _count: { select: { sales: true } },
        },
      })
    } else if (q.startDate || q.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {}
      if (q.startDate) {
        const start = new Date(q.startDate)
        start.setHours(0, 0, 0, 0)
        dateFilter.gte = start
      }
      if (q.endDate) {
        const end = new Date(q.endDate)
        end.setHours(23, 59, 59, 999)
        dateFilter.lte = end
      }
      whereSale.createdAt = dateFilter
      whereCashMovement.createdAt = dateFilter
    } else if (q.mode !== 'all') {
      // Default: Hoy
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      whereSale.createdAt = { gte: start }
      whereCashMovement.createdAt = { gte: start }
    }

    const sales = await prisma.sale.findMany({
      where: whereSale,
      include: {
        payments: { select: { method: true, amount: true } },
        items: { select: { quantity: true, unitPrice: true, costPrice: true } },
        user: { select: { id: true, fullName: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    let revenue = 0
    let totalCost = 0
    const byMethod: Record<string, { amount: number; count: number }> = {}

    for (const s of sales) {
      revenue += s.total
      for (const p of s.payments) {
        byMethod[p.method] ??= { amount: 0, count: 0 }
        byMethod[p.method].amount = r2(byMethod[p.method].amount + p.amount)
        byMethod[p.method].count += 1
      }
      for (const it of s.items) {
        totalCost += it.costPrice * it.quantity
      }
    }

    revenue = r2(revenue)
    const estimatedProfit = r2(revenue - totalCost)

    const cashMovements = await prisma.cashMovement.findMany({
      where: whereCashMovement,
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    })

    let cashIn = 0
    let cashOut = 0
    for (const m of cashMovements) {
      if (m.type === 'CASH_IN') cashIn += m.amount
      else cashOut += m.amount
    }

    const lowStockProducts = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { stock: 'asc' },
      take: 500,
    })
    const lowStock = lowStockProducts.filter((p) => p.stock <= p.minStock).slice(0, 10)
    const lowStockCount = lowStockProducts.filter((p) => p.stock <= p.minStock).length

    const debtors = await prisma.customer.aggregate({
      _sum: { balance: true },
      _count: true,
      where: { balance: { gt: 0.009 } },
    })

    const openShift = await prisma.shift.findFirst({
      where: { status: 'OPEN' },
      include: { user: { select: { fullName: true } }, _count: { select: { sales: true } } },
    })

    return {
      salesTotal: revenue,
      salesCount: sales.length,
      averageTicket: sales.length ? r2(revenue / sales.length) : 0,
      estimatedProfit,
      byMethod,
      cashMovements: {
        cashIn: r2(cashIn),
        cashOut: r2(cashOut),
        count: cashMovements.length,
        items: cashMovements,
      },
      sales: sales.slice(0, 50),
      shiftInfo,
      lowStockCount,
      lowStock,
      fiados: { total: r2(debtors._sum.balance ?? 0), customers: debtors._count },
      openShift,
    }
  })

  // Ruta original para compatibilidad
  app.get('/today', async (req) => {
    return app.inject({
      method: 'GET',
      url: '/api/reports/dashboard?mode=today',
      headers: req.headers,
    }).then((res) => JSON.parse(res.body))
  })

  // Exportación a CSV Granular
  app.get('/export/csv', async (req, reply) => {
    const q = req.query as {
      shiftId?: string
      startDate?: string
      endDate?: string
      types?: string // 'sales,purchases,stock,shifts,cash_movements' o 'all'
    }

    const typesStr = q.types || 'all'
    const selectedTypes = new Set(
      typesStr === 'all'
        ? ['sales', 'purchases', 'stock', 'shifts', 'cash_movements']
        : typesStr.split(',').map((t) => t.trim().toLowerCase()),
    )

    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (q.startDate) {
      const start = new Date(q.startDate)
      start.setHours(0, 0, 0, 0)
      dateFilter.gte = start
    }
    if (q.endDate) {
      const end = new Date(q.endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    const hasDateFilter = !!(q.startDate || q.endDate)
    const sections: string[] = []

    // 1. Resumen de Turno específico (si se solicita por shiftId)
    if (q.shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: q.shiftId },
        include: {
          user: { select: { fullName: true, username: true } },
          _count: { select: { sales: true } },
        },
      })
      if (shift) {
        sections.push(
          '=== INFORMACIÓN DEL TURNO ===',
          toCsvRow(['ID Turno', 'Cajero', 'Usuario', 'Fecha Apertura', 'Hora Apertura', 'Fecha Cierre', 'Hora Cierre', 'Estado', 'Fondo Inicial', 'Efectivo Esperado', 'Efectivo Contado', 'Diferencia', 'Cantidad Ventas', 'Notas']),
          toCsvRow([
            shift.id,
            shift.user.fullName,
            shift.user.username,
            formatDate(shift.openedAt),
            formatTime(shift.openedAt),
            formatDate(shift.closedAt),
            formatTime(shift.closedAt),
            shift.status === 'OPEN' ? 'ABIERTO' : 'CERRADO',
            shift.initialCash.toFixed(2),
            shift.expectedCash !== null ? shift.expectedCash.toFixed(2) : '',
            shift.actualCash !== null ? shift.actualCash.toFixed(2) : '',
            shift.difference !== null ? shift.difference.toFixed(2) : '',
            shift._count.sales,
            shift.notes || '',
          ]),
          '',
        )
      }
    }

    // 2. VENTAS
    if (selectedTypes.has('sales')) {
      const whereSale: Record<string, unknown> = {}
      if (q.shiftId) whereSale.shiftId = q.shiftId
      else if (hasDateFilter) whereSale.createdAt = dateFilter

      const sales = await prisma.sale.findMany({
        where: whereSale,
        include: {
          items: { include: { product: { select: { name: true, barcode: true } } } },
          payments: true,
          customer: { select: { name: true, phone: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      sections.push('=== VENTAS Y DETALLE DE ITEMS ===')
      sections.push(
        toCsvRow([
          'ID Venta',
          'Fecha',
          'Hora',
          'Cajero',
          'Cliente',
          'Subtotal',
          'Descuento',
          'Total',
          'Métodos de Pago',
          'Detalle de Productos (Cantidad x Nombre @ PrecioUnit = Subtotal)',
          'ID Turno',
        ]),
      )

      for (const s of sales) {
        const paymentsStr = s.payments.map((p) => `${p.method}: $${p.amount.toFixed(2)}`).join(' | ')
        const itemsStr = s.items
          .map((i) => `${i.quantity}x ${i.product.name} @ $${i.unitPrice.toFixed(2)} = $${i.subtotal.toFixed(2)}`)
          .join(' ; ')

        sections.push(
          toCsvRow([
            s.id,
            formatDate(s.createdAt),
            formatTime(s.createdAt),
            s.user.fullName,
            s.customer?.name || 'Consumidor Final',
            s.subtotal.toFixed(2),
            s.discount.toFixed(2),
            s.total.toFixed(2),
            paymentsStr,
            itemsStr,
            s.shiftId,
          ]),
        )
      }
      sections.push('')
    }

    // 3. MOVIMIENTOS DE CAJA (CASH MOVEMENTS)
    if (selectedTypes.has('cash_movements')) {
      const whereCash: Record<string, unknown> = {}
      if (q.shiftId) whereCash.shiftId = q.shiftId
      else if (hasDateFilter) whereCash.createdAt = dateFilter

      const movements = await prisma.cashMovement.findMany({
        where: whereCash,
        include: {
          user: { select: { fullName: true } },
          shift: { select: { id: true, openedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      sections.push('=== MOVIMIENTOS DE CAJA CHICA (INGRESOS Y EGRESOS) ===')
      sections.push(
        toCsvRow(['ID Movimiento', 'Fecha', 'Hora', 'Tipo', 'Monto', 'Motivo', 'Cajero / Usuario', 'ID Turno']),
      )

      for (const m of movements) {
        sections.push(
          toCsvRow([
            m.id,
            formatDate(m.createdAt),
            formatTime(m.createdAt),
            m.type === 'CASH_IN' ? 'INGRESO' : 'EGRESO',
            m.amount.toFixed(2),
            m.reason,
            m.user.fullName,
            m.shiftId,
          ]),
        )
      }
      sections.push('')
    }

    // 4. COMPRAS Y RECEPCIÓN DE PROVEEDORES
    if (selectedTypes.has('purchases')) {
      const wherePurchases: Record<string, unknown> = {}
      if (q.shiftId) wherePurchases.shiftId = q.shiftId
      else if (hasDateFilter) wherePurchases.createdAt = dateFilter

      const purchases = await prisma.purchaseOrder.findMany({
        where: wherePurchases,
        include: {
          supplier: { select: { name: true, phone: true } },
          items: { include: { product: { select: { name: true, barcode: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })

      sections.push('=== COMPRAS Y RECEPCIÓN A PROVEEDORES ===')
      sections.push(
        toCsvRow([
          'ID Compra',
          'Fecha',
          'Hora',
          'Proveedor',
          'N° Factura/Remito',
          'Total',
          'Pagado con Caja',
          'Estado',
          'ID Turno',
          'Detalle de Items (Cantidad x Producto @ CostoUnit = Subtotal)',
          'Notas',
        ]),
      )

      for (const p of purchases) {
        const itemsStr = p.items
          .map((i) => `${i.quantity}x ${i.product.name} @ $${i.unitCost.toFixed(2)} = $${i.subtotal.toFixed(2)}`)
          .join(' ; ')

        sections.push(
          toCsvRow([
            p.id,
            formatDate(p.createdAt),
            formatTime(p.createdAt),
            p.supplier.name,
            p.invoiceNumber || '—',
            p.total.toFixed(2),
            p.paidWithCash ? 'SI' : 'NO',
            p.status,
            p.shiftId || '—',
            itemsStr,
            p.notes || '',
          ]),
        )
      }
      sections.push('')
    }

    // 5. MOVIMIENTOS Y AJUSTES DE STOCK
    if (selectedTypes.has('stock')) {
      const whereStock: Record<string, unknown> = {}
      if (hasDateFilter) whereStock.createdAt = dateFilter

      const stockMoves = await prisma.stockMovement.findMany({
        where: whereStock,
        include: {
          product: { select: { name: true, barcode: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      sections.push('=== MOVIMIENTOS Y AJUSTES DE STOCK ===')
      sections.push(
        toCsvRow([
          'ID Movimiento',
          'Fecha',
          'Hora',
          'Producto',
          'Código de Barras',
          'Tipo Movimiento',
          'Cantidad',
          'Stock Anterior',
          'Nuevo Stock',
          'Motivo',
          'Usuario',
        ]),
      )

      for (const sm of stockMoves) {
        sections.push(
          toCsvRow([
            sm.id,
            formatDate(sm.createdAt),
            formatTime(sm.createdAt),
            sm.product.name,
            sm.product.barcode || '',
            sm.type,
            sm.quantity.toFixed(2),
            sm.previousStock.toFixed(2),
            sm.newStock.toFixed(2),
            sm.reason || '',
            sm.user.fullName,
          ]),
        )
      }
      sections.push('')
    }

    // 6. RESUMEN DE TURNOS (HISTÓRICO DE ARQUEOS)
    if (selectedTypes.has('shifts') && !q.shiftId) {
      const whereShift: Record<string, unknown> = {}
      if (hasDateFilter) whereShift.openedAt = dateFilter

      const shifts = await prisma.shift.findMany({
        where: whereShift,
        include: {
          user: { select: { fullName: true, username: true } },
          _count: { select: { sales: true } },
        },
        orderBy: { openedAt: 'desc' },
      })

      sections.push('=== RESUMEN HISTÓRICO DE TURNOS Y ARQUEOS ===')
      sections.push(
        toCsvRow([
          'ID Turno',
          'Cajero',
          'Fecha Apertura',
          'Hora Apertura',
          'Fecha Cierre',
          'Hora Cierre',
          'Estado',
          'Fondo Inicial',
          'Efectivo Esperado',
          'Efectivo Contado',
          'Diferencia',
          'Cantidad Ventas',
          'Notas',
        ]),
      )

      for (const s of shifts) {
        sections.push(
          toCsvRow([
            s.id,
            s.user.fullName,
            formatDate(s.openedAt),
            formatTime(s.openedAt),
            formatDate(s.closedAt),
            formatTime(s.closedAt),
            s.status === 'OPEN' ? 'ABIERTO' : 'CERRADO',
            s.initialCash.toFixed(2),
            s.expectedCash !== null ? s.expectedCash.toFixed(2) : '',
            s.actualCash !== null ? s.actualCash.toFixed(2) : '',
            s.difference !== null ? s.difference.toFixed(2) : '',
            s._count.sales,
            s.notes || '',
          ]),
        )
      }
      sections.push('')
    }

    // UTF-8 BOM para compatibilidad automática con Excel
    const csvContent = '\uFEFF' + sections.join('\r\n')
    const filenameDate = new Date().toISOString().slice(0, 10)
    const filename = q.shiftId
      ? `openkiosco_turno_${q.shiftId.slice(0, 8)}_${filenameDate}.csv`
      : `openkiosco_reporte_${filenameDate}.csv`

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csvContent)
  })
}
