# Renting.ru — API Reference

**Base URL:** `http://localhost:4000/api/v1`  
**Interactive docs:** `http://localhost:4000/docs` (Swagger UI, when API is running)  
**OpenAPI spec:** `docs/openapi.yaml`  
**Postman collection:** `docs/postman_collection.json`

---

## Response Envelope

Every response — success or error — uses this wrapper:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "pagination": { "page": 1, "perPage": 12, "total": 42, "totalPages": 4 }
  }
}
```

On error:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LISTING_UNAVAILABLE",
    "message": "This listing is already booked for the selected period."
  }
}
```

`error.code` is always a stable machine-readable string — safe to use in client `switch` statements.

---

## Authentication

### JWT (customers, staff, admin)
```
Authorization: Bearer <access_token>
```
Access tokens expire in **15 minutes**. Use `POST /auth/refresh` to rotate.

### API Key (integrations)
```
X-Api-Key: <prefix>.<secret>
```
Create keys from the admin panel → Settings.

---

## Error Codes

| Code | Meaning |
|---|---|
| `INVALID_CREDENTIALS` | Wrong email or password |
| `TOKEN_EXPIRED` | JWT expired — refresh it |
| `TOKEN_INVALID` | Bad or tampered token |
| `UNAUTHORIZED` | Endpoint requires login |
| `FORBIDDEN` | Logged in but wrong role |
| `NOT_FOUND` | Resource not found |
| `CATEGORY_NOT_FOUND` | Category slug doesn't exist |
| `CATEGORY_DISABLED` | Category exists but is turned off |
| `LISTING_NOT_FOUND` | Listing not found |
| `LISTING_UNAVAILABLE` | Listing already booked for that period |
| `LISTING_INACTIVE` | Listing is not active |
| `DRIVER_UNAVAILABLE` | Driver not available for that period |
| `COUPON_INVALID` | Coupon code doesn't exist |
| `COUPON_EXPIRED` | Coupon past its valid date |
| `COUPON_LIMIT_REACHED` | Coupon usage limit hit |
| `LICENSE_REQUIRED` | Booking type requires a verified license |
| `LICENSE_PENDING` | License submitted but not yet approved |
| `BOOKING_INVALID_TRANSITION` | State machine transition not allowed |
| `ATTRIBUTE_INVALID` | JSONB attribute fails category schema validation |
| `EMAIL_TAKEN` | Registration email already in use |
| `VALIDATION_ERROR` | Request body failed validation |
| `RATE_LIMITED` | Too many requests |

---

## Auth

### `POST /auth/register`
Create a new customer account.

**Body**
```json
{
  "name": "Sara Ahmed",
  "email": "sara@example.com",
  "password": "Password1!",
  "phone": "+971501234567"
}
```

**Response `201`**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "...", "name": "Sara Ahmed", "email": "sara@example.com", "roles": ["customer"] }
}
```

---

### `POST /auth/login`
```json
{ "email": "admin@renting.ru", "password": "Password1!" }
```
Returns same shape as register. The `roles` array tells you the user's role(s).

---

### `POST /auth/refresh`
```json
{ "refreshToken": "eyJ..." }
```
Returns new `{ accessToken, refreshToken }`. Old refresh token is revoked.

---

### `POST /auth/logout`
```json
{ "refreshToken": "eyJ..." }
```
Revokes the refresh token.

---

### `GET /auth/me`
Returns the current user's profile and roles. Requires `Authorization` header.

---

### `POST /auth/otp/send`
```json
{ "target": "sara@example.com", "channel": "email" }
```
Sends a 6-digit OTP. `channel` is `"email"` or `"sms"`.

---

### `POST /auth/otp/verify`
```json
{ "target": "sara@example.com", "code": "482910" }
```

---

## Categories

### `GET /categories`
Lists all **enabled** categories. Each category includes its attribute schema and pricing units.

```json
[
  {
    "id": "...",
    "slug": "cars",
    "name": { "en": "Cars", "ru": "Автомобили", "ar": "سيارات" },
    "isEnabled": true,
    "attributes": [
      {
        "key": "transmission",
        "label": { "en": "Transmission" },
        "dataType": "select",
        "filterWidget": "select",
        "options": ["automatic", "manual"]
      }
    ],
    "pricingUnits": [
      { "unit": "day", "isDefault": true },
      { "unit": "hour", "isDefault": false }
    ]
  }
]
```

The `attributes` array is what `CategoryBrowser.tsx` reads to build the search filter UI dynamically.

---

### `GET /categories/:slug`
Single category by slug (e.g. `/categories/cars`).  
Returns `403 CATEGORY_DISABLED` if the category is toggled off.

---

## Listings

### `GET /categories/:slug/listings`
Search listings within a category.

**Query params**

| Param | Type | Description |
|---|---|---|
| `page` | integer | Default: 1 |
| `perPage` | integer | Default: 12 |
| `startAt` | datetime | Filter: must be available from |
| `endAt` | datetime | Filter: must be available until |
| `locationId` | uuid | Filter by pickup location |
| `attrs` | JSON string | JSONB attribute filters (see below) |
| `sortBy` | string | `createdAt` \| `price` \| `rating` |
| `sortDir` | string | `asc` \| `desc` |

**`attrs` examples**
```
# Automatic transmission
?attrs={"transmission":"automatic"}

