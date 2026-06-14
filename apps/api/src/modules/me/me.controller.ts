import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { ErrorCode } from "@renting/shared";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from "class-validator";
import { AppException } from "../../common/app.exception";
import { CryptoService } from "../../common/crypto.service";
import { AuthUser, CurrentUser } from "../../common/decorators";
import { pageParams, paginated } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { BookingsService } from "../bookings/bookings.service";

class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional({ example: "ru" }) @IsOptional() @Length(2, 5) locale?: string;
  @ApiPropertyOptional({ example: "EUR" }) @IsOptional() @Length(3, 3) preferredCurrency?: string;
}

class UploadLicenseDto {
  @ApiProperty({ description: "License number — stored encrypted (AES-256-GCM)" })
  @IsString() @IsNotEmpty() number!: string;
  @ApiProperty({ example: "RU" }) @Length(2, 2) country!: string;
  @ApiProperty({ example: "2030-05-01" }) @IsDateString() expiresOn!: string;
  @ApiProperty() @IsString() frontImageUrl!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() backImageUrl?: string;
}

@ApiTags("Me")
@ApiBearerAuth()
@Controller("me")
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly bookings: BookingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Current profile" })
  async profile(@CurrentUser() user: AuthUser) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true, avatarUrl: true,
        locale: true, preferredCurrency: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true,
        roles: { select: { role: { select: { name: true } } } },
        license: { select: { status: true, country: true, expiresOn: true, rejectReason: true } },
      },
    });
    return { ...me, roles: me.roles.map((r) => r.role.name) };
  }

  @Patch()
  @ApiOperation({ summary: "Update profile" })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: dto,
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, locale: true, preferredCurrency: true },
    });
  }

  // ── driver's license verification ──────────────────────

  @Post("license")
  @ApiOperation({ summary: "Submit driver's license for verification (resets status to pending)" })
  async uploadLicense(@CurrentUser() user: AuthUser, @Body() dto: UploadLicenseDto) {
    const data = {
      numberEncrypted: this.crypto.encrypt(dto.number),
      country: dto.country.toUpperCase(),
      expiresOn: new Date(dto.expiresOn),
      frontImageUrl: dto.frontImageUrl,
      backImageUrl: dto.backImageUrl,
      status: "pending" as const,
      reviewedById: null,
      reviewedAt: null,
      rejectReason: null,
    };
    const license = await this.prisma.driverLicense.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    return { status: license.status, submittedAt: license.updatedAt };
  }

  @Get("license")
  @ApiOperation({ summary: "License verification status" })
  async license(@CurrentUser() user: AuthUser) {
    const license = await this.prisma.driverLicense.findUnique({
      where: { userId: user.id },
      select: { status: true, country: true, expiresOn: true, rejectReason: true, updatedAt: true },
    });
    return license ?? { status: "not_submitted" };
  }

  // ── bookings / invoices / reviews ──────────────────────

  @Get("bookings")
  @ApiOperation({ summary: "My bookings" })
  myBookings(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.bookings.listForCustomer(user.id, query);
  }

  @Get("invoices")
  @ApiOperation({ summary: "My invoices" })
  async invoices(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where = { booking: { customerId: user.id } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where, orderBy: { issuedAt: "desc" }, skip: page.skip, take: page.take,
        include: { booking: { select: { code: true, listing: { select: { title: true } } } } },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Get("reviews")
  @ApiOperation({ summary: "My reviews" })
  async myReviews(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where = { customerId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        include: { listing: { select: { slug: true, title: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  // ── favorites ──────────────────────────────────────────

  @Get("favorites")
  @ApiOperation({ summary: "My favorite listings" })
  async favorites(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where = { userId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        include: {
          listing: {
            select: {
              id: true, slug: true, title: true, avgRating: true, attributes: true,
              category: { select: { slug: true, isEnabled: true } },
              media: { where: { isCover: true }, select: { url: true } },
              prices: { select: { pricingUnit: true, currency: true, basePrice: true } },
            },
          },
        },
      }),
      this.prisma.favorite.count({ where }),
    ]);
    // favorites in disabled categories stay stored but are filtered from the response
    return paginated(items.filter((f) => f.listing.category.isEnabled), total, page);
  }

  @Post("favorites/:listingId")
  @ApiOperation({ summary: "Add a favorite" })
  async addFavorite(@CurrentUser() user: AuthUser, @Param("listingId") listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw AppException.notFound("Listing not found");
    await this.prisma.favorite.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      update: {},
      create: { userId: user.id, listingId },
    });
    return { favorited: true };
  }

  @Delete("favorites/:listingId")
  @ApiOperation({ summary: "Remove a favorite" })
  async removeFavorite(@CurrentUser() user: AuthUser, @Param("listingId") listingId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId: user.id, listingId } });
    return { favorited: false };
  }

  // ── notifications ──────────────────────────────────────

  @Get("notifications")
  @ApiOperation({ summary: "My notification feed" })
  async notifications(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where = { userId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        select: { id: true, channel: true, templateKey: true, payload: true, status: true, readAt: true, createdAt: true },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Patch("notifications/:id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  async markRead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
    if (result.count === 0) throw AppException.notFound("Notification not found");
    return { read: true };
  }
}
