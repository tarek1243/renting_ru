import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WebhookEvent } from "@renting/shared";
import { CryptoService } from "../../common/crypto.service";
import { PrismaService } from "../../prisma/prisma.service";

const RETRY_DELAYS_MIN = [1, 5, 30, 120, 720];

/**
 * Outbound webhooks for integrators (the mobile backend-for-frontend, CRMs...).
 * Deliveries are persisted, signed (HMAC-SHA256 over the raw body, header
 * X-Renting-Signature), and retried with backoff until exhausted.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** Fan out an event to all subscribed endpoints. */
  emit(event: WebhookEvent, payload: Record<string, unknown>): void {
    void this.prisma.webhookEndpoint
      .findMany({ where: { isActive: true, events: { has: event } } })
      .then((endpoints) =>
        endpoints.length === 0
          ? undefined
          : this.prisma.webhookDelivery.createMany({
              data: endpoints.map((e) => ({
                endpointId: e.id,
                event,
                payload: { event, occurredAt: new Date().toISOString(), data: payload } as any,
                nextRetryAt: new Date(),
              })),
            }),
      )
      .catch((e) => this.logger.error(`emit failed: ${e.message}`));
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async deliver(): Promise<void> {
    if (this.dispatching || process.env.EMIT_OPENAPI === "1") return;
    this.dispatching = true;
    try {
      const due = await this.prisma.webhookDelivery.findMany({
        where: { status: "pending", nextRetryAt: { lte: new Date() } },
        include: { endpoint: true },
        take: 20,
        orderBy: { nextRetryAt: "asc" },
      });
      for (const delivery of due) {
        const body = JSON.stringify(delivery.payload);
        const signature = this.crypto.hmac(delivery.endpoint.secret, body);
        let responseStatus: number | null = null;
        let ok = false;
        try {
          const res = await fetch(delivery.endpoint.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-renting-signature": signature,
              "x-renting-event": delivery.event,
              "x-renting-delivery": delivery.id,
            },
            body,
            signal: AbortSignal.timeout(10_000),
          });
          responseStatus = res.status;
          ok = res.ok;
        } catch {
          ok = false;
        }
        const attempts = delivery.attempts + 1;
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: ok
            ? { status: "delivered", attempts, responseStatus }
            : attempts >= RETRY_DELAYS_MIN.length
              ? { status: "exhausted", attempts, responseStatus }
              : { attempts, responseStatus, nextRetryAt: new Date(Date.now() + RETRY_DELAYS_MIN[attempts] * 60_000) },
        });
      }
    } finally {
      this.dispatching = false;
    }
  }
}