# At least 5 seats
?attrs={"seats":{"min":5}}

# Automatic AND at least 5 seats
?attrs={"transmission":"automatic","seats":{"min":5}}
```

**Response**
```json
{
  "items": [
    {
      "id": "...",
      "slug": "toyota-camry-2023",
      "title": { "en": "Toyota Camry 2023", "ru": "Тойота Камри 2023" },
      "attributes": { "transmission": "automatic", "seats": 5, "brand": "Toyota" },
      "prices": [{ "unit": "day", "amount": 80, "currency": "USD" }],
      "averageRating": 4.7,
      "viewCount": 142
    }
  ],
  "total": 6
}
```

---

### `GET /categories/:slug/listings/:listingSlug`
Full listing detail including media gallery, all prices, extras, and reviews.

---

## Drivers

### `GET /drivers/available`
Lists drivers with no schedule conflicts in a time range.

**Query params:** `startAt` (required), `endAt` (required)

---

### `GET /drivers/:id`
Single driver profile with bio, languages, rates, and rating.

---

## Pricing

### `POST /listings/:id/quote`
Get a live price breakdown. Does **not** create a booking.

**Body**
```json
{
  "startAt": "2026-07-01T09:00:00Z",
  "endAt": "2026-07-04T09:00:00Z",
  "pricingUnit": "day",
  "withDriver": false,
  "driverId": null,
  "extraIds": ["<extra-uuid>"],
  "couponCode": "WELCOME10",
  "currency": "USD"
}
```

**Response**
```json
{
  "currency": "USD",
  "breakdown": [
    { "label": "3 x day @ $80", "amount": 240 },
    { "label": "Child seat x 3 days", "amount": 15 },
    { "label": "Coupon WELCOME10 (10%)", "amount": -25.5 }
  ],
  "subtotal": 240,
  "driverFee": 0,
  "extrasTotal": 15,
  "discountAmount": 25.5,
  "taxAmount": 22.95,
  "depositAmount": 50,
  "totalAmount": 252.45
}
```

> The same `PricingService.quote()` is called again server-side on `POST /bookings` — clients cannot submit a tampered price.

---

## Bookings

### `POST /bookings`
Create a booking. The server re-prices the order and inserts an availability block atomically.

**Body**
```json
{
  "listingId": "<uuid>",
  "startAt": "2026-07-01T09:00:00Z",
  "endAt": "2026-07-04T09:00:00Z",
  "pricingUnit": "day",
  "withDriver": false,
  "driverId": null,
  "extraIds": [],
  "couponCode": "WELCOME10",
  "currency": "USD",
  "paymentMethod": "stripe",
  "notes": "Please prepare a child seat."
}
```

**`paymentMethod` values**
- `stripe` — returns `payment.clientSecret` for Stripe.js to complete payment
- `regional` — auto-succeeds (dev/test gateway)
- `cash` — no payment intent, manual collection

**Response `201`**
```json
{
  "id": "...",
  "code": "RNT-2026-00001",
  "status": "pending",
  "totalAmount": 252.45,
  "currency": "USD",
  "payment": {
    "status": "pending",
    "clientSecret": "pi_xxx_secret_yyy"
  }
}
```

**Error cases**
- `409 LISTING_UNAVAILABLE` — overlapping booking exists (enforced at DB level)
- `400 LICENSE_REQUIRED` — category requires a verified driver's license

---

### `GET /bookings`
Current user's bookings. Supports `?status=confirmed&page=1`.

---

### `GET /bookings/:id`
Full booking with listing, driver, payment, invoice, and extras.

---

### `PATCH /bookings/:id/cancel`
Customer cancels. Body: `{ "reason": "..." }`.  
Refund is initiated automatically if the cancellation policy allows.

---

### `POST /bookings/:id/review`
Submit a review for a **completed** booking.

```json
{ "rating": 5, "comment": "Excellent car, very clean." }
```

Review goes into `pending` status until moderated.

---

## License

### `POST /licenses/upload`
Upload a driver's license for verification.

```json
{
  "licenseNumber": "AB123456",
  "expiresAt": "2028-06-01",
  "frontImageKey": "licenses/abc.jpg",
  "backImageKey": "licenses/def.jpg"
}
```

`frontImageKey` / `backImageKey` are S3 keys obtained from `POST /media/presign`.  
The license number is encrypted AES-256-GCM before storage.

---

## Media

### `POST /media/presign`
Get a presigned S3 URL for direct browser upload (valid 15 minutes).

```json
{ "filename": "car-photo.jpg", "contentType": "image/jpeg", "folder": "listings" }
```

**Response**
```json
{
  "uploadUrl": "https://minio.../presigned-put-url",
  "key": "listings/uuid-car-photo.jpg",
  "publicUrl": "https://minio.../listings/uuid-car-photo.jpg"
}
```

Upload workflow: call this endpoint → `PUT` the file to `uploadUrl` → save `key` to your listing/license.

---

## Favorites

| Method | Path | Description |
|---|---|---|
| `GET` | `/favorites` | List saved listings |
| `PUT` | `/favorites/:listingId` | Add to favorites (idempotent) |
| `DELETE` | `/favorites/:listingId` | Remove from favorites |

---

## Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List notifications (`?unreadOnly=true`) |
| `PATCH` | `/notifications/read-all` | Mark all as read |

---

## Content

| Method | Path | Description |
|---|---|---|
| `GET` | `/pages/:slug` | CMS content page (e.g. `/pages/about`) |
| `GET` | `/faqs` | FAQ list |

---

## Admin — Categories

> All admin routes require `Authorization: Bearer <token>` with role `staff` or `super_admin`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/categories` | All categories including disabled |
| `POST` | `/admin/categories` | Create category |
| `PATCH` | `/admin/categories/:id` | Update name/icon |
| `DELETE` | `/admin/categories/:id` | Delete (no active listings) |
| `PATCH` | `/admin/categories/:id/toggle` | **On/off switch** — hides or exposes category instantly |
| `POST` | `/admin/categories/:id/attributes` | Add attribute to JSONB schema |
| `DELETE` | `/admin/categories/:id/attributes/:attrId` | Remove attribute |
| `POST` | `/admin/categories/:id/pricing-units` | Add pricing unit |

