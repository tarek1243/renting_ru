import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { AttributeDataType, FilterWidget, PricingUnit } from "@renting/shared";
import { Type } from "class-transformer";
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional,
  IsString, Matches, Min, ValidateNested,
} from "class-validator";

export class CategoryConfigDto {
  @ApiProperty() @IsBoolean() requiresDriverOption!: boolean;
  @ApiProperty() @IsBoolean() requiresLicenseVerification!: boolean;
  @ApiProperty() @IsBoolean() usesCheckInOut!: boolean;
  @ApiPropertyOptional({ example: { required: true, type: "fixed", value: 200 } })
  @IsOptional() @IsObject() securityDeposit?: { required: boolean; type: "percent" | "fixed"; value: number } | null;
  @ApiProperty({ example: 60 }) @IsInt() @Min(0) minDurationMinutes!: number;
  @ApiProperty({ example: 129600 }) @IsInt() @Min(0) maxDurationMinutes!: number;
  @ApiProperty({ example: 60 }) @IsInt() @Min(0) leadTimeMinutes!: number;
  @ApiProperty({ example: 1440 }) @IsInt() @Min(0) freeCancellationMinutes!: number;
}

export class CreateCategoryDto {
  @ApiProperty({ example: "real-estate" })
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @ApiProperty({ example: { en: "Real Estate", ru: "Недвижимость", ar: "عقارات" } })
  @IsObject()
  name!: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  description?: Record<string, string>;

  @ApiPropertyOptional({ example: "building" })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ type: CategoryConfigDto })
  @ValidateNested()
  @Type(() => CategoryConfigDto)
  config!: CategoryConfigDto;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class ToggleCategoryDto {
  @ApiProperty({ description: "true = visible everywhere instantly; false = hidden + 403 on its endpoints" })
  @IsBoolean()
  isEnabled!: boolean;
}

export class AttributeOptionDto {
  @ApiProperty() @IsString() @IsNotEmpty() value!: string;
  @ApiProperty({ example: { en: "Furnished", ru: "С мебелью" } }) @IsObject() label!: Record<string, string>;
}

export class CreateAttributeDto {
  @ApiProperty({ example: "bedrooms" })
  @Matches(/^[a-z0-9_]+$/)
  key!: string;

  @ApiProperty({ example: { en: "Bedrooms", ru: "Спальни", ar: "غرف النوم" } })
  @IsObject()
  label!: Record<string, string>;

  @ApiProperty({ enum: AttributeDataType })
  @IsEnum(AttributeDataType)
  dataType!: AttributeDataType;

  @ApiPropertyOptional({ type: [AttributeOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeOptionDto)
  options?: AttributeOptionDto[];

  @ApiPropertyOptional({ example: "m²" }) @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional({ example: { min: 0, max: 20 } }) @IsOptional() @IsObject() validation?: { min?: number; max?: number; regex?: string };
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isRequired?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isFilterable?: boolean;
  @ApiPropertyOptional({ enum: FilterWidget }) @IsOptional() @IsEnum(FilterWidget) filterWidget?: FilterWidget;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() showInCard?: boolean;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateAttributeDto extends PartialType(CreateAttributeDto) {}

export class UpsertPricingUnitDto {
  @ApiProperty({ enum: PricingUnit }) @IsEnum(PricingUnit) unit!: PricingUnit;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) minQuantity?: number;
  @ApiPropertyOptional({ default: 365 }) @IsOptional() @IsInt() @Min(1) maxQuantity?: number;
}
