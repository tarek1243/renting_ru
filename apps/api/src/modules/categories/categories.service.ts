import { HttpStatus, Injectable } from "@nestjs/common";
import { AttributeDataType, ErrorCode } from "@renting/shared";
import { AppException } from "../../common/app.exception";
import { CacheService } from "../../cache/cache.service";
import { PrismaService } from "../../prisma/prisma.service";

const CACHE_TTL = 60;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Public list — enabled categories only. */
  async listEnabled() {
    const cached = await this.cache.get<unknown[]>("categories:enabled");
    if (cached) return cached;
    const rows = await this.prisma.rentalCategory.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true, description: true, icon: true, sortOrder: true },
    });
    await this.cache.set("categories:enabled", rows, CACHE_TTL);
    return rows;
  }

  /**
   * The category gate. Every public category-scoped read/write goes through here:
   * unknown slug → 404, disabled → 403 CATEGORY_DISABLED.
   */
  async getEnabledBySlug(slug: string) {
    const category = await this.getBySlugAnyState(slug);
    if (!category.isEnabled) throw AppException.categoryDisabled(slug);
    return category;
  }

  async getBySlugAnyState(slug: string) {
    const key = `category:${slug}`;
    let category = await this.cache.get<any>(key);
    if (!category) {
      category = await this.prisma.rentalCategory.findUnique({
        where: { slug },
        include: {
          attributes: { orderBy: { sortOrder: "asc" } },
          pricingUnits: true,
        },
      });
      if (category) await this.cache.set(key, category, CACHE_TTL);
    }
    if (!category) {
      throw new AppException(ErrorCode.CategoryNotFound, `Category '${slug}' not found`, HttpStatus.NOT_FOUND);
    }
    return category;
  }

  async getEnabledById(id: string) {
    const category = await this.prisma.rentalCategory.findUnique({
      where: { id },
      include: { attributes: true, pricingUnits: true },
    });
    if (!category) {
      throw new AppException(ErrorCode.CategoryNotFound, "Category not found", HttpStatus.NOT_FOUND);
    }
    if (!category.isEnabled) throw AppException.categoryDisabled(category.slug);
    return category;
  }

  /** Public detail: attribute schema + filter definitions + pricing units + booking rules. */
  async publicSchema(slug: string) {
    const category = await this.getEnabledBySlug(slug);
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      icon: category.icon,
      config: category.config,
      pricingUnits: category.pricingUnits.map((u: any) => ({
        unit: u.unit,
        isDefault: u.isDefault,
        minQuantity: u.minQuantity,
        maxQuantity: u.maxQuantity,
      })),
      attributes: category.attributes.map((a: any) => ({
        key: a.key,
        label: a.label,
        dataType: a.dataType,
        options: a.options,
        unit: a.unit,
        validation: a.validation,
        isRequired: a.isRequired,
        isFilterable: a.isFilterable,
        filterWidget: a.filterWidget,
        showInCard: a.showInCard,
        sortOrder: a.sortOrder,
      })),
    };
  }

  /**
   * Validates a listing's attributes JSON against the category's attribute schema.
   * This is what makes "new category = configuration, not migration" safe.
   */
  validateAttributes(
    attributeDefs: Array<{
      key: string; dataType: string; isRequired: boolean;
      options: any; validation: any;
    }>,
    attributes: Record<string, unknown>,
    { partial = false } = {},
  ): Record<string, unknown> {
    const errors: string[] = [];
    const clean: Record<string, unknown> = {};
    const defsByKey = new Map(attributeDefs.map((d) => [d.key, d]));

    for (const key of Object.keys(attributes)) {
      if (!defsByKey.has(key)) errors.push(`unknown attribute '${key}'`);
    }

    for (const def of attributeDefs) {
      const value = attributes[def.key];
      if (value === undefined || value === null || value === "") {
        if (def.isRequired && !partial) errors.push(`'${def.key}' is required`);
        continue;
      }
      const v = def.validation ?? {};
      switch (def.dataType) {
        case AttributeDataType.Text:
          if (typeof value !== "string") errors.push(`'${def.key}' must be a string`);
          else clean[def.key] = value;
          break;
        case AttributeDataType.Number: {
          const num = Number(value);
          if (!Number.isFinite(num)) errors.push(`'${def.key}' must be a number`);
          else if (v.min !== undefined && num < v.min) errors.push(`'${def.key}' must be ≥ ${v.min}`);
          else if (v.max !== undefined && num > v.max) errors.push(`'${def.key}' must be ≤ ${v.max}`);
          else clean[def.key] = num;
          break;
        }
        case AttributeDataType.Boolean:
          if (typeof value !== "boolean") errors.push(`'${def.key}' must be a boolean`);
          else clean[def.key] = value;
          break;
        case AttributeDataType.Select: {
          const valid = (def.options ?? []).some((o: any) => o.value === value);
          if (!valid) errors.push(`'${def.key}' must be one of the defined options`);
          else clean[def.key] = value;
          break;
        }
        case AttributeDataType.Multiselect: {
          const arr = Array.isArray(value) ? value : [value];
          const allowed = new Set((def.options ?? []).map((o: any) => o.value));
          if (!arr.every((x) => allowed.has(x))) errors.push(`'${def.key}' contains invalid options`);
          else clean[def.key] = arr;
          break;
        }
      }
    }

    if (errors.length > 0) {
      throw new AppException(ErrorCode.AttributeValidationFailed, "Attribute validation failed", HttpStatus.BAD_REQUEST, errors);
    }
    return clean;
  }

  async invalidateCache(slug?: string) {
    const keys = ["categories:enabled"];
    if (slug) keys.push(`category:${slug}`);
    await this.cache.del(...keys);
  }
}
