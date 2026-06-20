import { Body, Controller, Get, HttpStatus, Param, Post, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsIn, IsString, Matches } from "class-validator";
import { Response } from "express";
import { AppException } from "../../common/app.exception";
import { AuthUser, CurrentUser, Public } from "../../common/decorators";
import { ErrorCode } from "@renting/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { MediaService } from "./media.service";

class PresignDto {
  @ApiProperty({ example: "camry-front.jpg" })
  @IsString() @Matches(/^[\w .()-]+$/) fileName!: string;

  @ApiProperty({ example: "image/jpeg", enum: ["image/jpeg", "image/png", "image/webp", "application/pdf"] })
  @IsIn(["image/jpeg", "image/png", "image/webp", "application/pdf"]) contentType!: string;
}

class UploadBase64Dto {
  @ApiProperty({ description: "Data URL: data:<mime>;base64,<data>" })
  @IsString() data!: string;

  @ApiProperty({ example: "license-front.jpg" })
  @IsString() name!: string;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB decoded

@ApiTags("Media")
@ApiBearerAuth()
@Controller("media")
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("presign")
  @ApiOperation({ summary: "Presigned S3 PUT for direct uploads (listing photos, license scans)" })
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.media.presignUpload(user.id, dto.fileName, dto.contentType);
  }

  @Post("upload")
  @ApiOperation({ summary: "Upload a file as a base64 data-URL — stored in DB, no S3 required" })
  async upload(@CurrentUser() _user: AuthUser, @Body() dto: UploadBase64Dto) {
    // expect: "data:image/jpeg;base64,/9j/..."
    const match = dto.data.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) {
      throw new AppException(ErrorCode.ValidationError, "data must be a base64 data URL", HttpStatus.BAD_REQUEST);
    }
    const [, mimeType, b64] = match;
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new AppException(ErrorCode.ValidationError, "Only JPEG, PNG, WEBP and PDF allowed", HttpStatus.BAD_REQUEST);
    }
    const buffer = Buffer.from(b64, "base64");
    if (buffer.byteLength > MAX_BYTES) {
      throw new AppException(ErrorCode.ValidationError, "File exceeds 8 MB limit", HttpStatus.BAD_REQUEST);
    }
    const blob = await this.prisma.mediaBlob.create({
      data: { mimeType, data: buffer },
      select: { id: true },
    });
    return { url: `/api/v1/media/blobs/${blob.id}`, id: blob.id };
  }

  @Public()
  @Get("blobs/:id")
  @ApiOperation({ summary: "Serve a stored media blob" })
  async serveBlob(@Param("id") id: string, @Res({ passthrough: false }) res: Response) {
    const blob = await this.prisma.mediaBlob.findUnique({ where: { id } });
    if (!blob) { res.status(404).json({ success: false, error: { message: "Not found" } }); return; }
    res.setHeader("content-type", blob.mimeType);
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
    res.end(blob.data);
  }
}
