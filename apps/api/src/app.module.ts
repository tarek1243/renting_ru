import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { CacheModule } from "./cache/cache.module";
import { AuthGuard } from "./common/auth.guard";
import { CommonModule } from "./common/common.module";
import { EnvelopeInterceptor } from "./common/envelope.interceptor";
import { AllExceptionsFilter } from "./common/http-exception.filter";
import { HealthController } from "./health.controller";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { DriversModule } from "./modules/drivers/drivers.module";
import { ListingsModule } from "./modules/listings/listings.module";
import { MeModule } from "./modules/me/me.module";
import { MediaModule } from "./modules/media/media.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PricingModule } from "./modules/pricing/pricing.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
    PrismaModule,
    CacheModule,
    CommonModule,
    AuthModule,
    CategoriesModule,
    ListingsModule,
    PricingModule,
    BookingsModule,
    PaymentsModule,
    DriversModule,
    MeModule,
    CatalogModule,
    SettingsModule,
    NotificationsModule,
    WebhooksModule,
    MediaModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
