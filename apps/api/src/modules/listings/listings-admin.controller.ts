import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { AvailabilityReason, ErrorCode, ListingStatus, PricingUnit, RoleName } from "@renting/shared";
import { Type } from "class-transformer";
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsNumber, IsObject, IsOptional,
  IsString, IsUUID, Matches, Min, ValidateNested,
} from "class-validator";
import { AppException } from "../../common/app.exception";
import { AuditService } from "../../common/audit.service";
import { AuthUser, CurrentUser, Roles } from "../../common/decorators";
import { pageParams, paginated, sortParams } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { CategoriesService } from "../categories/categories.service";
import { ListingModerationService } from "./listing-moderation.service";
import { NotificationsService } from "../notifications/notifications.service";

class ListingPriceDto {
  @ApiProperty({ enum: PricingUnit }) @IsEnum(PricingUnit) pricingUnit!: PricingUnit;
  @ApiProperty({ example: "USD" }) @IsString() currency!: string;
  @ApiProperty({ example: 55 }) @IsNumber() @Min(0) basePrice!: number;
}

class MediaItemDto {
  @ApiProperty() @IsString() url!: string;
  @ApiPropertyOptional({ default: "image" }) @IsOptional() @IsIn(["image", "video"]) type?: "image" | "video";
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() sortOrder?: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isCover?: boolean;
}

