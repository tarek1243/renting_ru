import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@renting/shared";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { Roles } from "../../common/decorators";
import { pageParams, paginated } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";

class UpdateNeedDto {
  @ApiPropertyOptional({ enum: ["open", "reviewing", "matched", "closed", "cancelled"] })
  @IsOptional() @IsIn(["open", "reviewing", "matched", "closed", "cancelled"]) status?: any;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) internalNote?: string;
}

@ApiTags("Admin · Transportation needs")
@ApiBearerAuth()
@Roles(RoleName.Staff, RoleName.SuperAdmin)
@Controller("admin/needs")
export class NeedsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where: any = query.status ? { status: String(query.status) } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transportationNeed.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        include: { customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } }),
      this.prisma.transportationNeed.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateNeedDto) {
    return this.prisma.transportationNeed.update({ where: { id }, data: dto });
  }
}
