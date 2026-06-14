/**
 * Emits docs/openapi.yaml + docs/openapi.json from the live Nest metadata —
 * the spec is generated from the same decorators that serve traffic, so it
 * cannot drift. Run: pnpm --filter @renting/api openapi:emit
 */
process.env.EMIT_OPENAPI = "1";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://emit:emit@localhost:5432/emit";

import { NestFactory } from "@nestjs/core";
import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";
import { AppModule } from "./app.module";
import { buildOpenApiDocument } from "./swagger";

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1", { exclude: ["docs"] });
  const document = buildOpenApiDocument(app);

  const docsDir = path.resolve(__dirname, "../../../docs");
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, "openapi.json"), JSON.stringify(document, null, 2));
  fs.writeFileSync(path.join(docsDir, "openapi.yaml"), yaml.dump(document, { noRefs: true, lineWidth: 140 }));
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${docsDir} (${Object.keys(document.paths).length} paths)`);
  await app.close();
  process.exit(0);
}

void main();
