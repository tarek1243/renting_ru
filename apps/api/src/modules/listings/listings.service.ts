import { HttpStatus, Injectable } from "@nestjs/common";
import { AttributeDataType, ErrorCode } from "@renting/shared";
import { AppException } from "../../common/app.exception";
import { pageParams, paginated, sortParams } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { CategoriesService } from "../categories/categories.service";

const PUBLIC_LISTING_SELECT = {
  id: true, slug: true, title: true, description: true, status: true,
  attributes: true, avgRating: true, reviewsCount: true, isFeatured: true,
  city: true, neighborhood: true, lat: true, lng: true,
  withDriverAvailable: true, selfDriveAvailable: true,
  owner: { select: { id: true, gender: true } },
  category: { select: { slug: true, name: true, isEnabled: true } },
  location: { select: { id: true, name: true, type: true, city: true, lat: true, lng: true } },
  media: { orderBy: { sortOrder: "asc" as const }, select: { type: true, url: true, isCover: true, sortOrder: true } },
  prices: { select: { pricingUnit: true, currency: true, basePrice: true } },
};

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  /**
   * Category-scoped search. Filters come from the category's own attribute
   * schema (?filter[transmission]=automatic&filter[year][min]=2020), plus the
   * engine-level filters every category shares: price, location, availability, q.
   */
  async search(slug: string, query: Record<string, any>) {
    const category = await this.categories.getEnabledBySlug(slug);
    const page = pageParams(query);
    const orderBy = sortParams(query, ["createdAt", "avgRating", "viewCount"], { isFeatured: "desc" });

    const where: any = { categoryId: category.id, status: "active" };
    const AND: any[] = [];
    const viewerGender = await this.viewerGender(query.viewerId);
    if (viewerGender) {
      AND.push({ owner: { gender: viewerGender } });
    } else {
      AND.push({ owner: { gender: null } });
    }

    // engine-level filters
    if (query.q) {
      const q = String(query.q);
      AND.push({
        OR: [
          { slug: { contains: q.toLowerCase().replace(/\s+/g, "-") } },
          ...["en", "ru", "ar"].map((locale) => ({ title: { path: [locale], string_contains: q } })),
        ],
      });
    }
    if (query.location) AND.push({ locationId: String(query.location) });
    if (query.featured === "true") AND.push({ isFeatured: true });

    const priceFilter = query.price ?? {};
    if (priceFilter.min || priceFilter.max) {
      AND.push({
        prices: {
          some: {
            pricingUnit: String(query.priceUnit ?? this.defaultUnit(category)),
            ...(priceFilter.min ? { basePrice: { gte: Number(priceFilter.min) } } : {}),
            ...(priceFilter.max ? { basePrice: { lte: Number(priceFilter.max) } } : {}),
          },
        },
      });
    }

    if (query.availableFrom && query.availableTo) {
      const from = new Date(String(query.availableFrom));
      const to = new Date(String(query.availableTo));
      if (!isNaN(+from) && !isNaN(+to) && to > from) {
        AND.push({ NOT: { availabilityBlocks: { some: { startAt: { lt: to }, endAt: { gt: from } } } } });
      }
    }

    // attribute filters, validated against the schema
    const filters: Record<string, any> = query.filter ?? {};
    for (const attr of category.attributes as any[]) {
      if (!attr.isFilterable || filters[attr.key] === undefined) continue;
      const raw = filters[attr.key];
      switch (attr.dataType) {
        case AttributeDataType.Number: {
          if (typeof raw === "object") {
            if (raw.min !== undefined) AND.push({ attributes: { path: [attr.key], gte: Number(raw.min) } });
            if (raw.max !== undefined) AND.push({ attributes: { path: [attr.key], lte: Number(raw.max) } });
          } else {
            AND.push({ attributes: { path: [attr.key], equals: Number(raw) } });
          }
          break;
        }
        case AttributeDataType.Boolean:
          AND.push({ attributes: { path: [attr.key], equals: String(raw) === "true" } });
          break;
        case AttributeDataType.Multiselect: {
          const values = Array.isArray(raw) ? raw : String(raw).split(",");
          AND.push({ OR: values.map((v: string) => ({ attributes: { path: [attr.key], array_contains: v } })) });
          break;
        }
        default: {
          const values = Array.isArray(raw) ? raw : String(raw).split(",");
          AND.push(
            values.length === 1
              ? { attributes: { path: [attr.key], equals: values[0] } }
              : { OR: values.map((v: string) => ({ attributes: { path: [attr.key], equals: v } })) },
          );
        }
      }
    }

    if (AND.length > 0) where.AND = AND;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({ where, select: PUBLIC_LISTING_SELECT, orderBy, skip: page.skip, take: page.take }),
      this.prisma.listing.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  /** Public detail by id or slug. Category must be enabled. */
  async getPublic(idOrSlug: string, viewerId?: string) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const viewerGender = await this.viewerGender(viewerId);
    const listing = await this.prisma.listing.findFirst({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      select: { ...PUBLIC_LISTING_SELECT, createdAt: true, categoryId: true },
    });
    if (!listing || listing.status !== "active") throw AppException.notFound("Listing not found");
    if (!listing.category.isEnabled) throw AppException.categoryDisabled(listing.category.slug);
    if (viewerGender) {
      if (listing.owner?.gender !== viewerGender) throw AppException.notFound("Listing not found");
    } else if (listing.owner?.gender) {
      throw AppException.notFound("Listing not found");
    }
    void this.prisma.listing.update({ where: { id: listing.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
    return listing;
  }

  /** Availability calendar: blocked ranges between `from` and `to`. */
  async availability(listingId: string, fromRaw?: string, toRaw?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, category: { select: { slug: true, isEnabled: true } } },
    });
    if (!listing) throw AppException.notFound("Listing not found");
    if (!listing.category.isEnabled) throw AppException.categoryDisabled(listing.category.slug);

    const from = fromRaw ? new Date(fromRaw) : new Date();
    const to = toRaw ? new Date(toRaw) : new Date(Date.now() + 90 * 86400_000);
    if (isNaN(+from) || isNaN(+to) || to <= from) {
      throw new AppException(ErrorCode.ValidationError, "Invalid from/to range", HttpStatus.BAD_REQUEST);
    }
    const blocks = await this.prisma.availabilityBlock.findMany({
      where: { listingId, startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true, reason: true },
      orderBy: { startAt: "asc" },
    });
    return { from, to, blocked: blocks };
  }

  /** Approved reviews for a listing. */
  async reviews(listingId: string, query: Record<string, any>) {
    const page = pageParams(query);
    const where = { listingId, status: "approved" as const };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page.skip,
        take: page.take,
        select: {
          id: true, rating: true, driverRating: true, comment: true, adminReply: true, createdAt: true,
          customer: { select: { firstName: true, avatarUrl: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  private defaultUnit(category: any): string {
    return category.pricingUnits.find((u: any) => u.isDefault)?.unit ?? category.pricingUnits[0]?.unit ?? "day";
  }

  private async viewerGender(viewerId?: string): Promise<"male" | "female" | null> {
    if (!viewerId || viewerId.startsWith("apikey:")) return null;
    const viewer = await this.prisma.user.findUnique({ where: { id: viewerId }, select: { gender: true } });
    return viewer?.gender ?? null;
  }
}