class CreateListingDto {
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty({ example: "toyota-camry-2023" }) @Matches(/^[a-z0-9-]+$/) slug!: string;
  @ApiProperty({ example: { en: "Toyota Camry 2023" } }) @IsObject() title!: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsObject() description?: Record<string, string>;
  @ApiPropertyOptional({ enum: ListingStatus, default: ListingStatus.Draft })
  @IsOptional() @IsEnum(ListingStatus) status?: ListingStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lng?: number;
  @ApiProperty({ description: "Attribute values matching the category schema" })
  @IsObject() attributes!: Record<string, unknown>;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isFeatured?: boolean;
  @ApiPropertyOptional({ type: [ListingPriceDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ListingPriceDto)
  prices?: ListingPriceDto[];
  @ApiPropertyOptional({ type: [MediaItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaItemDto)
  media?: MediaItemDto[];
}

class UpdateListingDto extends PartialType(CreateListingDto) {}

class AvailabilityBlockDto {
  @ApiProperty() @IsDateString() startAt!: string;
  @ApiProperty() @IsDateString() endAt!: string;
  @ApiProperty({ enum: ["maintenance", "manual"] }) @IsIn(["maintenance", "manual"]) reason!: "maintenance" | "manual";
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

class PriceRuleDto {
  @ApiProperty({ enum: ["listing", "category"] }) @IsIn(["listing", "category"]) scope!: "listing" | "category";
  @ApiPropertyOptional() @IsOptional() @IsUUID() listingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsOn?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsOn?: string;
  @ApiPropertyOptional({ type: [Number], description: "0=Sun..6=Sat; empty = all days" })
  @IsOptional() @IsArray() daysOfWeek?: number[];
  @ApiProperty({ enum: ["percent", "fixed"] }) @IsIn(["percent", "fixed"]) adjustmentType!: "percent" | "fixed";
  @ApiProperty() @IsNumber() adjustmentValue!: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() priority?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

class ListingDecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

@ApiTags("Admin · Listings")
@ApiBearerAuth()
@Roles(RoleName.Staff, RoleName.SuperAdmin)
@Controller("admin")
export class ListingsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
    private readonly moderation: ListingModerationService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get("listings")
  @ApiOperation({ summary: "All listings across categories (any status)" })
  async list(@Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where: any = {};
    if (query.categoryId) where.categoryId = String(query.categoryId);
    if (query.status) where.status = String(query.status);
    if (query.moderationStatus) where.moderationStatus = String(query.moderationStatus);
    if (query.q) where.slug = { contains: String(query.q), mode: "insensitive" };
    const orderBy = sortParams(query, ["createdAt", "avgRating", "viewCount"], { createdAt: "desc" });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where, orderBy, skip: page.skip, take: page.take,
        include: {
          category: { select: { slug: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, gender: true, ownerApprovalStatus: true } },
          prices: true, media: true, location: true,
        },
      }),
      this.prisma.listing.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Get("listings/:id")
  @ApiOperation({ summary: "Listing detail incl. blocks and rules" })
  async get(@Param("id") id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        category: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, gender: true, ownerApprovalStatus: true } },
        prices: true, media: { orderBy: { sortOrder: "asc" } }, location: true,
        priceRules: true, availabilityBlocks: { orderBy: { startAt: "asc" }, take: 100 },
      },
    });
    if (!listing) throw AppException.notFound("Listing not found");
    return listing;
  }

  @Post("listings")
  @ApiOperation({ summary: "Create a listing (attributes validated against the category schema)" })
  async create(@Body() dto: CreateListingDto, @CurrentUser() user: AuthUser) {
    const category = await this.prisma.rentalCategory.findUnique({
      where: { id: dto.categoryId },
      include: { attributes: true },
    });
    if (!category) throw AppException.notFound("Category not found");
    const attributes = this.categories.validateAttributes(category.attributes as any, dto.attributes);
    const listing = await this.prisma.listing.create({
      data: {
        categoryId: dto.categoryId, slug: dto.slug, title: dto.title, description: dto.description,
        status: dto.status ?? "draft", locationId: dto.locationId, lat: dto.lat, lng: dto.lng,
        attributes: attributes as never, isFeatured: dto.isFeatured ?? false,
        prices: dto.prices ? { create: dto.prices } : undefined,
        media: dto.media ? { create: dto.media } : undefined,
      },
      include: { prices: true, media: true },
    });
    this.audit.log({ actorId: user.id, action: "listing.create", entityType: "listing", entityId: listing.id, after: listing });
    return listing;
  }

  @Get("listings-review")
  @ApiOperation({ summary: "Moderation review queue for pending and AI-flagged listings" })
  async reviewQueue(@Query() query: Record<string, any>) {
    const page = pageParams(query);
    const status = query.status ? [String(query.status)] : ["pending_review", "ai_flagged"];
    const where: any = { status: { in: status } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: page.skip,
        take: page.take,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, gender: true, ownerApprovalStatus: true } },
          category: { select: { slug: true, name: true } },
          prices: { orderBy: { pricingUnit: "asc" } },
          media: { orderBy: { sortOrder: "asc" } },
          location: true,
        },
      }),
      this.prisma.listing.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Post("listings/:id/approve")
  @ApiOperation({ summary: "Approve a listing and publish it immediately" })
  async approveListing(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const before = await this.prisma.listing.findUnique({
      where: { id },
      include: { owner: true },
    });
    if (!before) throw AppException.notFound("Listing not found");
    if (before.owner?.ownerApprovalStatus !== "approved") {
      throw new AppException(ErrorCode.Forbidden, "Owner account must be approved before listing approval", HttpStatus.FORBIDDEN);
    }
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { status: "active", reviewedById: user.id, reviewedAt: new Date(), rejectReason: null },
      include: { owner: true },
    });
    if (listing.ownerId) {
      this.notifications.queue(listing.ownerId, "email", "listing_review_status", {
        title: (listing.title as any)?.en ?? listing.slug,
        status: "approved",
        reason: "",
      });
    }
    this.audit.log({ actorId: user.id, action: "listing.approve", entityType: "listing", entityId: id, before, after: listing });
    return listing;
  }

  @Post("listings/:id/reject")
  @ApiOperation({ summary: "Reject a listing and store the rejection reason" })
  async rejectListing(@Param("id") id: string, @Body() dto: ListingDecisionDto, @CurrentUser() user: AuthUser) {
    const before = await this.prisma.listing.findUnique({ where: { id } });
    if (!before) throw AppException.notFound("Listing not found");
    const reason = dto.reason ?? "Listing did not meet marketplace requirements";
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { status: "rejected", reviewedById: user.id, reviewedAt: new Date(), rejectReason: reason },
    });
    if (listing.ownerId) {
      this.notifications.queue(listing.ownerId, "email", "listing_review_status", {
        title: (listing.title as any)?.en ?? listing.slug,
        status: "rejected",
        reason,
      });
    }
    this.audit.log({ actorId: user.id, action: "listing.reject", entityType: "listing", entityId: id, before, after: listing });
    return listing;
  }

  @Post("listings/:id/moderate")
  @ApiOperation({ summary: "Run or rerun AI moderation for a listing when AI is enabled" })
  async moderateListing(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { media: { orderBy: { sortOrder: "asc" } } },
    });
    if (!listing) throw AppException.notFound("Listing not found");
    const result = await this.moderation.analyze({
      title: listing.title as Record<string, string>,
      description: listing.description as Record<string, string> | null,
      imageUrls: listing.media.map((m) => m.url),
      tags: Array.isArray((listing.attributes as any)?.tags) ? (listing.attributes as any).tags : [],
    });
    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        moderationStatus: result.status,
        moderationWarnings: result as any,
        status: result.status === "flagged" || result.status === "failed" ? "ai_flagged" : listing.status,
      },
    });
    this.audit.log({ actorId: user.id, action: "listing.moderate", entityType: "listing", entityId: id, after: updated });
    return updated;
  }

  @Patch("listings/:id")
  @ApiOperation({ summary: "Update a listing (replaces prices/media when provided)" })
  async update(@Param("id") id: string, @Body() dto: UpdateListingDto, @CurrentUser() user: AuthUser) {
    const before = await this.prisma.listing.findUnique({ where: { id }, include: { category: { include: { attributes: true } } } });
    if (!before) throw AppException.notFound("Listing not found");

    let attributes: Record<string, unknown> | undefined;
    if (dto.attributes) {
      attributes = this.categories.validateAttributes(before.category.attributes as any, {
        ...(before.attributes as Record<string, unknown>),
        ...dto.attributes,
      });
    }

    const listing = await this.prisma.$transaction(async (tx) => {
      if (dto.prices) {
        await tx.listingPrice.deleteMany({ where: { listingId: id } });
        await tx.listingPrice.createMany({ data: dto.prices.map((p) => ({ ...p, listingId: id })) });
      }
      if (dto.media) {
        await tx.listingMedia.deleteMany({ where: { listingId: id } });
        await tx.listingMedia.createMany({ data: dto.media.map((m) => ({ type: "image", ...m, listingId: id })) });
      }
      return tx.listing.update({
        where: { id },
        data: {
          slug: dto.slug, title: dto.title, description: dto.description, status: dto.status,
          locationId: dto.locationId, lat: dto.lat, lng: dto.lng,
          attributes: attributes as never, isFeatured: dto.isFeatured,
        },
        include: { prices: true, media: true },
      });
    });
    this.audit.log({ actorId: user.id, action: "listing.update", entityType: "listing", entityId: id, before, after: listing });
    return listing;
  }

  @Delete("listings/:id")
  @ApiOperation({ summary: "Delete a listing (blocked while it has bookings)" })
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const bookings = await this.prisma.booking.count({ where: { listingId: id, status: { in: ["pending", "confirmed", "ongoing"] } } });
    if (bookings > 0) {
      throw new AppException(ErrorCode.Conflict, `Listing has ${bookings} active bookings`, HttpStatus.CONFLICT);
    }
    await this.prisma.listing.delete({ where: { id } });
    this.audit.log({ actorId: user.id, action: "listing.delete", entityType: "listing", entityId: id });
    return { deleted: true };
  }

  // ── availability blocks (maintenance / manual) ─────────

  @Post("listings/:id/availability-blocks")
  @ApiOperation({ summary: "Block a period (maintenance etc.) — rejects overlaps" })
  async addBlock(@Param("id") id: string, @Body() dto: AvailabilityBlockDto, @CurrentUser() user: AuthUser) {
    try {
      const block = await this.prisma.availabilityBlock.create({
        data: { listingId: id, startAt: new Date(dto.startAt), endAt: new Date(dto.endAt), reason: dto.reason, note: dto.note },
      });
      this.audit.log({ actorId: user.id, action: "listing.block.create", entityType: "availability_block", entityId: block.id, after: block });
      return block;
    } catch (e: any) {
      if (String(e.message).includes("availability_no_overlap") || String(e.code) === "23P01" || String(e.message).includes("23P01")) {
        throw new AppException(ErrorCode.ListingUnavailable, "Period overlaps an existing booking or block", HttpStatus.CONFLICT);
      }
      throw e;
    }
  }

  @Delete("availability-blocks/:blockId")
  @ApiOperation({ summary: "Remove a manual/maintenance block" })
  async removeBlock(@Param("blockId") blockId: string, @CurrentUser() user: AuthUser) {
    const block = await this.prisma.availabilityBlock.findUnique({ where: { id: blockId } });
    if (!block) throw AppException.notFound("Block not found");
    if (block.reason === "booking") {
      throw new AppException(ErrorCode.Conflict, "Booking blocks are released by cancelling the booking", HttpStatus.CONFLICT);
    }
    await this.prisma.availabilityBlock.delete({ where: { id: blockId } });
    this.audit.log({ actorId: user.id, action: "listing.block.delete", entityType: "availability_block", entityId: blockId, before: block });
    return { deleted: true };
  }

  // ── price rules ────────────────────────────────────────

  @Get("price-rules")
  @ApiOperation({ summary: "Seasonal/price rules" })
  priceRules(@Query("listingId") listingId?: string, @Query("categoryId") categoryId?: string) {
    return this.prisma.priceRule.findMany({
      where: { ...(listingId ? { listingId } : {}), ...(categoryId ? { categoryId } : {}) },
      orderBy: { priority: "desc" },
    });
  }

  @Post("price-rules")
  @ApiOperation({ summary: "Create a price rule" })
  async createPriceRule(@Body() dto: PriceRuleDto, @CurrentUser() user: AuthUser) {
    if (dto.scope === "listing" && !dto.listingId) {
      throw new AppException(ErrorCode.ValidationError, "listingId required for listing-scoped rules");
    }
    if (dto.scope === "category" && !dto.categoryId) {
      throw new AppException(ErrorCode.ValidationError, "categoryId required for category-scoped rules");
    }
    const rule = await this.prisma.priceRule.create({
      data: {
        scope: dto.scope, listingId: dto.listingId, categoryId: dto.categoryId, name: dto.name,
        startsOn: dto.startsOn ? new Date(dto.startsOn) : undefined,
        endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
        daysOfWeek: dto.daysOfWeek ?? [], adjustmentType: dto.adjustmentType,
        adjustmentValue: dto.adjustmentValue, priority: dto.priority ?? 0, isActive: dto.isActive ?? true,
      },
    });
    this.audit.log({ actorId: user.id, action: "price-rule.create", entityType: "price_rule", entityId: rule.id, after: rule });
    return rule;
  }

  @Delete("price-rules/:ruleId")
  @ApiOperation({ summary: "Delete a price rule" })
  async deletePriceRule(@Param("ruleId") ruleId: string, @CurrentUser() user: AuthUser) {
    await this.prisma.priceRule.delete({ where: { id: ruleId } });
    this.audit.log({ actorId: user.id, action: "price-rule.delete", entityType: "price_rule", entityId: ruleId });
    return { deleted: true };
  }
}
