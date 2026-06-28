INSERT INTO "category_attributes" (
  "id",
  "category_id",
  "key",
  "label",
  "data_type",
  "options",
  "unit",
  "validation",
  "is_required",
  "is_filterable",
  "filter_widget",
  "show_in_card",
  "sort_order"
)
SELECT
  (
    substr(md5("id"::text || ':smoking_policy'), 1, 8) || '-' ||
    substr(md5("id"::text || ':smoking_policy'), 9, 4) || '-' ||
    substr(md5("id"::text || ':smoking_policy'), 13, 4) || '-' ||
    substr(md5("id"::text || ':smoking_policy'), 17, 4) || '-' ||
    substr(md5("id"::text || ':smoking_policy'), 21, 12)
  )::uuid,
  "id",
  'smoking_policy',
  '{"en":"Smoking","ar":"التدخين"}'::jsonb,
  'select',
  '[{"value":"non_smoking","label":{"en":"Non-smoking","ar":"ممنوع التدخين"}},{"value":"smoking_allowed","label":{"en":"Smoking allowed","ar":"مسموح بالتدخين"}}]'::jsonb,
  NULL,
  NULL,
  FALSE,
  TRUE,
  'select',
  TRUE,
  10
FROM "rental_categories"
WHERE "slug" = 'cars'
ON CONFLICT ("category_id", "key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "options" = EXCLUDED."options",
  "is_filterable" = TRUE,
  "filter_widget" = 'select',
  "show_in_card" = TRUE,
  "sort_order" = 10;

UPDATE "listings"
SET "attributes" = jsonb_set("attributes", '{smoking_policy}', '"non_smoking"', true)
WHERE "category_id" = (SELECT "id" FROM "rental_categories" WHERE "slug" = 'cars')
  AND NOT ("attributes" ? 'smoking_policy');
