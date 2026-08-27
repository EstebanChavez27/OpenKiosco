# OpenKiosco

POS **open source**, moderno, liviano y ultra-rápido diseñado específicamente para kioscos, minimarkets, almacenes y comercios de barrio. Optimizado para operar a máxima velocidad con teclado y lector de códigos de barras, con turnos de caja con **arqueo a ciegas**, libreta de fiados (cuentas corrientes), módulo de proveedores y compras, emisión de tickets térmicos y exportación de reportes a Excel/CSV.

> [!IMPORTANT]
> ### 🔑 Credenciales de Acceso Inicial por Defecto (Auto-Seeding)
> Al abrir OpenKiosco por primera vez en cualquier plataforma (instalador de Windows, Linux, Docker o desarrollo local), el sistema crea automáticamente el usuario administrador inicial:
> - **Usuario:** `admin`
> - **PIN de acceso rápido:** `1234`
> - **Contraseña de administrador:** `1234`
>
> ⚠️ **Aviso de Seguridad:** Al ingresar por primera vez, dirigite a la sección superior **"Usuarios"** para actualizar tu PIN y contraseña por una clave segura, y para dar de alta las cuentas de tus cajeros.

---

## 🚀 Tecnologías y Arquitectura

- **Backend:** Node.js 20+ · Fastify 5 · Prisma ORM · SQLite en modo WAL (local) / PostgreSQL (self-hosted).
- **Frontend:** React 18 · Vite · Tailwind CSS v4 · Zustand · TanStack Query · Lucide Icons · Sonner.
- **Desktop Nativo:** Tauri v2 (Rust) para empaquetado portable multiplataforma en Windows (`.exe` NSIS / `.msi`) y Linux (`.deb` / `.AppImage`).
- **Monorepo Workspace:** npm workspaces (`apps/api`, `apps/web`, `src-tauri`).

```
openkiosco/
├── apps/
│   ├── api/            # Backend REST Fastify + Prisma ORM
│   │   ├── prisma/     # schema.prisma, migraciones y seed demo
│   │   └── src/        # Módulos: auth, shifts, products, categories, customers, suppliers, sales, reports, users
│   ├── web/            # SPA React 18 + Vite + Tailwind CSS
│   │   └── src/        # Componentes POS, inventario, proveedores, reportes, fiados, layout
├── src-tauri/          # Wrapper de escritorio nativo Tauri v2 en Rust
├── scripts/            # Scripts de empaquetado, verificación y lanzadores locales
├── iniciar_openkiosco.bat # Lanzador de 1 clic para Windows
├── iniciar_openkiosco.sh  # Lanzador de 1 clic para Linux
└── package.json
```

---

## ✨ Funcionalidades y Módulos

### 1. 🛒 Punto de Venta (POS) de Alta Velocidad
- **Operación 100% por Teclado y Código de Barras:** Atajos globales para cobrar, buscar artículos o registrar movimientos sin tocar el mouse.
- **Prefijos Multiplicadores y Productos Pesables:** Soporte para venta por bulto/múltiplos (ej: `3*7790001000011` o `3*coca`) y productos fraccionados por kilogramo (ej: `0.5*pan`).
- **Búsqueda Inteligente:** Coincidencia exacta por código de barras y búsqueda difusa (fuzzy search) instantánea por nombre de producto.
- **Pagos Mixtos y Divididos:** Combinación flexible de múltiples medios de pago en una sola venta:
  - Efectivo (con cálculo automático de vuelto).
  - Tarjeta de Débito.
  - Tarjeta de Crédito.
  - Transferencia / QR (Mercado Pago, MODO, etc.).
  - Fiado / Cuenta Corriente de Cliente.
- **Gestión Reactiva del Carrito:** Botón "Vaciar Carrito", limpieza automática post-venta y devolución instantánea del foco al buscador.

### 2. 🏷️ Gestión de Categorías
- **CRUD Completo:** Creación, edición y administración de categorías de productos.
- **Identificación Visual:** Selector de paleta de colores distintivos.
- **Filtros Rápidos:** Píldoras de filtrado interactivo por categoría en la pantalla de ventas (POS) y en el catálogo de inventario.
- **Eliminación Segura:** Opción de reasignar o desvincular productos a "Sin categoría" al eliminar una categoría existente.

### 3. 🚚 Módulo de Proveedores y Compras
- **Directorio de Proveedores:** Registro de contactos, teléfono, correo, CUIT/RUT, dirección y notas.
- **Acceso Directo a WhatsApp:** Botón para iniciar chat directo con el proveedor (`wa.me`) con un solo clic.
- **Recepción de Mercadería:** Registro de órdenes de compra con actualización automática de existencias (`stock`) y recálculo del precio de costo (`costPrice`).
- **Integración con Caja Chica:** Opción para pagar la compra con dinero físico del turno activo, generando automáticamente el egreso correspondiente (`CASH_OUT`).

