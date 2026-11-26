import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentUserGuard } from './auth/current-user.guard.js';
import { dataSourceOptions } from './database/data-source.js';
import { DeferralModule } from './deferral/deferral.module.js';
import { EquipmentModule } from './equipment/equipment.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // migrationsRun: pending migrations apply on startup, so `npm run start:dev`
    // is enough after `docker compose up -d`.
    TypeOrmModule.forRoot({ ...dataSourceOptions, migrationsRun: true }),
    UsersModule,
    EquipmentModule,
    DeferralModule,
  ],
  providers: [
    // Every route requires X-User-Id unless marked @Public().
    { provide: APP_GUARD, useClass: CurrentUserGuard },
  ],
})
export class AppModule {}
