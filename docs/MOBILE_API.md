# Renting — Mobile App API Guide

Use this document when building mobile screens with Claude.
Paste the relevant section into the prompt alongside your UI request.

---

## Setup

```
Production API base URL:  https://<your-api-service>.up.railway.app/api/v1
All requests:             Content-Type: application/json
Authenticated requests:   Authorization: Bearer <accessToken>
```

> Replace `<your-api-service>` with the Railway URL of your API service.

---

## Response shape (all endpoints)

Every response — success or error — is wrapped the same way:

```json
// Success
{ "success": true, "data": { ... }, "error": null, "meta": null }

// Paginated success
{ "success": true, "data": [...], "error": null, "meta": { "pagination": { "page": 1, "perPage": 12, "total": 84, "totalPages": 7 } } }

// Error
{ "success": false, "data": null, "error": { "code": "LISTING_UNAVAILABLE", "message": "Already booked for that period." } }
```

Always read `error.code` (not `error.message`) for UI logic — the code is a stable string, the message can change.

---

## Token management

Access tokens expire after **15 minutes**. Store both tokens on device (e.g. SecureStore / Keychain).

```
// On every API call:
if (response.status === 401) {
  call POST /auth/refresh with { refreshToken }
  store new accessToken + refreshToken
  retry the original request
}
```

---

## Error codes reference

| Code | When it appears | What to show the user |
|---|---|---|
| `INVALID_CREDENTIALS` | Login | "Wrong email or password" |
| `EMAIL_TAKEN` | Register | "Email already in use" |
| `TOKEN_EXPIRED` | Any authenticated call | Refresh silently, retry |
| `UNAUTHORIZED` | Any authenticated call | Redirect to login |
| `NOT_FOUND` | Any detail call | "Not found" |
| `LISTING_UNAVAILABLE` | Quote / Book | "Already booked for these dates" |
| `LISTING_INACTIVE` | Book | "This listing is not available" |
| `DRIVER_UNAVAILABLE` | Quote / Book | "Driver not available for these dates" |
| `LICENSE_REQUIRED` | Book | Show license upload screen |
| `LICENSE_PENDING` | Book | "Your license is under review" |
| `COUPON_INVALID` | Quote / Book | "Invalid coupon code" |
| `COUPON_EXPIRED` | Quote / Book | "This coupon has expired" |
| `COUPON_LIMIT_REACHED` | Quote / Book | "Coupon usage limit reached" |
| `VALIDATION_ERROR` | Any | Show field errors from `error.message` |
| `RATE_LIMITED` | Any | "Too many requests, please wait" |

---

---

# SCREEN-BY-SCREEN API REFERENCE

---

## SCREEN: Splash / App Launch

On launch, check if a stored `accessToken` exists.
Call `GET /auth/me` to validate it. If 401, try refresh. If refresh fails, go to Login.

```
GET /auth/me
Headers: Authorization: Bearer <accessToken>

Response data:
{
  "id": "uuid",
  "name": "Sara Ahmed",
  "email": "sara@example.com",
  "phone": "+971501234567",
  "roles": ["customer"],
  "licenseStatus": "approved"   // null | "pending" | "approved" | "rejected"
}
```

`roles` values: `customer` · `staff` · `super_admin`

---

## SCREEN: Register

```
POST /auth/register
Body:
{
  "name": "Sara Ahmed",
  "email": "sara@example.com",
  "password": "Password1!",   // min 8 chars, 1 uppercase, 1 number
  "phone": "+971501234567"    // optional
}

Response 201:
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "...", "name": "Sara Ahmed", "email": "...", "roles": ["customer"] }
}
```

Store both tokens. Navigate to Home.

---

## SCREEN: Login

```
POST /auth/login
Body:
{ "email": "sara@example.com", "password": "Password1!" }

Response 200: same shape as register
```

Error `INVALID_CREDENTIALS` → show inline error.

---

## SCREEN: Forgot Password / OTP

Step 1 — send OTP:
```
POST /auth/otp/send
Body: { "target": "sara@example.com", "channel": "email" }
```

Step 2 — verify OTP:
```
POST /auth/otp/verify
Body: { "target": "sara@example.com", "code": "482910" }
```

---

## SCREEN: Logout

```
POST /auth/logout
Body: { "refreshToken": "eyJ..." }
```

Clear stored tokens and navigate to Login.

---

## SCREEN: Home

