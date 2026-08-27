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
  const headers = {}
  if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json'
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

  const loginPass = await req('POST', '/api/auth/login-admin', { username: 'admin', password: '1234' }, false)
  assert(loginPass.status === 200 && loginPass.data.token, 'POST /auth/login-admin (admin/1234)')

  const me = await req('GET', '/api/auth/me')
  assert(me.status === 200 && me.data.user.role === 'ADMIN', 'GET /auth/me')

  const noAuth = await fetch(BASE + '/api/products')
  assert(noAuth.status === 401, 'Ruta protegida sin token -> 401')

  const curBefore = await req('GET', '/api/shifts/current')
  if (curBefore.data.shift) {
    await req('POST', '/api/shifts/close', { actualCash: 0, notes: 'Reset para tests' })
  }
  const curClean = await req('GET', '/api/shifts/current')
  assert(curClean.status === 200 && curClean.data.shift === null, 'Sin turno abierto')

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
  const juanInitialBalance = juan.balance
  const cocaInitialStock = coca.stock

  const sale1 = await req('POST', '/api/sales', {
    items: [{ productId: coca.id, quantity: 2 }],
    payments: [
      { method: 'CASH', amount: 2000 },
      { method: 'ON_ACCOUNT', amount: 500 },
    ],
    customerId: juan.id,
  })
  assert(sale1.status === 200 && sale1.data.sale.total === 2500, 'Venta mixta efectivo+fiado ($2500)')
  assert(sale1.data.customerBalance === juanInitialBalance + 500, `Balance de Juan actualizado a $${juanInitialBalance + 500}`)

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
  assert(cocaStock === cocaInitialStock - 2, `Stock descontado (Coca = ${cocaStock})`)

  const movement = await req('POST', '/api/shifts/cash-movement', {
    type: 'CASH_OUT',
    amount: 1500,
    reason: 'Pago al proveedor',
  })
  assert(movement.status === 200, 'Movimiento manual de caja (extracción $1500)')

  const stmt = await req('GET', `/api/customers/${juan.id}/statement`)
  assert(stmt.data.totals.balance === juanInitialBalance + 500 && stmt.data.entries.length >= 1, 'Estado de cuenta con entradas')

  const overpay = await req('POST', `/api/customers/${juan.id}/payments`, { amount: 999999 })
  assert(overpay.status === 400, 'Pago mayor a la deuda -> 400')

  const pay = await req('POST', `/api/customers/${juan.id}/payments`, { amount: 500 })
  assert(pay.status === 200 && pay.data.customer.balance === juanInitialBalance, 'Pago parcial de deuda ($500)')

  // Test Categorías CRUD
  const catName = `Golosinas ${Date.now()}`
  const catCreate = await req('POST', '/api/categories', { name: catName, color: '#ec4899' })
  assert(catCreate.status === 200 && catCreate.data.category.name === catName, 'Crear categoría')
  const catId = catCreate.data.category.id

  const catPatch = await req('PATCH', `/api/categories/${catId}`, { name: `${catName} y Snacks` })
  assert(catPatch.status === 200 && catPatch.data.category.name.includes('Snacks'), 'Editar categoría')

  const catList = await req('GET', '/api/categories')
  assert(catList.status === 200 && catList.data.categories?.length >= 1, 'Listar categorías')

  // Test Proveedores y Compras
  const suppName = `Distribuidora Central ${Date.now()}`
  const suppCreate = await req('POST', '/api/suppliers', {
    name: suppName,
    contactName: 'Carlos',
    phone: '5491133445566',
    email: 'ventas@central.com',
  })
  assert(suppCreate.status === 200 && suppCreate.data.supplier.name === suppName, 'Crear proveedor')
  const suppId = suppCreate.data.supplier.id

  const suppList = await req('GET', `/api/suppliers?q=${encodeURIComponent(suppName.slice(0, 15))}`)
  assert(suppList.status === 200 && suppList.data.suppliers?.length >= 1, 'Buscar proveedor')

  // Registrar compra con pago de caja ($2000)
  const prevCocaStock = cocaStock
  const purchase = await req('POST', '/api/suppliers/purchases', {
    supplierId: suppId,
    invoiceNumber: 'FAC-001',
    paidWithCash: true,
    items: [{ productId: coca.id, quantity: 10, unitCost: 950 }],
  })
  assert(purchase.status === 200 && purchase.data.purchaseOrder.total === 9500, 'Registrar compra a proveedor ($9500)')

  const cocaAfterPurchase = (await req('GET', `/api/products/search?q=${coca.barcode}`)).data.products[0]
  assert(cocaAfterPurchase.stock === prevCocaStock + 10, 'Stock de Coca incrementado tras compra')
  assert(cocaAfterPurchase.costPrice === 950, 'Costo de Coca actualizado a $950')

  // Test Consulta de Venta para Ticket Térmico
  const saleDetail = await req('GET', `/api/sales/${sale1.data.sale.id}`)
  assert(
    saleDetail.status === 200 &&
      saleDetail.data.sale.items?.length === 1 &&
      saleDetail.data.sale.payments?.length === 2,
    'Consultar venta con items y pagos para Ticket Térmico',
  )

  // Eliminar categoría de prueba
  const catDelete = await req('DELETE', `/api/categories/${catId}`)
  assert(catDelete.status === 200 && catDelete.data.success, 'Eliminar categoría de prueba')

  // Test Gestión de Usuarios (RBAC)
  const usersList = await req('GET', '/api/users')
  assert(usersList.status === 200 && usersList.data.users?.length >= 2, 'Listar usuarios como ADMIN')

  const testUsername = `cajero_${Date.now()}`
  const userCreate = await req('POST', '/api/users', {
    username: testUsername,
    fullName: 'Cajero de Prueba',
    role: 'CASHIER',
    pin: '4321',
  })
  assert(userCreate.status === 200 && userCreate.data.user.username === testUsername, 'Crear nuevo cajero')
  const newUserId = userCreate.data.user.id

  // Cambiar PIN de cajero
  const changeCreds = await req('PUT', `/api/users/${newUserId}/password-pin`, {
    pin: '9876',
  })
  assert(changeCreds.status === 200 && changeCreds.data.success, 'ADMIN resetea PIN de usuario')

  // Probar login del nuevo usuario con su nuevo PIN
  const testLogin = await req('POST', '/api/auth/login-pin', { username: testUsername, pin: '9876' }, false)
  assert(testLogin.status === 200 && testLogin.data.user.username === testUsername, 'Login exitoso del nuevo usuario con PIN actualizado')

  // Verificar que un cajero no puede acceder a endpoints de administración
  const cashierToken = testLogin.data.token
  const forbiddenRes = await fetch(BASE + '/api/users', {
    headers: { Authorization: `Bearer ${cashierToken}` },
  })
  assert(forbiddenRes.status === 403, 'Cajero bloqueado de endpoints ADMIN (403 Forbidden)')

  const closed = await req('POST', '/api/shifts/close', { actualCash: 0, notes: 'Cierre demo' })
  assert(closed.status === 200, 'POST /shifts/close (arqueo)')
  assert(closed.data.summary.salesCount >= 2, 'Resumen del cierre con ventas registradas')
  assert(closed.data.summary.byMethod.QR_TRANSFER?.amount >= 1150, 'Desglose por método de pago')

  const curAfter = await req('GET', '/api/shifts/current')
  assert(curAfter.data.shift === null, 'Turno cerrado correctamente')

  const today = await req('GET', '/api/reports/today')
  assert(today.status === 200 && today.data.salesTotal >= 3650, 'Reporte del día consistente')

  // Test Dashboard con Filtros
  const dashboardAll = await req('GET', '/api/reports/dashboard?mode=all')
  assert(
    dashboardAll.status === 200 &&
      dashboardAll.data.salesTotal >= 3650 &&
      dashboardAll.data.estimatedProfit >= 0,
    'Dashboard histórico consolidado con ganancia estimada',
  )

  const testShiftId = closed.data.shift.id
  const dashboardShift = await req('GET', `/api/reports/dashboard?shiftId=${testShiftId}`)
  assert(
    dashboardShift.status === 200 &&
      dashboardShift.data.shiftInfo?.id === testShiftId &&
      dashboardShift.data.salesCount >= 2,
    'Dashboard filtrado por ID de turno específico',
  )

  // Test Exportación CSV
  const csvRes = await fetch(`${BASE}/api/reports/export/csv`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const csvBuf = Buffer.from(await csvRes.arrayBuffer())
  const csvText = csvBuf.toString('utf-8')
  const hasBom = csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf
  assert(
    csvRes.status === 200 &&
      csvRes.headers.get('content-type')?.includes('text/csv') &&
      hasBom &&
      csvText.includes('=== VENTAS Y DETALLE DE ITEMS ==='),
    'Exportación CSV global con UTF-8 BOM y detalle de items',
  )

  const csvShiftRes = await fetch(`${BASE}/api/reports/export/csv?shiftId=${testShiftId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const csvShiftText = await csvShiftRes.text()
  assert(
    csvShiftRes.status === 200 &&
      csvShiftText.includes('=== INFORMACIÓN DEL TURNO ===') &&
      csvShiftText.includes(testShiftId),
    'Exportación CSV de turno específico para arqueo',
  )

  console.log('')
  if (failures === 0) {
    console.log('Todos los tests pasaron exitosamente.')
  } else {
    console.error(`${failures} test(s) fallaron.`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
