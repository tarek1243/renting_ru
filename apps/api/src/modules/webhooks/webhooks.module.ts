import { Module } from "@nestjs/common";
import { WebhooksAdminController } from "./webhooks-admin.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  controllers: [WebhooksAdminController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
