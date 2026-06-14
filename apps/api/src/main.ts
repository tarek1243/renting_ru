import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { config } from "./config/config";
import { buildOpenApiDocument, mountSwagger } from "./swagger";

async function bootstrap() {
  const cfg = config();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // keep raw body for PSP webhook signature verification
  app.use(
    json({
      limit: "2mb",
      verify: (req: any, _res, buf) => {
        if (req.url?.includes("/payments/webhooks/")) req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(urlencoded({ extended: true }));

  app.use(helmet());
  app.enableCors({
    origin: cfg.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key"],
  });

  app.setGlobalPrefix("api/v1", { exclude: ["docs"] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: false } }),
  );
  app.enableShutdownHooks();

  const document = buildOpenApiDocument(app);
  mountSwagger(app, document);

  await app.listen(cfg.API_PORT);
  // eslint-disable-next-line no-console
  console.log(`API ready on ${cfg.API_URL}/api/v1 — Swagger UI at ${cfg.API_URL}/docs`);
}

void bootstrap();
