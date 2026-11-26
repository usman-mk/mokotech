import { DataSource, DataSourceOptions } from 'typeorm';
import { AppUser } from '../users/app-user.entity.js';
import { Equipment } from '../equipment/equipment.entity.js';
import { DeferralRequest } from '../deferral/deferral-request.entity.js';
import { InitSeed1764000000000 } from './migrations/1764000000000-InitSeed.js';
import { CreateDeferralRequest1764000000001 } from './migrations/1764000000001-CreateDeferralRequest.js';

// Same URL as docker-compose.yml and ci.yml; env var wins when set.
const DEFAULT_DATABASE_URL =
  'postgresql://appuser:devpassword@localhost:5432/inspection';

// Entities and migrations are listed explicitly (not globbed) so the same
// config works from src/ (vitest), dist/ (app, CLI) and on any OS.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  entities: [AppUser, Equipment, DeferralRequest],
  migrations: [InitSeed1764000000000, CreateDeferralRequest1764000000001],
  synchronize: false,
};

// Used by the TypeORM CLI: `typeorm migration:run -d dist/database/data-source.js`
export default new DataSource(dataSourceOptions);