### 4. 📖 Libreta de Clientes y Fiados (Cuentas Corrientes)
- **Límite de Crédito:** Asignación de tope máximo de fiado por cliente para evitar sobreendeudamiento.
- **Creación Rápida Inline:** Botón `+ Nuevo Cliente` directamente desde el modal de cobro fiado para registrar clientes sin perder la venta en curso.
- **Estado de Cuenta Transaccional:** Registro detallado de cargos (ventas a cuenta) y pagos/abonos parciales o totales.
- **Resumen por WhatsApp:** Envío de estado de deuda y detalle de cuenta corriente al WhatsApp del cliente.

### 5. 🔒 Turnos de Caja y Arqueo a Ciegas (Anti-Fraude)
- **Apertura de Turno:** Registro de fondo de caja inicial.
- **Movimientos de Caja Chica:** Registro de ingresos y extracciones manuales (pago de fletes, gastos menores, retiro de ganancias) con motivo obligatorio.
- **Arqueo a Ciegas:** Al cerrar el turno, el cajero cuenta y declara el efectivo físico sin conocer el total calculado por el sistema. Una vez confirmado, se revelan el monto esperado, el monto contado y la diferencia exacta (sobrante/faltante).
- **Exportación Directa del Turno:** Botón `📥 Exportar CSV` en el mismo modal de cierre para descargar el balance del turno antes o después de confirmar.

### 6. 🧾 Emisión de Tickets Térmicos (58mm / 80mm / PDF)
- **Formato ESC/POS Monoespaciado:** Diseñado específicamente para impresoras térmicas de tickets y comandas.
- **Selector de Ancho:** Configuración rápida para rollos de 58 mm o 80 mm.
- **Leyenda No Fiscal:** Encabezados y totales claros para control interno.
- **Impresión y Guardado:** Impresión directa mediante `@media print` del navegador o descarga en formato PDF desde la pantalla de cobro o desde el historial de ventas.

### 7. 📊 Dashboard de Reportes y Métricas Reactivas
- **Filtro Temporal y por Turno:** Selector superior con opciones:
  - `Ventas de Hoy` (Vista por defecto).
  - `Histórico Global Consolidado` (Todas las ventas acumuladas).
  - `Rango de Fechas Personalizado` (Filtro interactivo `Desde` y `Hasta`).
  - `Lista de Turnos Recientes` (Desglose por turno con cajero, fecha y estado).
- **Métricas Clave en Tiempo Real:**
  - Ventas Totales y Cantidad de Tickets.
  - **Ganancia Estimada** (Ventas menos Costo de Mercadería).
  - Ticket Promedio.
  - Total acumulado en Fiados.
  - Balance de Caja Chica (Total Ingresos vs. Total Egresos).
  - Desglose por Medio de Pago con gráficos comparativos.
  - Alertas de Stock Crítico (artículos por debajo del mínimo).
- **Historial de Ventas:** Tabla completa con reimpresión de tickets y detalles de cobro.

### 8. 📥 Módulo de Exportación a CSV (Excel / Sheets)
- **Exportación Granular:** Modal con checkboxes para seleccionar qué entidades exportar:
  - [x] Ventas y detalle de artículos cobrados.
  - [x] Compras y recepción a proveedores.
  - [x] Movimientos y ajustes de stock.
  - [x] Entradas y salidas de caja chica (Cash in / out).
  - [x] Resumen de turnos y arqueos (Sobrante/Faltante).
- **Compatibilidad Total:** Archivos codificados en **UTF-8 con BOM (`\uFEFF`)** y escape estándar para apertura nativa y sin caracteres corruptos en Microsoft Excel, Google Sheets y LibreOffice Calc.
- **Alcance Flexible:** Descarga por turno activo, por rango de fechas o de todo el historial.

### 9. 🛡️ Administración de Usuarios y Seguridad (RBAC)
- **Control de Acceso Basado en Roles:**
  - `ADMIN`: Control total, gestión de personal, reportes y configuración.
  - `CASHIER`: Ventas, cobros, fiados y arqueos de caja.
- **Acceso Rápido por PIN:** Autenticación ágil mediante PIN numérico de 4 a 6 dígitos ideal para pantallas táctiles y teclados numéricos.
- **Panel de Administración de Personal:** Alta de usuarios, cambio de roles, activación/desactivación y reseteo de PIN/contraseña protegido para administradores.

---

## ⌨️ Atajos de Teclado del POS

| Tecla | Acción |
|---|---|
| `F2` | Enfocar buscador de productos / código de barras |
| `F4` | Abrir movimientos manuales de caja chica (Ingreso / Egreso) |
| `F9` / `Espacio` | Abrir modal de cobro / checkout |
| `ESC` | Vaciar carrito actual / Cerrar modales |
| `Enter` | Agregar producto buscado / Confirmar cobro |
| `3*coca` | Multiplicador de cantidad de producto |
| `0.5*pan` | Cantidad fraccionada / pesable por kilogramo |

---

## 📦 Puesta en Marcha en Desarrollo

**Requisitos:** Node.js ≥ 20 y npm.

```bash
# 1. Clonar el repositorio
git clone https://github.com/EstebanChavez27/OpenKiosco.git
cd OpenKiosco

# 2. Instalar dependencias del monorepo
npm install

# 3. Aplicar migraciones y datos de prueba
npm run db:migrate
npm run db:seed

# 4. Iniciar frontend y backend en paralelo
npm run dev
```

