/**
 * Closed-form basketball win probability and leverage.
 *
 * The remaining-game margin is modeled as Normal(mu, sigma^2) with
 *   sigma = SIGMA_GAME * sqrt(secondsLeft / 2880)
 *   mu    = currentMargin + HOME_EDGE * secondsLeft / 2880
 * which is the standard Brownian-motion approximation for scoring margin.
 *
 * Leverage = how much one possession (~1.5 pts either way) moves win probability,
 * normalized so that the opening tip of an even game equals 1.0.
 */
export const REGULATION_SECONDS = 2880;
export const PERIOD_SECONDS = 720;
export const OT_SECONDS = 300;
const SIGMA_GAME = 13;
const HOME_EDGE = 2.5;
const SWING = 1.5;

export function normCdf(x: number): number {
  // Abramowitz & Stegun 7.1.26 via erf; |error| < 1.5e-7
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export function secondsLeft(period: number, clock: number): number {
  if (period <= 4) return (4 - period) * PERIOD_SECONDS + Math.max(0, clock);
  return Math.max(0, clock);
}

function params(margin: number, secs: number): { mu: number; sigma: number } {
  const s = Math.max(secs, 2);
  return {
    mu: margin + (HOME_EDGE * secs) / REGULATION_SECONDS,
    sigma: SIGMA_GAME * Math.sqrt(s / REGULATION_SECONDS),
  };
}

/** P(home wins). Ties at 0:00 of regulation count as 0.5 (overtime coin flip). */
export function homeWinProb(homeMinusAway: number, period: number, clock: number): number {
  const secs = secondsLeft(period, clock);
  if (secs <= 0) return homeMinusAway > 0 ? 1 : homeMinusAway < 0 ? 0 : 0.5;
  const { mu, sigma } = params(homeMinusAway, secs);
  return normCdf(mu / sigma);
}

function rawLeverage(margin: number, secs: number): number {
  const { mu, sigma } = params(margin, secs);
  return normCdf((mu + SWING) / sigma) - normCdf((mu - SWING) / sigma);
}

const BASELINE = rawLeverage(0, REGULATION_SECONDS);

export function leverageIndex(homeMinusAway: number, period: number, clock: number): number {
  const secs = secondsLeft(period, clock);
  if (secs <= 0) return homeMinusAway === 0 ? 4 : 0; // tied at the horn -> overtime incoming
  return rawLeverage(homeMinusAway, secs) / BASELINE;
}
