import {
  Body, Controller, Get, HttpStatus, Param, Post, Res,
  UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
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

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags("Media")
@ApiBearerAuth()
@Controller("media")
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("presign")
  @ApiOperation({
    summary: "Presigned S3 PUT for direct uploads (listing photos, license scans)",
    description: "Upload with HTTP PUT to uploadUrl, then store publicUrl on the entity. Works for web and mobile identically.",
  })
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.media.presignUpload(user.id, dto.fileName, dto.contentType);
  }

  @Post("upload")
  @ApiOperation({ summary: "Direct file upload — stores in DB and returns a public URL (no S3 required)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES } }))
  async upload(@CurrentUser() _user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new AppException(ErrorCode.ValidationError, "No file provided", HttpStatus.BAD_REQUEST);
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new AppException(ErrorCode.ValidationError, "Only JPEG, PNG, WEBP and PDF allowed", HttpStatus.BAD_REQUEST);
    }
    const blob = await this.prisma.mediaBlob.create({
      data: { mimeType: file.mimetype, data: file.buffer },
      select: { id: true },
    });
    return { url: `/api/v1/media/blobs/${blob.id}`, id: blob.id };
  }

  @Public()
  @Get("blobs/:id")
  @ApiOperation({ summary: "Serve a stored media blob" })
  async serveBlob(@Param("id") id: string, @Res() res: Response) {
    const blob = await this.prisma.mediaBlob.findUnique({ where: { id } });
    if (!blob) throw AppException.notFound("Media not found");
    res.setHeader("content-type", blob.mimeType);
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
    res.send(blob.data);
  }
}
