import { Module } from "@nestjs/common";
import { CategoriesModule } from "../categories/categories.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PricingModule } from "../pricing/pricing.module";
import { SettingsModule } from "../settings/settings.module";
import { ListingModerationService } from "./listing-moderation.service";
import { ListingsAdminController } from "./listings-admin.controller";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";

@Module({
  imports: [CategoriesModule, PricingModule, SettingsModule, NotificationsModule],
  controllers: [ListingsController, ListingsAdminController],
  providers: [ListingsService, ListingModerationService],
  exports: [ListingsService, ListingModerationService],
})
export class ListingsModule {}
