# Renting.ru — Rental Platform

Production-ready, API-first multi-category rental platform. Ships with car rentals out of the box; add Real Estate, Boats, or any other category via three admin API calls and zero code changes.

## Architecture

```
apps/
  api/        NestJS API — PostgreSQL + Prisma + Redis
  web/        Next.js customer website (SSR/ISR, App Router, i18n)
  admin/      Next.js admin panel
packages/
  shared/     Shared enums, types, error codes
docs/
  openapi.yaml              Full OpenAPI 3.0 spec (70+ endpoints)
  postman_collection.json   Postman collection with auto-token scripts
  adding-real-estate-category.md
```

## Quick Start

### Prerequisites

- Node.js 22+, pnpm 9+
- Docker (for Postgres, Redis, MinIO, Mailpit)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Docker services

```bash
docker-compose up -d
```

Services:
| Service | URL |
|---|---|
| PostgreSQL 16 | localhost:5432 |
| Redis 7 | localhost:6379 |
| MinIO (S3) | http://localhost:9000 (console: 9001) |
| Mailpit (SMTP) | http://localhost:8025 |

### 3. Run database migrations + seeds

```bash
pnpm --filter @renting/api migrate:deploy
pnpm --filter @renting/api seed
```

The seed creates:
- Roles: `super_admin`, `staff`, `driver`, `customer`
- Users: `admin@renting.ru` / `customer@renting.ru` (password: `Password1!`)
- Cars category with 10 attributes (brand, model, year, transmission, …)
- 6 demo car listings (Toyota Camry, BMW X5, Mercedes E-Class, …)
- 2 drivers (Sergey, Amina)
- Coupon `WELCOME10` (10% off, max $50)
- Summer price rule (+20%)
- Content pages (About, Privacy), FAQs

### 4. Start the API

```bash
pnpm --filter @renting/api dev
# API at http://localhost:4000
# Swagger at http://localhost:4000/docs
```

### 5. Start the customer website

```bash
pnpm --filter @renting/web dev
# Website at http://localhost:3000
```

### 6. Start the admin panel

```bash
pnpm --filter @renting/admin dev
# Admin at http://localhost:3100
# Login: admin@renting.ru / Password1!
```

### Build all

```bash
pnpm build
```

---

## Key Features

### Multi-Category Extensibility

Add a new rental category with zero code:

```bash
# 1. Create category
POST /api/v1/admin/categories
{ "slug": "real-estate", "name": { "en": "Real Estate", ... }, "isEnabled": false }

# 2. Add attributes (each defines a search filter widget)
POST /api/v1/admin/categories/:id/attributes
{ "key": "property_type", "dataType": "select", "filterWidget": "select", "options": [...] }

# 3. Enable it
PATCH /api/v1/admin/categories/:id/toggle
```

See [docs/adding-real-estate-category.md](docs/adding-real-estate-category.md) for a complete walkthrough.

### Standard Response Envelope

Every API response:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "pagination": { "page": 1, "perPage": 12, "total": 42, "totalPages": 4 } }
}
```

On error:
```json
{
  "success": false,
  "data": null,
  "error": { "code": "LISTING_UNAVAILABLE", "message": "This listing is already booked for the selected period." }
}
```

Error codes are stable machine-readable strings from `@renting/shared`'s `ErrorCode` enum.

### Booking State Machine

```
pending → confirmed → in_progress → completed
       ↘            ↘             ↘
        cancelled   cancelled      disputed
                                   no_show
                                   refunded
