# AGENT.MD: OpenKiosco

## 1. Project Overview & Scope
**OpenKiosco** is an open-source, lightweight, ultra-fast Point of Sale (POS) and inventory management system designed for kiosks, convenience stores, and neighborhood retail businesses. It is optimized for standalone local execution on low-spec hardware (with or without internet access) while fully supporting self-hosted deployment (Docker) for remote mobile access and multi-device management.

### Key Goals:
- **Zero-Friction Counter Operation:** Fully operable via keyboard shortcuts and physical barcode scanners.
- **Traceability & Shift Auditing:** Mandatory cashier shifts with blind cash drawer reconciliation (*arqueo a ciegas*).
- **Fractional / Weighed Sales:** Native decimal quantity support for bulk, weighed, or fractional products.
- **Customer Ledger ("Libreta de Fiados"):** Debt and balance tracking with WhatsApp statement dispatch.
- **Multi-Method Payments:** Split payments per transaction (Cash, Debit, Credit, QR/Transfer, and Store Credit/Fiado).

---

## 2. Tech Stack & Infrastructure

- **Backend Runtime:** Node.js (v20+) or Bun with **Fastify** (TypeScript).
- **Database & ORM:** **Prisma ORM** / **Drizzle ORM** (default: SQLite with WAL mode for local zero-config instances; PostgreSQL for self-hosted instances).
- **Frontend SPA / PWA:** **React (Vite)** + **Tailwind CSS** + **Lucide React** + **Shadcn/UI**.
- **State Management & Data Fetching:** Zustand + TanStack Query (React Query).
- **Desktop Wrapper (Optional):** **Tauri v2** for native desktop packaging on local PCs.
- **Containerization:** Multi-stage `Dockerfile` and `docker-compose.yml`.

---

## 3. Database Schema (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "sqlite" // Change to "postgresql" for self-hosted environments
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ----------------------------------------------------
// USERS & AUTHENTICATION
// ----------------------------------------------------
enum Role {
  ADMIN
  CASHIER
}

model User {
  id             String          @id @default(uuid())
  username       String          @unique
  fullName       String
  pin            String          // Hashed 4-6 digit numeric PIN for counter fast-login
  role           Role            @default(CASHIER)
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  
  shifts         Shift[]
  sales          Sale[]
  cashMovements  CashMovement[]
  stockMovements StockMovement[]
}

// ----------------------------------------------------
// SHIFTS & CASH DRAWER AUDIT
// ----------------------------------------------------
enum ShiftStatus {
  OPEN
  CLOSED
}

model Shift {
  id             String          @id @default(uuid())
  userId         String
  user           User            @relation(fields: [userId], references: [id])
  
  openedAt       DateTime        @default(now())
  closedAt       DateTime?
  status         ShiftStatus     @default(OPEN)
  
  initialCash    Decimal         @default(0.0)
  expectedCash   Decimal?        // Calculated at close: initialCash + cashSales + cashIn - cashOut
  actualCash     Decimal?        // Blindly counted by cashier
  difference     Decimal?        // actualCash - expectedCash (Shortage/Overage)
  notes          String?

  sales          Sale[]
  cashMovements  CashMovement[]
}

enum CashMovementType {
  CASH_IN    // Cash drawer injection / float top-up
  CASH_OUT   // Vendor payment, owner withdrawal, petty expenses
}

model CashMovement {
  id          String           @id @default(uuid())
  shiftId     String
  shift       Shift            @relation(fields: [shiftId], references: [id])
  userId      String
  user        User             @relation(fields: [userId], references: [id])
  
  type        CashMovementType
  amount      Decimal
  reason      String
  createdAt   DateTime         @default(now())
}

// ----------------------------------------------------
// CATALOG & INVENTORY
// ----------------------------------------------------
model Category {
  id       String    @id @default(uuid())
  name     String    @unique
  products Product[]
}

model Product {
  id             String          @id @default(uuid())
  barcode        String?         @unique
  name           String
  description    String?
  categoryId     String?
  category       Category?       @relation(fields: [categoryId], references: [id])
  
  costPrice      Decimal         @default(0.0)
  salePrice      Decimal
  
  stock          Decimal         @default(0.0) // Decimal for fractional/kg values
  minStock       Decimal         @default(5.0)
  isWeighted     Boolean         @default(false)
  isActive       Boolean         @default(true)
  
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  saleItems      SaleItem[]
  stockMovements StockMovement[]
}

enum StockMovementType {
  PURCHASE
  SALE
  ADJUSTMENT
  WASTE
}

model StockMovement {
  id            String            @id @default(uuid())
  productId     String
  product       Product           @relation(fields: [productId], references: [id])
  userId        String
  user          User              @relation(fields: [userId], references: [id])
  
  type          StockMovementType
  quantity      Decimal
  previousStock Decimal
  newStock      Decimal
  reason        String?
  createdAt     DateTime          @default(now())
}

