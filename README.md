# OpenKiosco

POS **open source**, liviano y ultra-rápido para kioscos, almacenes y comercios de barrio. Optimizado para operar con teclado y lector de códigos de barras, con turnos de caja, **arqueo a ciegas**, fiados (libreta de clientes) e inventario.

---

## Stack

- **Backend:** Node.js 20+ · Fastify 5 · Prisma ORM · SQLite (WAL) en desarrollo / PostgreSQL en self-host.
- **Frontend:** React 18 + Vite + Tailwind CSS v4 + Zustand + TanStack Query + Lucide.
- **Desktop:** Tauri v2 (opcional) para empaquetar un `.exe` nativo.
- **Monorepo:** npm workspaces (`apps/api`, `apps/web`, `src-tauri`).

```
openkiosco/
├── apps/
│   ├── api/            # Backend Fastify + Prisma
│   │   └── prisma/     # schema.prisma, migraciones, seed
│   ├── web/            # SPA React + Tailwind
│   └── (web/dist)      # build de producción
├── src-tauri/          # escritorio nativo Tauri v2 (Opción A)
├── scripts/            # launcher, empaquetado y helpers (Opción B)
├── iniciar_openkiosco.bat
├── docker-compose.yml
└── package.json
```

---

## Empezar en desarrollo

**Requisitos:** Node.js ≥ 20 (y npm).

```bash
npm install
npm run dev              # API en :3000 + Web en :5173 (proxy /api)
```

Preparar la base de datos (solo la primera vez):

```bash
npm run db:migrate      # aplica migraciones
npm run db:seed         # usuario demo + productos + clientes
```

**Usuarios demo:**

| Usuario | Rol    | PIN   | Contraseña (admin) |
|---------|--------|-------|--------------------|
| `admin` | ADMIN  | `1234`| `admin123`         |
| `caja1` | CAJA   | `1111`| —                  |

Tests end-to-end del API:

```bash
npm run smoke
```

> El frontend corre en `http://localhost:5173`. El API escucha en `http://localhost:3000/api`.

---

## Opción A · Desktop nativo con Tauri v2 (Recomendado Multiplataforma)

Empaqueta el frontend y el backend en instaladores nativos para **Windows** (`.exe` NSIS, `.msi` WiX) y **Linux** (`.deb`, `.AppImage`), sin necesidad de abrir terminales para el usuario final. El backend Fastify + Prisma se incluye embebido junto a un **Node.js portable** y se administra automáticamente al abrir y cerrar la aplicación.

### Cómo funciona

1. `scripts/build-desktop.mjs` prepara los recursos:
   - Compila el frontend (`apps/web` → `dist`).
   - Empaqueta el backend a un único bundle CJS con **esbuild**.
   - Copia `schema.prisma` + migraciones y arma dependencias de producción.
   - Incrusta el runtime de Node portable (`node.exe` en Windows / `node` en Linux).
2. Tauri compila la aplicación nativa en Rust:
   - Inicia el servidor backend en el puerto `4820` en segundo plano.
   - Ejecuta las migraciones (`AUTO_MIGRATE=1`) automáticamente al primer inicio.
   - Almacena la base de datos de manera aislada (`%APPDATA%\OpenKiosco` en Windows / `~/.openkiosco` en Linux).
   - Finaliza el proceso hijo de manera limpia al cerrar la ventana.

### Compilación Manual

