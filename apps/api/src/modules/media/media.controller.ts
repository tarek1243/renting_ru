import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsIn, IsString, Matches } from "class-validator";
import { AuthUser, CurrentUser } from "../../common/decorators";
import { MediaService } from "./media.service";

class PresignDto {
  @ApiProperty({ example: "camry-front.jpg" })
  @IsString() @Matches(/^[\w .()-]+$/) fileName!: string;

  @ApiProperty({ example: "image/jpeg", enum: ["image/jpeg", "image/png", "image/webp", "application/pdf"] })
  @IsIn(["image/jpeg", "image/png", "image/webp", "application/pdf"]) contentType!: string;
}

@ApiTags("Media")
@ApiBearerAuth()
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("presign")
  @ApiOperation({
    summary: "Presigned S3 PUT for direct uploads (listing photos, license scans)",
    description: "Upload with HTTP PUT to uploadUrl, then store publicUrl on the entity. Works for web and mobile identically.",
  })
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.media.presignUpload(user.id, dto.fileName, dto.contentType);
  }
}
