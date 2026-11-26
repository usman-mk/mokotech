import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AppUser, UserRole } from '../users/app-user.entity.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Route needs no X-User-Id (e.g. the user list used to pick a user). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Route is limited to these roles (checked after the user is identified). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Request after CurrentUserGuard has identified the caller. */
export interface AuthenticatedRequest extends Request {
  user: AppUser;
}

/** Injects the user identified from the X-User-Id header. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AppUser =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
