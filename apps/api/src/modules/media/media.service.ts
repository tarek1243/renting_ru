import { HttpStatus, Injectable } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ErrorCode } from "@renting/shared";
import * as crypto from "crypto";
import { AppException } from "../../common/app.exception";
import { config } from "../../config/config";

@Injectable()
export class MediaService {
  private client: S3Client | null = null;

  private s3(): S3Client {
    const cfg = config();
    if (!cfg.S3_ENDPOINT || !cfg.S3_ACCESS_KEY) {
      throw new AppException(ErrorCode.Internal, "Object storage is not configured", HttpStatus.NOT_IMPLEMENTED);
    }
    if (!this.client) {
      this.client = new S3Client({
        endpoint: cfg.S3_ENDPOINT,
        region: cfg.S3_REGION,
        forcePathStyle: true, // MinIO compatibility
        credentials: { accessKeyId: cfg.S3_ACCESS_KEY, secretAccessKey: cfg.S3_SECRET_KEY ?? "" },
      });
    }
    return this.client;
  }

  async presignUpload(userId: string, fileName: string, contentType: string) {
    const cfg = config();
    const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const key = `uploads/${userId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const uploadUrl = await getSignedUrl(
      this.s3(),
      new PutObjectCommand({ Bucket: cfg.S3_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 600 },
    );
    return {
      uploadUrl,
      method: "PUT",
      headers: { "content-type": contentType },
      key,
      publicUrl: `${cfg.S3_PUBLIC_URL ?? `${cfg.S3_ENDPOINT}/${cfg.S3_BUCKET}`}/${key}`,
      expiresIn: 600,
    };
  }
}
