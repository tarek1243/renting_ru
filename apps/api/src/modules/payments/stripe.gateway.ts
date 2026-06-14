import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorCode } from "@renting/shared";
import Stripe from "stripe";
import { AppException } from "../../common/app.exception";
import { config } from "../../config/config";
import { CreatePaymentIntentInput, PaymentGatewayAdapter, PaymentIntentResult, RefundResult } from "./gateway.interface";

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND"]);
const toMinor = (amount: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);

@Injectable()
export class StripeGateway implements PaymentGatewayAdapter {
  readonly name = "stripe";
  private client: Stripe | null = null;

  private stripe(): Stripe {
    if (!this.client) {
      const key = config().STRIPE_SECRET_KEY;
      if (!key) {
        throw new AppException(ErrorCode.PaymentFailed, "Stripe is not configured on this deployment", HttpStatus.NOT_IMPLEMENTED);
      }
      this.client = new Stripe(key);
    }
    return this.client;
  }

  async createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const intent = await this.stripe().paymentIntents.create({
      amount: toMinor(input.amount, input.currency),
      currency: input.currency.toLowerCase(),
      receipt_email: input.customerEmail ?? undefined,
      metadata: { bookingCode: input.bookingCode, ...input.metadata },
      automatic_payment_methods: { enabled: true },
    });
    return { ref: intent.id, clientPayload: { clientSecret: intent.client_secret, publishableHint: "use Stripe.js" } };
  }

  async refund(gatewayRef: string, amount: number, currency: string): Promise<RefundResult> {
    const refund = await this.stripe().refunds.create({
      payment_intent: gatewayRef,
      amount: toMinor(amount, currency),
    });
    return { ref: refund.id };
  }

  async parseWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
    const secret = config().STRIPE_WEBHOOK_SECRET;
    if (!secret || !signatureHeader) {
      throw new AppException(ErrorCode.Unauthorized, "Missing Stripe webhook signature", HttpStatus.UNAUTHORIZED);
    }
    let event: Stripe.Event;
    try {
      event = this.stripe().webhooks.constructEvent(rawBody, signatureHeader, secret);
    } catch {
      throw new AppException(ErrorCode.Unauthorized, "Invalid Stripe webhook signature", HttpStatus.UNAUTHORIZED);
    }
    if (event.type === "payment_intent.succeeded") {
      return { type: "payment_succeeded" as const, gatewayRef: (event.data.object as Stripe.PaymentIntent).id };
    }
    if (event.type === "payment_intent.payment_failed") {
      return { type: "payment_failed" as const, gatewayRef: (event.data.object as Stripe.PaymentIntent).id };
    }
    return { type: "ignored" as const, gatewayRef: null };
  }
}