### Load categories (tab bar / category selector)
```
GET /categories

Response data: [
  {
    "id": "uuid",
    "slug": "cars",
    "name": { "en": "Cars", "ru": "Автомобили", "ar": "سيارات" },
    "icon": "🚗",
    "isEnabled": true,
    "attributes": [                   // use to build filter UI
      {
        "key": "transmission",
        "label": { "en": "Transmission" },
        "dataType": "select",         // select | number | boolean | text | date
        "filterWidget": "select",     // select | range | toggle | text
        "options": ["automatic", "manual"],
        "isRequired": false
      },
      {
        "key": "seats",
        "label": { "en": "Seats" },
        "dataType": "number",
        "filterWidget": "range",
        "options": null
      }
    ],
    "pricingUnits": [
      { "unit": "day", "isDefault": true },
      { "unit": "hour", "isDefault": false }
    ]
  }
]
```

Pick the user's locale key from `name` to show the category label.

### Load featured listings for first category
```
GET /categories/cars/listings?featured=true&perPage=6

Response data.items: [
  {
    "id": "uuid",
    "slug": "toyota-camry-2023",
    "title": { "en": "Toyota Camry 2023" },
    "attributes": { "transmission": "automatic", "seats": 5, "brand": "Toyota" },
    "prices": [
      { "unit": "day", "amount": 80, "currency": "USD" },
      { "unit": "hour", "amount": 15, "currency": "USD" }
    ],
    "media": [{ "url": "https://...", "isPrimary": true }],
    "averageRating": 4.7,
    "reviewCount": 23,
    "location": { "id": "uuid", "name": "Dubai Airport" }
  }
]
```

---

## SCREEN: Browse / Search (listing list)

```
GET /categories/:slug/listings

Query params:
  page=1
  perPage=12
  startAt=2026-07-01T09:00:00Z     // ISO datetime — availability filter
  endAt=2026-07-04T09:00:00Z
  locationId=<uuid>                 // optional location filter
  attrs={"transmission":"automatic","seats":{"min":5}}   // JSON-encoded
  sortBy=price                      // createdAt | price | rating
  sortDir=asc                       // asc | desc
  featured=true                     // optional

Response:
{
  "success": true,
  "data": {
    "items": [ ...listing summaries... ],
    "total": 42
  },
  "meta": {
    "pagination": { "page": 1, "perPage": 12, "total": 42, "totalPages": 4 }
  }
}
```

Build filter UI from `category.attributes`:
- `filterWidget: "select"` → dropdown / segmented control
- `filterWidget: "range"` → min/max sliders → encode as `{"seats":{"min":2,"max":7}}`
- `filterWidget: "toggle"` → boolean toggle → `{"wifi":true}`

---

## SCREEN: Listing Detail

```
GET /categories/:slug/listings/:listingSlug

Response data:
{
  "id": "uuid",
  "slug": "toyota-camry-2023",
  "title": { "en": "Toyota Camry 2023", "ar": "..." },
  "description": { "en": "Comfortable sedan..." },
  "attributes": { "transmission": "automatic", "seats": 5, "brand": "Toyota", "year": 2023 },
  "prices": [
    { "unit": "day", "amount": 80, "currency": "USD" },
    { "unit": "hour", "amount": 15, "currency": "USD" }
  ],
  "media": [
    { "url": "https://...", "isPrimary": true },
    { "url": "https://..." }
  ],
  "extras": [
    { "id": "uuid", "name": { "en": "Child Seat" }, "price": 5, "pricingUnit": "day" },
    { "id": "uuid", "name": { "en": "GPS" }, "price": 3, "pricingUnit": "day" }
  ],
  "location": { "id": "uuid", "name": "Dubai Airport", "lat": 25.25, "lng": 55.36 },
  "averageRating": 4.7,
  "reviewCount": 23,
  "reviews": [
    { "id": "uuid", "rating": 5, "comment": "Great car!", "author": "Sara A.", "createdAt": "2026-05-01T..." }
  ],
  "withDriverAllowed": true,
  "requiresLicense": true          // if true and user has no approved license, block booking
}
```

### Add / remove favorite (heart button)
```
PUT    /favorites/:listingId     // add (idempotent, no body needed)
DELETE /favorites/:listingId     // remove
```

---

## SCREEN: Drivers (optional — shown when "with driver" is selected)

```
GET /drivers/available?startAt=2026-07-01T09:00:00Z&endAt=2026-07-04T09:00:00Z

Response data: [
  {
    "id": "uuid",
    "name": "Ahmed K.",
    "bio": { "en": "10 years experience..." },
    "languages": ["en", "ar"],
    "hourlyRate": 12,
    "dailyRate": 80,
    "currency": "USD",
    "avatarUrl": "https://...",
    "rating": 4.9,
    "reviewCount": 41
  }
]
```

