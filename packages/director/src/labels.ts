/** Basketball-style period and clock labels (also the defaults for other clock sports). */
export function periodLabel(period: number): string {
  if (period <= 4) return ['1st', '2nd', '3rd', '4th'][period - 1];
  return period === 5 ? 'OT' : `${period - 4}OT`;
}

export function clockLabel(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 60) return `${s.toFixed(1)}`;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}
