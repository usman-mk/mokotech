import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { parseIntId } from '../common/int-id.js';
import type { UserRole } from '../users/app-user.entity.js';
import { UsersService } from '../users/users.service.js';
import {
  AuthenticatedRequest,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from './auth.decorators.js';

export const USER_ID_HEADER = 'x-user-id';

/**
 * Global guard. Per the brief there is no login: the caller is identified by
 * the X-User-Id header and their role is read from app_user.
 *
 * - @Public() routes skip this guard.
 * - Missing, malformed or unknown id -> 401.
 * - @Roles(...) set and the user's role is not listed -> 403.
 */
@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = parseIntId(request.header(USER_ID_HEADER));
    if (userId === null) {
      throw new UnauthorizedException(
        'X-User-Id header is required and must be a positive integer',
      );
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException(`User ${userId} does not exist`);
    }
    request.user = user;

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException(
        `Role '${user.role}' is not allowed; requires: ${roles.join(', ')}`,
      );
    }

    return true;
  }
}
