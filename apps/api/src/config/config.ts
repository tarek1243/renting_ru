import * as path from "path";
import { z } from "zod";

// Load .env from the app dir or repo root (no-op when vars come from the environment).
const envCandidates = [
  path.resolve(__dirname, "../../.env"), // running from src (ts-node / nest start)
  path.resolve(__dirname, "../../../.env"), // running from dist
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"), // repo root
];
for (const file of envCandidates) {
  try {
    (process as any).loadEnvFile?.(file);
    break;
  } catch {
    /* try next */
  }
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().default("http://localhost:4000"),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3100"),

  JWT_ACCESS_SECRET: z.string().default("dev-access-secret"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret"),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(2592000),
  OTP_TTL: z.coerce.number().default(300),
  ENCRYPTION_KEY: z.string().length(32).default("0123456789abcdef0123456789abcdef"),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("renting-media"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Renting <no-reply@renting.local>"),
  SMS_PROVIDER: z.string().default("log"),
  SMS_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | null = null;

export function config(): AppConfig {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
      throw new Error("Invalid environment configuration");
    }
    cached = parsed.data;
  }
  return cached;
}
