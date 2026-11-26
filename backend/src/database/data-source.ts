import { DataSource, DataSourceOptions } from 'typeorm';
import { loadRootEnvFile, requireEnv } from '../config/env.js';
import { AppUser } from '../users/app-user.entity.js';
import { Equipment } from '../equipment/equipment.entity.js';
import { DeferralRequest } from '../deferral/deferral-request.entity.js';
import { InitSeed1764000000000 } from './migrations/1764000000000-InitSeed.js';
import { CreateDeferralRequest1764000000001 } from './migrations/1764000000001-CreateDeferralRequest.js';

// No credentials in code: DATABASE_URL comes from the environment (CI) or
// from <repo root>/.env (local dev).
loadRootEnvFile();

// Entities and migrations are listed explicitly (not globbed) so the same
// config works from src/ (vitest), dist/ (app, CLI) and on any OS.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: requireEnv('DATABASE_URL'),
  entities: [AppUser, Equipment, DeferralRequest],
  migrations: [InitSeed1764000000000, CreateDeferralRequest1764000000001],
  synchronize: false,
};

// Used by the TypeORM CLI: `typeorm migration:run -d dist/database/data-source.js`
export default new DataSource(dataSourceOptions);