---

## SCREEN: Price Quote (before booking — show live total)

Call this whenever the user changes dates, extras, driver, or coupon.
Does NOT create a booking.

```
POST /listings/:listingId/quote
Headers: Authorization: Bearer <accessToken>
Body:
{
  "startAt": "2026-07-01T09:00:00Z",
  "endAt": "2026-07-04T09:00:00Z",
  "pricingUnit": "day",
  "withDriver": false,
  "driverId": null,
  "extraIds": ["<extra-uuid>"],
  "couponCode": "WELCOME10",        // optional — omit if no coupon
  "currency": "USD"
}

Response data:
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

Show each `breakdown` line in the summary. The server recalculates on `POST /bookings` — the client cannot submit a custom price.

---

## SCREEN: Create Booking / Checkout

```
POST /bookings
Headers: Authorization: Bearer <accessToken>
Body:
{
  "listingId": "<uuid>",
  "startAt": "2026-07-01T09:00:00Z",
  "endAt": "2026-07-04T09:00:00Z",
  "pricingUnit": "day",
  "withDriver": false,
  "driverId": null,                  // required if withDriver: true
  "extraIds": ["<extra-uuid>"],
  "couponCode": "WELCOME10",         // optional
  "currency": "USD",
  "paymentMethod": "stripe",         // stripe | cash | regional
  "notes": "Please prepare a child seat."
}

Response 201:
{
  "id": "uuid",
  "code": "RNT-2026-00001",
  "status": "pending",
  "totalAmount": 252.45,
  "currency": "USD",
  "payment": {
    "status": "pending",
    "clientSecret": "pi_xxx_secret_yyy"   // only for paymentMethod: "stripe"
  }
}
```

**Payment method handling:**
- `stripe` → use `payment.clientSecret` with Stripe SDK (`confirmPayment`) → Stripe calls backend webhook → booking moves to `confirmed` automatically
- `cash` → no payment UI needed, booking stays `pending` until staff confirms
- `regional` → no payment UI, auto-confirmed immediately

**Error cases:**
- `409 LISTING_UNAVAILABLE` → "Already booked for these dates, please choose different dates"
- `400 LICENSE_REQUIRED` → navigate to License Upload screen
- `400 LICENSE_PENDING` → show "License under review" message

---

## SCREEN: Booking Confirmation

After payment succeeds, navigate here with the booking `id`.

```
GET /bookings/:id
Headers: Authorization: Bearer <accessToken>

Response data:
{
  "id": "uuid",
  "code": "RNT-2026-00001",
  "status": "confirmed",            // pending | confirmed | in_progress | completed | cancelled | disputed | refunded | no_show
  "startAt": "2026-07-01T09:00:00Z",
  "endAt": "2026-07-04T09:00:00Z",
  "totalAmount": 252.45,
  "currency": "USD",
  "listing": {
    "title": { "en": "Toyota Camry 2023" },
    "media": [{ "url": "https://...", "isPrimary": true }],
    "location": { "name": "Dubai Airport" }
  },
  "driver": null,                   // or driver object if withDriver
  "extras": [...],
  "payment": { "status": "succeeded", "method": "stripe" },
  "invoice": { "url": "https://..." },   // PDF download link
  "notes": "Please prepare a child seat.",
  "createdAt": "2026-06-15T..."
}
```

**Booking status labels for UI:**

| status | Label to show |
|---|---|
| `pending` | Awaiting confirmation |
| `confirmed` | Confirmed |
| `in_progress` | Active / In progress |
| `completed` | Completed |
| `cancelled` | Cancelled |
| `disputed` | Under dispute |
| `refunded` | Refunded |
| `no_show` | No-show |

---

## SCREEN: My Bookings

```
GET /bookings?page=1&perPage=10
GET /bookings?status=confirmed&page=1      // filter by status

Response data: [ ...booking summaries (same shape as GET /bookings/:id)... ]
```

---

## SCREEN: Cancel Booking

```
PATCH /bookings/:id/cancel
Headers: Authorization: Bearer <accessToken>
Body: { "reason": "Plans changed" }
```

If cancellation policy allows, refund is initiated automatically.

---

## SCREEN: Write a Review

Only available when booking `status === "completed"`.

```
POST /bookings/:id/review
Headers: Authorization: Bearer <accessToken>
Body: { "rating": 5, "comment": "Excellent car, very clean." }
```

Review is held as `pending` until moderated by admin. Show "Thanks, your review is under review."

---

## SCREEN: My Profile

```
GET /auth/me
→ shows name, email, phone, licenseStatus
```

To update profile (if endpoint available), use `PATCH /auth/me`.

---

## SCREEN: License Upload

Upload flow — 3 steps:

**Step 1 — upload front image:**
```
POST /media/presign
Headers: Authorization: Bearer <accessToken>
Body: { "filename": "license-front.jpg", "contentType": "image/jpeg", "folder": "licenses" }

