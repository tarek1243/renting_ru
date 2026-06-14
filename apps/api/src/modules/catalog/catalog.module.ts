import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { CatalogController } from "./catalog.controller";

@Module({
  imports: [PricingModule],
  controllers: [CatalogController],
})
export class CatalogModule {}
