import { describe, expect, it } from 'vitest';

import { formatDuration } from './utils';

describe('formatDuration', () => {
  it('formats zero and durations shorter than a minute', () => {
    expect(formatDuration(0)).toBe('0m 0s');
    expect(formatDuration(5_999)).toBe('0m 5s');
  });

  it('formats whole minutes with remaining seconds', () => {
    expect(formatDuration(90_000)).toBe('1m 30s');
    expect(formatDuration(125_000)).toBe('2m 5s');
  });

  it('drops fractional seconds', () => {
    expect(formatDuration(61_999)).toBe('1m 1s');
  });
});
