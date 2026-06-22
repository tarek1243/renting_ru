import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { ErrorCode } from "@renting/shared";
import { randomUUID } from "crypto";
import { AppException } from "../../common/app.exception";
import { AuthUser, CurrentUser } from "../../common/decorators";
import { pageParams, paginated } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";

class CreateNeedDto {
  @ApiProperty({ example: "Drive my kids every school day from XXX School at noon to our home in District 1." })
  @IsString() @MinLength(10) @MaxLength(2000) description!: string;

  @ApiProperty({ enum: ["en", "ar"], default: "en" })
  @IsString() @IsIn(["en", "ar"]) locale!: string;
}

@ApiTags("Transportation needs")
@ApiBearerAuth()
@Controller("needs")
export class NeedsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @ApiOperation({ summary: "Register a transportation need in the customer's own words" })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNeedDto) {
    const code = `NEED-${randomUUID().slice(0, 8).toUpperCase()}`;
    return this.prisma.transportationNeed.create({
      data: { code, customerId: user.id, description: dto.description.trim(), locale: dto.locale },
      select: { id: true, code: true, description: true, locale: true, status: true, createdAt: true, updatedAt: true },
    });
  }

  @Get()
  @ApiOperation({ summary: "List the current customer's transportation needs" })
  async list(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    const page = pageParams(query);
    const where = { customerId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transportationNeed.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take,
        select: { id: true, code: true, description: true, locale: true, status: true, createdAt: true, updatedAt: true } }),
      this.prisma.transportationNeed.count({ where }),
    ]);
    return paginated(items, total, page);
  }

  @Get(":id")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const need = await this.prisma.transportationNeed.findFirst({ where: { id, customerId: user.id },
      select: { id: true, code: true, description: true, locale: true, status: true, createdAt: true, updatedAt: true } });
    if (!need) throw AppException.notFound("Transportation need not found");
    return need;
  }

  @Patch(":id/cancel")
  async cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const need = await this.prisma.transportationNeed.findFirst({ where: { id, customerId: user.id } });
    if (!need) throw AppException.notFound("Transportation need not found");
    if (!["open", "reviewing"].includes(need.status)) {
      throw new AppException(ErrorCode.Conflict, "This need can no longer be cancelled", HttpStatus.CONFLICT);
    }
    return this.prisma.transportationNeed.update({ where: { id }, data: { status: "cancelled" },
      select: { id: true, code: true, description: true, locale: true, status: true, createdAt: true, updatedAt: true } });
  }
}
