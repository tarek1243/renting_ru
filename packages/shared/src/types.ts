import { AttributeDataType, FilterWidget, PricingUnit } from "./enums";

/** Translated string: locale → text, e.g. { en: "Automatic", ru: "Автомат", ar: "أوتوماتيك" } */
export type I18nText = Record<string, string>;

export interface AttributeOption {
  value: string;
  label: I18nText;
}

export interface AttributeValidation {
  min?: number;
  max?: number;
  regex?: string;
}

/** One field of a category's dynamic schema — drives validation AND search-filter UI. */
export interface CategoryAttributeDef {
  id: string;
  key: string;
  label: I18nText;
  dataType: AttributeDataType;
  options: AttributeOption[] | null;
  unit: string | null;
  validation: AttributeValidation | null;
  isRequired: boolean;
  isFilterable: boolean;
  filterWidget: FilterWidget | null;
  showInCard: boolean;
  sortOrder: number;
}

/** Per-category booking rules stored in rental_categories.config. */
export interface CategoryConfig {
  requiresDriverOption: boolean;
  requiresLicenseVerification: boolean;
  usesCheckInOut: boolean;
  securityDeposit: { required: boolean; type: "percent" | "fixed"; value: number } | null;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  leadTimeMinutes: number;
  /** Free-cancellation window before start, in minutes. */
  freeCancellationMinutes: number;
}

export interface CategoryPricingUnitDef {
  unit: PricingUnit;
  isDefault: boolean;
  minQuantity: number;
  maxQuantity: number;
}

export interface PriceBreakdownLine {
  label: string;
  amount: number;
}

/** Output of POST /listings/:id/quote — the single source of pricing truth. */
export interface Quote {
  currency: string;
  pricingUnit: PricingUnit;
  unitQuantity: number;
  unitPrice: number;
  baseAmount: number;
  seasonalAdjustment: number;
  driverAmount: number;
  extrasAmount: number;
  discountAmount: number;
  taxAmount: number;
  depositAmount: number;
  totalAmount: number;
  lines: PriceBreakdownLine[];
}