Response data:
{
  "uploadUrl": "https://s3.../presigned-url",   // PUT directly to this URL
  "key": "licenses/uuid-license-front.jpg",     // save this
  "publicUrl": "https://cdn.../licenses/uuid-license-front.jpg"
}
```

**Step 2 — PUT the file to `uploadUrl`:**
```
PUT <uploadUrl>
Headers: Content-Type: image/jpeg
Body: <binary image data>
```
No auth header needed — the URL is pre-signed.

**Step 3 — repeat Step 1+2 for back image, then submit:**
```
POST /licenses/upload
Headers: Authorization: Bearer <accessToken>
Body:
{
  "licenseNumber": "AB123456",
  "expiresAt": "2028-06-01",
  "frontImageKey": "licenses/uuid-front.jpg",
  "backImageKey": "licenses/uuid-back.jpg"
}
```

After this, `user.licenseStatus` becomes `"pending"`. Admin reviews it and the status changes to `"approved"` or `"rejected"`. Show the user their current `licenseStatus` on the Profile screen.

---

## SCREEN: Favorites

```
GET /favorites
Headers: Authorization: Bearer <accessToken>

Response data: [ ...listing summaries... ]
```

---

## SCREEN: Notifications

```
GET /notifications
GET /notifications?unreadOnly=true
Headers: Authorization: Bearer <accessToken>

Response data: [
  {
    "id": "uuid",
    "title": "Booking Confirmed",
    "body": "Your Toyota Camry booking RNT-2026-00001 is confirmed.",
    "type": "booking_confirmed",   // booking_confirmed | booking_cancelled | license_approved | license_rejected | review_approved | payment_received
    "isRead": false,
    "createdAt": "2026-06-15T..."
  }
]
```

```
PATCH /notifications/read-all
Headers: Authorization: Bearer <accessToken>
```

---

## SCREEN: Listing Upload Photo (if users can submit listings)

Same 2-step flow as license upload but use `folder: "listings"`:

```
POST /media/presign
Body: { "filename": "car.jpg", "contentType": "image/jpeg", "folder": "listings" }
→ { "uploadUrl": "...", "key": "listings/uuid-car.jpg", "publicUrl": "..." }

PUT <uploadUrl> with binary image
→ save "key" and "publicUrl" to use in listing creation
```

---

## Localization

All `name`, `title`, `description`, `label` fields are multilingual objects:
```json
{ "en": "Cars", "ru": "Автомобили", "ar": "سيارات" }
```

Pick the key matching the user's locale. Fallback order: `en` → first available key.

RTL layout: apply when locale is `ar` (or any Arabic/Hebrew locale).

---

## Pagination pattern

All list endpoints return the same pagination meta. Implement infinite scroll:

```
GET /categories/cars/listings?page=1&perPage=12   // first load
GET /categories/cars/listings?page=2&perPage=12   // load more

meta.pagination.page < meta.pagination.totalPages  → more pages exist
```

---

## Stripe payment integration

1. Create booking with `paymentMethod: "stripe"` → get `payment.clientSecret`
2. Use Stripe React Native SDK:
```js
import { useStripe } from '@stripe/stripe-react-native';
const { confirmPayment } = useStripe();

const { error } = await confirmPayment(clientSecret, {
  paymentMethodType: 'Card',
  paymentMethodData: { billingDetails: { name: user.name } }
});

if (error) { /* show error */ }
else { /* navigate to confirmation screen */ }
```
3. Stripe calls `POST /payments/webhook/stripe` on the backend automatically → booking status moves to `confirmed`.

---

## Quick-start prompt template for Claude

When building a screen, paste this at the top of your prompt:

```
I'm building a React Native (Expo) app for a car rental platform.

API base URL: https://<api>.up.railway.app/api/v1
Auth: Bearer token in Authorization header
All responses: { success, data, error, meta }

[paste the relevant SCREEN section from this doc]

Build the [Screen Name] screen. Use:
- React Native + Expo
- TypeScript
- React Query for data fetching
- NativeWind or StyleSheet for styling
- Expo Router for navigation
```
