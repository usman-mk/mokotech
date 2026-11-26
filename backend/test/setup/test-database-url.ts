/**
 * Tests delete and reset rows, so they never run against the development
 * database: `.../inspection` becomes `.../inspection_test`.
 */
export function toTestDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const name = url.pathname.slice(1);
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Unexpected database name in DATABASE_URL: "${name}"`);
  }
  if (!name.endsWith('_test')) {
    url.pathname = `/${name}_test`;
  }
  return url.toString();
}

export function databaseName(databaseUrl: string): string {
  return new URL(databaseUrl).pathname.slice(1);
}
