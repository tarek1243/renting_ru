import { Module } from "@nestjs/common";
import { BookingsModule } from "../bookings/bookings.module";
import { ListingsModule } from "../listings/listings.module";
import { MeController } from "./me.controller";

@Module({
  imports: [BookingsModule, ListingsModule],
  controllers: [MeController],
})
export class MeModule {}
