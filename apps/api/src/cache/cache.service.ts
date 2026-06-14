import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { config } from "../config/config";

/**
 * Redis-backed cache with a transparent in-memory fallback, so local dev works
 * without Redis while production uses it for cross-instance consistency.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private memory = new Map<string, { value: string; expiresAt: number }>();

  constructor() {
    const url = config().REDIS_URL;
    if (url && process.env.EMIT_OPENAPI !== "1") {
      this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
      this.redis.connect().catch(() => {
        this.logger.warn("Redis unreachable — falling back to in-memory cache");
        this.redis?.disconnect();
        this.redis = null;
      });
      this.redis.on("error", () => undefined);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redis?.status === "ready") {
        const raw = await this.redis.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      }
    } catch {
      /* fall through to memory */
    }
    const hit = this.memory.get(key);
    if (!hit || hit.expiresAt < Date.now()) return null;
    return JSON.parse(hit.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const raw = JSON.stringify(value);
    try {
      if (this.redis?.status === "ready") {
        await this.redis.set(key, raw, "EX", ttlSeconds);
        return;
      }
    } catch {
      /* fall through to memory */
    }
    this.memory.set(key, { value: raw, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (this.redis?.status === "ready") await this.redis.del(...keys);
    } catch {
      /* ignore */
    }
    keys.forEach((k) => this.memory.delete(k));
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
