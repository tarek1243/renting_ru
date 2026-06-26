import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@renting/shared";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AuditService } from "../../common/audit.service";
import { AuthUser, CurrentUser, Public, Roles } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { SettingsService } from "./settings.service";

class UpsertSettingDto {
  @ApiProperty() @IsString() @IsNotEmpty() key!: string;
  @ApiProperty({ description: "Arbitrary JSON value" }) value!: unknown;
  @ApiPropertyOptional() @IsOptional() @IsString() group?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
}

@ApiTags("Settings")
@Controller()
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Get("settings/public")
  @ApiOperation({ summary: "Public platform settings (currencies, branding, tax)" })
  publicSettings() {
    return this.settings.publicSettings();
  }

  @Roles(RoleName.SuperAdmin)
  @ApiBearerAuth()
  @Get("admin/settings")
  @ApiOperation({ summary: "All settings" })
  all() {
    return this.prisma.setting.findMany({ orderBy: { key: "asc" } });
  }

  @Roles(RoleName.SuperAdmin)
  @ApiBearerAuth()
  @Put("admin/settings")
  @ApiOperation({ summary: "Create or update a setting" })
  async upsert(@Body() dto: UpsertSettingDto, @CurrentUser() user: AuthUser) {
    const row = await this.settings.set(dto.key, dto.value, dto.group, dto.isPublic);
    this.audit.log({ actorId: user.id, action: "setting.set", entityType: "setting", entityId: dto.key, after: row });
    return row;
  }

  @Roles(RoleName.SuperAdmin)
  @ApiBearerAuth()
  @Put("admin/settings/:key")
  @ApiOperation({ summary: "Update one setting by key" })
  async updateKey(@Param("key") key: string, @Body() dto: { value: unknown }, @CurrentUser() user: AuthUser) {
    const row = await this.settings.set(key, dto.value, "general", false);
    this.audit.log({ actorId: user.id, action: "setting.set", entityType: "setting", entityId: key, after: row });
    return row;
  }
}
