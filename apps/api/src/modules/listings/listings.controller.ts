import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PricingUnit } from "@renting/shared";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional,
  IsString, IsUUID, Min, ValidateNested,
} from "class-validator";
import { Request } from "express";
import { Public } from "../../common/decorators";
import { PricingService } from "../pricing/pricing.service";
import { ListingsService } from "./listings.service";

export class QuoteExtraDto {
  @ApiProperty() @IsUUID() extraId!: string;
  @ApiProperty({ default: 1 }) @IsInt() @Min(1) quantity!: number;
}

export class QuoteRequestDto {
  @ApiProperty({ enum: PricingUnit }) @IsEnum(PricingUnit) pricingUnit!: PricingUnit;
  @ApiProperty({ example: "2026-07-01T10:00:00Z" }) @IsDateString() startAt!: string;
  @ApiProperty({ example: "2026-07-04T10:00:00Z" }) @IsDateString() endAt!: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() withDriver?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() driverId?: string;
  @ApiPropertyOptional({ type: [QuoteExtraDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => QuoteExtraDto)
  extras?: QuoteExtraDto[];
  @ApiPropertyOptional({ example: "WELCOME10" }) @IsOptional() @IsString() couponCode?: string;
  @ApiPropertyOptional({ example: "USD" }) @IsOptional() @IsString() currency?: string;
}

@ApiTags("Listings")
@Controller()
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly pricing: PricingService,
  ) {}

  @Public()
  @Get("categories/:slug/listings")
  @ApiOperation({
    summary: "Search listings in a category",
    description:
      "Engine filters: q, location, featured, price[min], price[max], priceUnit, availableFrom, availableTo, page, perPage, sort (createdAt|avgRating|viewCount), order. " +
      "Plus dynamic attribute filters from the category schema: filter[<key>]=value, filter[<key>][min]/[max] for ranges, comma-separated lists for multi-value.",
  })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "perPage", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "location", required: false })
  @ApiQuery({ name: "availableFrom", required: false })
  @ApiQuery({ name: "availableTo", required: false })
  search(@Param("slug") slug: string, @Query() query: Record<string, any>, @Req() req: Request) {
    return this.listings.search(slug, { ...query, ...((req as any).query ?? {}), viewerId: (req as any).user?.id });
  }

  @Public()
  @Get("listings/:idOrSlug")
  @ApiOperation({ summary: "Listing detail (gallery, attributes, prices, location)" })
  detail(@Param("idOrSlug") idOrSlug: string, @Req() req: Request) {
    return this.listings.getPublic(idOrSlug, (req as any).user?.id);
  }

  @Public()
  @Get("listings/:id/availability")
  @ApiOperation({ summary: "Blocked date ranges for the availability calendar" })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  availability(@Param("id") id: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.listings.availability(id, from, to);
  }

  @Public()
  @Get("listings/:id/reviews")
  @ApiOperation({ summary: "Approved reviews" })
  reviews(@Param("id") id: string, @Query() query: Record<string, any>) {
    return this.listings.reviews(id, query);
  }

  @Public()
  @Post("listings/:id/quote")
  @ApiOperation({
    summary: "Price a prospective booking — full breakdown",
    description: "The same engine runs server-side on booking creation, so the client can never tamper with prices.",
  })
  quote(@Param("id") id: string, @Body() dto: QuoteRequestDto, @Req() req: Request) {
    const userId = (req as any).user?.id as string | undefined;
    return this.pricing.quote({
      listingId: id,
      pricingUnit: dto.pricingUnit,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      withDriver: dto.withDriver,
      driverId: dto.driverId,
      extras: dto.extras,
      couponCode: dto.couponCode,
      currency: dto.currency,
      userId: userId?.startsWith("apikey:") ? undefined : userId,
    });
  }
}
