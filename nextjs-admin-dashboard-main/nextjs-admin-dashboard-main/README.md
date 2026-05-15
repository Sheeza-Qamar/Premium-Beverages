# Premium Beverages ERP

Internal operations dashboard for **Premium Beverages** — client relationships, stock, orders, payments, production, and finance in one place. Built with **Next.js 16**, **React 19**, and **TypeScript**.

---

## Overview

| Capability | Description |
|------------|-------------|
| **Clients** | Customer records, branded label lines, membership card with QR |
| **Inventory** | Bottle stock (by size and mix/pure), client label stock, other materials |
| **Orders & payments** | Line-item orders, invoice numbers, advances, balances, PDF invoices and receipts |
| **Production** | Production runs tied to orders; label usage deducted from client stock |
| **Ledger** | Debits (orders) and credits (payments) with running balance |
| **Expenses** | Operational spend and monthly summaries |
| **Dashboard** | KPIs, charts, and per-client order/payment snapshot |

Legacy routes `/dashboard/billing-invoices` and `/dashboard/payments-recovery` redirect to **Orders & payments**.

---

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS
- **Language:** TypeScript
- **Database:** MySQL (`mysql2/promise`)
- **Auth:** JWT session cookie (`erp_session`), enforced via `src/proxy.ts`

---

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **MySQL** 8.x (local, Aiven, or compatible host)
- **npm** (or compatible package manager)

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` in the project root and set your values:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=bottle_erp
DB_SSL=false
JWT_SECRET=use_a_long_random_secret_here
```

See [Environment variables](#environment-variables) for optional settings.

### 3. Initialize the database

Apply the schema and migrations for your environment:

- Base schema: `database/bottle_erp_full_schema.sql`
- Incremental changes: `database/migrations/*.sql`

Run these against your MySQL database before first use.

### 4. Create the first administrator

Start the app, then open `/auth/first-admin` once to register the initial admin account. Subsequent admins are managed under **Administrators** in the dashboard.

### 5. Run the application

**Development:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in at `/auth/sign-in`.

**Production build (local check):**

```bash
npm run build
npm start
```

**Lint:**

```bash
npm run lint
```

Uses ESLint flat config (`eslint.config.mjs`).

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | Yes | MySQL host |
| `DB_PORT` | Yes | MySQL port (default `3306`) |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `DB_NAME` | Yes | Database name |
| `DB_SSL` | Yes | `true` / `false` for TLS |
| `JWT_SECRET` | Yes | Strong random secret for sessions and client-card tokens |
| `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` | No | [Web3Forms](https://web3forms.com) key for the public landing contact form |
| `NEXT_PUBLIC_SUPPORT_DOC_PATH` | No | Path to handbook `.docx` under `public/` (e.g. `/handbook.docx`) |
| `DB_SSL_MODE` | No | e.g. `REQUIRED` (hosted MySQL) |
| `DB_SSL_REJECT_UNAUTHORIZED` | No | `false` when using self-signed or provider CA without local file |
| `DB_SSL_CA_PATH` | No | Filesystem path to CA certificate (recommended for Aiven) |

**Hosted MySQL (e.g. Aiven) — example:**

```env
DB_SSL=true
DB_SSL_MODE=REQUIRED
DB_SSL_CA_PATH=/path/to/ca.pem
```

**Support handbook:** Place a `.docx` in `public/` or set `NEXT_PUBLIC_SUPPORT_DOC_PATH`. The in-app viewer uses `GET /api/support-guideline`.

Never commit `.env.local` or production secrets to Git.

---

## Application modules

| Module | Purpose |
|--------|---------|
| **Dashboard** | Stock, production, sales, receivables; charts; client order history |
| **Administrators** | Admin user accounts |
| **Clients** | Customer master data; edit page for label lines and membership card |
| **Inventory** | Bottle stock (size + mix/pure), client label quantities, other materials |
| **Orders & payments** | Orders, advances, payments, search, outstanding balances, invoice and receipt PDFs |
| **Production** | Record production per client/order; bottle type and size from order lines; **label stock** deducted |
| **Ledger** | Client-wise or all-clients ledger (orders = debit, payments = credit) |
| **Expenses** | Expense entry and monthly reports |
| **Support & guideline** | In-app viewing of the operations handbook (`.docx`) |

List views support client-side search on major record tables.

---

## Finance and data consistency

1. Each **order** stores `total_amount`, `invoice_number`, `status`, and `payment_type`.
2. **Payments** are stored per `order_id`, including advance at order creation.
3. **Outstanding** = `total_amount − SUM(payments)` for that order (same rule in APIs and UI).
4. **Ledger** is derived from the same `orders` and `payments` tables; cancelled orders are excluded from ledger totals.
5. **Production** updates produced quantity on the order and deducts **client label** usage; it does not deduct bottle inventory rows.

---

## Security

- Dashboard and API routes (except auth and public client card) require a valid `erp_session` cookie.
- **Public client card:** `/client-card/[token]` — token is JWT-signed and validated on each API request.
- Use **HTTPS** in production, especially when sharing client QR links.
- Rotate `JWT_SECRET` and database credentials on a regular schedule.

---

## Deployment

### Vercel (recommended)

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Set **Root directory** to this app folder if the repo is monorepo-style.
4. Add all required environment variables (Production and Preview as needed).
5. Deploy.
6. Run database schema/migrations on the production MySQL instance.
7. Complete [Pre-deploy checklist](#pre-deploy-checklist) on the live URL.

### Other hosts

Any Node.js host that supports Next.js 16:

```bash
npm run build
npm start
```

`npm start` runs `scripts/ensure-next-prod.mjs` before serving the production server.

---

## Pre-deploy checklist

Run once per environment after the database is initialized:

- [ ] Sign in; create a **client** and optional **label lines** on the client edit page.
- [ ] **Inventory:** add bottle stock and/or label stock with quantities.
- [ ] **Orders & payments:** create an order with line items (bottle type, size); optional advance; verify invoice number and totals.
- [ ] Download **invoice PDF** from the orders list.
- [ ] **Record payment**; confirm outstanding balance; download **receipt PDF**.
- [ ] **Production:** record a run for that order; confirm produced quantity and label deduction.
- [ ] **Ledger:** debits, credits, and balance match expectations.
- [ ] **Dashboard:** KPIs and charts load without errors.
- [ ] **Support & guideline:** handbook `.docx` loads if shipped.

---

## Project layout (high level)

```
src/app/              # Pages and API routes (App Router)
src/components/       # Shared UI (layout, landing, etc.)
src/lib/              # DB, schemas, PDF helpers, utilities
database/             # SQL schema and migrations
public/               # Static assets and optional handbook .docx
```

---

## Maintenance

- Keep `.env.local` and secrets out of version control.
- Apply new files under `database/migrations/` when pulling updates.
- Back up MySQL before schema changes in production.

---

## License

Proprietary — **Premium Beverages**. Internal use unless otherwise agreed.
