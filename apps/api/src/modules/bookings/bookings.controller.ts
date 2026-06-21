import { Body, Controller, Get, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from "@nestjs/swagger";
import { ErrorCode, PaymentMethod, PricingUnit } from "@renting/shared";
import { Type } from "class-transformer";
import { randomUUID } from "crypto";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional,
  IsString, IsUUID, Max, MaxLength, Min, ValidateNested,
} from "class-validator";
import { AppException } from "../../common/app.exception";
import { AuthUser, CurrentUser } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { BookingsService } from "./bookings.service";

class BookingExtraDto {
  @ApiProperty() @IsUUID() extraId!: string;
  @ApiProperty({ default: 1 }) @IsInt() @Min(1) quantity!: number;
}

class CreateBookingDto {
  @ApiProperty() @IsUUID() listingId!: string;
  @ApiProperty({ enum: PricingUnit }) @IsEnum(PricingUnit) pricingUnit!: PricingUnit;
  @ApiProperty({ example: "2026-07-01T10:00:00Z" }) @IsDateString() startAt!: string;
  @ApiProperty({ example: "2026-07-04T10:00:00Z" }) @IsDateString() endAt!: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() withDriver?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() driverId?: string;
  @ApiPropertyOptional({ type: [BookingExtraDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BookingExtraDto)
  extras?: BookingExtraDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() couponCode?: string;
  @ApiPropertyOptional({ example: "USD" }) @IsOptional() @IsString() currency?: string;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsUUID() pickupLocationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() dropoffLocationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) pickupAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) dropoffAddress?: string;
}

class CreateRecurringBookingDto extends CreateBookingDto {
  @ApiProperty({ type: [Number], example: [0, 1, 2, 3, 4], description: "0=Sunday through 6=Saturday" })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  daysOfWeek!: number[];

  @ApiProperty({ example: "2026-12-17" }) @IsDateString() repeatUntil!: string;

  @ApiPropertyOptional({ description: "Browser Date.getTimezoneOffset() value" })
  @IsOptional() @IsInt() @Min(-840) @Max(840) timezoneOffsetMinutes?: number;
}

class ModifyBookingDto extends PartialType(CreateBookingDto) {}

class CancelBookingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

class PayBookingDto {
  @ApiProperty({ enum: ["stripe", "regional", "cash"] }) @IsString() gateway!: string;
}

class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating!: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 }) @IsOptional() @IsInt() @Min(1) @Max(5) driverRating?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

@ApiTags("Bookings")
@ApiBearerAuth()
@Controller("bookings")
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a booking",
    description: "Availability is locked transactionally; price is recomputed server-side from the same quote engine.",
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user.id, {
      ...dto,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });
  }

  @Post("recurring")
  @ApiOperation({ summary: "Schedule separate bookings on selected weekdays" })
  async createRecurring(@CurrentUser() user: AuthUser, @Body() dto: CreateRecurringBookingDto) {
    const firstStart = new Date(dto.startAt);
    const firstEnd = new Date(dto.endAt);
    const durationMs = firstEnd.getTime() - firstStart.getTime();
    if (durationMs <= 0) {
      throw new AppException(ErrorCode.ValidationError, "End time must be after start time", HttpStatus.BAD_REQUEST);
    }

    const until = new Date(dto.repeatUntil);
    until.setUTCHours(23, 59, 59, 999);
    const days = new Set(dto.daysOfWeek);
    const timezoneOffsetMs = (dto.timezoneOffsetMinutes ?? 0) * 60_000;
    const occurrences: Date[] = [];
    const cursor = new Date(firstStart);
    while (cursor <= until && occurrences.length <= 90) {
      const localWeekday = new Date(cursor.getTime() - timezoneOffsetMs).getUTCDay();
      if (days.has(localWeekday)) occurrences.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (!occurrences.length) {
      throw new AppException(ErrorCode.ValidationError, "No trips fall in this date range", HttpStatus.BAD_REQUEST);
    }
    if (occurrences.length > 90) {
      throw new AppException(ErrorCode.ValidationError, "A recurring series is limited to 90 trips", HttpStatus.BAD_REQUEST);
    }

    const recurringSeriesId = randomUUID();
    const base: any = { ...dto, recurringSeriesId, deferCreatedEvents: true };
    delete base.daysOfWeek;
    delete base.repeatUntil;
    delete base.timezoneOffsetMinutes;
    const bookings: any[] = [];
    try {
      for (const startAt of occurrences) {
        bookings.push(await this.bookings.create(user.id, {
          ...base,
          startAt,
          endAt: new Date(startAt.getTime() + durationMs),
        }));
      }
    } catch (error) {
      // Do not leave half a school/work schedule behind if a later date is busy.
      const created = await this.prisma.booking.findMany({
        where: { recurringSeriesId }, select: { couponId: true },
      });
      const couponUses = new Map<string, number>();
      for (const booking of created) {
        if (booking.couponId) couponUses.set(booking.couponId, (couponUses.get(booking.couponId) ?? 0) + 1);
      }
      await this.prisma.$transaction([
        this.prisma.booking.deleteMany({ where: { recurringSeriesId } }),
        ...[...couponUses].map(([id, count]) =>
          this.prisma.coupon.update({ where: { id }, data: { usedCount: { decrement: count } } }),
        ),
      ]);
      throw error;
    }
    for (const booking of bookings) this.bookings.publishCreated(booking, user.id);
    return { recurringSeriesId, count: bookings.length, bookings };
  }

  @Get(":id")
  @ApiOperation({ summary: "Booking detail (own bookings only)" })
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bookings.getForCustomer(id, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Modify dates/driver/extras while pending or confirmed — re-quoted server-side" })
  modify(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ModifyBookingDto) {
    return this.bookings.modify(id, user.id, {
      ...dto,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
    });
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel own booking (free-cancellation window enforced)" })
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CancelBookingDto) {
    return this.bookings.cancelByCustomer(id, user.id, dto.reason);
  }

  @Post(":id/payments")
  @ApiOperation({ summary: "Start payment: stripe → clientSecret, regional → redirect URL, cash → registered for pickup" })
  pay(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PayBookingDto) {
    return this.payments.createIntent(id, user.id, dto.gateway);
  }

  @Get(":id/invoice")
  @ApiOperation({ summary: "Invoice for a completed booking" })
  async invoice(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const booking = await this.bookings.getForCustomer(id, user.id);
    if (!booking.invoice) throw AppException.notFound("Invoice not issued yet");
    return booking.invoice;
  }

  @Post(":id/review")
  @ApiOperation({ summary: "Review a completed booking (one per booking; moderated before publishing)" })
  async review(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateReviewDto) {
    const booking = await this.bookings.getForCustomer(id, user.id);
    if (booking.status !== "completed") {
      throw new AppException(ErrorCode.Conflict, "Only completed bookings can be reviewed", HttpStatus.CONFLICT);
    }
    if (booking.review) {
      throw new AppException(ErrorCode.Conflict, "Booking already reviewed", HttpStatus.CONFLICT);
    }
    return this.prisma.review.create({
      data: {
        bookingId: id,
        listingId: booking.listingId,
        customerId: user.id,
        driverId: booking.driverId,
        rating: dto.rating,
        driverRating: booking.withDriver ? dto.driverRating : null,
        comment: dto.comment,
      },
    });
  }
}
