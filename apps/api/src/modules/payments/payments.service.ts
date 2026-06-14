import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ErrorCode, PaymentGateway } from "@renting/shared";
import { AppException } from "../../common/app.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentGatewayAdapter } from "./gateway.interface";
import { RegionalGateway } from "./regional.gateway";
import { StripeGateway } from "./stripe.gateway";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly gateways: Record<string, PaymentGatewayAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    stripe: StripeGateway,
    regional: RegionalGateway,
  ) {
    this.gateways = { [stripe.name]: stripe, [regional.name]: regional };
  }

  gateway(name: string): PaymentGatewayAdapter {
    const gw = this.gateways[name];
    if (!gw) throw new AppException(ErrorCode.ValidationError, `Unknown gateway '${name}'`);
    return gw;
  }

  /** Create a charge intent for a booking (online payment). */
  async createIntent(bookingId: string, userId: string, gatewayName: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, payments: true },
    });
    if (!booking) throw AppException.notFound("Booking not found");
    if (booking.customerId !== userId) throw AppException.forbidden();
    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new AppException(ErrorCode.Conflict, "Booking is not payable in its current status", HttpStatus.CONFLICT);
    }
    const alreadyPaid = booking.payments.some((p) => p.type === "charge" && p.status === "captured");
    if (alreadyPaid) {
      throw new AppException(ErrorCode.Conflict, "Booking is already paid", HttpStatus.CONFLICT);
    }

    if (gatewayName === PaymentGateway.Cash) {
      const payment = await this.prisma.payment.create({
        data: {
          bookingId, gateway: "cash", type: "charge",
          amount: booking.totalAmount, currency: booking.currency, status: "pending",
        },
      });
      return { payment, clientPayload: { instructions: "Pay at pickup" } };
    }

    const gw = this.gateway(gatewayName);
    const intent = await gw.createIntent({
      bookingCode: booking.code,
      amount: Number(booking.totalAmount),
      currency: booking.currency,
      customerEmail: booking.customer.email,
    });
    const payment = await this.prisma.payment.create({
      data: {
        bookingId, gateway: gatewayName as any, gatewayRef: intent.ref, type: "charge",
        amount: booking.totalAmount, currency: booking.currency, status: "pending",
      },
    });
    return { payment, clientPayload: intent.clientPayload };
  }

  /** Webhook entry point — marks payments captured/failed. */
  async handleGatewayWebhook(gatewayName: string, rawBody: Buffer, signature: string | undefined) {
    const gw = this.gateway(gatewayName);
    const event = await gw.parseWebhook(rawBody, signature);
    if (event.type === "ignored" || !event.gatewayRef) return { received: true };

    const payment = await this.prisma.payment.findFirst({
      where: { gatewayRef: event.gatewayRef },
      include: { booking: true },
    });
    if (!payment) {
      this.logger.warn(`webhook for unknown payment ref ${event.gatewayRef}`);
      return { received: true };
    }
    if (event.type === "payment_succeeded" && payment.status !== "captured") {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "captured", paidAt: new Date() },
      });
      this.notifications.queue(payment.booking.customerId, "email", "booking_confirmed", {
        code: payment.booking.code, startAt: payment.booking.startAt.toISOString(),
      });
    } else if (event.type === "payment_failed") {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
    }
    return { received: true };
  }

  /** Refund the captured charge of a booking (admin or cancellation flow). */
  async refundBooking(bookingId: string, amount?: number) {
    const charge = await this.prisma.payment.findFirst({
      where: { bookingId, type: "charge", status: "captured" },
    });
    if (!charge) return null; // nothing captured — nothing to refund (cash/pending)
    const refundAmount = amount ?? Number(charge.amount);

    let ref = `manual_${Date.now()}`;
    if (charge.gateway !== "cash" && charge.gatewayRef) {
      try {
        const result = await this.gateway(charge.gateway).refund(charge.gatewayRef, refundAmount, charge.currency);
        ref = result.ref;
      } catch (e: any) {
        throw new AppException(ErrorCode.RefundFailed, `Gateway refund failed: ${e.message}`, HttpStatus.BAD_GATEWAY);
      }
    }
    return this.prisma.payment.create({
      data: {
        bookingId, gateway: charge.gateway, gatewayRef: ref, type: "refund",
        amount: refundAmount, currency: charge.currency, status: "refunded", paidAt: new Date(),
      },
    });
  }
}