> **Frontend:** `http://localhost:5173` | **API:** `http://localhost:3000/api`

### Usuarios Demo / Iniciales:

| Usuario | Rol | PIN | Contraseña (Admin) |
|---|---|---|---|
| `admin` | `ADMIN` | `1234` | `1234` |
| `caja1` | `CASHIER` | `1111` | — |

---

## 🖥️ Lanzadores Locales de 1 Clic (Sin compilar Rust)

OpenKiosco incluye scripts ejecutables para iniciar la aplicación localmente sin necesidad de instalar Rust:

- **En Windows:** Doble clic sobre **`iniciar_openkiosco.bat`** (o ejecutar `scripts\run-openkiosco.ps1`).
- **En Linux:** Dar permisos y ejecutar **`iniciar_openkiosco.sh`**:
  ```bash
  chmod +x iniciar_openkiosco.sh
  ./iniciar_openkiosco.sh
  ```
  *(Opcional: copiar `openkiosco.desktop` a `~/.local/share/applications/` para iniciar desde el menú de aplicaciones).*

---

## 🛠️ Compilación Nativa de Escritorio (Tauri v2)

Genera paquetes instalables nativos que incluyen el backend y un Node.js portable embebido (sin terminales visibles para el usuario).

### Requisitos:
- **Rust y Cargo:** Instalar mediante [rustup.rs](https://rustup.rs).
- **Dependencias en Linux (Debian / Ubuntu):**
  ```bash
  sudo apt update
  sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev libgtk-3-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev libfuse2 squashfs-tools build-essential curl wget file
  ```
- **Dependencias en Windows:** [WiX Toolset v3.14+](https://wixtoolset.org/) (`choco install wixtoolset -y`).

### Comando de Compilación:
```bash
npm run desktop:build
```

### Paquetes Generados:
- **Windows:**
  - Instalador NSIS: `src-tauri/target/release/bundle/nsis/OpenKiosco_0.3.1_x64-setup.exe`
- **Linux:**
  - Paquete Debian/Ubuntu: `src-tauri/target/release/bundle/deb/openkiosco_0.3.1_amd64.deb`
  - Paquete portable AppImage: `src-tauri/target/release/bundle/appimage/openkiosco_0.3.1_amd64.AppImage`

---

## 🌐 Publicación y Releases Automáticas (GitHub Actions)

El repositorio cuenta con integración continua (`.github/workflows/release.yml`) para compilar releases en la nube automáticamente:

```bash
git tag v0.3.1
git push origin v0.3.1
```

GitHub Actions compilará en paralelo los binarios para Windows y Linux y los adjuntará automáticamente a la sección **Releases** de tu repositorio.

---

## 📜 Comandos Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia backend Fastify y frontend Vite en paralelo con HMR |
| `npm run build` | Compila TypeScript y genera el build de producción web y API |
| `npm run smoke` | Ejecuta la suite de pruebas de integración automatizadas (E2E) |
| `npm run db:migrate` | Ejecuta y sincroniza las migraciones de Prisma |
| `npm run db:seed` | Carga el catálogo, categorías, clientes y usuarios demo |
| `npm run desktop:prepare` | Empaqueta frontend/backend y verifica el runtime portable |
| `npm run desktop:build` | Genera los instaladores nativos de escritorio con Tauri |

---

## 🤝 Cómo Contribuir (Contributing & PRs)

¡Las contribuciones de la comunidad son súper bienvenidas! Si encontrás un error, querés sugerir una nueva funcionalidad o mejorar el código existente:

1. **Hacé un Fork** del repositorio en GitHub.
2. **Creá una rama descriptiva** para tu mejora o corrección:
   ```bash
   git checkout -b feature/nueva-mejora
   # o para correcciones:
   git checkout -b fix/correccion-ticket
   ```
3. **Realizá tus commits** con mensajes claros y descriptivos.
4. **Verificá los tests y build**:
   ```bash
   npm run build
   npm run smoke
   ```
5. **Enviá un Pull Request (PR)** hacia la rama `main` explicando los cambios introducidos y el problema que resuelve.

---

## 🤖 Origen del Proyecto y Metodología de Desarrollo

> *"Este proyecto nació bajo el enfoque de **vibecoding**, desarrollado en su mayor parte mediante iteraciones de IA utilizando modelos como **Gemini 3.7 Flash**, **GLM 5.3** y **DeepSeek V4 Flash**, complementado con refactorización, arquitectura y ajustes manuales para garantizar rendimiento, estabilidad local y seguridad."*

---

## 📄 Licencia

Este proyecto es software libre distribuido bajo los términos de la **GNU Affero General Public License v3.0 (GNU AGPLv3)**.

Esto garantiza que **OpenKiosco** sea 100% libre y de código abierto para siempre. Cualquier modificación, mejora o software derivado (incluso si se ejecuta como servicio en red o en la nube) debe mantenerse bajo esta misma licencia, con su código fuente disponible públicamente para toda la comunidad.

Consultá el archivo [LICENSE](LICENSE) para ver los términos completos.