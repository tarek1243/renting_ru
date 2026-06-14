import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@renting/shared";
import { IsArray, IsInt, IsOptional, IsString, Min } from "class-validator";
import { AuditService } from "../../common/audit.service";
import { CryptoService } from "../../common/crypto.service";
import { AuthUser, CurrentUser, Roles } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";

class CreateApiKeyDto {
  @ApiProperty({ example: "Mobile BFF" }) @IsString() name!: string;
  @ApiPropertyOptional({ type: [String], example: ["read"] }) @IsOptional() @IsArray() scopes?: string[];
  @ApiPropertyOptional({ default: 60 }) @IsOptional() @IsInt() @Min(1) rateLimitPerMin?: number;
}

@ApiTags("Admin · API keys")
@ApiBearerAuth()
@Roles(RoleName.SuperAdmin)
@Controller("admin/api-keys")
export class ApiKeysAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List API keys (hashes never leave the server)" })
  list() {
    return this.prisma.apiKey.findMany({
      select: { id: true, name: true, keyPrefix: true, scopes: true, rateLimitPerMin: true, lastUsedAt: true, isActive: true, createdAt: true },
    });
  }

  @Post()
  @ApiOperation({ summary: "Create an API key — the full key (prefix.secret) is returned ONCE" })
  async create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: AuthUser) {
    const prefix = `rk_${this.crypto.randomToken(6)}`;
    const secret = this.crypto.randomToken(24);
    const row = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyPrefix: prefix,
        keyHash: this.crypto.sha256(secret),
        scopes: dto.scopes ?? ["read"],
        rateLimitPerMin: dto.rateLimitPerMin ?? 60,
      },
    });
    this.audit.log({ actorId: user.id, action: "api-key.create", entityType: "api_key", entityId: row.id });
    return { id: row.id, name: row.name, apiKey: `${prefix}.${secret}`, scopes: row.scopes };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Revoke an API key" })
  async revoke(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.apiKey.update({ where: { id }, data: { isActive: false } });
    this.audit.log({ actorId: user.id, action: "api-key.revoke", entityType: "api_key", entityId: id });
    return { revoked: true };
  }
}
