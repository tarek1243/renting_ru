import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "@renting/shared";

/** Domain exception carrying a stable machine-readable error code. */
export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }

  static notFound(message = "Resource not found") {
    return new AppException(ErrorCode.NotFound, message, HttpStatus.NOT_FOUND);
  }

  static forbidden(message = "Forbidden") {
    return new AppException(ErrorCode.Forbidden, message, HttpStatus.FORBIDDEN);
  }

  static categoryDisabled(slug: string) {
    return new AppException(
      ErrorCode.CategoryDisabled,
      `Category '${slug}' is currently disabled`,
      HttpStatus.FORBIDDEN,
    );
  }
}
