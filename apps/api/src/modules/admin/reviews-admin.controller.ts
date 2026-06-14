import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@renting/shared";
import { IsIn, IsOptional, IsString } from "class-validator";
import { AppException } from "../../common/app.exception";
import { AuditService } from "../../common/audit.service";
import { AuthUser, CurrentUser, Roles } from "../../common/decorators";
import { pageParams, paginated } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";

class ModerateReviewDto {
  @ApiPropertyOptional({ enum: ["approved", "rejected"] })
  @IsOptional() @IsIn(["approved", "rejected"]) status?: "approved" | "rejected";
  @ApiPropertyOptional() @IsOptional() @IsString() adminReply?: string;
}

@ApiTags("Admin · Reviews")
@ApiBearerAuth()
@Roles(RoleName.Staff, RoleName.SuperAdmin)
@Controller("admin/reviews")
export class ReviewsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Reviews queue (?status=pending for moderation)" })
  async list(@Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where: any = {};
    if (query.status) where.status = String(query.status);
    if (query.listingId) where.listingId = String(query.listingId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          listing: { select: { slug: true, title: true } },
          booking: { select: { code: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Approve/reject a review and/or reply — approval recomputes listing & driver ratings" })
  async moderate(@Param("id") id: string, @Body() dto: ModerateReviewDto, @CurrentUser() user: AuthUser) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw AppException.notFound("Review not found");

    const updated = await this.prisma.review.update({
      where: { id },
      data: { status: dto.status, adminReply: dto.adminReply },
    });

    if (dto.status && dto.status !== review.status) {
      await this.recomputeListingRating(review.listingId);
      if (review.driverId) await this.recomputeDriverRating(review.driverId);
    }
    this.audit.log({ actorId: user.id, action: `review.${dto.status ?? "reply"}`, entityType: "review", entityId: id });
    return updated;
  }

  private async recomputeListingRating(listingId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { listingId, status: "approved" },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { avgRating: agg._avg.rating ?? 0, reviewsCount: agg._count },
    });
  }

  private async recomputeDriverRating(driverId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { driverId, status: "approved", driverRating: { not: null } },
      _avg: { driverRating: true },
      _count: { driverRating: true },
    });
    await this.prisma.driver.update({
      where: { id: driverId },
      data: { avgRating: agg._avg.driverRating ?? 0, ratingsCount: agg._count.driverRating },
    });
  }
}
