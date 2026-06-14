import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Renting Platform API")
    .setDescription(
      [
        "API-first multi-category rental engine (cars, real estate, ...).",
        "",
        "**Envelope**: every response is `{ success, data, error, meta }`. Errors carry stable `error.code` values (e.g. `CATEGORY_DISABLED`, `LISTING_UNAVAILABLE`).",
        "**Auth**: JWT bearer access tokens (15 min) + rotating refresh tokens — identical for web and mobile. Third-party integrations may use `X-Api-Key`.",
        "**Pagination**: `?page&perPage&sort&order` on all list endpoints; pagination metadata in `meta.pagination`.",
        "**Categories**: clients must build search filters and listing forms from `GET /categories/{slug}` — never hardcode attributes.",
        "**Webhooks**: subscribe via admin endpoints; deliveries signed with HMAC-SHA256 in `X-Renting-Signature`.",
      ].join("\n"),
    )
    .setVersion("1.0.0")
    .addServer("/", "Current host")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .addApiKey({ type: "apiKey", name: "X-Api-Key", in: "header" }, "api-key")
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function mountSwagger(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup("docs", app, document, {
    customSiteTitle: "Renting API docs",
    swaggerOptions: { persistAuthorization: true, docExpansion: "none" },
  });
}
