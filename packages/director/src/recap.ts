import type { FeedEvent, GameInfo, Side } from './types';
import { durationLabel } from './explain';
import { sportOf } from './sports';

/**
 * "What you missed": a one-line catch-up generated on the device from the
 * play-by-play between when you last saw a game and now (stream time).
 * Picks the single most important storyline: a lead change, a comeback,
 * a run, or a team pulling away. Returns undefined when nothing notable happened
 * (e.g. you only missed a commercial).
 */
export interface Recap {
  label: string; // "While you were away" | "How we got here"
  text: string;
}

export function buildRecap(info: GameInfo, events: FeedEvent[], awayMs: number, firstLook: boolean): Recap | undefined {
  const scoring = events.filter((e) => (e.type === 'score' || e.type === 'freethrow') && e.points && e.team);
  if (!events.length) return undefined;
  const first = events[0];
  const last = events[events.length - 1];
  // Score at the start of the window = first event's score minus its own points.
  const startHome = first.homeScore - (first.team === 'home' && first.points ? first.points : 0);
  const startAway = first.awayScore - (first.team === 'away' && first.points ? first.points : 0);
  const endHome = last.homeScore;
  const endAway = last.awayScore;
  const ptsHome = endHome - startHome;
  const ptsAway = endAway - startAway;
  const sport = sportOf(info);
  const k = sport.recap;
  const unit = sport.unit.one;
  if (ptsHome + ptsAway < k.minTotal) return undefined;

  const code = (s: Side) => (s === 'home' ? info.home.code : info.away.code);
  const startMargin = startHome - startAway;
  const endMargin = endHome - endAway;

  // Biggest unanswered run in the window.
  let run = { side: undefined as Side | undefined, pts: 0 };
  let cur = { side: undefined as Side | undefined, pts: 0 };
  for (const e of scoring) {
    if (e.team === cur.side) cur.pts += e.points!;
    else cur = { side: e.team, pts: e.points! };
    if (cur.pts > run.pts) run = { ...cur };
  }

  // Lead changes.
  let leadChanges = 0;
  let prevSign = Math.sign(startMargin);
  for (const e of scoring) {
    const s = Math.sign(e.homeScore - e.awayScore);
    if (s !== 0 && prevSign !== 0 && s !== prevSign) leadChanges++;
    if (s !== 0) prevSign = s;
  }

  const leader = endMargin > 0 ? 'home' : endMargin < 0 ? 'away' : undefined;
  const scoreNow = `${info.away.code} ${endAway}–${endHome} ${info.home.code}`;
  const span = durationLabel(awayMs);
  const outscorer: Side = ptsHome >= ptsAway ? 'home' : 'away';
  const ptsFor = Math.max(ptsHome, ptsAway);
  const ptsAgainst = Math.min(ptsHome, ptsAway);

  const lc = leadChanges >= 2 ? ` ${leadChanges} lead changes.` : '';
  let text: string;
  if (leader && startMargin !== 0 && Math.sign(startMargin) !== Math.sign(endMargin)) {
    const deficit = Math.abs(startMargin);
    const how = run.pts >= k.run - 1 && run.side === leader ? ` on ${k.runPhrase(run.pts)}` : '';
    text =
      deficit >= k.comeback
        ? `${code(leader)} erased a ${deficit}-${unit} deficit${how} and leads. ${scoreNow}.`
        : `${code(leader)} took the lead${how}. ${scoreNow}.`;
  } else if (!leader) {
    const tier: Side | undefined = startMargin > 0 ? 'away' : startMargin < 0 ? 'home' : undefined;
    text =
      tier && Math.abs(startMargin) >= k.comeback
        ? `${code(tier)} came back from ${Math.abs(startMargin)} down to tie it at ${endHome}.`
        : `Back and forth: tied at ${endHome}.`;
  } else if (Math.abs(endMargin) - Math.abs(startMargin) >= k.pullAway) {
    text = `${code(leader)} pulled away, ${ptsFor}–${ptsAgainst} over that stretch. ${scoreNow}.`;
  } else if (Math.abs(startMargin) - Math.abs(endMargin) >= k.cut) {
    text = `${code(outscorer)} cut a ${Math.abs(startMargin)}-${unit} lead to ${Math.abs(endMargin)}. ${scoreNow}.`;
  } else if (run.pts >= k.run && run.side) {
    text = `${code(run.side)} ${sport.id === 'nba' ? 'went on' : 'scored'} ${k.runPhrase(run.pts)}. ${scoreNow}.`;
  } else if (leadChanges >= 2) {
    text = `The lead changed hands ${leadChanges} times. ${scoreNow}.`;
    return { label: firstLook ? `How we got here · last ${span}` : `While you were away · ${span}`, text };
  } else return undefined;
  text += lc;
  return { label: firstLook ? `How we got here · last ${span}` : `While you were away · ${span}`, text };
}