```

Transitions are guarded — invalid moves return `BOOKING_INVALID_TRANSITION`. Every transition is logged to `booking_status_events` and emitted as an outbound webhook.

### Double-Booking Prevention (DB-Level)

```sql
-- availability_blocks has this constraint:
EXCLUDE USING gist (listing_id WITH =, period WITH &&)
```

Two concurrent booking attempts for overlapping periods fail at the DB commit — no application-level race conditions possible.

### Single Pricing Authority

`PricingService.quote()` is called both for the public `/quote` preview endpoint **and** re-called server-side on `POST /bookings`. Clients cannot submit a tampered price.

### isEnabled Toggle

`RentalCategory.isEnabled` is the single on/off switch for an entire category. Toggling it:
1. Updates the DB row
2. Invalidates the Redis cache entry (TTL: 60s)
3. Category instantly disappears from / reappears in all public API responses

No deployment required.

---

## API Documentation

- **Swagger UI**: http://localhost:4000/docs (when API is running)
- **OpenAPI spec**: [docs/openapi.yaml](docs/openapi.yaml)
- **Postman collection**: [docs/postman_collection.json](docs/postman_collection.json)

### Authentication

```
Authorization: Bearer <jwt-access-token>
```

or for integrations:

```
X-Api-Key: <prefix>.<secret>
```

Access tokens expire in 15 minutes. Use `POST /auth/refresh` with the refresh token to rotate.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis URL |
| `JWT_ACCESS_SECRET` | dev-only default | Change in production |
| `JWT_REFRESH_SECRET` | dev-only default | Change in production |
| `ENCRYPTION_KEY` | dev-only 32-char default | AES-256 key for license numbers |
| `STRIPE_SECRET_KEY` | optional | Stripe integration |
| `S3_ENDPOINT` | optional | MinIO / AWS S3 |
| `SMTP_HOST` | optional | Mailpit in dev |

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | NestJS 10, TypeScript |
| ORM | Prisma 5, PostgreSQL 16 |
| Cache | Redis 7 (ioredis) |
| Storage | S3-compatible (MinIO in dev) |
| Customer site | Next.js 14 (App Router, SSR/ISR) |
| Admin panel | Next.js 14 |
| Styling | Tailwind CSS 3 |
| Charts | Recharts |
| Payments | Stripe (+ regional gateway stub) |
| Email | Nodemailer / SMTP |
| Auth | JWT (access + refresh rotation) |
| Monorepo | pnpm workspaces + Turborepo |

---

## Scripts

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace deps |
| `pnpm build` | Build all packages |
| `pnpm dev` | Dev all apps in parallel |
| `pnpm --filter @renting/api openapi:emit` | Emit `docs/openapi.yaml` from live decorators |
| `pnpm --filter @renting/api seed` | Run database seeds |
| `pnpm --filter @renting/api test` | Run e2e tests |

---

## Security

- Passwords: bcryptjs (cost 12)
- License numbers: AES-256-GCM at-rest encryption
- JWT: access (15m) + refresh (30d) with DB-level revocation
- API keys: prefix.secret, bcrypt-hashed in DB
- Webhook signatures: HMAC-SHA256 `X-Renting-Signature` header
- PSP webhooks: raw body preserved for signature verification
- Rate limiting: 100 req/min per IP (global), 5 req/min on auth endpoints
- RBAC: `customer`, `driver`, `staff`, `super_admin`
- OWASP: Helmet headers, input validation via class-validator, parameterized queries via Prisma

---

## Project Structure

```
apps/api/
  prisma/
    schema.prisma         30+ models
    migrations/           0001_init + 0002_db_guarantees
    seed.ts               Demo data
  src/
    common/               Guards, interceptors, filters, pagination
    config/               Zod-validated env
    modules/
      auth/               JWT, refresh, OTP, social
      categories/         Category engine with Redis cache
      listings/           Public search + detail
      drivers/            Driver availability
      pricing/            Single quote authority
      bookings/           State machine + availability blocks
      payments/           Gateway abstraction, Stripe, regional
      media/              S3 presigned uploads
      reviews/            Create + public listing
      favorites/          Saved listings
      notifications/      In-app + email + SMS
      webhooks/           Outbound delivery with retry
      admin/              All admin controllers
    swagger.ts            Swagger config
    openapi-emit.ts       CLI spec emitter
    main.ts               Bootstrap

apps/web/
  app/
    [locale]/             en, ru, ar — SSR/ISR pages
      page.tsx            Homepage
      [category]/         Category search (schema-driven filters)
      [category]/[slug]/  Listing detail + BookingWidget
      account/            User profile + booking history
      login/ register/    Auth forms
  components/
    CategoryBrowser.tsx   Schema-driven filter UI
    BookingWidget.tsx     Full booking flow with live quote
    Header Footer Gallery ListingCard

apps/admin/
  app/
    (auth)/login/         Admin login
    (dashboard)/          Sidebar layout
      page.tsx            KPI dashboard with Recharts
      bookings/           State machine transitions
      fleet/              Listing management
      categories/         Category builder + isEnabled toggle
      drivers/            Driver management
      customers/          License verification queue
      reviews/            Review moderation
      reports/            CSV export
      settings/           Platform config
```
