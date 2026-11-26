import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppUser, UserRole } from '../users/app-user.entity.js';
import type { UsersService } from '../users/users.service.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators.js';
import { CurrentUserGuard } from './current-user.guard.js';

const supervisor: AppUser = {
  id: 3,
  username: 'wichai.k',
  fullName: 'Wichai Kaewsri',
  role: 'supervisor',
};

function setup(opts: {
  header?: string;
  isPublic?: boolean;
  roles?: UserRole[];
  user?: AppUser | null;
}) {
  const request: {
    user?: AppUser;
    header: (name: string) => string | undefined;
  } = {
    header: (name) => (name === 'x-user-id' ? opts.header : undefined),
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const reflector = {
    getAllAndOverride: (key: string) =>
      key === IS_PUBLIC_KEY
        ? opts.isPublic
        : key === ROLES_KEY
          ? opts.roles
          : undefined,
  } as unknown as Reflector;

  const findById = vi.fn().mockResolvedValue(opts.user ?? null);
  const users = { findById } as unknown as UsersService;

  return {
    guard: new CurrentUserGuard(reflector, users),
    context,
    request,
    findById,
  };
}

describe('CurrentUserGuard', () => {
  it('lets @Public() routes through without a header or DB lookup', async () => {
    const { guard, context, findById } = setup({ isPublic: true });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });

  it('401 without X-User-Id', async () => {
    const { guard, context } = setup({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('401 for an unknown user', async () => {
    const { guard, context, findById } = setup({ header: '999', user: null });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findById).toHaveBeenCalledWith(999);
  });

  it('attaches the user to the request', async () => {
    const { guard, context, request } = setup({
      header: '3',
      user: supervisor,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(supervisor);
  });

  it('allows a role listed in @Roles()', async () => {
    const { guard, context } = setup({
      header: '3',
      user: supervisor,
      roles: ['supervisor', 'department_manager'],
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('403 for a role not listed in @Roles()', async () => {
    const { guard, context } = setup({
      header: '3',
      user: supervisor,
      roles: ['department_manager'],
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
