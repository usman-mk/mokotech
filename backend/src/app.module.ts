import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { dataSourceOptions } from './database/data-source.js';

@Module({
  imports: [
    // migrationsRun: pending migrations apply on startup, so `npm run start:dev`
    // is enough after `docker compose up -d`.
    TypeOrmModule.forRoot({ ...dataSourceOptions, migrationsRun: true }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
