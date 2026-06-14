import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Put, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ErrorCode, RoleName } from "@renting/shared";
import { Request } from "express";
import { AppException } from "../../common/app.exception";
import { AuditService } from "../../common/audit.service";
import { AuthUser, CurrentUser, Roles } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { CategoriesService } from "./categories.service";
import {
  CreateAttributeDto, CreateCategoryDto, ToggleCategoryDto,
  UpdateAttributeDto, UpdateCategoryDto, UpsertPricingUnitDto,
} from "./categories-admin.dto";

@ApiTags("Admin · Categories")
@ApiBearerAuth()
@Roles(RoleName.SuperAdmin)
@Controller("admin/categories")
export class CategoriesAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "All categories, enabled or not" })
  list() {
    return this.prisma.rentalCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { attributes: { orderBy: { sortOrder: "asc" } }, pricingUnits: true, _count: { select: { listings: true } } },
    });
  }

  @Post()
  @ApiOperation({ summary: "Create a category (the category builder)" })
  async create(@Body() dto: CreateCategoryDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const existing = await this.prisma.rentalCategory.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new AppException(ErrorCode.Conflict, `Slug '${dto.slug}' already exists`, HttpStatus.CONFLICT);
    }
    const category = await this.prisma.rentalCategory.create({
      data: { ...dto, config: dto.config as any, isEnabled: false },
    });
    this.audit.log({ actorId: user.id, action: "category.create", entityType: "category", entityId: category.id, after: category, ip: req.ip });
    await this.categories.invalidateCache(dto.slug);
    return category;
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update category metadata / booking rules" })
  async update(@Param("id") id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const before = await this.findOr404(id);
    const category = await this.prisma.rentalCategory.update({
      where: { id },
      data: { ...dto, config: dto.config as any },
    });
    this.audit.log({ actorId: user.id, action: "category.update", entityType: "category", entityId: id, before, after: category, ip: req.ip });
    await this.categories.invalidateCache(before.slug);
    return category;
  }

  @Patch(":id/toggle")
  @ApiOperation({
    summary: "Enable/disable a category platform-wide",
    description: "Takes effect instantly: navigation, search, and public API responses all honor the flag. No deployment.",
  })
  async toggle(@Param("id") id: string, @Body() dto: ToggleCategoryDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const before = await this.findOr404(id);
    const category = await this.prisma.rentalCategory.update({ where: { id }, data: { isEnabled: dto.isEnabled } });
    this.audit.log({
      actorId: user.id, action: dto.isEnabled ? "category.enable" : "category.disable",
      entityType: "category", entityId: id, before: { isEnabled: before.isEnabled }, after: { isEnabled: dto.isEnabled }, ip: req.ip,
    });
    await this.categories.invalidateCache(before.slug);
    return category;
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a category (only when it has no listings)" })
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const category = await this.findOr404(id);
    const listings = await this.prisma.listing.count({ where: { categoryId: id } });
    if (listings > 0) {
      throw new AppException(ErrorCode.Conflict, `Category has ${listings} listings — disable it instead`, HttpStatus.CONFLICT);
    }
    await this.prisma.rentalCategory.delete({ where: { id } });
    this.audit.log({ actorId: user.id, action: "category.delete", entityType: "category", entityId: id, before: category, ip: req.ip });
    await this.categories.invalidateCache(category.slug);
    return { deleted: true };
  }

  // ── attribute schema builder ───────────────────────────

  @Post(":id/attributes")
  @ApiOperation({ summary: "Add an attribute to the category schema" })
  async addAttribute(@Param("id") id: string, @Body() dto: CreateAttributeDto, @CurrentUser() user: AuthUser) {
    const category = await this.findOr404(id);
    const attr = await this.prisma.categoryAttribute.create({
      data: { categoryId: id, ...dto, options: (dto.options as any) ?? undefined, validation: (dto.validation as any) ?? undefined },
    });
    this.audit.log({ actorId: user.id, action: "category.attribute.create", entityType: "category_attribute", entityId: attr.id, after: attr });
    await this.categories.invalidateCache(category.slug);
    return attr;
  }

  @Patch(":id/attributes/:attrId")
  @ApiOperation({ summary: "Update an attribute definition" })
  async updateAttribute(
    @Param("id") id: string, @Param("attrId") attrId: string,
    @Body() dto: UpdateAttributeDto, @CurrentUser() user: AuthUser,
  ) {
    const category = await this.findOr404(id);
    const attr = await this.prisma.categoryAttribute.update({
      where: { id: attrId },
      data: { ...dto, options: (dto.options as any) ?? undefined, validation: (dto.validation as any) ?? undefined },
    });
    this.audit.log({ actorId: user.id, action: "category.attribute.update", entityType: "category_attribute", entityId: attrId, after: attr });
    await this.categories.invalidateCache(category.slug);
    return attr;
  }

  @Delete(":id/attributes/:attrId")
  @ApiOperation({ summary: "Remove an attribute from the schema" })
  async removeAttribute(@Param("id") id: string, @Param("attrId") attrId: string, @CurrentUser() user: AuthUser) {
    const category = await this.findOr404(id);
    await this.prisma.categoryAttribute.delete({ where: { id: attrId } });
    this.audit.log({ actorId: user.id, action: "category.attribute.delete", entityType: "category_attribute", entityId: attrId });
    await this.categories.invalidateCache(category.slug);
    return { deleted: true };
  }

  // ── pricing units ──────────────────────────────────────

  @Put(":id/pricing-units")
  @ApiOperation({ summary: "Replace the category's pricing units" })
  async setPricingUnits(@Param("id") id: string, @Body() dto: { units: UpsertPricingUnitDto[] }, @CurrentUser() user: AuthUser) {
    const category = await this.findOr404(id);
    const units = dto.units ?? [];
    await this.prisma.$transaction([
      this.prisma.categoryPricingUnit.deleteMany({ where: { categoryId: id } }),
      this.prisma.categoryPricingUnit.createMany({
        data: units.map((u) => ({
          categoryId: id, unit: u.unit, isDefault: u.isDefault ?? false,
          minQuantity: u.minQuantity ?? 1, maxQuantity: u.maxQuantity ?? 365,
        })),
      }),
    ]);
    this.audit.log({ actorId: user.id, action: "category.pricing-units.set", entityType: "category", entityId: id, after: units });
    await this.categories.invalidateCache(category.slug);
    return this.prisma.categoryPricingUnit.findMany({ where: { categoryId: id } });
  }

  private async findOr404(id: string) {
    const category = await this.prisma.rentalCategory.findUnique({ where: { id } });
    if (!category) throw AppException.notFound("Category not found");
    return category;
  }
}
