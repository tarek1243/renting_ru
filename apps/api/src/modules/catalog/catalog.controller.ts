import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags, PartialType } from "@nestjs/swagger";
import { RoleName } from "@renting/shared";
import {
  IsBoolean, IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min,
} from "class-validator";
import { Request } from "express";
import { AppException } from "../../common/app.exception";
import { AuditService } from "../../common/audit.service";
import { AuthUser, CurrentUser, Public, Roles } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";

class CreateLocationDto {
  @ApiProperty({ example: { en: "Airport branch" } }) @IsObject() name!: Record<string, string>;
  @ApiPropertyOptional({ enum: ["branch", "airport", "city_zone"], default: "branch" })
  @IsOptional() @IsIn(["branch", "airport", "city_zone"]) type?: "branch" | "airport" | "city_zone";
  @ApiPropertyOptional() @IsOptional() @IsObject() address?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional({ example: "RU" }) @IsOptional() @IsString() countryCode?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateLocationDto extends PartialType(CreateLocationDto) {}

class CreateExtraDto {
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty({ example: { en: "Child seat" } }) @IsObject() name!: Record<string, string>;
  @ApiProperty() @IsNumber() @Min(0) price!: number;
  @ApiPropertyOptional({ enum: ["per_booking", "per_unit"], default: "per_booking" })
  @IsOptional() @IsIn(["per_booking", "per_unit"]) priceType?: "per_booking" | "per_unit";
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateExtraDto extends PartialType(CreateExtraDto) {}

class CreateCouponDto {
  @ApiProperty({ example: "SUMMER15" }) @IsString() code!: string;
  @ApiProperty({ enum: ["percent", "fixed"] }) @IsIn(["percent", "fixed"]) type!: "percent" | "fixed";
  @ApiProperty() @IsNumber() @Min(0) value!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() minAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxDiscount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() usageLimit?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsNumber() perUserLimit?: number;
  @ApiProperty() @IsDateString() validFrom!: string;
  @ApiProperty() @IsDateString() validTo!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateCouponDto extends PartialType(CreateCouponDto) {}

class ValidateCouponDto {
  @ApiProperty() @IsString() code!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
}

class UpsertPageDto {
  @ApiProperty({ example: "faq" }) @IsString() slug!: string;
  @ApiProperty() @IsObject() title!: Record<string, string>;
  @ApiProperty() @IsObject() body!: Record<string, string>;
  @ApiPropertyOptional({ enum: ["draft", "published"], default: "draft" })
  @IsOptional() @IsIn(["draft", "published"]) status?: "draft" | "published";
  @ApiPropertyOptional() @IsOptional() @IsObject() seo?: Record<string, unknown>;
}

class UpsertFaqDto {
  @ApiProperty() @IsObject() question!: Record<string, string>;
  @ApiProperty() @IsObject() answer!: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsString() group?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() sortOrder?: number;
}

@ApiTags("Catalog")
@Controller()
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
  ) {}

  // ── public reads ───────────────────────────────────────

  @Public()
  @Get("locations")
  @ApiOperation({ summary: "Active pickup/drop-off locations" })
  locations() {
    return this.prisma.location.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  }

  @Public()
  @Get("extras")
  @ApiOperation({ summary: "Active extras for a category" })
  @ApiQuery({ name: "categoryId", required: true })
  extras(@Query("categoryId") categoryId: string) {
    return this.prisma.extra.findMany({ where: { categoryId, isActive: true } });
  }

  @Public()
  @Post("coupons/validate")
  @ApiOperation({ summary: "Check a coupon code (full discount math happens in /quote)" })
  async validateCoupon(@Body() dto: ValidateCouponDto, @Req() req: Request) {
    const userId = (req as any).user?.id as string | undefined;
    const coupon = await this.pricing.validateCoupon(
      dto.code, dto.categoryId, userId?.startsWith("apikey:") ? undefined : userId,
    );
    return { code: coupon.code, type: coupon.type, value: coupon.value, minAmount: coupon.minAmount, validTo: coupon.validTo };
  }

  @Public()
  @Get("pages/:slug")
  @ApiOperation({ summary: "Published content page (terms, about...)" })
  async page(@Param("slug") slug: string) {
    const page = await this.prisma.contentPage.findFirst({ where: { slug, status: "published" } });
    if (!page) throw AppException.notFound("Page not found");
    return page;
  }

