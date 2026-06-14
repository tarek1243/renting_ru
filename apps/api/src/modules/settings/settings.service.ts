import { Injectable } from "@nestjs/common";
import { CacheService } from "../../cache/cache.service";
import { PrismaService } from "../../prisma/prisma.service";

export interface CurrencySettings {
  default: string;
  supported: string[];
  rates: Record<string, number>;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const cached = await this.cache.get<T>(`setting:${key}`);
    if (cached !== null) return cached;
    const row = await this.prisma.setting.findUnique({ where: { key } });
    const value = (row?.value as T) ?? fallback;
    await this.cache.set(`setting:${key}`, value, 60);
    return value;
  }

  currencies(): Promise<CurrencySettings> {
    return this.get<CurrencySettings>("currencies", { default: "USD", supported: ["USD"], rates: { USD: 1 } });
  }

  tax(): Promise<{ percent: number; label: string }> {
    return this.get("tax", { percent: 0, label: "Tax" });
  }

  async publicSettings() {
    const rows = await this.prisma.setting.findMany({ where: { isPublic: true } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async set(key: string, value: unknown, group = "general", isPublic = false) {
    const row = await this.prisma.setting.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any, group, isPublic },
    });
    await this.cache.del(`setting:${key}`);
    return row;
  }
}
