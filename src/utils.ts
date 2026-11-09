/** Форматує тривалість у хвилинах і секундах, відкидаючи мілісекунди. */
export function formatDuration(ms: number): string {
  const totalSeconds: number = Math.floor(ms / 1000);
  const minutes: number = Math.floor(totalSeconds / 60);
  const seconds: number = totalSeconds % 60;

  return `${minutes}m ${seconds}s`;
}
