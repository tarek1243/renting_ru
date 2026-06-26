import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { ErrorCode, Gender, PricingUnit } from "@renting/shared";
import { Type } from "class-transformer";
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional,
  IsString, IsUUID, Length, Min, ValidateNested,
} from "class-validator";
import { AppException } from "../../common/app.exception";
import { CryptoService } from "../../common/crypto.service";
import { AuthUser, CurrentUser } from "../../common/decorators";
import { pageParams, paginated } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { BookingsService } from "../bookings/bookings.service";
import { ListingModerationService } from "../listings/listing-moderation.service";

class MyListingPriceDto {
  @ApiProperty({ enum: PricingUnit }) @IsEnum(PricingUnit) pricingUnit!: PricingUnit;
  @ApiPropertyOptional({ example: "USD", default: "USD" }) @IsOptional() @IsString() currency?: string;
  @ApiProperty({ example: 55 }) @IsNumber() @Min(1) basePrice!: number;
}

class CreateMyListingDto {
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty({ example: "My Toyota Camry 2023" }) @IsString() @IsNotEmpty() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty({ example: "Riyadh" }) @IsString() @IsNotEmpty() city!: string;
  @ApiProperty({ example: "Al Olaya" }) @IsString() @IsNotEmpty() neighborhood!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() withDriverAvailable?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() selfDriveAvailable?: boolean;
  @ApiProperty({ type: [MyListingPriceDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => MyListingPriceDto)
  prices!: MyListingPriceDto[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) photos?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

class UpdateMyListingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() neighborhood?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() withDriverAvailable?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() selfDriveAvailable?: boolean;
  @ApiPropertyOptional({ type: [MyListingPriceDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MyListingPriceDto)
  prices?: MyListingPriceDto[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) photos?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional({ example: "ru" }) @IsOptional() @Length(2, 5) locale?: string;
  @ApiPropertyOptional({ example: "EUR" }) @IsOptional() @Length(3, 3) preferredCurrency?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
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
    private readonly moderation: ListingModerationService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Current profile" })
  async profile(@CurrentUser() user: AuthUser) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true, avatarUrl: true,
        gender: true, ownerApprovalStatus: true, ownerRejectReason: true,
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
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true, gender: true,
        locale: true, preferredCurrency: true, ownerApprovalStatus: true,
      },
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

  // ── customer-owned listings (marketplace) ──────────────

  @Get("listings")
  @ApiOperation({ summary: "My listings (as owner)" })
  async myListings(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    const page = { skip: Number(query.page ?? 0) * Number(query.perPage ?? 20), take: Number(query.perPage ?? 20) };
    const where = { ownerId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        include: {
          category: { select: { slug: true, name: true } },
          prices: { select: { pricingUnit: true, currency: true, basePrice: true } },
          media: { where: { isCover: true }, select: { url: true }, take: 1 },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { items, total };
  }

  @Post("listings")
  @ApiOperation({ summary: "Create a listing (submitted as draft for admin review)" })
  async createMyListing(@CurrentUser() user: AuthUser, @Body() dto: CreateMyListingDto) {
    const category = await this.prisma.rentalCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw AppException.notFound("Category not found");
    const owner = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { gender: true, ownerApprovalStatus: true },
    });
    if (!owner?.gender) {
      throw new AppException(ErrorCode.ValidationError, "Gender is required before listing a vehicle", HttpStatus.BAD_REQUEST);
    }
    if (owner.ownerApprovalStatus !== "approved") {
      throw new AppException(ErrorCode.Forbidden, "Your owner account must be approved before publishing listings", HttpStatus.FORBIDDEN);
    }
    this.assertMarketplaceListing(dto.prices, dto.photos ?? [], dto.withDriverAvailable, dto.selfDriveAvailable);

    const base = dto.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    const suffix = Math.random().toString(36).slice(2, 7);
    const slug = `${base}-${suffix}`;
    const moderation = await this.moderation.analyze({
      title: { en: dto.title },
      description: dto.description ? { en: dto.description } : undefined,
      imageUrls: dto.photos ?? [],
      tags: dto.tags ?? [],
    });

    const listing = await this.prisma.listing.create({
      data: {
        categoryId: dto.categoryId,
        ownerId: user.id,
        slug,
        title: { en: dto.title },
        description: dto.description ? { en: dto.description } : undefined,
        status: moderation.status === "flagged" || moderation.status === "failed" ? "ai_flagged" : "pending_review",
        city: dto.city,
        neighborhood: dto.neighborhood,
        withDriverAvailable: dto.withDriverAvailable ?? true,
        selfDriveAvailable: dto.selfDriveAvailable ?? true,
        moderationStatus: moderation.status,
        moderationWarnings: moderation as any,
        attributes: { tags: dto.tags ?? [] },
        prices: { create: dto.prices.map((p) => ({ ...p, currency: p.currency ?? "USD" })) },
        media: dto.photos?.length
          ? { create: dto.photos.map((url, i) => ({ url, type: "image", sortOrder: i, isCover: i === 0 })) }
          : undefined,
      },
      include: { prices: true, media: true },
    });
    return listing;
  }

  @Patch("listings/:id")
  @ApiOperation({ summary: "Update my listing (only while draft)" })
  async updateMyListing(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateMyListingDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing || listing.ownerId !== user.id) throw AppException.notFound("Listing not found");
    if (!["draft", "pending_review", "ai_flagged", "rejected"].includes(listing.status)) {
      throw new AppException(ErrorCode.Conflict, "Only listings that are not active can be edited", HttpStatus.CONFLICT);
    }
    if (dto.prices || dto.photos) {
      this.assertMarketplaceListing(dto.prices, dto.photos ?? [], dto.withDriverAvailable, dto.selfDriveAvailable, true);
    }
    const nextTitle = dto.title ? { en: dto.title } : (listing.title as Record<string, string>);
    const nextDescription =
      dto.description !== undefined ? { en: dto.description } : (listing.description as Record<string, string> | null);
    const nextPhotos = dto.photos ?? [];
    const moderation = await this.moderation.analyze({
      title: nextTitle,
      description: nextDescription,
      imageUrls: nextPhotos,
      tags: dto.tags ?? [],
    });
    return this.prisma.$transaction(async (tx) => {
      if (dto.photos) {
        await tx.listingMedia.deleteMany({ where: { listingId: id } });
        if (dto.photos.length) {
          await tx.listingMedia.createMany({
            data: dto.photos.map((url, i) => ({ listingId: id, url, type: "image", sortOrder: i, isCover: i === 0 })),
          });
        }
      }
      if (dto.prices) {
        await tx.listingPrice.deleteMany({ where: { listingId: id } });
        await tx.listingPrice.createMany({
          data: dto.prices.map((p) => ({ listingId: id, ...p, currency: p.currency ?? "USD" })),
        });
      }
      return tx.listing.update({
        where: { id },
        data: {
          ...(dto.title ? { title: { en: dto.title } } : {}),
          ...(dto.description !== undefined ? { description: { en: dto.description } } : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
          ...(dto.neighborhood !== undefined ? { neighborhood: dto.neighborhood } : {}),
          ...(dto.withDriverAvailable !== undefined ? { withDriverAvailable: dto.withDriverAvailable } : {}),
          ...(dto.selfDriveAvailable !== undefined ? { selfDriveAvailable: dto.selfDriveAvailable } : {}),
          status: moderation.status === "flagged" || moderation.status === "failed" ? "ai_flagged" : "pending_review",
          moderationStatus: moderation.status,
          moderationWarnings: moderation as any,
          rejectReason: null,
          reviewedAt: null,
          reviewedById: null,
          ...(dto.tags ? { attributes: { tags: dto.tags } } : {}),
        },
        include: { prices: true, media: true },
      });
    });
  }

  @Delete("listings/:id")
  @ApiOperation({ summary: "Delete my listing (only while draft)" })
  async deleteMyListing(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing || listing.ownerId !== user.id) throw AppException.notFound("Listing not found");
    if (listing.status !== "draft") {
      throw new AppException(ErrorCode.Conflict, "Only draft listings can be deleted", HttpStatus.CONFLICT);
    }
    await this.prisma.listing.delete({ where: { id } });
    return { deleted: true };
  }

  private assertMarketplaceListing(
    prices: MyListingPriceDto[] | undefined,
    photos: string[],
    withDriverAvailable?: boolean,
    selfDriveAvailable?: boolean,
    partial = false,
  ) {
    if (!partial || prices) {
      const requiredUnits = [PricingUnit.Hour, PricingUnit.Day, PricingUnit.Week, PricingUnit.Month];
      const provided = new Set((prices ?? []).map((p) => p.pricingUnit));
      for (const unit of requiredUnits) {
        if (!provided.has(unit)) {
          throw new AppException(ErrorCode.ValidationError, `Price for ${unit} rental is required`, HttpStatus.BAD_REQUEST);
        }
      }
    }
    if (!partial && photos.length < 4) {
      throw new AppException(ErrorCode.ValidationError, "At least 4 clear vehicle photos are required", HttpStatus.BAD_REQUEST);
    }
    if (withDriverAvailable === false && selfDriveAvailable === false) {
      throw new AppException(ErrorCode.ValidationError, "Listing must be available with driver, without driver, or both", HttpStatus.BAD_REQUEST);
    }
  }
}
