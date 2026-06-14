import { SetMetadata, createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RoleName } from "@renting/shared";

export const IS_PUBLIC_KEY = "isPublic";
/** Route is reachable without a JWT (still rate-limited). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
/** Restrict route to the given roles. super_admin always passes. */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  id: string;
  roles: string[];
  /** Set when the principal is an API key instead of a user. */
  apiKey?: { id: string; scopes: string[] };
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
