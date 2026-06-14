import { Injectable, Logger } from "@nestjs/common";
import { CreatePaymentIntentInput, PaymentGatewayAdapter, PaymentIntentResult, RefundResult } from "./gateway.interface";

/**
 * Placeholder for a regional PSP (e.g. YooKassa, PayTabs, Paymob).
 * In dev it auto-succeeds so the full booking flow is testable end-to-end;
 * replace the three methods with real API calls to go live.
 */
@Injectable()
export class RegionalGateway implements PaymentGatewayAdapter {
  readonly name = "regional";
  private readonly logger = new Logger(RegionalGateway.name);

  async createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const ref = `regional_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.logger.log(`[regional:dev] intent ${ref} for ${input.amount} ${input.currency} (${input.bookingCode})`);
    return {
      ref,
      clientPayload: {
        redirectUrl: `https://pay.example-regional.dev/checkout/${ref}`,
        devNote: "Placeholder gateway — POST /payments/webhooks/regional with {\"ref\":\"...\",\"status\":\"succeeded\"} to simulate completion",
      },
    };
  }

  async refund(gatewayRef: string): Promise<RefundResult> {
    this.logger.log(`[regional:dev] refund for ${gatewayRef}`);
    return { ref: `refund_${gatewayRef}` };
  }

  async parseWebhook(rawBody: Buffer) {
    try {
      const body = JSON.parse(rawBody.toString("utf8"));
      if (body.status === "succeeded" && body.ref) return { type: "payment_succeeded" as const, gatewayRef: String(body.ref) };
      if (body.status === "failed" && body.ref) return { type: "payment_failed" as const, gatewayRef: String(body.ref) };
    } catch {
      /* fall through */
    }
    return { type: "ignored" as const, gatewayRef: null };
  }
}
