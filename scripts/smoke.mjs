const BASE = process.env.API_URL ?? 'http://localhost:3000'

let token = ''
let failures = 0

function assert(cond, label, extra = '') {
  if (cond) {
    console.log(`  OK   ${label}`)
  } else {
    failures++
    console.error(`  FAIL ${label} ${extra}`)
  }
}

async function req(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {}
  return { status: res.status, data }
}

async function main() {
  console.log(`Smoke test contra ${BASE}\n`)

  const health = await req('GET', '/health', null, false)
  assert(health.status === 200 && health.data.status === 'ok', 'GET /health')

  const badPin = await req('POST', '/api/auth/login-pin', { username: 'admin', pin: '9999' }, false)
  assert(badPin.status === 401, 'PIN incorrecto rechazado')

  const login = await req('POST', '/api/auth/login-pin', { username: 'admin', pin: '1234' }, false)
  assert(login.status === 200 && login.data.token, 'POST /auth/login-pin (admin/1234)')
  token = login.data.token

  const me = await req('GET', '/api/auth/me')
  assert(me.status === 200 && me.data.user.role === 'ADMIN', 'GET /auth/me')

  const noAuth = await fetch(BASE + '/api/products')
  assert(noAuth.status === 401, 'Ruta protegida sin token -> 401')

  const curBefore = await req('GET', '/api/shifts/current')
  assert(curBefore.status === 200 && curBefore.data.shift === null, 'Sin turno abierto')

  const opened = await req('POST', '/api/shifts/open', { initialCash: 5000 })
  assert(opened.status === 200 && opened.data.shift.initialCash === 5000, 'POST /shifts/open (inicial $5000)')

  const dupOpen = await req('POST', '/api/shifts/open', { initialCash: 0 })
  assert(dupOpen.status === 409, 'Doble apertura de turno rechazada (409)')

  const searchBarcode = await req('GET', '/api/products/search?q=7790001000011')
  assert(
    searchBarcode.data.products?.length === 1 && searchBarcode.data.products[0].name.includes('Coca'),
    'Búsqueda exacta por código de barras',
  )
  const searchName = await req('GET', '/api/products/search?q=COC')
  assert(searchName.data.products?.some((p) => p.name.includes('Coca')), 'Búsqueda fuzzy por nombre')

  const coca = searchName.data.products.find((p) => p.name.includes('Coca'))
  const pan = (await req('GET', '/api/products/search?q=pan')).data.products.find((p) => p.isWeighted)
  const customers = await req('GET', '/api/customers?q=Juan')
  const juan = customers.data.customers[0]

  const sale1 = await req('POST', '/api/sales', {
    items: [{ productId: coca.id, quantity: 2 }],
    payments: [
      { method: 'CASH', amount: 2000 },
      { method: 'ON_ACCOUNT', amount: 500 },
    ],
    customerId: juan.id,
  })
  assert(sale1.status === 200 && sale1.data.sale.total === 2500, 'Venta mixta efectivo+fiado ($2500)')
  assert(sale1.data.customerBalance === 4000, 'Balance de Juan actualizado a $4000')

  const sale2 = await req('POST', '/api/sales', {
    items: [{ productId: pan.id, quantity: 0.5 }],
    payments: [{ method: 'QR_TRANSFER', amount: 1150 }],
  })
  assert(sale2.status === 200 && sale2.data.sale.total === 1150, 'Venta fraccionada 0.5kg pan por QR')

  const badPayments = await req('POST', '/api/sales', {
    items: [{ productId: coca.id, quantity: 1 }],
    payments: [{ method: 'CASH', amount: 100 }],
  })
  assert(badPayments.status === 400, 'Pagos que no cubren el total -> 400')

  const fractionalInt = await req('POST', '/api/sales', {
    items: [{ productId: coca.id, quantity: 1.5 }],
    payments: [{ method: 'CASH', amount: 1875 }],
  })
  assert(fractionalInt.status === 400, 'Cantidad fraccionada en producto no pesable -> 400')

  const stockCheck = await req('GET', `/api/products/search?q=${coca.barcode}`)
  const cocaStock = stockCheck.data.products[0].stock
  assert(cocaStock === 38, `Stock descontado (Coca = ${cocaStock})`)

  const movement = await req('POST', '/api/shifts/cash-movement', {
    type: 'CASH_OUT',
    amount: 1500,
    reason: 'Pago al proveedor',
  })
  assert(movement.status === 200, 'Movimiento manual de caja (extracción $1500)')

  const stmt = await req('GET', `/api/customers/${juan.id}/statement`)
  assert(stmt.data.totals.balance === 4000 && stmt.data.entries.length >= 2, 'Estado de cuenta con entradas')

  const overpay = await req('POST', `/api/customers/${juan.id}/payments`, { amount: 99999 })
  assert(overpay.status === 400, 'Pago mayor a la deuda -> 400')

  const pay = await req('POST', `/api/customers/${juan.id}/payments`, { amount: 1000 })
  assert(pay.status === 200 && pay.data.customer.balance === 3000, 'Pago parcial de deuda ($1000)')

  const closed = await req('POST', '/api/shifts/close', { actualCash: 6650, notes: 'Cierre demo' })
  const expected = 5000 + 2000 - 1500
  assert(closed.status === 200, 'POST /shifts/close (arqueo)')
  assert(
    closed.data.shift.expectedCash === expected &&
      closed.data.shift.difference === 6650 - expected,
    `Esperado $${expected}, diferencia registrada (${closed.data.shift.difference})`,
  )
  assert(closed.data.summary.salesCount === 2, 'Resumen del cierre con 2 ventas')
  assert(closed.data.summary.byMethod.QR_TRANSFER?.amount === 1150, 'Desglose por método de pago')

  const curAfter = await req('GET', '/api/shifts/current')
  assert(curAfter.data.shift === null, 'Turno cerrado correctamente')

  const today = await req('GET', '/api/reports/today')
  assert(today.data.salesTotal === 3650 && today.data.fiados.total === 9000, 'Reporte del día consistente')

  console.log('')
  if (failures === 0) {
    console.log('Todos los tests pasaron.')
  } else {
    console.error(`${failures} test(s) fallaron.`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
