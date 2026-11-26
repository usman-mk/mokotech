import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// <repo root>/.env — same depth from src/config and dist/config.
const ROOT_ENV_FILE = fileURLToPath(new URL('../../../.env', import.meta.url));

/**
 * Loads <repo root>/.env if it exists (local dev). Variables already set in the
 * environment (e.g. DATABASE_URL in CI) are not overridden.
 */
export function loadRootEnvFile(): void {
  if (existsSync(ROOT_ENV_FILE)) {
    process.loadEnvFile(ROOT_ENV_FILE);
  }
}

/** Returns the variable or fails fast with a hint instead of a vague DB error. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env at the repo root, or export ${name}.`,
    );
  }
  return value;
}
