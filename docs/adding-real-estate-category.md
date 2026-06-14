# Adding a New Rental Category — Real Estate Example

This guide demonstrates how to add a completely new rental category (Real Estate) to the platform **without any code changes or database migrations**.

The multi-category engine stores category schema in three database tables:
- `rental_categories` — the category itself (slug, name, isEnabled)
- `category_attributes` — JSONB attribute schema (validated at write time)
- `category_pricing_units` — allowed pricing units for listings in this category

---

## Step 1 — Create the Category (disabled)

```http
POST /api/v1/admin/categories
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "slug": "real-estate",
  "name": {
    "en": "Real Estate",
    "ru": "Недвижимость",
    "ar": "عقارات"
  },
  "icon": "🏢",
  "isEnabled": false
}
```

**Why disabled first?** You configure the schema before customers can see it.
The `isEnabled: false` means every route that calls `CategoriesService.getEnabledBySlug()`
returns `CATEGORY_DISABLED` — no partial visibility.

---

## Step 2 — Define the Attribute Schema

Each attribute row tells the API how to validate JSONB writes AND tells the frontend
which filter widget to render. Zero frontend code changes are needed.

```http
POST /api/v1/admin/categories/<category-id>/attributes
Authorization: Bearer <admin-token>

# Property type (select widget in search sidebar)
{
  "key": "property_type",
  "label": { "en": "Property Type", "ru": "Тип", "ar": "نوع العقار" },
  "dataType": "select",
  "filterWidget": "select",
  "isRequired": true,
  "options": ["apartment", "villa", "studio", "office", "shop"],
  "sortOrder": 1
}
```

```http
# Area in m² (range slider in search sidebar)
{
  "key": "area_sqm",
  "label": { "en": "Area (m²)", "ru": "Площадь (м²)", "ar": "المساحة (م²)" },
  "dataType": "number",
  "filterWidget": "range",
  "isRequired": true,
  "minValue": 10,
  "maxValue": 2000,
  "sortOrder": 2
}
```

```http
# Bedrooms (range filter)
{
  "key": "bedrooms",
  "label": { "en": "Bedrooms", "ru": "Спален", "ar": "غرف النوم" },
  "dataType": "number",
  "filterWidget": "range",
  "isRequired": false,
  "minValue": 0,
  "maxValue": 10,
  "sortOrder": 3
}
```

```http
# Furnished toggle
{
  "key": "furnished",
  "label": { "en": "Furnished", "ru": "С мебелью", "ar": "مفروش" },
  "dataType": "boolean",
  "filterWidget": "toggle",
  "isRequired": false,
  "sortOrder": 4
}
```

```http
# Floor
{
  "key": "floor",
  "label": { "en": "Floor", "ru": "Этаж", "ar": "الطابق" },
  "dataType": "number",
  "filterWidget": "range",
  "minValue": 0,
  "maxValue": 100,
  "sortOrder": 5
}
```

---

## Step 3 — Add Pricing Units

```http
POST /api/v1/admin/categories/<category-id>/pricing-units
Authorization: Bearer <admin-token>

# Night (for short stays)
{
  "unit": "night",
  "label": { "en": "per Night", "ru": "за ночь", "ar": "لكل ليلة" },
  "isDefault": false
}
```

```http
# Month (for long-term rentals) — set as default
{
  "unit": "month",
  "label": { "en": "per Month", "ru": "в месяц", "ar": "شهريًا" },
  "isDefault": true
}
```

---

## Step 4 — Create Listings

Now staff can create listings. The `attributes` JSONB is validated against the schema
defined in Step 2.

```http
POST /api/v1/admin/listings
Authorization: Bearer <admin-token>

{
  "categoryId": "<real-estate-category-id>",
  "title": {
    "en": "Modern 2BR Apartment — City Center",
    "ru": "Современная 2-комнатная квартира — Центр",
    "ar": "شقة حديثة ٢ غرف — وسط المدينة"
  },
  "description": {
    "en": "Fully furnished, 10th floor, panoramic views.",
    "ru": "Полностью меблированная, 10 этаж, панорамный вид.",
    "ar": "مفروشة بالكامل، الطابق العاشر، إطلالات بانورامية."
  },
  "slug": "modern-2br-apartment-city-center",
  "attributes": {
    "property_type": "apartment",
    "area_sqm": 85,
    "bedrooms": 2,
    "furnished": true,
    "floor": 10
  },
  "status": "draft"
}
```

If any attribute fails validation (e.g. `"property_type": "castle"` which is not in
the options list), the API returns `ATTRIBUTE_INVALID` with field details.

---

## Step 5 — Enable the Category

When listings are ready and the team has reviewed them, flip the toggle:

```http
PATCH /api/v1/admin/categories/<category-id>/toggle
Authorization: Bearer <admin-token>
```

This:
1. Sets `isEnabled = true` in the DB
2. Invalidates the Redis cache entry for this category (TTL 60s)
3. The category immediately appears in `GET /categories` responses
4. `CategoryBrowser.tsx` on the web automatically reads the new attribute schema
   and renders the correct filter widgets — **no frontend code changes needed**

---

## What happens on the frontend

The `CategoryBrowser` component is schema-driven:

```tsx
// apps/web/components/CategoryBrowser.tsx (simplified)
{schema.attributes.map((attr) => {
  if (attr.filterWidget === 'select')  return <SelectFilter />;
  if (attr.filterWidget === 'range')   return <RangeFilter />;
  if (attr.filterWidget === 'toggle')  return <ToggleFilter />;
})}
```

A Real Estate listing with `property_type`, `area_sqm`, `bedrooms`, `furnished`, and
`floor` attributes automatically gets a working search UI with a select dropdown for
property type, range sliders for area/bedrooms/floor, and a toggle for furnished —
all rendered from the attribute rows you inserted in Step 2.

---

## Summary

| What you did | Lines of code written |
|---|---|
| Created the category | 0 |
| Defined 5 search attributes | 0 |
| Added 2 pricing units | 0 |
| Created listings with validated JSONB | 0 |
| Got a working search UI with 5 filter widgets | 0 |
| **Total code changes** | **0** |

The only things you touched were three database tables via the admin API.
The `RentalCategory.isEnabled` toggle is the single on/off switch — flip it when ready.
