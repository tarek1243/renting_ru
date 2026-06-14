import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

/** Time-driven booking housekeeping: start reminders ~24h ahead. */
@Injectable()
export class BookingsCron {
  private readonly logger = new Logger(BookingsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendReminders(): Promise<void> {
    if (process.env.EMIT_OPENAPI === "1") return;
    const windowStart = new Date(Date.now() + 23.5 * 3600_000);
    const windowEnd = new Date(Date.now() + 24.5 * 3600_000);
    const candidates = await this.prisma.booking.findMany({
      where: { status: "confirmed", startAt: { gte: windowStart, lt: windowEnd } },
    });
    for (const booking of candidates) {
      const meta = (booking.meta as Record<string, unknown>) ?? {};
      if (meta.reminderSent) continue;
      const vars = { code: booking.code, startAt: booking.startAt.toISOString() };
      this.notifications.queue(booking.customerId, "email", "booking_reminder", vars);
      this.notifications.queue(booking.customerId, "sms", "booking_reminder", vars);
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { meta: { ...meta, reminderSent: true } as never },
      });
      this.logger.log(`reminder queued for ${booking.code}`);
    }
  }
}
