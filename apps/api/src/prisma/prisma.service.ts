import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    if (process.env.EMIT_OPENAPI === "1") return; // spec emission boots the app without a DB
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
