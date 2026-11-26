import { loadRootEnvFile, requireEnv } from '../../src/config/env.js';
import { toTestDatabaseUrl } from './test-database-url.js';

// Runs in every test worker before the test file is imported, so
// data-source.ts already sees the test database URL.
loadRootEnvFile();
process.env.DATABASE_URL = toTestDatabaseUrl(requireEnv('DATABASE_URL'));
