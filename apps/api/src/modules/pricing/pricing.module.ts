import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { PricingService } from "./pricing.service";

@Module({
  imports: [SettingsModule],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
