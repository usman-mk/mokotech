import { addDays, daysBetween, isDateOnly } from './date-only.js';

describe('date-only helpers', () => {
  it.each(['2026-01-31', '2024-02-29', '2026-12-31'])(
    'isDateOnly accepts %s',
    (value) => {
      expect(isDateOnly(value)).toBe(true);
    },
  );

  it.each([
    '2026-02-30',
    '2025-02-29', // not a leap year
    '2026-13-01',
    '2026-1-5',
    '2026-01-05T00:00:00Z',
    '',
    20260105,
    null,
  ])('isDateOnly rejects %s', (value) => {
    expect(isDateOnly(value)).toBe(false);
  });

  it.each([
    ['2026-01-01', '2026-01-31', 30],
    ['2026-01-31', '2026-03-02', 30], // across February
    ['2024-02-28', '2024-03-01', 2], // leap year
    ['2026-12-20', '2027-01-19', 30], // across year end
    ['2026-03-10', '2026-03-01', -9],
  ])('daysBetween(%s, %s) = %i', (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected);
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-12-25', 10)).toBe('2027-01-04');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
