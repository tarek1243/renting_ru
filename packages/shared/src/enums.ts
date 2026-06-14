export enum RoleName {
  Customer = "customer",
  Driver = "driver",
  Staff = "staff",
  SuperAdmin = "super_admin",
}

export enum BookingStatus {
  Pending = "pending",
  Confirmed = "confirmed",
  Ongoing = "ongoing",
  Completed = "completed",
  Cancelled = "cancelled",
  Rejected = "rejected",
}

/** Allowed booking state-machine transitions. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.Pending]: [BookingStatus.Confirmed, BookingStatus.Rejected, BookingStatus.Cancelled],
  [BookingStatus.Confirmed]: [BookingStatus.Ongoing, BookingStatus.Cancelled],
  [BookingStatus.Ongoing]: [BookingStatus.Completed, BookingStatus.Cancelled],
  [BookingStatus.Completed]: [],
  [BookingStatus.Cancelled]: [],
  [BookingStatus.Rejected]: [],
};

export enum PricingUnit {
  Hour = "hour",
  Day = "day",
  Week = "week",
  Night = "night",
  Month = "month",
}

/** Minutes represented by one pricing unit (months approximated as 30 days). */
export const PRICING_UNIT_MINUTES: Record<PricingUnit, number> = {
  [PricingUnit.Hour]: 60,
  [PricingUnit.Day]: 1440,
  [PricingUnit.Week]: 10080,
  [PricingUnit.Night]: 1440,
  [PricingUnit.Month]: 43200,
};

export enum ListingStatus {
  Draft = "draft",
  Active = "active",
  Inactive = "inactive",
  Maintenance = "maintenance",
}

export enum AttributeDataType {
  Text = "text",
  Number = "number",
  Boolean = "boolean",
  Select = "select",
  Multiselect = "multiselect",
}

export enum FilterWidget {
  Checkbox = "checkbox",
  Select = "select",
  Range = "range",
  Toggle = "toggle",
}

export enum PaymentGateway {
  Stripe = "stripe",
  Regional = "regional",
  Cash = "cash",
}

export enum PaymentType {
  Charge = "charge",
  Refund = "refund",
  DepositHold = "deposit_hold",
  DepositRelease = "deposit_release",
}

export enum PaymentStatus {
  Pending = "pending",
  Authorized = "authorized",
  Captured = "captured",
  Failed = "failed",
  Refunded = "refunded",
}

export enum PaymentMethod {
  Online = "online",
  OnPickup = "on_pickup",
}

export enum ReviewStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

export enum LicenseStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

export enum AvailabilityReason {
  Booking = "booking",
  Maintenance = "maintenance",
  Manual = "manual",
}

export enum WebhookEvent {
  BookingCreated = "booking.created",
  BookingConfirmed = "booking.confirmed",
  BookingCancelled = "booking.cancelled",
  BookingCompleted = "booking.completed",
}

export enum NotificationChannel {
  Email = "email",
  Sms = "sms",
  Push = "push",
}
