import { Module } from "@nestjs/common";
import { NeedsController } from "./needs.controller";
import { NeedsAdminController } from "./needs-admin.controller";

@Module({ controllers: [NeedsController, NeedsAdminController] })
export class NeedsModule {}
