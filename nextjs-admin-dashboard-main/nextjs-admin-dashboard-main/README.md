# Premium Beverages ERP Dashboard

Production ERP dashboard for `Premium Beverages`, built with Next.js and TypeScript.

This system manages:
- clients and client labels
- inventory and production
- orders and invoices
- payments recovery and ledger
- branded client membership cards (QR-based access)
- professional invoice and receipt PDFs

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

Optional SSL flags (for hosted MySQL like Aiven):

```env
DB_SSL_MODE=REQUIRED
DB_SSL_REJECT_UNAUTHORIZED=false
DB_SSL_CA_PATH=/path/to/ca.pem
```

## Core Modules

- `Dashboard` - KPIs and charts
- `Clients` - profile management, label inventory, membership QR and card PDF
- `Inventory` - stock and raw material tracking
- `Production` - production records and usage
- `Orders` - sales orders management
- `Billing & Invoices` - computerized invoice generation + branded PDF
- `Payments & Recovery` - payment recording + branded receipt PDF
- `Ledger` - debit/credit and running balances
- `Expenses` - operational expense logs

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

## Notes

- Keep `.env.local` out of Git
- Rotate `JWT_SECRET` and DB credentials periodically
- Use HTTPS domain in production for secure client card sharing
