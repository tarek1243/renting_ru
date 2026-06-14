import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags, PartialType } from "@nestjs/swagger";
import { ErrorCode, RoleName } from "@renting/shared";
import { Type } from "class-transformer";
import {
  IsArray, IsDateString, IsEmail, IsInt, IsNumber, IsObject, IsOptional,
  IsString, IsUUID, Matches, Max, Min, ValidateNested,
} from "class-validator";
import { AppException } from "../../common/app.exception";
import { AuditService } from "../../common/audit.service";
import { AuthUser, CurrentUser, Public, Roles } from "../../common/decorators";
import { pageParams, paginated } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { DriversService } from "./drivers.service";

class ScheduleSlotDto {
  @ApiProperty({ minimum: 0, maximum: 6 }) @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @ApiProperty({ example: "08:00" }) @Matches(/^\d{2}:\d{2}$/) startTime!: string;
  @ApiProperty({ example: "20:00" }) @Matches(/^\d{2}:\d{2}$/) endTime!: string;
}

class TimeOffDto {
  @ApiProperty() @IsDateString() startAt!: string;
  @ApiProperty() @IsDateString() endAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

class CreateDriverDto {
  @ApiProperty({ description: "Existing user id, or omit and provide email+firstName to create one" })
  @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() bio?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional({ type: [String], example: ["en", "ru"] }) @IsOptional() @IsArray() languages?: string[];
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) yearsExperience?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) hourlyRate?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) dailyRate?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPercent?: number;
}

class UpdateDriverDto extends PartialType(CreateDriverDto) {}