// ----------------------------------------------------
// CUSTOMERS & STORE CREDIT ("FIADOS")
// ----------------------------------------------------
model Customer {
  id          String                @id @default(uuid())
  name        String
  phone       String?
  creditLimit Decimal               @default(0.0) // 0 = No credit limit
  balance     Decimal               @default(0.0) // Outstanding debt
  createdAt   DateTime              @default(now())

  sales       Sale[]
  ledger      CustomerLedgerEntry[]
}

enum LedgerEntryType {
  CHARGE  // Purchase on credit (+ balance)
  PAYMENT // Debt payment received (- balance)
}

model CustomerLedgerEntry {
  id          String          @id @default(uuid())
  customerId  String
  customer    Customer        @relation(fields: [customerId], references: [id])
  saleId      String?
  sale        Sale?           @relation(fields: [saleId], references: [id])
  
  type        LedgerEntryType
  amount      Decimal
  description String
  createdAt   DateTime        @default(now())
}

// ----------------------------------------------------
// SALES & PAYMENTS
// ----------------------------------------------------
enum PaymentMethod {
  CASH
  CARD_DEBIT
  CARD_CREDIT
  QR_TRANSFER
  ON_ACCOUNT // Fiado / Store Credit
}

model Sale {
  id          String                @id @default(uuid())
  shiftId     String
  shift       Shift                 @relation(fields: [shiftId], references: [id])
  userId      String
  user        User                  @relation(fields: [userId], references: [id])
  customerId  String?
  customer    Customer?             @relation(fields: [customerId], references: [id])
  
  subtotal    Decimal
  discount    Decimal               @default(0.0)
  total       Decimal
  
  createdAt   DateTime              @default(now())
  
  items       SaleItem[]
  payments    SalePayment[]
  ledgerEntry CustomerLedgerEntry[]
}

model SaleItem {
  id        String   @id @default(uuid())
  saleId    String
  sale      Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  
  quantity  Decimal
  unitPrice Decimal
  costPrice Decimal
  subtotal  Decimal
}

model SalePayment {
  id          String        @id @default(uuid())
  saleId      String
  sale        Sale          @relation(fields: [saleId], references: [id], onDelete: Cascade)
  
  method      PaymentMethod
  amount      Decimal
}

---

## 4. API Endpoints & Business Logic
Authentication & Fast Login
POST /api/auth/login-pin: Accepts { username, pin }. Returns JWT token with role claims.

POST /api/auth/login-admin: Standard administrative password login.

Shifts & Cash Management
POST /api/shifts/open: Validates no active open shift exists for the terminal/user. Accepts { initialCash }.

POST /api/shifts/cash-movement: Records manual cash in/out (CASH_IN / CASH_OUT) associated with active shiftId.

POST /api/shifts/close: Blind count. Accepts { actualCash, notes }. Calculates expectedCash, records difference, and sets status to CLOSED.

GET /api/shifts/current: Returns the active shift metadata.

POS & Sales Execution
GET /api/products/search?q=: Query by exact barcode or fuzzy product name.

POST /api/sales:

Runs in a single atomic database transaction.

Decrements inventory levels and logs StockMovement for each item.

Validates customer credit limit if any payment method is ON_ACCOUNT.

Updates customer balance and creates CustomerLedgerEntry if ON_ACCOUNT is used.

Creates Sale, SaleItem, and SalePayment records attached to the active shiftId.

Customers & Fiados
GET /api/customers/:id/statement: Returns ledger history and calculates totals.

POST /api/customers/:id/payments: Registers debt settlement, decreases customer balance, and creates an audit ledger entry.

---

## 5. Monorepo Project Structure

openkiosco/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── shifts/
│   │   │   │   ├── sales/
│   │   │   │   ├── products/
│   │   │   │   ├── customers/
│   │   │   │   └── reports/
│   │   │   ├── plugins/
│   │   │   ├── utils/
│   │   │   └── server.ts
│   │   └── tsconfig.json
│   │
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   │   ├── pos/
│       │   │   ├── shifts/
│       │   │   ├── customers/
│       │   │   ├── inventory/
│       │   │   └── ui/
│       │   ├── hooks/
│       │   │   ├── useBarcodeScanner.ts
│       │   │   └── useKeyboardShortcuts.ts
│       │   ├── stores/
│       │   │   ├── useCartStore.ts
│       │   │   └── useShiftStore.ts
│       │   ├── pages/
│       │   └── App.tsx
│       └── vite.config.ts
└── src-tauri/
    ├── Cargo.toml
    └── tauri.conf.json

---

## 6. Implementation Guidelines for AI Agents
Strict Type Safety: Share DTOs/types between API and Web interfaces using TypeScript interfaces or Zod schemas.

Transaction Integrity: All inventory deductions, ledger balance updates, and sales records MUST execute inside a database transaction (prisma.$transaction).

Optimized Counter UX: All primary actions in the POS screen must be accessible via keyboard shortcuts:

F2: Focus product search / barcode input.

F4: Open Cash Drawer / Manual Movement modal.

F9 or Space: Open Checkout / Payment modal.

Esc: Clear cart / Close modals.

Resilience: Handle potential offline or intermittent network states gracefully in the frontend layer with clear visual indicators.