import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@renting/shared";
import { Response } from "express";
import { AppException } from "../../common/app.exception";
import { Public, Roles } from "../../common/decorators";
import { pageParams, paginated } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

@ApiTags("Admin · Dashboard & Reports")
@ApiBearerAuth()
@Roles(RoleName.Staff, RoleName.SuperAdmin)
@Controller("admin")
export class ReportsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("dashboard/kpis")
  @ApiOperation({ summary: "Dashboard KPIs: revenue, bookings funnel, fleet utilization, top listings" })
  async kpis(@Query("days") daysRaw?: string) {
    const days = Math.min(365, Math.max(1, Number(daysRaw) || 30));
    const since = new Date(Date.now() - days * 86400_000);

    const [revenueAgg, bookingsByStatus, totalListings, activeListings, topListings, recentBookings] =
      await this.prisma.$transaction([
        this.prisma.booking.aggregate({
          where: { status: { in: ["confirmed", "ongoing", "completed"] }, createdAt: { gte: since } },
          _sum: { totalAmount: true },
          _count: true,
        }),
        this.prisma.booking.groupBy({
          by: ["status"],
          where: { createdAt: { gte: since } },
          _count: true,
          orderBy: { status: "asc" },
        }),
        this.prisma.listing.count(),
        this.prisma.listing.count({ where: { status: "active" } }),
        this.prisma.booking.groupBy({
          by: ["listingId"],
          where: { status: { in: ["confirmed", "ongoing", "completed"] }, createdAt: { gte: since } },
          _sum: { totalAmount: true },
          _count: true,
          orderBy: { _sum: { totalAmount: "desc" } },
          take: 5,
        }),
        this.prisma.booking.findMany({
          orderBy: { createdAt: "desc" }, take: 8,
          select: {
            id: true, code: true, status: true, totalAmount: true, currency: true, createdAt: true,
            listing: { select: { title: true, slug: true } },
            customer: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);

    // utilization: booked days vs available days over the window, active fleet only
    const blocks = await this.prisma.availabilityBlock.findMany({
      where: { reason: "booking", startAt: { lt: new Date() }, endAt: { gt: since }, listing: { status: "active" } },
      select: { startAt: true, endAt: true },
    });
    const bookedMs = blocks.reduce((sum, b) => {
      const start = Math.max(+b.startAt, +since);
      const end = Math.min(+b.endAt, Date.now());
      return sum + Math.max(0, end - start);
    }, 0);
    const capacityMs = Math.max(1, activeListings * days * 86400_000);
    const utilizationPercent = Math.round((bookedMs / capacityMs) * 1000) / 10;

    const listingTitles = await this.prisma.listing.findMany({
      where: { id: { in: topListings.map((t) => t.listingId) } },
      select: { id: true, slug: true, title: true },
    });

    return {
      windowDays: days,
      revenue: { total: revenueAgg._sum.totalAmount ?? 0, bookings: revenueAgg._count },
      bookingsByStatus: Object.fromEntries(bookingsByStatus.map((b) => [b.status, b._count])),
      fleet: { total: totalListings, active: activeListings, utilizationPercent },
      topListings: topListings.map((t) => ({
        listing: listingTitles.find((l) => l.id === t.listingId),
        revenue: t._sum?.totalAmount ?? 0,
        bookings: t._count,
      })),
      recentBookings,
    };
  }

  @Get("reports/:type")
  @ApiOperation({
    summary: "Operational reports — bookings | revenue | fleet | drivers; ?format=csv streams a download",
  })
  @ApiQuery({ name: "format", required: false, enum: ["json", "csv"] })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  async report(
    @Param("type") type: string,
    @Query() query: Record<string, any>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const from = query.from ? new Date(String(query.from)) : new Date(Date.now() - 30 * 86400_000);
    const to = query.to ? new Date(String(query.to)) : new Date();
    let rows: Record<string, unknown>[];

    switch (type) {
      case "bookings": {
        const bookings = await this.prisma.booking.findMany({
          where: { createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: "desc" },
          include: {
            listing: { select: { slug: true } },
            customer: { select: { email: true, firstName: true, lastName: true } },
          },
        });
        rows = bookings.map((b) => ({
          code: b.code, status: b.status, listing: b.listing.slug,
          customer: `${b.customer.firstName} ${b.customer.lastName}`.trim(), email: b.customer.email,
          startAt: b.startAt, endAt: b.endAt, withDriver: b.withDriver,
          total: Number(b.totalAmount), currency: b.currency, createdAt: b.createdAt,
        }));
        break;
      }
      case "revenue": {
        const bookings = await this.prisma.booking.findMany({
          where: { status: { in: ["confirmed", "ongoing", "completed"] }, createdAt: { gte: from, lte: to } },
          select: { createdAt: true, totalAmount: true, taxAmount: true, discountAmount: true, currency: true },
        });
        const byDay = new Map<string, { revenue: number; tax: number; discounts: number; bookings: number }>();
        for (const b of bookings) {
          const day = b.createdAt.toISOString().slice(0, 10);
          const agg = byDay.get(day) ?? { revenue: 0, tax: 0, discounts: 0, bookings: 0 };
          agg.revenue += Number(b.totalAmount);
          agg.tax += Number(b.taxAmount);
          agg.discounts += Number(b.discountAmount);
          agg.bookings += 1;
          byDay.set(day, agg);
        }
        rows = [...byDay.entries()].sort().map(([date, agg]) => ({ date, ...agg }));
        break;
      }
      case "fleet": {
        const listings = await this.prisma.listing.findMany({
          include: {
            category: { select: { slug: true } },
            _count: { select: { bookings: true } },
            bookings: {
              where: { status: { in: ["confirmed", "ongoing", "completed"] }, createdAt: { gte: from, lte: to } },
              select: { totalAmount: true },
            },
          },
        });
        rows = listings.map((l) => ({
          slug: l.slug, category: l.category.slug, status: l.status,
          rating: Number(l.avgRating), reviews: l.reviewsCount, views: l.viewCount,
          bookingsTotal: l._count.bookings,
          revenueInWindow: l.bookings.reduce((s, b) => s + Number(b.totalAmount), 0),
        }));
        break;
      }
      case "drivers": {
        const drivers = await this.prisma.driver.findMany({
          include: {
            user: { select: { firstName: true, lastName: true } },
            bookings: {
              where: { status: "completed", createdAt: { gte: from, lte: to } },
              select: { driverAmount: true },
            },
          },
        });
        rows = drivers.map((d) => {
          const gross = d.bookings.reduce((s, b) => s + Number(b.driverAmount), 0);
          return {
            name: `${d.user.firstName} ${d.user.lastName}`.trim(), status: d.status,
            completedJobs: d.bookings.length, gross,
            commissionPercent: Number(d.commissionPercent),
            net: Math.round((gross * (1 - Number(d.commissionPercent) / 100)) * 100) / 100,
            rating: Number(d.avgRating),
          };
        });
        break;
      }
      default:
        throw AppException.notFound(`Unknown report '${type}' — use bookings | revenue | fleet | drivers`);
    }

    if (String(query.format) === "csv") {
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="${type}-${from.toISOString().slice(0, 10)}.csv"`);
      res.send(toCsv(rows));
      return undefined as never;
    }
    return { type, from, to, rows };
  }

  @Get("audit-logs")
  @ApiOperation({ summary: "Audit trail of admin actions" })
  async auditLogs(@Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where: any = {};
    if (query.entityType) where.entityType = String(query.entityType);
    if (query.actorId) where.actorId = String(query.actorId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        include: { actor: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, page);
  }
}
