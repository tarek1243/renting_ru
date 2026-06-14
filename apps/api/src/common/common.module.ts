import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditService } from "./audit.service";
import { CryptoService } from "./crypto.service";

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [CryptoService, AuditService],
  exports: [CryptoService, AuditService, JwtModule],
})
export class CommonModule {}