**Toggle example**
```
PATCH /admin/categories/abc-123/toggle
→ { "id": "...", "slug": "cars", "isEnabled": false }
```
One call. Redis cache invalidated. Category disappears from all public routes instantly.

**Add attribute example**
```json
POST /admin/categories/:id/attributes
{
  "key": "property_type",
  "label": { "en": "Property Type", "ru": "Тип", "ar": "نوع العقار" },
  "dataType": "select",
  "filterWidget": "select",
  "isRequired": true,
  "options": ["apartment", "villa", "studio", "office"]
}
```

---

## Admin — Listings

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/listings` | All listings (`?status=active&categoryId=...`) |
| `POST` | `/admin/listings` | Create listing |
| `PATCH` | `/admin/listings/:id` | Update (including `status`) |
| `DELETE` | `/admin/listings/:id` | Delete listing |

---

## Admin — Bookings

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/bookings` | All bookings (`?status=pending&from=2026-01-01&to=2026-12-31`) |
| `PATCH` | `/admin/bookings/:id/transition` | Advance booking state |

**State machine — valid transitions**

```
pending      → confirmed, cancelled
confirmed    → in_progress, cancelled
in_progress  → completed, disputed, no_show
completed    → refunded
```

```json
PATCH /admin/bookings/:id/transition
{ "status": "confirmed", "notes": "Payment verified" }
```

