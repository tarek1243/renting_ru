import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ErrorCode, RoleName } from "@renting/shared";
import * as bcrypt from "bcryptjs";
import { AppException } from "../../common/app.exception";
import { CryptoService } from "../../common/crypto.service";
import { config } from "../../config/config";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RegisterDto } from "./auth.dto";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly crypto: CryptoService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── registration / login ───────────────────────────────

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new AppException(ErrorCode.ValidationError, "Either email or phone is required");
    }
    if (dto.email && (await this.prisma.user.findUnique({ where: { email: dto.email } }))) {
      throw new AppException(ErrorCode.EmailTaken, "Email already registered", HttpStatus.CONFLICT);
    }
    if (dto.phone && (await this.prisma.user.findUnique({ where: { phone: dto.phone } }))) {
      throw new AppException(ErrorCode.PhoneTaken, "Phone already registered", HttpStatus.CONFLICT);
    }
    const customerRole = await this.prisma.role.findUniqueOrThrow({ where: { name: RoleName.Customer } });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, 10),
        firstName: dto.firstName,
        lastName: dto.lastName ?? "",
        roles: { create: { roleId: customerRole.id } },
      },
    });
    if (user.email) {
      this.notifications.queue(user.id, "email", "welcome", { firstName: user.firstName });
    }
    return this.issueTokens(user.id);
  }

  async login(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppException(ErrorCode.InvalidCredentials, "Invalid credentials", HttpStatus.UNAUTHORIZED);
    }
    this.assertActive(user.status);
    return this.issueTokens(user.id);
  }

  // ── phone OTP ──────────────────────────────────────────

  async requestOtp(phone: string) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otpCode.create({
      data: {
        destination: phone,
        codeHash: this.crypto.sha256(code),
        purpose: "login",
        expiresAt: new Date(Date.now() + config().OTP_TTL * 1000),
      },
    });
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (user) {
      this.notifications.queue(user.id, "sms", "otp", { code });
    } else {
      // No account yet — send directly; one is created on verification.
      this.notifications.sendRawSms(phone, `Your verification code: ${code}`);
    }
    if (config().NODE_ENV !== "production") this.logger.debug(`OTP for ${phone}: ${code}`);
    return { sent: true, ttl: config().OTP_TTL };
  }

  async verifyOtp(phone: string, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { destination: phone, purpose: "login", consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!otp || otp.attempts >= 5) {
      throw new AppException(ErrorCode.OtpInvalid, "No active code — request a new one", HttpStatus.UNAUTHORIZED);
    }
    if (otp.expiresAt < new Date()) {
      throw new AppException(ErrorCode.OtpExpired, "Code expired", HttpStatus.UNAUTHORIZED);
    }
    if (otp.codeHash !== this.crypto.sha256(code)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new AppException(ErrorCode.OtpInvalid, "Incorrect code", HttpStatus.UNAUTHORIZED);
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      const customerRole = await this.prisma.role.findUniqueOrThrow({ where: { name: RoleName.Customer } });
      user = await this.prisma.user.create({
        data: { phone, firstName: "Guest", phoneVerifiedAt: new Date(), roles: { create: { roleId: customerRole.id } } },
      });
    } else if (!user.phoneVerifiedAt) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
    }
    this.assertActive(user.status);
    return this.issueTokens(user.id);
  }

  // ── social login ───────────────────────────────────────

  async socialLogin(provider: "google" | "apple" | "facebook", token: string) {
    const profile = await this.verifySocialToken(provider, token);
    let account = await this.prisma.socialAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: profile.id } },
      include: { user: true },
    });
    if (!account) {
      let user = profile.email ? await this.prisma.user.findUnique({ where: { email: profile.email } }) : null;
      if (!user) {
        const customerRole = await this.prisma.role.findUniqueOrThrow({ where: { name: RoleName.Customer } });
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            firstName: profile.firstName ?? "Guest",
            lastName: profile.lastName ?? "",
            emailVerifiedAt: profile.email ? new Date() : null,
            roles: { create: { roleId: customerRole.id } },
          },
        });
      }
      account = await this.prisma.socialAccount.create({
        data: { provider, providerUserId: profile.id, userId: user.id },
        include: { user: true },
      });
    }
    this.assertActive(account.user.status);
    return this.issueTokens(account.user.id);
  }

  /** Google tokens are verified against the tokeninfo endpoint; Apple/Facebook are placeholder integrations. */
  private async verifySocialToken(
    provider: string,
    token: string,
  ): Promise<{ id: string; email?: string; firstName?: string; lastName?: string }> {
    if (provider === "google") {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        throw new AppException(ErrorCode.InvalidCredentials, "Google token rejected", HttpStatus.UNAUTHORIZED);
      }
      const body: any = await res.json();
      return { id: body.sub, email: body.email, firstName: body.given_name, lastName: body.family_name };
    }
    throw new AppException(
      ErrorCode.ValidationError,
      `Provider '${provider}' is not configured on this deployment`,
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  // ── refresh & logout ───────────────────────────────────

  async refresh(refreshToken: string) {
    const hash = this.crypto.sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppException(ErrorCode.TokenInvalid, "Refresh token invalid or expired", HttpStatus.UNAUTHORIZED);
    }
    // Rotation: revoke the used token, issue a fresh pair.
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.userId);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash: this.crypto.sha256(refreshToken) },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return { loggedOut: true };
  }

  // ── password reset ─────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = this.crypto.randomToken(32);
      await this.prisma.otpCode.create({
        data: {
          destination: email,
          codeHash: this.crypto.sha256(token),
          purpose: "reset_password",
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
      this.notifications.queue(user.id, "email", "password_reset", { token });
    }
    return { sent: true }; // identical response whether or not the email exists
  }

  async resetPassword(token: string, password: string) {
    const hash = this.crypto.sha256(token);
    const record = await this.prisma.otpCode.findFirst({
      where: { purpose: "reset_password", codeHash: hash, consumedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) {
      throw new AppException(ErrorCode.TokenInvalid, "Reset token invalid or expired", HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prisma.user.findUnique({ where: { email: record.destination } });
    if (!user) throw AppException.notFound("Account not found");
    await this.prisma.$transaction([
      this.prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { reset: true };
  }

  // ── helpers ────────────────────────────────────────────

  private assertActive(status: string) {
    if (status !== "active") {
      throw new AppException(ErrorCode.AccountSuspended, "Account is suspended", HttpStatus.FORBIDDEN);
    }
  }

  async issueTokens(userId: string): Promise<TokenPair & { user: unknown }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    const roles = user.roles.map((r) => r.role.name);
    const cfg = config();
    const accessToken = this.jwt.sign(
      { sub: user.id, roles, typ: "access" },
      { secret: cfg.JWT_ACCESS_SECRET, expiresIn: cfg.JWT_ACCESS_TTL },
    );
    const refreshToken = this.crypto.randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.crypto.sha256(refreshToken),
        expiresAt: new Date(Date.now() + cfg.JWT_REFRESH_TTL * 1000),
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: cfg.JWT_ACCESS_TTL,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        locale: user.locale,
        preferredCurrency: user.preferredCurrency,
      },
    };
  }
}
