# Premium Beverages ERP Dashboard

Production ERP dashboard for `Premium Beverages`, built with Next.js and TypeScript.

This system manages:

- Clients and client labels (plus branded membership card / QR)
- Inventory and production (material and label consumption)
- **Orders & payments** — create orders (invoice numbers), advance payments, record payments, outstanding balances, **invoice PDF** and **payment receipt PDF**
- Ledger (order totals as debit, payments as credit, running balance)
- Expenses and dashboard KPIs

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- MySQL (`mysql2/promise`)
- JWT-based auth

## Run Locally

```bash
npm install
npm run dev
```

For production build:

```bash
npm run build
npm start
```

`npm run lint` uses ESLint flat config (`eslint.config.mjs`).

## Environment Variables

Create `.env.local` in project root:

```env
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
DB_SSL=true
JWT_SECRET=your-strong-random-secret
```

Landing page contact form ([Web3Forms](https://web3forms.com)): add your access key so `#contact` submissions reach your inbox.

```env
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your-web3forms-access-key
```

On Vercel, add the same variable to the project’s Environment Variables (Production / Preview as needed). Web3Forms expects requests from the browser for the free tier; server-side proxying may require a paid plan with IP whitelisting per their docs.

Optional SSL flags (for hosted MySQL like Aiven):

```env
DB_SSL_MODE=REQUIRED
DB_SSL_REJECT_UNAUTHORIZED=false
DB_SSL_CA_PATH=/path/to/ca.pem
```

Optional: fixed path for the in-app **Support & guideline** Word viewer (otherwise the server auto-detects the first `.docx` under `public/`):

```env
NEXT_PUBLIC_SUPPORT_DOC_PATH=/your-handbook.docx
```

## Core modules (sidebar)

| Area | Role |
|------|------|
| **Dashboard** | Stock, production, sales, receivables; per-client order/payment snapshot |
| **Administrators** | Admin users |
| **Clients** | Customer master; detail page for labels and client card |
| **Inventory** | Raw materials and label-linked stock |
| **Orders & payments** | Create orders (line items, status, credit/cash), advance on create, search, outstanding list, **record payment** (linked to order), payment history, **invoice / receipt PDFs** |
| **Production** | Per client/order production; deducts inventory; optional quick payment for same order when balance due |
| **Ledger** | All clients or filter: debits = orders, credits = payments |
| **Expenses** | Operational expenses and summaries |
| **Support & guideline** | In-app `.docx` handbook from `public/` (see API `GET /api/support-guideline`) |

Legacy URLs `/dashboard/billing-invoices` and `/dashboard/payments-recovery` redirect to **Orders & payments**.

## How money and orders stay in sync

1. **Order** row stores `total_amount`, `invoice_number`, `status`, `payment_type`.
2. **Payments** rows store `amount_paid` per `order_id` (including advance at order creation).
3. **Outstanding** = `total_amount − SUM(payments for that order)` (APIs and UI use this consistently).
4. **Ledger** builds from the same `orders` and `payments` tables (cancelled orders excluded from ledger totals).

## Security / Access

- Admin dashboard routes require authenticated session (`erp_session` cookie)
- Public client-facing card route:
  - `/client-card/[token]`
- Token is signed via JWT and validated on every client-card API request

## Deployment (Vercel)

1. Push code to GitHub
2. Import repo in Vercel
3. Add environment variables from `.env.local`
4. Deploy

## Pre-deploy smoke test (manual)

After DB migrations/schema helpers have run at least once in that environment:

1. Sign in → **Clients**: create client → open detail → optional label.
2. **Inventory**: ensure bottle/cap (and label if used) have quantity.
3. **Orders & payments**: create order with line items; optional advance; confirm invoice number and totals.
4. Download **invoice PDF** from the orders list.
5. **Record payment** for part or full balance; confirm outstanding updates; download **receipt PDF** from history.
6. **Production**: record run for same client/order; confirm stock decreases and produced qty on order.
7. **Ledger**: entries and balance match expectations.
8. **Dashboard**: KPIs load without error.
9. **Support & guideline**: if you ship a handbook, add a `.docx` under `public/` (or set `NEXT_PUBLIC_SUPPORT_DOC_PATH`).

## Notes

- Keep `.env.local` out of Git
- Rotate `JWT_SECRET` and DB credentials periodically
- Use HTTPS in production for secure client card sharing
