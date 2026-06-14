import { execSync } from "child_process";
import * as path from "path";

export default async function globalSetup() {
  // Ensure we use the test database
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://renting:renting@localhost:5432/renting_test";
  process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

  // Run migrations on the test DB
  const apiDir = path.resolve(__dirname, "..");
  execSync("npx prisma migrate deploy", {
    cwd: apiDir,
    env: { ...process.env },
    stdio: "inherit",
  });

  // Seed test data
  execSync("ts-node --transpile-only prisma/seed.ts", {
    cwd: apiDir,
    env: { ...process.env },
    stdio: "inherit",
  });
}
