import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { BookingStatus, RoleName } from "@renting/shared";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { AuthUser, CurrentUser, Roles } from "../../common/decorators";
import { PaymentsService } from "../payments/payments.service";
import { BookingsService } from "./bookings.service";

class TransitionDto {
  @ApiProperty({ enum: BookingStatus }) @IsEnum(BookingStatus) status!: BookingStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

class AssignDriverDto {
  @ApiProperty() @IsUUID() driverId!: string;
}

class RefundDto {
  @ApiPropertyOptional({ description: "Defaults to the full captured amount" })
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
}

@ApiTags("Admin · Bookings")
@ApiBearerAuth()
@Roles(RoleName.Staff, RoleName.SuperAdmin)
@Controller("admin/bookings")
export class BookingsAdminController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "All bookings — filter by status, category, listing, driver, customer, period, code" })
  list(@Query() query: Record<string, any>) {
    return this.bookings.listAdmin(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Full booking detail incl. history and payments" })
  get(@Param("id") id: string) {
    return this.bookings.getAdmin(id);
  }

  @Post(":id/status")
  @ApiOperation({
    summary: "Move a booking through the workflow",
    description: "pending → confirmed/rejected; confirmed → ongoing/cancelled; ongoing → completed/cancelled. Invalid transitions are rejected; completion issues the invoice; cancellation auto-refunds captured payments and frees the calendar.",
  })
  transition(@Param("id") id: string, @Body() dto: TransitionDto, @CurrentUser() user: AuthUser) {
    return this.bookings.transition(id, dto.status, user.id, dto.note);
  }

  @Post(":id/assign-driver")
  @ApiOperation({ summary: "Assign/replace the chauffeur (availability checked)" })
  assignDriver(@Param("id") id: string, @Body() dto: AssignDriverDto, @CurrentUser() user: AuthUser) {
    return this.bookings.assignDriver(id, dto.driverId, user.id);
  }

  @Post(":id/refund")
  @ApiOperation({ summary: "Refund the captured payment (full or partial)" })
  async refund(@Param("id") id: string, @Body() dto: RefundDto, @CurrentUser() user: AuthUser) {
    const refund = await this.payments.refundBooking(id, dto.amount);
    return refund ?? { refunded: false, reason: "No captured payment on this booking" };
  }
}