#### Requisitos Previos:
- **Node.js ≥ 20** y **npm**.
- **Rust / Cargo** (instalar mediante [rustup.rs](https://rustup.rs)).
- **En Linux (Debian / Ubuntu / Linux Mint / etc.):**
  ```bash
  sudo apt update
  sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev libgtk-3-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev build-essential curl wget file
  ```
- **En Linux (Fedora / RHEL):**
  ```bash
  sudo dnf install -y webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel openssl-devel gtk3-devel
  ```
- **En Linux (Arch Linux):**
  ```bash
  sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg openssl gtk3 base-devel
  ```

#### Comandos de Compilación:

```bash
# 1. Instalar dependencias del proyecto
npm install

# 2. Generar instaladores nativos según el sistema operativo actual
npm run desktop:build
```

#### Binarios generados:

- **En Windows:**
  - Instalador NSIS: `src-tauri/target/release/bundle/nsis/OpenKiosco_0.1.0_x64-setup.exe`
  - Paquete MSI: `src-tauri/target/release/bundle/msi/OpenKiosco_0.1.0_x64_es-AR.msi`
- **En Linux:**
  - Paquete Debian/Ubuntu: `src-tauri/target/release/bundle/deb/openkiosco_0.1.0_amd64.deb`
  - Paquete AppImage portable: `src-tauri/target/release/bundle/appimage/openkiosco_0.1.0_amd64.AppImage`

#### Instalación y uso en Linux:

```bash
# Instalar paquete .deb:
sudo apt install ./src-tauri/target/release/bundle/deb/openkiosco_0.1.0_amd64.deb

# O ejecutar directamente el .AppImage:
chmod +x src-tauri/target/release/bundle/appimage/openkiosco_0.1.0_amd64.AppImage
./src-tauri/target/release/bundle/appimage/openkiosco_0.1.0_amd64.AppImage
```

### Verificar el empaquetado sin compilar con Rust

```bash
npm run desktop:prepare
```

Prepara todos los recursos, arranca el backend empaquetado, valida `/health` y comprueba que se sirva la SPA y la API.

---

## Opción B · Lanzadores locales de 1 clic (Sin compilar con Rust)

Si no deseás instalar el compilador de Rust, podés usar los scripts lanzadores locales con un solo clic. Requieren tener instalado Node.js ≥ 20.

### En Windows:
Doble clic en **`iniciar_openkiosco.bat`** (o ejecutar `scripts\run-openkiosco.ps1`).

### En Linux:
1. Dar permisos de ejecución si es necesario:
   ```bash
   chmod +x iniciar_openkiosco.sh
   ```
2. Ejecutar con doble clic o desde la terminal:
   ```bash
   ./iniciar_openkiosco.sh
   ```

El lanzador:
- Comprueba que Node.js ≥ 20 esté disponible.
- Instala automáticamente `node_modules` la primera vez.
- Aplica migraciones y datos demo (seed) si no existen.
- Inicia la API y la interfaz web en segundo plano.
- Abre automáticamente el navegador en `http://localhost:5173`.
- Al presionar `Q` o cerrar la ventana, detiene todos los procesos limpiamente.

#### Acceso directo de escritorio en Linux (`openkiosco.desktop`):
Podés copiar el acceso directo a tus aplicaciones:
```bash
cp openkiosco.desktop ~/.local/share/applications/
```

---

## CI/CD · Releases Automáticas en GitHub

El repositorio incluye un workflow en `.github/workflows/release.yml` para compilar automáticamente en la nube:

1. Creá y subí un tag con formato semántico (por ejemplo `v0.1.0`):
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
2. GitHub Actions activará una matriz con runners de **Windows** y **Linux (Ubuntu)**.
3. El workflow compilará los paquetes y publicará automáticamente los archivos en la sección **Releases** de GitHub:
   - `OpenKiosco_0.1.0_x64-setup.exe` (Windows)
   - `OpenKiosco_0.1.0_x64.msi` (Windows)
   - `openkiosco_0.1.0_amd64.deb` (Linux Debian/Ubuntu)
   - `openkiosco_0.1.0_amd64.AppImage` (Linux Portable)

---

## Docker (self-hosted)

```bash
docker compose up --build
```

Expone `http://localhost:3000` sirviendo el frontend y el API juntos. La base de datos se persiste en el volumen `openkiosco-data`.

---

## Funcionalidades principales

- **Punto de Venta (POS) & Atajos:** `F2` buscar · `F4` caja · `F9`/`ESPACIO` cobrar · `ESC` vacía · `Enter` confirma · prefijos de cantidad (ej: `3*coca`).
- **Gestión de Categorías:** CRUD completo, asignación de colores distintivos, reasignación segura de productos al eliminar y filtros rápidos tipo píldora en POS y Stock.
- **Módulo de Proveedores & Compras:** Agenda de contactos, enlace directo a WhatsApp (`wa.me`), recepción de mercadería (actualización automática de `stock` y `costPrice`), y registro opcional de egreso de caja (`CASH_OUT`) en el turno activo.
- **Emisión de Tickets Térmicos (58mm / 80mm / PDF):** Comprobante no fiscal monoespaciado optimizado para impresoras térmicas ESC/POS e impresión limpia vía navegador (`window.print()` con CSS `@media print`) y guardado en PDF desde el cobro o historial.
- **Turnos & Arqueo a Ciegas:** Apertura con fondo inicial, movimientos manuales de caja y cierre con conteo ciego (el esperado se revela al finalizar).
- **Ventas & Pagos Mixtos:** Descuento de stock transaccional, pagos combinados (Efectivo, Tarjeta Débito/Crédito, QR/Transferencia y Fiado).
- **Libreta de Fiados:** Límite de crédito por cliente, balance en cuenta corriente, historial de movimientos y envío de resumen por WhatsApp.

### Atajos del POS

| Tecla | Acción |
|---|---|
| `F2` | Enfocar búsqueda de producto |
| `F4` | Movimientos manuales de caja (ingreso / egreso) |
| `F9` / `Espacio` | Abrir cobro / checkout |
| `ESC` | Vaciar carrito / cerrar modal |
| `Enter` | Confirmar producto o cobro |

---

## Scripts del proyecto

| Comando | Finalidad |
|---------|-----------|
| `npm run dev` | API + web en paralelo |
| `npm run build` | typecheck + build de ambos |
| `npm run smoke` | test end-to-end del API |
| `npm run db:migrate|deploy|seed` | ciclo de BD |
| `npm run desktop:icons` | regenera iconos Tauri |
| `npm run desktop:prepare` | prepara recursos y verifica backend empaquetado |
| `npm run desktop:build` | genera el `.exe` instalador (Tauri) |
| `npm run tauri` | alias del CLI de Tauri |

---

## Licencia

Open source. Consultá los términos del proyecto.