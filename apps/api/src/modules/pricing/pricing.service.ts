import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorCode, PRICING_UNIT_MINUTES, PricingUnit, Quote } from "@renting/shared";
import { AppException } from "../../common/app.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";

export interface QuoteInput {
  listingId: string;
  pricingUnit: PricingUnit;
  startAt: Date;
  endAt: Date;
  withDriver?: boolean;
  driverId?: string;
  extras?: Array<{ extraId: string; quantity: number }>;
  couponCode?: string;
  currency?: string;
  userId?: string;
}

export interface QuoteResult extends Quote {
  listingId: string;
  categoryId: string;
  couponId: string | null;
  driverId: string | null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * The single pricing authority. The public /quote endpoint, booking creation,
 * and booking modification all call this — clients can never set prices.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async quote(input: QuoteInput): Promise<QuoteResult> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: input.listingId },
      include: {
        category: { include: { pricingUnits: true } },
        prices: true,
        priceRules: { where: { isActive: true } },
      },
    });
    if (!listing) throw AppException.notFound("Listing not found");
    if (!listing.category.isEnabled) throw AppException.categoryDisabled(listing.category.slug);
    if (listing.status !== "active") {
      throw new AppException(ErrorCode.ListingNotActive, "Listing is not bookable", HttpStatus.CONFLICT);
    }

    const category = listing.category;
    const config = category.config as any;

    // ── duration → unit quantity ──────────────────────────
    if (isNaN(+input.startAt) || isNaN(+input.endAt) || input.endAt <= input.startAt) {
      throw new AppException(ErrorCode.ValidationError, "endAt must be after startAt");
    }
    const minutes = (input.endAt.getTime() - input.startAt.getTime()) / 60000;
    if (minutes < config.minDurationMinutes || minutes > config.maxDurationMinutes) {
      throw new AppException(
        ErrorCode.DurationOutOfRange,
        `Duration must be between ${config.minDurationMinutes} and ${config.maxDurationMinutes} minutes`,
      );
    }
    if (input.startAt.getTime() < Date.now() + (config.leadTimeMinutes ?? 0) * 60000) {
      throw new AppException(ErrorCode.ValidationError, `Bookings need at least ${config.leadTimeMinutes} minutes lead time`);
    }

    const unitDef = category.pricingUnits.find((u) => u.unit === input.pricingUnit);
    if (!unitDef) {
      throw new AppException(
        ErrorCode.PricingUnitNotSupported,
        `Unit '${input.pricingUnit}' is not offered for '${category.slug}'`,
      );
    }
    const unitQuantity = Math.ceil(minutes / PRICING_UNIT_MINUTES[input.pricingUnit]);
    if (unitQuantity < unitDef.minQuantity || unitQuantity > unitDef.maxQuantity) {
      throw new AppException(
        ErrorCode.DurationOutOfRange,
        `Quantity must be ${unitDef.minQuantity}–${unitDef.maxQuantity} × ${input.pricingUnit}`,
      );
    }

    // ── currency & base price ─────────────────────────────
    const money = await this.settings.currencies();
    const currency = (input.currency ?? money.default).toUpperCase();
    if (!money.supported.includes(currency)) {
      throw new AppException(ErrorCode.CurrencyNotSupported, `Currency '${currency}' is not supported`);
    }
    const convert = (amountInDefault: number) =>
      round((amountInDefault * (money.rates[currency] ?? 1)) / (money.rates[money.default] ?? 1));

    const priceRow =
      listing.prices.find((p) => p.pricingUnit === input.pricingUnit && p.currency === currency) ??
      listing.prices.find((p) => p.pricingUnit === input.pricingUnit && p.currency === money.default);
    if (!priceRow) {
      throw new AppException(ErrorCode.PricingUnitNotSupported, `No price configured for unit '${input.pricingUnit}'`);
    }
    const unitPrice = priceRow.currency === currency ? Number(priceRow.basePrice) : convert(Number(priceRow.basePrice));
    let baseAmount = round(unitPrice * unitQuantity);

    // ── seasonal / price rules ────────────────────────────
    const rules = await this.prisma.priceRule.findMany({
      where: {
        isActive: true,
        OR: [{ scope: "listing", listingId: listing.id }, { scope: "category", categoryId: category.id }],
      },
      orderBy: { priority: "desc" },
    });
    let seasonalAdjustment = 0;
    const startDay = input.startAt;
    const matching = rules.find((r) => {
      const dateOk =
        (!r.startsOn || startDay >= r.startsOn) &&
        (!r.endsOn || startDay <= new Date(r.endsOn.getTime() + 86399_000));
      const dowOk = r.daysOfWeek.length === 0 || r.daysOfWeek.includes(startDay.getUTCDay());
      return dateOk && dowOk;
    });
    if (matching) {
      seasonalAdjustment =
        matching.adjustmentType === "percent"
          ? round((baseAmount * Number(matching.adjustmentValue)) / 100)
          : convert(Number(matching.adjustmentValue)) * unitQuantity;
      baseAmount = round(baseAmount + seasonalAdjustment);
    }

    // ── driver ────────────────────────────────────────────
    let driverAmount = 0;
    let driverId: string | null = null;
    if (input.withDriver) {
      if (!config.requiresDriverOption) {
        throw new AppException(ErrorCode.DriverOptionNotSupported, `'${category.slug}' does not offer a driver option`);
      }
      const driver = input.driverId
        ? await this.prisma.driver.findFirst({ where: { id: input.driverId, status: "active" } })
        : await this.prisma.driver.findFirst({ where: { status: "active" }, orderBy: { dailyRate: "asc" } });
      if (!driver) {
        throw new AppException(ErrorCode.DriverNotAvailable, "No driver available", HttpStatus.CONFLICT);
      }
      driverId = driver.id;
      const days = Math.ceil(minutes / 1440);
      driverAmount =
        input.pricingUnit === PricingUnit.Hour
          ? convert(Number(driver.hourlyRate)) * unitQuantity
          : convert(Number(driver.dailyRate)) * days;
      driverAmount = round(driverAmount);
    }

    // ── extras ────────────────────────────────────────────
    let extrasAmount = 0;
    const extraLines: Array<{ label: string; amount: number }> = [];
    if (input.extras?.length) {
      const ids = input.extras.map((e) => e.extraId);
      const extras = await this.prisma.extra.findMany({ where: { id: { in: ids }, categoryId: category.id, isActive: true } });
      for (const req of input.extras) {
        const extra = extras.find((e) => e.id === req.extraId);
        if (!extra) throw new AppException(ErrorCode.ValidationError, `Extra ${req.extraId} not available for this category`);
        const qty = Math.max(1, req.quantity);
        const price = convert(Number(extra.price));
        const amount = round(extra.priceType === "per_unit" ? price * unitQuantity * qty : price * qty);
        extrasAmount = round(extrasAmount + amount);
        extraLines.push({ label: (extra.name as any).en ?? extra.id, amount });
      }
    }

    // ── coupon ────────────────────────────────────────────
    let discountAmount = 0;
    let couponId: string | null = null;
    if (input.couponCode) {
      const coupon = await this.validateCoupon(input.couponCode, category.id, input.userId);
      const subtotal = baseAmount + driverAmount + extrasAmount;
      const minAmount = convert(Number(coupon.minAmount));
      if (subtotal < minAmount) {
        throw new AppException(ErrorCode.CouponInvalid, `Coupon requires a minimum of ${minAmount} ${currency}`);
      }
      discountAmount =
        coupon.type === "percent" ? round((subtotal * Number(coupon.value)) / 100) : convert(Number(coupon.value));
      if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, convert(Number(coupon.maxDiscount)));
      discountAmount = round(Math.min(discountAmount, subtotal));
      couponId = coupon.id;
    }

    // ── tax & deposit ─────────────────────────────────────
    const tax = await this.settings.tax();
    const taxable = Math.max(0, baseAmount + driverAmount + extrasAmount - discountAmount);
    const taxAmount = round((taxable * tax.percent) / 100);

    let depositAmount = 0;
    const dep = config.securityDeposit;
    if (dep?.required) {
      depositAmount = dep.type === "percent" ? round((baseAmount * dep.value) / 100) : convert(dep.value);
    }

    const totalAmount = round(taxable + taxAmount);

    const lines: Array<{ label: string; amount: number }> = [
      { label: `${unitQuantity} x ${input.pricingUnit} @ ${unitPrice}`, amount: round(unitPrice * unitQuantity) },
      ...(seasonalAdjustment !== 0 ? [{ label: "Seasonal adjustment", amount: seasonalAdjustment }] : []),
      ...(driverAmount > 0 ? [{ label: "Chauffeur service", amount: driverAmount }] : []),
      ...extraLines,
      ...(discountAmount > 0 ? [{ label: "Discount", amount: -discountAmount }] : []),
      { label: `${tax.label} ${tax.percent}%`, amount: taxAmount },
    ];

    return {
      listingId: listing.id,
      categoryId: category.id,
      currency,
      pricingUnit: input.pricingUnit,
      unitQuantity,
      unitPrice,
      baseAmount,
      seasonalAdjustment,
      driverAmount,
      extrasAmount,
      discountAmount,
      taxAmount,
      depositAmount,
      totalAmount,
      couponId,
      driverId,
      lines,
    };
  }

  async validateCoupon(code: string, categoryId?: string, userId?: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon || !coupon.isActive) {
      throw new AppException(ErrorCode.CouponInvalid, "Coupon not found", HttpStatus.NOT_FOUND);
    }
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
      throw new AppException(ErrorCode.CouponExpired, "Coupon is not valid right now");
    }
    if (coupon.categoryId && categoryId && coupon.categoryId !== categoryId) {
      throw new AppException(ErrorCode.CouponInvalid, "Coupon does not apply to this category");
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new AppException(ErrorCode.CouponUsageExceeded, "Coupon usage limit reached");
    }
    if (userId) {
      const used = await this.prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } });
      if (used >= coupon.perUserLimit) {
        throw new AppException(ErrorCode.CouponUsageExceeded, "You have already used this coupon");
      }
    }
    return coupon;
  }
}
