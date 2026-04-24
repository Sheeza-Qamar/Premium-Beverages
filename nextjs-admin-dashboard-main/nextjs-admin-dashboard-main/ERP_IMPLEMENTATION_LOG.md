# Bottle ERP — implementation log

**Stack:** Next.js (App Router), MySQL (`mysql2` pool in `src/lib/db.ts`), JWT session auth (`src/lib/auth.ts`).

**Convention:** For each functional area we add:
- MySQL migration / `CREATE TABLE` (or append to `sql/` if present)
- `src/app/api/...` route handlers
- `src/app/...` pages and client components
- Sidebar entries in `src/components/Layouts/sidebar/data/index.ts` when needed

---

## Implemented

| Date | FR / feature | SQL / tables | API routes | UI |
|------|----------------|--------------|------------|-----|
| 2026-04-04 | **1.1 Inventory** — add materials (bottle/cap/label/plastic), update qty, view stock, pcs/kg, optional low-stock alerts | `bottle_erp_full_schema.sql` → `raw_materials`, `inventory` | `GET /api/inventory`, `POST /api/inventory/raw-materials`, `PATCH /api/inventory/raw-materials/[id]` | `/dashboard/inventory`, sidebar **Inventory** |
| 2026-04-04 | **1.2 Clients** — CRUD clients, contact fields, per-client label inventory (`client_labels`) | `clients`, `client_labels` | `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/[id]`, `POST /api/clients/[id]/labels`, `PATCH/DELETE .../labels/[labelId]` | `/dashboard/clients`, `/dashboard/clients/[id]` |
| 2026-04-06 | **Inventory bottle type update** — bottle items now require `mix` or `pure`; schema prepared for selling/production rows too | `raw_materials.bottle_type`, `production.bottle_type`, `order_items.bottle_type`, migration `2026_04_06_add_bottle_type_support.sql` | inventory endpoints accept/validate `bottleType` with `materialType` | `/dashboard/inventory` add/edit flow includes bottle type |
| 2026-04-06 | **Clients contact update** — added client email (with name, phone, address) in APIs and UI | `clients.email`, migration `2026_04_06_add_client_email.sql` | clients APIs now return/accept `email` with validation | `/dashboard/clients`, `/dashboard/clients/[id]` forms and list show email |
| 2026-04-06 | **1.3 Label inventory (client specific)** — production posting deducts labels per client with transactional checks and remaining stock visibility | `production`, `production_label_usage`, `client_labels` (schema guard for `production.bottle_type`) | `GET/POST /api/production` | `/dashboard/production`, sidebar **Production** |
| 2026-04-06 | **1.4 Production management** — records production, links client, auto-deducts bottles/caps (inventory) and labels (client labels), keeps history | `production_usage` + `production_label_usage` write path | `POST /api/production` transactional deduction, `GET /api/production` with material+label history | `/dashboard/production` material selection, deduction entry, history view |
| 2026-04-06 | **1.5 Order management (sales)** — create orders per client, support credit/cash, store order details with item lines | `orders`, `order_items` (schema guard for `orders.payment_type` / `order_items.bottle_type`) | `GET/POST /api/orders` | `/dashboard/orders`, sidebar **Orders** |

---

## Notes

- **Full DB schema:** `database/bottle_erp_full_schema.sql` — table **`admins`** (not `users`). First admin: **`/auth/first-admin`** when DB is empty, or `database/seed_initial_admin.sql`. More admins: **`/admins`**.
- Legacy `users` table: see `database/migrate_users_to_admins.sql` (manual steps).
- Env: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, **`DB_NAME=bottle_erp`**, `JWT_SECRET`.
