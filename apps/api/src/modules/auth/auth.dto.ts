import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, MinLength } from "class-validator";
import { Gender } from "@renting/shared";

export class RegisterDto {
  @ApiPropertyOptional({ example: "dana@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "+15551234567" })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: "Dana" })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiPropertyOptional({ example: "Customer" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ enum: Gender, example: Gender.Female })
  @IsEnum(Gender)
  gender!: Gender;
}

export class LoginDto {
  @ApiProperty({ description: "Email or phone" })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class OtpRequestDto {
  @ApiProperty({ example: "+15551234567" })
  @IsPhoneNumber()
  phone!: string;
}

export class OtpVerifyDto {
  @ApiProperty({ example: "+15551234567" })
  @IsPhoneNumber()
  phone!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class SocialLoginDto {
  @ApiProperty({ description: "ID token / access token issued by the provider" })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class SocialProviderParam {
  @ApiProperty({ enum: ["google", "apple", "facebook"] })
  @IsIn(["google", "apple", "facebook"])
  provider!: "google" | "apple" | "facebook";
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
