import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RegionalGateway } from "./regional.gateway";
import { StripeGateway } from "./stripe.gateway";

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeGateway, RegionalGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
