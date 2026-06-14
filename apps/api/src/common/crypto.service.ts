import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import { config } from "../config/config";

/** AES-256-GCM for sensitive-at-rest fields (license numbers etc.). */
@Injectable()
export class CryptoService {
  private key = Buffer.from(config().ENCRYPTION_KEY, "utf8");

  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
  }

  decrypt(payload: string): string {
    const [iv, tag, data] = payload.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  }

  sha256(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  randomToken(bytes = 48): string {
    return crypto.randomBytes(bytes).toString("hex");
  }

  hmac(secret: string, payload: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }
}
