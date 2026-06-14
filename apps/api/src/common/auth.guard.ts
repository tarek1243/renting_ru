import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ErrorCode, RoleName } from "@renting/shared";
import * as crypto from "crypto";
import { AppException } from "./app.exception";
import { AuthUser, IS_PUBLIC_KEY, ROLES_KEY } from "./decorators";
import { config } from "../config/config";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";

/**
 * Global guard. Principals, in order of precedence:
 *  1. Bearer JWT (web + mobile users)
 *  2. X-Api-Key (third-party integrations; read-only scopes)
 * @Public() routes pass without a principal but still get one attached if present.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();

    const user = await this.resolvePrincipal(req);
    if (user) req.user = user;

    if (isPublic) return true;
    if (!user) {
      throw new AppException(ErrorCode.Unauthorized, "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    return this.checkRoles(ctx, user);
  }

  private async resolvePrincipal(req: any): Promise<AuthUser | null> {
    const header: string = req.headers["authorization"] ?? "";
    if (header.startsWith("Bearer ")) {
      try {
        const payload = this.jwt.verify(header.slice(7), { secret: config().JWT_ACCESS_SECRET });
        if (payload.typ !== "access") throw new Error("wrong token type");
        return { id: payload.sub, roles: payload.roles ?? [] };
      } catch (e: any) {
        const code = e?.name === "TokenExpiredError" ? ErrorCode.TokenExpired : ErrorCode.TokenInvalid;
        throw new AppException(code, "Invalid or expired access token", HttpStatus.UNAUTHORIZED);
      }
    }

    const apiKey: string | undefined = req.headers["x-api-key"];
    if (apiKey && apiKey.includes(".")) {
      const [prefix, secret] = apiKey.split(".", 2);
      const cacheKey = `apikey:${prefix}`;
      let record = await this.cache.get<{ id: string; hash: string; scopes: string[]; active: boolean }>(cacheKey);
      if (!record) {
        const row = await this.prisma.apiKey.findUnique({ where: { keyPrefix: prefix } });
        if (!row) return null;
        record = { id: row.id, hash: row.keyHash, scopes: row.scopes, active: row.isActive };
        await this.cache.set(cacheKey, record, 60);
      }
      const hash = crypto.createHash("sha256").update(secret).digest("hex");
      if (!record.active || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(record.hash))) return null;
      this.prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
      return { id: `apikey:${record.id}`, roles: [], apiKey: { id: record.id, scopes: record.scopes } };
    }

    return null;
  }

  private checkRoles(ctx: ExecutionContext, user: AuthUser): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) {
      // Authenticated route without explicit roles → any user principal; API keys
      // are limited to routes that declare no role AND are user-agnostic reads,
      // so reject them from account-scoped routes.
      if (user.apiKey) {
        throw new AppException(ErrorCode.Forbidden, "API keys cannot access account-scoped endpoints", HttpStatus.FORBIDDEN);
      }
      return true;
    }
    if (user.apiKey) {
      throw new AppException(ErrorCode.Forbidden, "API keys cannot access role-restricted endpoints", HttpStatus.FORBIDDEN);
    }
    if (user.roles.includes(RoleName.SuperAdmin)) return true;
    if (required.some((r) => user.roles.includes(r))) return true;
    throw new AppException(ErrorCode.Forbidden, "Insufficient role", HttpStatus.FORBIDDEN);
  }
}
