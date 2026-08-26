# OpenKiosco: Project Brief & Design Specification

## 1. Product Vision
OpenKiosco is a high-efficiency, open-source Point of Sale (POS) and retail management system designed specifically for local convenience stores, bodegas, and neighborhood kiosks. It prioritizes speed, utility, and modern aesthetics to help small business owners manage fast-paced operations with the precision of larger retail chains.

## 2. Core Personas
- **The Cashier:** Needs a keyboard-optimized interface for rapid checkout, barcode scanning, and simple shift handovers.
- **The Store Owner:** Requires remote visibility into store performance, inventory levels, and outstanding customer debt via a mobile-friendly dashboard.

## 3. Key Workflows & Features

### A. High-Speed POS Terminal (Desktop)
- **Instant Search:** Autofocused search bar with barcode scanner support `[F2]`.
- **Product Grid:** Visual grid for top-selling items with stock level badges.
- **Fractional Sales:** Specialized support for weighed items (e.g., "$/kg").
- **Persistent Cart:** Side-anchored receipt view with quantity controls and bold total summary.
- **Flexible Payments:** Split payment support (Cash, Card, QR) and "Fiado" (On Account) customer billing.

### B. "Libreta de Fiados" (Customer Credit Tracker)
- **Debt Management:** Digital ledger for tracking trusted customers with outstanding balances.
- **Reminders:** Integrated WhatsApp action to share payment summaries directly with customers.
- **Payment Registration:** Rapid entry for partial or full debt payments.

### C. Inventory & Stock Control
- **Low Stock Alerts:** Visual indicators and sorting to prioritize reordering.
- **Bulk Updates:** Tools for percentage-based price adjustments across categories.
- **Profit Tracking:** Automated calculation of margins based on cost vs. sale price.

### D. Cashier Security & Shift Management
- **Blind Cash Count:** "Arqueo a ciegas" workflow where cashiers enter physical counts without seeing system totals to prevent theft.
- **Discrepancy Reporting:** Automated comparison of Expected vs. Actual cash with shift logs.

## 4. Visual Identity (Design System)
- **Style:** Minimalist, high-utility, dark-mode first.
- **Color Palette:**
  - Primary: Emerald Green (#10B981) for actions.
  - Accent: Electric Indigo for secondary branding.
  - Surface: Slate/Neutral dark backgrounds for high contrast and reduced eye strain.
- **Typography:** Geist (Sans-serif) for interface elements; Monospace for prices and numeric data.

## 5. Technical Specifications
- **Architecture:** PWA (Progressive Web App) for cross-platform utility (Desktop terminal + Mobile dashboard).
- **Interactions:** Heavy emphasis on keyboard shortcuts (`F1`-`F4`, `Space` for checkout) to minimize mouse usage.
- **Offline Capability:** Designed to operate during internet outages with "Last Sync" status tracking.
