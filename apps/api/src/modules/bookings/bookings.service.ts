import { HttpStatus, Injectable } from "@nestjs/common";
import {
  BOOKING_TRANSITIONS, BookingStatus, ErrorCode, PricingUnit, WebhookEvent,
} from "@renting/shared";
import { AppException } from "../../common/app.exception";
import { AuditService } from "../../common/audit.service";
import { pageParams, paginated, sortParams } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentsService } from "../payments/payments.service";
import { PricingService } from "../pricing/pricing.service";
import { WebhooksService } from "../webhooks/webhooks.service";

export interface CreateBookingInput {
  listingId: string;
  pricingUnit: PricingUnit;
  startAt: Date;
  endAt: Date;
  withDriver?: boolean;
  driverId?: string;
  extras?: Array<{ extraId: string; quantity: number }>;
  couponCode?: string;
  currency?: string;
  paymentMethod: "online" | "on_pickup";
  pickupLocationId?: string;
  dropoffLocationId?: string;
  customerNotes?: string;
}

const BOOKING_INCLUDE = {
  listing: { select: { id: true, slug: true, title: true, media: { where: { isCover: true }, select: { url: true } } } },
  category: { select: { slug: true, name: true } },
  driver: { select: { id: true, photoUrl: true, languages: true, avgRating: true, user: { select: { firstName: true, lastName: true } } } },
  pickupLocation: true,
  dropoffLocation: true,
  extras: { include: { extra: { select: { name: true } } } },
  payments: true,
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  invoice: true,
  review: { select: { id: true, rating: true, status: true } },
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
    private readonly audit: AuditService,
  ) {}

  // ── creation ───────────────────────────────────────────

  async create(customerId: string, input: CreateBookingInput) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: input.listingId },
      include: { category: true },
    });
    if (!listing) throw AppException.notFound("Listing not found");
    const config = listing.category.config as any;

    // license gate (cars-style categories)
    if (config.requiresLicenseVerification && !input.withDriver) {
      const license = await this.prisma.driverLicense.findUnique({ where: { userId: customerId } });
      if (license?.status !== "approved") {
        throw new AppException(
          ErrorCode.LicenseRequired,
          "A verified driver's license is required for self-drive bookings",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // server-side authoritative pricing
    const quote = await this.pricing.quote({ ...input, userId: customerId });

    // driver availability
    if (input.withDriver && quote.driverId) {
      await this.assertDriverFree(quote.driverId, input.startAt, input.endAt);
    }

    const code = await this.nextCode("booking", "RNT");

    let booking;
    try {
      booking = await this.prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
          data: {
            code,
            categoryId: quote.categoryId,
            listingId: listing.id,
            customerId,
            status: "pending",
            startAt: input.startAt,
            endAt: input.endAt,
            pricingUnit: input.pricingUnit,
            unitQuantity: quote.unitQuantity,
            pickupLocationId: input.pickupLocationId,
            dropoffLocationId: input.dropoffLocationId,
            withDriver: input.withDriver ?? false,
            driverId: input.withDriver ? quote.driverId : null,
            baseAmount: quote.baseAmount,
            extrasAmount: quote.extrasAmount,
            driverAmount: quote.driverAmount,
            discountAmount: quote.discountAmount,
            taxAmount: quote.taxAmount,
            securityDepositAmount: quote.depositAmount,
            totalAmount: quote.totalAmount,
            currency: quote.currency,
            couponId: quote.couponId,
            paymentMethod: input.paymentMethod,
            customerNotes: input.customerNotes,
            meta: { quoteLines: quote.lines } as any,
            statusHistory: { create: { toStatus: "pending", actorId: customerId } },
          },
        });

        // The availability block IS the lock: the generated-column exclusion
        // constraint rejects concurrent overlapping inserts at commit time.
        await tx.availabilityBlock.create({
          data: { listingId: listing.id, startAt: input.startAt, endAt: input.endAt, reason: "booking", bookingId: created.id },
        });

        if (input.extras?.length) {
          const extras = await tx.extra.findMany({ where: { id: { in: input.extras.map((e) => e.extraId) } } });
          await tx.bookingExtra.createMany({
            data: input.extras.map((e) => {
              const extra = extras.find((x) => x.id === e.extraId)!;
              const line = quote.lines.find((l) => l.label === (extra.name as any).en);
              return {
                bookingId: created.id, extraId: e.extraId, quantity: e.quantity,
                unitPrice: extra.price, total: line?.amount ?? 0,
              };
            }),
          });
        }

        if (quote.couponId) {
          await tx.couponRedemption.create({
            data: { couponId: quote.couponId, userId: customerId, bookingId: created.id, amount: quote.discountAmount },
          });
          await tx.coupon.update({ where: { id: quote.couponId }, data: { usedCount: { increment: 1 } } });
        }

        return created;
      });
    } catch (e: any) {
      if (this.isOverlapViolation(e)) {
        throw new AppException(
          ErrorCode.ListingUnavailable,
          "The selected period is no longer available",
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }

    this.notifications.queue(customerId, "email", "booking_created", this.notifyVars(booking, listing));
    this.notifications.queue(customerId, "sms", "booking_created", this.notifyVars(booking, listing));
    this.webhooks.emit(WebhookEvent.BookingCreated, this.webhookPayload(booking));
    this.audit.log({ actorId: customerId, action: "booking.create", entityType: "booking", entityId: booking.id });

    return this.getForCustomer(booking.id, customerId);
  }

  // ── reads ──────────────────────────────────────────────

  async getForCustomer(id: string, customerId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!booking || booking.customerId !== customerId) throw AppException.notFound("Booking not found");
    return booking;
  }

  async listForCustomer(customerId: string, query: Record<string, any>) {
    const page = pageParams(query);
    const where: any = { customerId };
    if (query.status) where.status = String(query.status);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        include: {
          listing: { select: { slug: true, title: true, media: { where: { isCover: true }, select: { url: true } } } },
          category: { select: { slug: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  // ── customer modification / cancellation ──────────────

  async modify(id: string, customerId: string, changes: Partial<CreateBookingInput>) {
    const booking = await this.getForCustomer(id, customerId);
    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new AppException(ErrorCode.BookingNotModifiable, "Only pending/confirmed bookings can be modified", HttpStatus.CONFLICT);
    }
    const startAt = changes.startAt ?? booking.startAt;
    const endAt = changes.endAt ?? booking.endAt;

    const quote = await this.pricing.quote({
      listingId: booking.listingId,
      pricingUnit: (changes.pricingUnit ?? booking.pricingUnit) as PricingUnit,
      startAt, endAt,
      withDriver: changes.withDriver ?? booking.withDriver,
      driverId: changes.driverId ?? booking.driverId ?? undefined,
      extras: changes.extras,
      currency: booking.currency,
      userId: customerId,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        // replace the availability block — the exclusion constraint validates the new window
        await tx.availabilityBlock.deleteMany({ where: { bookingId: id } });
        await tx.availabilityBlock.create({
          data: { listingId: booking.listingId, startAt, endAt, reason: "booking", bookingId: id },
        });
        if (changes.extras) {
          await tx.bookingExtra.deleteMany({ where: { bookingId: id } });
        }
        await tx.booking.update({
          where: { id },
          data: {
            startAt, endAt,
            pricingUnit: (changes.pricingUnit ?? booking.pricingUnit) as any,
            unitQuantity: quote.unitQuantity,
            withDriver: changes.withDriver ?? booking.withDriver,
            driverId: (changes.withDriver ?? booking.withDriver) ? quote.driverId : null,
            baseAmount: quote.baseAmount, extrasAmount: quote.extrasAmount,
            driverAmount: quote.driverAmount, discountAmount: booking.discountAmount,
            taxAmount: quote.taxAmount, totalAmount: quote.totalAmount,
            meta: { quoteLines: quote.lines } as any,
          },
        });
      });
    } catch (e: any) {
      if (this.isOverlapViolation(e)) {
        throw new AppException(ErrorCode.ListingUnavailable, "The new period is not available", HttpStatus.CONFLICT);
      }
      throw e;
    }
    this.audit.log({ actorId: customerId, action: "booking.modify", entityType: "booking", entityId: id });
    return this.getForCustomer(id, customerId);
  }

  async cancelByCustomer(id: string, customerId: string, reason?: string) {
    const booking = await this.getForCustomer(id, customerId);
    return this.transition(id, BookingStatus.Cancelled, customerId, reason ?? "Cancelled by customer", {
      enforceCustomerPolicy: true, customerBooking: booking,
    });
  }

  // ── admin/status workflow ──────────────────────────────

  async listAdmin(query: Record<string, any>) {
    const page = pageParams(query);
    const where: any = {};
    if (query.status) where.status = String(query.status);
    if (query.categoryId) where.categoryId = String(query.categoryId);
    if (query.listingId) where.listingId = String(query.listingId);
    if (query.driverId) where.driverId = String(query.driverId);
    if (query.customerId) where.customerId = String(query.customerId);
    if (query.from) where.startAt = { gte: new Date(String(query.from)) };
    if (query.to) where.endAt = { lte: new Date(String(query.to)) };
    if (query.q) where.code = { contains: String(query.q), mode: "insensitive" };
    const orderBy = sortParams(query, ["createdAt", "startAt", "totalAmount"], { createdAt: "desc" });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, orderBy, skip: page.skip, take: page.take,
        include: {
          listing: { select: { slug: true, title: true } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          driver: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
          category: { select: { slug: true } },
          payments: true,
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  async getAdmin(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { ...BOOKING_INCLUDE, customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
    if (!booking) throw AppException.notFound("Booking not found");
    return booking;
  }

  /**
   * The guarded state machine. ALL status changes — customer cancellations,
   * admin approve/reject/start/complete — go through here.
   */
  async transition(
    id: string,
    to: BookingStatus,
    actorId: string,
    note?: string,
    opts: { enforceCustomerPolicy?: boolean; customerBooking?: any } = {},
  ) {
    const booking = opts.customerBooking ?? (await this.getAdmin(id));
    const from = booking.status as BookingStatus;
    if (!BOOKING_TRANSITIONS[from]?.includes(to)) {
      throw new AppException(
        ErrorCode.BookingInvalidTransition,
        `Cannot transition from '${from}' to '${to}'`,
        HttpStatus.CONFLICT,
      );
    }

    if (opts.enforceCustomerPolicy && to === BookingStatus.Cancelled) {
      const category = await this.prisma.rentalCategory.findUniqueOrThrow({ where: { id: booking.categoryId } });
      const freeWindowMin = (category.config as any).freeCancellationMinutes ?? 0;
      const minutesToStart = (new Date(booking.startAt).getTime() - Date.now()) / 60000;
      if (booking.status === "confirmed" && minutesToStart < freeWindowMin) {
        throw new AppException(
          ErrorCode.BookingNotModifiable,
          `Free cancellation closed ${freeWindowMin} minutes before start — contact support`,
          HttpStatus.CONFLICT,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.booking.update({
        where: { id },
        data: {
          status: to,
          ...(to === BookingStatus.Cancelled ? { cancelledAt: new Date(), cancelReason: note } : {}),
          statusHistory: { create: { fromStatus: from, toStatus: to, actorId, note } },
        },
      });
      // terminal states free the calendar
      if (to === BookingStatus.Cancelled || to === BookingStatus.Rejected) {
        await tx.availabilityBlock.deleteMany({ where: { bookingId: id } });
      }
      if (to === BookingStatus.Completed) {
        const number = await this.nextCodeTx(tx, "invoice", "INV");
        await tx.invoice.create({
          data: {
            bookingId: id,
            number,
            totals: {
              base: row.baseAmount, extras: row.extrasAmount, driver: row.driverAmount,
              discount: row.discountAmount, tax: row.taxAmount, total: row.totalAmount, currency: row.currency,
            } as any,
          },
        });
      }
      return row;
    });

    // refunds on cancellation of captured online payments
    if (to === BookingStatus.Cancelled || to === BookingStatus.Rejected) {
      await this.payments.refundBooking(id).catch(() => undefined);
    }

    const events: Partial<Record<BookingStatus, { webhook: WebhookEvent; template: string }>> = {
      [BookingStatus.Confirmed]: { webhook: WebhookEvent.BookingConfirmed, template: "booking_confirmed" },
      [BookingStatus.Cancelled]: { webhook: WebhookEvent.BookingCancelled, template: "booking_cancelled" },
      [BookingStatus.Rejected]: { webhook: WebhookEvent.BookingCancelled, template: "booking_cancelled" },
      [BookingStatus.Completed]: { webhook: WebhookEvent.BookingCompleted, template: "booking_completed" },
    };
    const event = events[to];
    if (event) {
      this.webhooks.emit(event.webhook, this.webhookPayload(updated));
      this.notifications.queue(updated.customerId, "email", event.template, {
        code: updated.code, startAt: updated.startAt.toISOString(), reason: note ?? "",
      });
    }
    if (to === BookingStatus.Confirmed && updated.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: updated.driverId } });
      if (driver) {
        this.notifications.queue(driver.userId, "email", "driver_assigned", {
          code: updated.code, startAt: updated.startAt.toISOString(),
        });
      }
    }
    this.audit.log({ actorId, action: `booking.${to}`, entityType: "booking", entityId: id, before: { status: from }, after: { status: to } });
    return this.getAdmin(id);
  }

  async assignDriver(id: string, driverId: string, actorId: string) {
    const booking = await this.getAdmin(id);
    if (!booking.withDriver) {
      throw new AppException(ErrorCode.DriverOptionNotSupported, "Booking is self-drive", HttpStatus.CONFLICT);
    }
    await this.assertDriverFree(driverId, booking.startAt, booking.endAt, id);
    await this.prisma.booking.update({ where: { id }, data: { driverId } });
    const driver = await this.prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
    this.notifications.queue(driver.userId, "email", "driver_assigned", {
      code: booking.code, startAt: booking.startAt.toISOString(),
    });
    this.audit.log({ actorId, action: "booking.assign-driver", entityType: "booking", entityId: id, after: { driverId } });
    return this.getAdmin(id);
  }

  // ── helpers ────────────────────────────────────────────

  private async assertDriverFree(driverId: string, startAt: Date, endAt: Date, excludeBookingId?: string) {
    const clash = await this.prisma.booking.count({
      where: {
        driverId,
        status: { in: ["pending", "confirmed", "ongoing"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    });
    const timeOff = await this.prisma.driverTimeOff.count({
      where: { driverId, startAt: { lt: endAt }, endAt: { gt: startAt } },
    });
    if (clash > 0 || timeOff > 0) {
      throw new AppException(ErrorCode.DriverNotAvailable, "Driver is not available for this period", HttpStatus.CONFLICT);
    }
  }

  private isOverlapViolation(e: any): boolean {
    const msg = String(e?.message ?? "");
    return msg.includes("availability_no_overlap") || msg.includes("23P01");
  }

  private async nextCode(counter: string, prefix: string): Promise<string> {
    return this.nextCodeTx(this.prisma, counter, prefix);
  }

  private async nextCodeTx(tx: any, counter: string, prefix: string): Promise<string> {
    const row = await tx.counter.upsert({
      where: { key: counter },
      update: { value: { increment: 1 } },
      create: { key: counter, value: 1001 },
    });
    return `${prefix}-${new Date().getFullYear()}-${String(row.value).padStart(5, "0")}`;
  }

  private notifyVars(booking: any, listing: any) {
    return {
      code: booking.code,
      listingTitle: (listing.title as any).en ?? listing.slug,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      total: String(booking.totalAmount),
      currency: booking.currency,
    };
  }

  private webhookPayload(booking: any) {
    return {
      id: booking.id,
      code: booking.code,
      status: booking.status,
      listingId: booking.listingId,
      customerId: booking.customerId,
      startAt: booking.startAt,
      endAt: booking.endAt,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
    };
  }
}