@ApiTags("Drivers")
@Controller()
export class DriversController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drivers: DriversService,
    private readonly audit: AuditService,
  ) {}

  // ── public ─────────────────────────────────────────────

  @Public()
  @Get("drivers/available")
  @ApiOperation({ summary: "Active chauffeurs free in a period (for the 'with driver' flow)" })
  @ApiQuery({ name: "start", required: true })
  @ApiQuery({ name: "end", required: true })
  available(@Query("start") start: string, @Query("end") end: string) {
    return this.drivers.availableBetween(new Date(start), new Date(end));
  }

  @Public()
  @Get("drivers/:id")
  @ApiOperation({ summary: "Public chauffeur profile" })
  async publicProfile(@Param("id") id: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id, status: "active" },
      select: {
        id: true, bio: true, photoUrl: true, languages: true, yearsExperience: true,
        hourlyRate: true, dailyRate: true, avgRating: true, ratingsCount: true,
        user: { select: { firstName: true } },
      },
    });
    if (!driver) throw AppException.notFound("Driver not found");
    return driver;
  }

  // ── driver portal ──────────────────────────────────────

  @Roles(RoleName.Driver)
  @ApiBearerAuth()
  @Get("driver/assignments")
  @ApiOperation({ summary: "My assignments (driver portal)" })
  async assignments(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    const driver = await this.drivers.byUserId(user.id);
    const page = pageParams(query);
    const where: any = { driverId: driver.id };
    if (query.status) where.status = String(query.status);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, orderBy: { startAt: "desc" }, skip: page.skip, take: page.take,
        select: {
          id: true, code: true, status: true, startAt: true, endAt: true, driverAmount: true, currency: true,
          listing: { select: { title: true, slug: true } },
          pickupLocation: true, dropoffLocation: true,
          customer: { select: { firstName: true, phone: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Roles(RoleName.Driver)
  @ApiBearerAuth()
  @Get("driver/earnings")
  @ApiOperation({ summary: "Earnings summary (completed assignments, commission applied)" })
  async earnings(@CurrentUser() user: AuthUser) {
    const driver = await this.drivers.byUserId(user.id);
    const completed = await this.prisma.booking.findMany({
      where: { driverId: driver.id, status: "completed" },
      select: { driverAmount: true, currency: true, endAt: true },
    });
    const gross = completed.reduce((sum, b) => sum + Number(b.driverAmount), 0);
    const commission = (gross * Number(driver.commissionPercent)) / 100;
    return {
      completedJobs: completed.length,
      gross,
      platformCommissionPercent: Number(driver.commissionPercent),
      net: Math.round((gross - commission) * 100) / 100,
    };
  }

  @Roles(RoleName.Driver)
  @ApiBearerAuth()
  @Get("driver/schedule")
  @ApiOperation({ summary: "My weekly schedule" })
  async mySchedule(@CurrentUser() user: AuthUser) {
    const driver = await this.drivers.byUserId(user.id);
    return this.prisma.driverSchedule.findMany({ where: { driverId: driver.id }, orderBy: { dayOfWeek: "asc" } });
  }

  @Roles(RoleName.Driver)
  @ApiBearerAuth()
  @Put("driver/schedule")
  @ApiOperation({ summary: "Replace my weekly schedule" })
  async setSchedule(@CurrentUser() user: AuthUser, @Body() dto: { slots: ScheduleSlotDto[] }) {
    const driver = await this.drivers.byUserId(user.id);
    return this.drivers.replaceSchedule(driver.id, dto.slots ?? []);
  }

  @Roles(RoleName.Driver)
  @ApiBearerAuth()
  @Post("driver/time-off")
  @ApiOperation({ summary: "Request time off" })
  async timeOff(@CurrentUser() user: AuthUser, @Body() dto: TimeOffDto) {
    const driver = await this.drivers.byUserId(user.id);
    return this.prisma.driverTimeOff.create({
      data: { driverId: driver.id, startAt: new Date(dto.startAt), endAt: new Date(dto.endAt), reason: dto.reason },
    });
  }

  // ── admin ──────────────────────────────────────────────

  @Roles(RoleName.Staff, RoleName.SuperAdmin)
  @ApiBearerAuth()
  @Get("admin/drivers")
  @ApiOperation({ summary: "All drivers" })
  async adminList(@Query() query: Record<string, any>) {
    const page = pageParams(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        skip: page.skip, take: page.take, orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } }, schedules: true },
      }),
      this.prisma.driver.count(),
    ]);
    return paginated(items, total, page);
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin)
  @ApiBearerAuth()
  @Post("admin/drivers")
  @ApiOperation({ summary: "Create a driver (links or creates the user account)" })
  async adminCreate(@Body() dto: CreateDriverDto, @CurrentUser() user: AuthUser) {
    const driver = await this.drivers.create(dto);
    this.audit.log({ actorId: user.id, action: "driver.create", entityType: "driver", entityId: driver.id });
    return driver;
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin)
  @ApiBearerAuth()
  @Patch("admin/drivers/:id")
  @ApiOperation({ summary: "Update driver profile/rates/commission/status" })
  async adminUpdate(@Param("id") id: string, @Body() dto: UpdateDriverDto & { status?: "active" | "inactive" }, @CurrentUser() user: AuthUser) {
    const driver = await this.prisma.driver.update({
      where: { id },
      data: {
        bio: dto.bio, photoUrl: dto.photoUrl, languages: dto.languages,
        yearsExperience: dto.yearsExperience, hourlyRate: dto.hourlyRate, dailyRate: dto.dailyRate,
        commissionPercent: dto.commissionPercent, status: dto.status,
      },
    });
    this.audit.log({ actorId: user.id, action: "driver.update", entityType: "driver", entityId: id, after: driver });
    return driver;
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin)
  @ApiBearerAuth()
  @Put("admin/drivers/:id/schedule")
  @ApiOperation({ summary: "Replace a driver's weekly schedule" })
  adminSchedule(@Param("id") id: string, @Body() dto: { slots: ScheduleSlotDto[] }) {
    return this.drivers.replaceSchedule(id, dto.slots ?? []);
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin)
  @ApiBearerAuth()
  @Delete("admin/drivers/:id")
  @ApiOperation({ summary: "Deactivate a driver (kept for history)" })
  async adminRemove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const active = await this.prisma.booking.count({
      where: { driverId: id, status: { in: ["pending", "confirmed", "ongoing"] } },
    });
    if (active > 0) {
      throw new AppException(ErrorCode.Conflict, `Driver has ${active} active assignments`, HttpStatus.CONFLICT);
    }
    await this.prisma.driver.update({ where: { id }, data: { status: "inactive" } });
    this.audit.log({ actorId: user.id, action: "driver.deactivate", entityType: "driver", entityId: id });
    return { deactivated: true };
  }
}
