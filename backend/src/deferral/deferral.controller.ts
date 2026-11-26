import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { parseIntId } from '../common/int-id.js';
import { AppUser } from '../users/app-user.entity.js';
import { DeferralRequest } from './deferral-request.entity.js';
import {
  ApproveDeferralDto,
  CreateDeferralRequestDto,
  RejectDeferralDto,
} from './deferral.dto.js';
import { DeferralService } from './deferral.service.js';

@Controller('deferral-requests')
export class DeferralController {
  constructor(private readonly deferrals: DeferralService) {}

  /** Any user may submit a request. */
  @Post()
  create(
    @CurrentUser() user: AppUser,
    @Body() dto: CreateDeferralRequestDto,
  ): Promise<DeferralRequest> {
    return this.deferrals.create(user, dto);
  }

  @Get()
  findAll(): Promise<DeferralRequest[]> {
    return this.deferrals.findAll();
  }

  /** The current approver's queue. Declared before ':id' so it matches first. */
  @Roles('supervisor', 'department_manager')
  @Get('pending-approvals')
  findPendingForMe(@CurrentUser() user: AppUser): Promise<DeferralRequest[]> {
    return this.deferrals.findPendingFor(user);
  }

  @Get(':id')
  findOne(@Param('id') rawId: string): Promise<DeferralRequest> {
    return this.deferrals.findById(this.parseId(rawId));
  }

  @Roles('supervisor', 'department_manager')
  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() user: AppUser,
    @Param('id') rawId: string,
    @Body() dto: ApproveDeferralDto,
  ): Promise<DeferralRequest> {
    return this.deferrals.approve(user, this.parseId(rawId), dto);
  }

  @Roles('supervisor', 'department_manager')
  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: AppUser,
    @Param('id') rawId: string,
    @Body() dto: RejectDeferralDto,
  ): Promise<DeferralRequest> {
    return this.deferrals.reject(user, this.parseId(rawId), dto);
  }

  private parseId(rawId: string): number {
    const id = parseIntId(rawId);
    if (id === null) {
      throw new NotFoundException(`Deferral request ${rawId} not found`);
    }
    return id;
  }
}
