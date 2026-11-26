import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeferralController } from './deferral.controller.js';
import { DeferralRequest } from './deferral-request.entity.js';
import { DeferralService } from './deferral.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([DeferralRequest])],
  controllers: [DeferralController],
  providers: [DeferralService],
})
export class DeferralModule {}
