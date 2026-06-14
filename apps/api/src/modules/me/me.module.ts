import { Module } from "@nestjs/common";
import { BookingsModule } from "../bookings/bookings.module";
import { MeController } from "./me.controller";

@Module({
  imports: [BookingsModule],
  controllers: [MeController],
})
export class MeModule {}
