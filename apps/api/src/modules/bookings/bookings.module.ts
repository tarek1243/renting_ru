import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { PricingModule } from "../pricing/pricing.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { BookingsAdminController } from "./bookings-admin.controller";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { BookingsCron } from "./bookings.cron";

@Module({
  imports: [PricingModule, PaymentsModule, NotificationsModule, WebhooksModule],
  controllers: [BookingsController, BookingsAdminController],
  providers: [BookingsService, BookingsCron],
  exports: [BookingsService],
})
export class BookingsModule {}
