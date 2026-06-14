import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser, Public, AuthUser } from "../../common/decorators";
import {
  ForgotPasswordDto, LoginDto, OtpRequestDto, OtpVerifyDto, RefreshDto,
  RegisterDto, ResetPasswordDto, SocialLoginDto, SocialProviderParam,
} from "./auth.dto";
import { AuthService } from "./auth.service";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("register")
  @ApiOperation({ summary: "Register with email/phone + password" })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  @ApiOperation({ summary: "Login with email-or-phone + password" })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.identifier, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("otp/request")
  @ApiOperation({ summary: "Send a one-time SMS code" })
  otpRequest(@Body() dto: OtpRequestDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("otp/verify")
  @ApiOperation({ summary: "Exchange SMS code for a token pair (registers on first login)" })
  otpVerify(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Public()
  @Post("social/:provider")
  @ApiOperation({ summary: "Login with a social provider token (google | apple | facebook)" })
  social(@Param() params: SocialProviderParam, @Body() dto: SocialLoginDto) {
    return this.auth.socialLogin(params.provider, dto.token);
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Rotate refresh token, get a new pair" })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke refresh token(s) for the current user" })
  logout(@CurrentUser() user: AuthUser, @Body() dto: Partial<RefreshDto>) {
    return this.auth.logout(user.id, dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("password/forgot")
  @ApiOperation({ summary: "Request a password-reset email" })
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post("password/reset")
  @ApiOperation({ summary: "Reset password with the emailed token" })
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}
