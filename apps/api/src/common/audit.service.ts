import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Fire-and-forget audit trail for admin/staff mutations. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    ip?: string;
    userAgent?: string;
  }): void {
    void this.prisma.auditLog
      .create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          before: (entry.before as any) ?? undefined,
          after: (entry.after as any) ?? undefined,
          ip: entry.ip,
          userAgent: entry.userAgent,
        },
      })
      .catch(() => undefined);
  }
}
