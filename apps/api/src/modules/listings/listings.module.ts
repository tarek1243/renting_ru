import { Module } from "@nestjs/common";
import { CategoriesModule } from "../categories/categories.module";
import { PricingModule } from "../pricing/pricing.module";
import { ListingsAdminController } from "./listings-admin.controller";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";

@Module({
  imports: [CategoriesModule, PricingModule],
  controllers: [ListingsController, ListingsAdminController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
