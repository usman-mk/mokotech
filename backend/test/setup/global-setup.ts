import pg from 'pg';
import { loadRootEnvFile, requireEnv } from '../../src/config/env.js';
import { databaseName, toTestDatabaseUrl } from './test-database-url.js';

/**
 * Runs once before all test files: creates the `<db>_test` database if it is
 * missing (connecting through DATABASE_URL). Migrations then run when each
 * test boots the app, so the database needs no other preparation.
 */
export default async function globalSetup(): Promise<void> {
  loadRootEnvFile();
  const baseUrl = requireEnv('DATABASE_URL');
  const testDb = databaseName(toTestDatabaseUrl(baseUrl));

  const client = new pg.Client({ connectionString: baseUrl });
  await client.connect();
  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [testDb],
    );
    if (existing.rowCount === 0) {
      // Name is validated in toTestDatabaseUrl (letters, digits, underscore).
      await client.query(`CREATE DATABASE "${testDb}"`);
    }
  } finally {
    await client.end();
  }
}
