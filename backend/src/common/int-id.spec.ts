import { parseIntId } from './int-id.js';

describe('parseIntId', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['2147483647', 2147483647],
  ])('accepts %s', (raw, expected) => {
    expect(parseIntId(raw)).toBe(expected);
  });

  it.each([
    [undefined],
    [''],
    ['0'],
    ['-1'],
    ['01'],
    ['1.5'],
    ['1e3'],
    [' 1'],
    ['abc'],
    ['2147483648'], // above Postgres integer max
  ])('rejects %s', (raw) => {
    expect(parseIntId(raw)).toBeNull();
  });
});
