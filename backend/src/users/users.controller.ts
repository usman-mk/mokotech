import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Public } from '../auth/auth.decorators.js';
import { AppUser } from './app-user.entity.js';
import { UsersService } from './users.service.js';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Public so the frontend can offer a user switcher before one is chosen. */
  @Public()
  @Get('users')
  findAll(): Promise<AppUser[]> {
    return this.users.findAll();
  }

  /** The user identified by X-User-Id. */
  @Get('me')
  me(@CurrentUser() user: AppUser): AppUser {
    return user;
  }
}
