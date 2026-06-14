export interface CreatePaymentIntentInput {
  bookingCode: string;
  amount: number; // major units
  currency: string;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  /** Gateway reference stored on the payment row (e.g. Stripe PaymentIntent id). */
  ref: string;
  /** What the client needs to complete payment (clientSecret / redirect URL). */
  clientPayload: Record<string, unknown>;
}

export interface RefundResult {
  ref: string;
}

/**
 * Payment gateway abstraction. Adding a regional PSP = implementing this
 * interface and registering it in PaymentsService.gateways.
 */
export interface PaymentGatewayAdapter {
  readonly name: string;
  createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  refund(gatewayRef: string, amount: number, currency: string): Promise<RefundResult>;
  /** Verify an incoming webhook and normalize it. */
  parseWebhook(rawBody: Buffer, signatureHeader: string | undefined): Promise<{
    type: "payment_succeeded" | "payment_failed" | "ignored";
    gatewayRef: string | null;
  }>;
}
