import { describe, expect, it } from 'vitest';

import { formatDuration } from './utils';

describe('formatDuration', () => {
  it('formats zero and durations shorter than a second', () => {
    expect(formatDuration(0)).toBe('0m 0s');
    expect(formatDuration(999)).toBe('0m 0s');
  });

  it('formats seconds and drops fractional seconds', () => {
    expect(formatDuration(5_999)).toBe('0m 5s');
  });

  it('formats minutes and remaining seconds', () => {
    expect(formatDuration(65_000)).toBe('1m 5s');
  });

  it('formats durations longer than an hour without wrapping minutes', () => {
    expect(formatDuration(3_661_000)).toBe('61m 1s');
  });
});
