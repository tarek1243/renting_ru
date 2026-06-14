import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { ApiEnvelope } from "@renting/shared";
import { Observable, map } from "rxjs";
import { PAGINATED } from "./pagination";

/** Wraps every successful response in the standard envelope. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope<unknown>> {
    return next.handle().pipe(
      map((body) => {
        if (body && typeof body === "object" && PAGINATED in body) {
          const { items, pagination } = body as any;
          return { success: true, data: items, error: null, meta: { pagination } };
        }
        return { success: true, data: body ?? null, error: null };
      }),
    );
  }
}
