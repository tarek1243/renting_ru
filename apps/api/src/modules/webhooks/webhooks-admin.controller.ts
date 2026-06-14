import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from "@nestjs/swagger";
import { RoleName, WebhookEvent } from "@renting/shared";
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUrl } from "class-validator";
import { AppException } from "../../common/app.exception";
import { AuditService } from "../../common/audit.service";
import { AuthUser, CurrentUser, Roles } from "../../common/decorators";
import { CryptoService } from "../../common/crypto.service";
import { pageParams, paginated } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";

class CreateWebhookEndpointDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ example: "https://partner.example.com/hooks/renting" }) @IsUrl({ require_tld: false }) url!: string;
  @ApiProperty({ enum: WebhookEvent, isArray: true })
  @IsArray() @ArrayNotEmpty() @IsEnum(WebhookEvent, { each: true })
  events!: WebhookEvent[];
}

class UpdateWebhookEndpointDto extends PartialType(CreateWebhookEndpointDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags("Admin · Webhooks")
@ApiBearerAuth()
@Roles(RoleName.SuperAdmin)
@Controller("admin/webhook-endpoints")
export class WebhooksAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List webhook endpoints" })
  list() {
    return this.prisma.webhookEndpoint.findMany({
      select: { id: true, name: true, url: true, events: true, isActive: true, createdAt: true },
    });
  }

  @Post()
  @ApiOperation({ summary: "Register an endpoint — the signing secret is returned ONCE" })
  async create(@Body() dto: CreateWebhookEndpointDto, @CurrentUser() user: AuthUser) {
    const secret = `whsec_${this.crypto.randomToken(24)}`;
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: { name: dto.name, url: dto.url, events: dto.events, secret },
    });
    this.audit.log({ actorId: user.id, action: "webhook-endpoint.create", entityType: "webhook_endpoint", entityId: endpoint.id });
    return { id: endpoint.id, name: endpoint.name, url: endpoint.url, events: endpoint.events, secret };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update endpoint URL / events / active flag" })
  async update(@Param("id") id: string, @Body() dto: UpdateWebhookEndpointDto, @CurrentUser() user: AuthUser) {
    const endpoint = await this.prisma.webhookEndpoint.update({ where: { id }, data: dto });
    this.audit.log({ actorId: user.id, action: "webhook-endpoint.update", entityType: "webhook_endpoint", entityId: id });
    return { id: endpoint.id, name: endpoint.name, url: endpoint.url, events: endpoint.events, isActive: endpoint.isActive };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an endpoint" })
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    this.audit.log({ actorId: user.id, action: "webhook-endpoint.delete", entityType: "webhook_endpoint", entityId: id });
    return { deleted: true };
  }

  @Get(":id/deliveries")
  @ApiOperation({ summary: "Delivery log with statuses and attempts" })
  async deliveries(@Param("id") id: string, @Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where = { endpointId: id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.webhookDelivery.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
      this.prisma.webhookDelivery.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Post("deliveries/:deliveryId/retry")
  @ApiOperation({ summary: "Force a retry of a failed/exhausted delivery" })
  async retry(@Param("deliveryId") deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw AppException.notFound("Delivery not found");
    return this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "pending", nextRetryAt: new Date() },
    });
  }
}
