import { ErrorCode } from "./errors";

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}

/** Every API response — success or failure — uses this envelope. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta?: { pagination?: PaginationMeta } & Record<string, unknown>;
}

export interface ListQuery {
  page?: number;
  perPage?: number;
  sort?: string;
  order?: "asc" | "desc";
}
