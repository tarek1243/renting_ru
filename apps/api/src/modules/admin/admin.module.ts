import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { ApiKeysAdminController } from "./api-keys-admin.controller";
import { CustomersAdminController } from "./customers-admin.controller";
import { ReportsAdminController } from "./reports-admin.controller";
import { ReviewsAdminController } from "./reviews-admin.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [CustomersAdminController, ReviewsAdminController, ReportsAdminController, ApiKeysAdminController],
})
export class AdminModule {}
