/**
 * Stable machine-readable error codes. Mobile and web clients switch on these,
 * never on HTTP status or human-readable messages.
 */
export enum ErrorCode {
  // generic
  ValidationError = "VALIDATION_ERROR",
  NotFound = "NOT_FOUND",
  Unauthorized = "UNAUTHORIZED",
  Forbidden = "FORBIDDEN",
  RateLimited = "RATE_LIMITED",
  Conflict = "CONFLICT",
  Internal = "INTERNAL_ERROR",

  // auth
  InvalidCredentials = "INVALID_CREDENTIALS",
  TokenExpired = "TOKEN_EXPIRED",
  TokenInvalid = "TOKEN_INVALID",
  OtpInvalid = "OTP_INVALID",
  OtpExpired = "OTP_EXPIRED",
  EmailTaken = "EMAIL_TAKEN",
  PhoneTaken = "PHONE_TAKEN",
  AccountSuspended = "ACCOUNT_SUSPENDED",

  // category engine
  CategoryDisabled = "CATEGORY_DISABLED",
  CategoryNotFound = "CATEGORY_NOT_FOUND",
  AttributeValidationFailed = "ATTRIBUTE_VALIDATION_FAILED",
  PricingUnitNotSupported = "PRICING_UNIT_NOT_SUPPORTED",

  // booking
  ListingUnavailable = "LISTING_UNAVAILABLE",
  ListingNotActive = "LISTING_NOT_ACTIVE",
  BookingInvalidTransition = "BOOKING_INVALID_TRANSITION",
  BookingNotModifiable = "BOOKING_NOT_MODIFIABLE",
  DurationOutOfRange = "DURATION_OUT_OF_RANGE",
  DriverNotAvailable = "DRIVER_NOT_AVAILABLE",
  DriverOptionNotSupported = "DRIVER_OPTION_NOT_SUPPORTED",
  LicenseRequired = "LICENSE_REQUIRED",

  // money
  CouponInvalid = "COUPON_INVALID",
  CouponExpired = "COUPON_EXPIRED",
  CouponUsageExceeded = "COUPON_USAGE_EXCEEDED",
  PaymentFailed = "PAYMENT_FAILED",
  RefundFailed = "REFUND_FAILED",
  CurrencyNotSupported = "CURRENCY_NOT_SUPPORTED",
}
