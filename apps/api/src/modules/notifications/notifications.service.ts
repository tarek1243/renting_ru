import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as nodemailer from "nodemailer";
import { config } from "../../config/config";
import { PrismaService } from "../../prisma/prisma.service";
import { renderTemplate } from "./templates";

/**
 * DB-backed notification outbox. `queue()` is called inside business flows
 * (cheap, transactional-adjacent); a cron dispatcher delivers with retries.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;
  private dispatching = false;

  constructor(private readonly prisma: PrismaService) {
    const cfg = config();
    if (cfg.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: cfg.SMTP_HOST,
        port: cfg.SMTP_PORT,
        secure: cfg.SMTP_PORT === 465,
        auth: cfg.SMTP_USER ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS } : undefined,
      });
    }
  }

  queue(userId: string, channel: "email" | "sms" | "push", templateKey: string, payload: Record<string, unknown> = {}): void {
    void this.prisma.notification
      .create({ data: { userId, channel, templateKey, payload: payload as any } })
      .catch((e) => this.logger.error(`queue failed: ${e.message}`));
  }

  /** Direct SMS for recipients without an account yet (e.g. first OTP). */
  sendRawSms(phone: string, text: string): void {
    void this.deliverSms(phone, text).catch((e) => this.logger.error(`raw sms failed: ${e.message}`));
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async dispatch(): Promise<void> {
    if (this.dispatching || process.env.EMIT_OPENAPI === "1") return;
    this.dispatching = true;
    try {
      const batch = await this.prisma.notification.findMany({
        where: { status: "queued", attempts: { lt: 5 } },
        include: { user: true },
        take: 25,
        orderBy: { createdAt: "asc" },
      });
      for (const n of batch) {
        try {
          const tpl = renderTemplate(n.templateKey, n.user.locale, n.payload as Record<string, unknown>);
          if (n.channel === "email" && n.user.email) {
            await this.deliverEmail(n.user.email, tpl.subject ?? "Notification", tpl.body);
          } else if (n.channel === "sms" && n.user.phone) {
            await this.deliverSms(n.user.phone, tpl.body);
          } else {
            throw new Error(`no ${n.channel} destination for user ${n.userId}`);
          }
          await this.prisma.notification.update({
            where: { id: n.id },
            data: { status: "sent", sentAt: new Date(), attempts: { increment: 1 } },
          });
        } catch (e: any) {
          await this.prisma.notification.update({
            where: { id: n.id },
            data: { attempts: { increment: 1 }, error: e.message, status: n.attempts + 1 >= 5 ? "failed" : "queued" },
          });
        }
      }
    } finally {
      this.dispatching = false;
    }
  }

  private async deliverEmail(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[email:log] to=${to} subject="${subject}" body="${text}"`);
      return;
    }
    await this.transporter.sendMail({ from: config().MAIL_FROM, to, subject, text });
  }

  private async deliverSms(to: string, text: string): Promise<void> {
    const provider = config().SMS_PROVIDER;
    if (provider === "log") {
      this.logger.log(`[sms:log] to=${to} body="${text}"`);
      return;
    }
    // Plug a real SMS provider here (twilio, sms.ru, ...). Throwing keeps retries honest.
    throw new Error(`SMS provider '${provider}' not implemented`);
  }
}
