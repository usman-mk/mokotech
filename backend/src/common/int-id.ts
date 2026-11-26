// Postgres `integer` max. Ids above this would make pg throw (500) instead of
// simply "not found", so they are rejected up front.
const PG_INT4_MAX = 2_147_483_647;

/** Parses a positive integer id from a string; returns null if invalid. */
export function parseIntId(raw: string | undefined): number | null {
  if (raw === undefined || !/^[1-9]\d*$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return id <= PG_INT4_MAX ? id : null;
}
