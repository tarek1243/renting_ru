import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@renting/shared";
import { IsIn, IsOptional, IsString } from "class-validator";
import { AppException } from "../../common/app.exception";
import { AuditService } from "../../common/audit.service";
import { AuthUser, CurrentUser, Roles } from "../../common/decorators";
import { pageParams, paginated } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

class LicenseDecisionDto {
  @ApiPropertyOptional({ description: "Required when rejecting" })
  @IsOptional() @IsString() reason?: string;
}

class SetUserStatusDto {
  @ApiProperty({ enum: ["active", "suspended"] }) @IsIn(["active", "suspended"]) status!: "active" | "suspended";
}

@ApiTags("Admin · Customers")
@ApiBearerAuth()
@Roles(RoleName.Staff, RoleName.SuperAdmin)
@Controller("admin/customers")
export class CustomersAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Customers with booking counts; ?q searches name/email/phone, ?licenseStatus filters verification queue" })
  async list(@Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where: any = { roles: { some: { role: { name: "customer" } } } };
    if (query.q) {
      const q = String(query.q);
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ];
    }
    if (query.licenseStatus) where.license = { status: String(query.licenseStatus) };
    if (query.status) where.status = String(query.status);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        select: {
          id: true, email: true, phone: true, firstName: true, lastName: true, status: true, createdAt: true,
          license: { select: { status: true, country: true, expiresOn: true } },
          _count: { select: { bookings: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Get(":id")
  @ApiOperation({ summary: "Customer detail incl. license images and recent bookings" })
  async get(@Param("id") id: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true, status: true,
        locale: true, preferredCurrency: true, createdAt: true,
        license: true,
        bookings: {
          orderBy: { createdAt: "desc" }, take: 10,
          select: { id: true, code: true, status: true, startAt: true, totalAmount: true, currency: true },
        },
      },
    });
    if (!customer) throw AppException.notFound("Customer not found");
    return customer;
  }

  @Post(":id/license/approve")
  @ApiOperation({ summary: "Approve the driver's license" })
  async approveLicense(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.decideLicense(id, "approved", user.id);
    return { status: "approved" };
  }

  @Post(":id/license/reject")
  @ApiOperation({ summary: "Reject the driver's license (with reason)" })
  async rejectLicense(@Param("id") id: string, @Body() dto: LicenseDecisionDto, @CurrentUser() user: AuthUser) {
    await this.decideLicense(id, "rejected", user.id, dto.reason ?? "Document unreadable");
    return { status: "rejected" };
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Suspend / reactivate a customer account" })
  async setStatus(@Param("id") id: string, @Body() dto: SetUserStatusDto, @CurrentUser() user: AuthUser) {
    const updated = await this.prisma.user.update({ where: { id }, data: { status: dto.status } });
    if (dto.status === "suspended") {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    this.audit.log({ actorId: user.id, action: `customer.${dto.status}`, entityType: "user", entityId: id });
    return { id: updated.id, status: updated.status };
  }

  private async decideLicense(userId: string, status: "approved" | "rejected", actorId: string, reason?: string) {
    const license = await this.prisma.driverLicense.findUnique({ where: { userId } });
    if (!license) throw AppException.notFound("No license submitted");
    await this.prisma.driverLicense.update({
      where: { userId },
      data: { status, reviewedById: actorId, reviewedAt: new Date(), rejectReason: reason ?? null },
    });
    this.notifications.queue(userId, "email", "license_status", { status, reason: reason ?? "" });
    this.audit.log({ actorId, action: `license.${status}`, entityType: "driver_license", entityId: license.id });
  }
}