  @Public()
  @Get("faqs")
  @ApiOperation({ summary: "FAQ entries" })
  faqs() {
    return this.prisma.faq.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }] });
  }

  // ── admin: locations ───────────────────────────────────

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Get("admin/locations")
  @ApiOperation({ summary: "All locations" })
  adminLocations() {
    return this.prisma.location.findMany({ orderBy: { createdAt: "asc" } });
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Post("admin/locations")
  @ApiOperation({ summary: "Create location" })
  async createLocation(@Body() dto: CreateLocationDto, @CurrentUser() user: AuthUser) {
    const location = await this.prisma.location.create({ data: dto as any });
    this.audit.log({ actorId: user.id, action: "location.create", entityType: "location", entityId: location.id });
    return location;
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Patch("admin/locations/:id")
  @ApiOperation({ summary: "Update location" })
  async updateLocation(@Param("id") id: string, @Body() dto: UpdateLocationDto, @CurrentUser() user: AuthUser) {
    const location = await this.prisma.location.update({ where: { id }, data: dto as any });
    this.audit.log({ actorId: user.id, action: "location.update", entityType: "location", entityId: id });
    return location;
  }

  @Roles(RoleName.SuperAdmin) @ApiBearerAuth()
  @Delete("admin/locations/:id")
  @ApiOperation({ summary: "Deactivate location" })
  async removeLocation(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.location.update({ where: { id }, data: { isActive: false } });
    this.audit.log({ actorId: user.id, action: "location.deactivate", entityType: "location", entityId: id });
    return { deactivated: true };
  }

  // ── admin: extras ──────────────────────────────────────

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Get("admin/extras")
  @ApiOperation({ summary: "All extras" })
  adminExtras(@Query("categoryId") categoryId?: string) {
    return this.prisma.extra.findMany({ where: categoryId ? { categoryId } : {} });
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Post("admin/extras")
  @ApiOperation({ summary: "Create extra" })
  createExtra(@Body() dto: CreateExtraDto) {
    return this.prisma.extra.create({ data: dto as any });
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Patch("admin/extras/:id")
  @ApiOperation({ summary: "Update extra" })
  updateExtra(@Param("id") id: string, @Body() dto: UpdateExtraDto) {
    return this.prisma.extra.update({ where: { id }, data: dto as any });
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Delete("admin/extras/:id")
  @ApiOperation({ summary: "Deactivate extra" })
  async removeExtra(@Param("id") id: string) {
    await this.prisma.extra.update({ where: { id }, data: { isActive: false } });
    return { deactivated: true };
  }

  // ── admin: coupons ─────────────────────────────────────

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Get("admin/coupons")
  @ApiOperation({ summary: "All coupons with usage counts" })
  coupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { redemptions: true } } } });
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Post("admin/coupons")
  @ApiOperation({ summary: "Create coupon" })
  async createCoupon(@Body() dto: CreateCouponDto, @CurrentUser() user: AuthUser) {
    const coupon = await this.prisma.coupon.create({
      data: {
        ...dto, code: dto.code.toUpperCase(),
        validFrom: new Date(dto.validFrom), validTo: new Date(dto.validTo),
      } as any,
    });
    this.audit.log({ actorId: user.id, action: "coupon.create", entityType: "coupon", entityId: coupon.id });
    return coupon;
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Patch("admin/coupons/:id")
  @ApiOperation({ summary: "Update coupon" })
  updateCoupon(@Param("id") id: string, @Body() dto: UpdateCouponDto) {
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto, code: dto.code?.toUpperCase(),
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      } as any,
    });
  }

  @Roles(RoleName.SuperAdmin) @ApiBearerAuth()
  @Delete("admin/coupons/:id")
  @ApiOperation({ summary: "Deactivate coupon" })
  async removeCoupon(@Param("id") id: string) {
    await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
    return { deactivated: true };
  }

  // ── admin: content pages & FAQ ─────────────────────────

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Get("admin/pages")
  @ApiOperation({ summary: "All content pages" })
  pages() {
    return this.prisma.contentPage.findMany();
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Post("admin/pages")
  @ApiOperation({ summary: "Create or update a page by slug" })
  upsertPage(@Body() dto: UpsertPageDto) {
    return this.prisma.contentPage.upsert({
      where: { slug: dto.slug },
      update: { title: dto.title, body: dto.body, status: dto.status, seo: dto.seo as any },
      create: { slug: dto.slug, title: dto.title, body: dto.body, status: dto.status ?? "draft", seo: dto.seo as any },
    });
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Post("admin/faqs")
  @ApiOperation({ summary: "Create FAQ entry" })
  createFaq(@Body() dto: UpsertFaqDto) {
    return this.prisma.faq.create({ data: dto as any });
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Patch("admin/faqs/:id")
  @ApiOperation({ summary: "Update FAQ entry" })
  updateFaq(@Param("id") id: string, @Body() dto: Partial<UpsertFaqDto>) {
    return this.prisma.faq.update({ where: { id }, data: dto as any });
  }

  @Roles(RoleName.Staff, RoleName.SuperAdmin) @ApiBearerAuth()
  @Delete("admin/faqs/:id")
  @ApiOperation({ summary: "Delete FAQ entry" })
  async deleteFaq(@Param("id") id: string) {
    await this.prisma.faq.delete({ where: { id } });
    return { deleted: true };
  }
}