Invalid transitions return `400 BOOKING_INVALID_TRANSITION`.

---

## Admin — Drivers

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/drivers` | All drivers |
| `POST` | `/admin/drivers` | Create driver profile |
| `PATCH` | `/admin/drivers/:id` | Update (isAvailable, hourlyRate, dailyRate) |

---

## Admin — Customers & Licenses

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/customers` | All customers (`?search=sara&page=1`) |
| `PATCH` | `/admin/licenses/:id/verify` | Approve or reject a license |

```json
PATCH /admin/licenses/:id/verify
{ "status": "approved", "notes": "Document clear." }
```

Sends an email/SMS notification to the customer automatically.

---

## Admin — Reviews

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/reviews` | All reviews (`?status=pending`) |
| `PATCH` | `/admin/reviews/:id` | Moderate: `approved`, `rejected`, `flagged` |

---

## Admin — Coupons

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/coupons` | All coupons |
| `POST` | `/admin/coupons` | Create coupon |
| `PATCH` | `/admin/coupons/:id` | Update / deactivate |

```json
POST /admin/coupons
{
  "code": "SUMMER25",
  "discountType": "percent",
  "discountValue": 25,
  "maxDiscount": 100,
  "usageLimit": 500,
  "validFrom": "2026-06-01T00:00:00Z",
  "validUntil": "2026-08-31T23:59:59Z",
  "isActive": true
}
```

---

## Admin — Reports & Dashboard

### `GET /admin/dashboard/kpis`
Returns total revenue, bookings by status, fleet utilization %, and top listings.

---

### `GET /admin/reports/:type`
Download a report as JSON or CSV.

**`type` values:** `bookings` · `revenue` · `fleet` · `drivers`

**Query params**

| Param | Required | Example |
|---|---|---|
| `from` | yes | `2026-01-01` |
| `to` | yes | `2026-12-31` |
| `format` | no | `csv` (default: `json`) |

```
GET /admin/reports/bookings?from=2026-01-01&to=2026-12-31&format=csv
→ streams CSV file download
```

---

### `GET /admin/audit-logs`
Full audit trail of admin actions. Supports `?actorId=...&action=toggle_category`.

---

## Admin — Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/settings` | All platform settings |
| `PUT` | `/admin/settings/:key` | Update a setting |

**Common keys**

| Key | Example value |
|---|---|
| `default_currency` | `USD` |
| `supported_currencies` | `USD,EUR,RUB,AED` |
| `tax_percent` | `10` |
| `company_name` | `Renting.ru` |
| `support_email` | `support@renting.ru` |

```json
PUT /admin/settings/tax_percent
{ "value": "12" }
```

---

## Admin — Webhooks

Outbound webhooks are delivered with an `X-Renting-Signature` HMAC-SHA256 header.  
Failed deliveries are retried at 1 / 5 / 30 / 120 / 720 minute intervals.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/webhooks` | List endpoints |
| `POST` | `/admin/webhooks` | Register endpoint |
| `DELETE` | `/admin/webhooks/:id` | Delete endpoint |
| `GET` | `/admin/webhooks/:id/deliveries` | Delivery history |

```json
POST /admin/webhooks
{
  "url": "https://your-app.com/hooks/renting",
  "events": ["booking.created", "booking.confirmed", "booking.cancelled", "booking.completed"],
  "secret": "my-signing-secret"
}
```

**Verifying signatures**
```js
const sig = req.headers['x-renting-signature'];
const expected = crypto
  .createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');
if (sig !== `sha256=${expected}`) throw new Error('Invalid signature');
```

---

## Payment Webhooks

These are called by the payment gateway, not by you.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/payments/webhook/stripe` | Requires `Stripe-Signature` header + raw body |
| `POST` | `/payments/webhook/regional` | Body: `{ "ref": "...", "status": "succeeded" }` |
