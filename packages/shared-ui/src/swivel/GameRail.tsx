import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { durationLabel, gameClock, sportOf, type BreakKind, type DirectorView, type GameInsight, type SportId } from '@swivel/director';
import { fb, px, type } from './theme';

interface Props {
  view: DirectorView;
  order: string[];
  /** 0 = "Your teams" button, 1..n = games in `order`; null = no focus shown. */
  focused: number | null;
  favorites: string[];
}

function statusOf(g: GameInsight, t: number): { text: string; color: string } {
  const s = g.screen;
  if (s.phase === 'final') return { text: 'Final', color: fb.dim };
  if (s.phase === 'pregame') {
    const mins = Math.max(0, Math.round((g.info.scheduledStart - t) / 60000));
    const [soon, now] = START_WORDS[sportOf(g.info).id];
    return { text: mins > 0 ? `${soon} ${mins}m` : now, color: fb.dim };
  }
  if (s.phase === 'break') {
    const kind = s.breakKind ?? 'timeout';
    if (g.resumeIncomingInMs !== undefined) return { text: `Back in ${durationLabel(g.resumeIncomingInMs)}`, color: fb.amber };
    const short = kind === 'inning' ? gameClock(g)[0] : kind === 'mandatory' && g.info.sport === 'nfl' ? 'TV timeout' : SHORT_BREAKS[kind];
    const el = g.breakElapsedMs;
    return { text: kind === 'halftime' || el === undefined ? short : `${short} ${durationLabel(el)}`, color: fb.buzzer };
  }
  return { text: gameClock(g).join(' '), color: fb.chalk };
}

const START_WORDS = { nba: ['Tips in', 'Tip-off'], nfl: ['Kickoff in', 'Kickoff'], mlb: ['First pitch in', 'First pitch'] } as const;

const SHORT_BREAKS: Record<BreakKind, string> = {
  timeout: 'Timeout',
  mandatory: 'Media break',
  quarter: 'Qtr break',
  halftime: 'Halftime',
  overtime: 'To OT',
  review: 'Review',
  twominute: '2-min warning',
  inning: 'Inning break',
  pitching: 'Pitching chg',
};

/** A tiny ball so mixed nights show each game's sport without crowding the scores. */
function SportGlyph({ sport }: { sport: SportId }) {
  if (sport === 'nfl') {
    return (
      <View style={[styles.glyph, { width: px(22), height: px(14), borderRadius: px(7), backgroundColor: '#8B4A2B', justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ width: px(9), height: px(2), backgroundColor: fb.chalk }} />
      </View>
    );
  }
  if (sport === 'mlb') {
    return <View style={[styles.glyph, { width: px(16), height: px(16), borderRadius: px(8), backgroundColor: fb.chalk, borderWidth: px(2), borderColor: '#D62828' }]} />;
  }
  return (
    <View style={[styles.glyph, { width: px(16), height: px(16), borderRadius: px(8), backgroundColor: '#E07A1F', justifyContent: 'center' }]}>
      <View style={{ height: px(1.5), backgroundColor: '#3B1F0A' }} />
    </View>
  );
}

/** Leverage as a 0..1 meter: log scale, 1 = an even opening tip, full = last-possession drama. */
function heat(g: GameInsight): number {
  if (g.screen.phase === 'final' || g.screen.phase === 'pregame') return 0;
  return Math.max(0.03, Math.min(1, Math.log2(1 + g.leverage) / 3));
}

function Row({
  g,
  t,
  onScreen,
  audio,
  focused,
  favorite,
  showSport,
}: {
  g: GameInsight;
  t: number;
  onScreen: boolean;
  audio: boolean;
  focused: boolean;
  favorite: boolean;
  showSport: boolean;
}) {
  const st = statusOf(g, t);
  const h = heat(g);
  const hot = g.tags.includes('crunch') || g.tags.includes('overtime');
  const final = g.screen.phase === 'final';
  const lines: Array<[typeof g.info.away, number]> = [
    [g.info.away, g.screen.awayScore],
    [g.info.home, g.screen.homeScore],
  ];
  return (
    <View style={[styles.row, onScreen && styles.rowOnScreen, focused && styles.rowFocused]}>
      <View style={{ flex: 1 }}>
        {lines.map(([team, score], i) => (
          <View key={team.code} style={styles.teamLine}>
            <View style={[styles.chip, { backgroundColor: team.color }]} />
            <Text style={[styles.code, final && { color: fb.haze }]}>{team.code}</Text>
            <Text style={[styles.score, type.digits, final && { color: fb.haze }]}>
              {g.screen.phase === 'pregame' ? '' : String(score)}
            </Text>
            {showSport && i === 0 && <SportGlyph sport={sportOf(g.info).id} />}
          </View>
        ))}
      </View>
      <View style={styles.right}>
        <Text style={[styles.status, type.digits, { color: st.color }]}>{st.text}</Text>
        <View style={styles.meter}>
          <View style={[styles.meterFill, { width: `${Math.round(h * 100)}%`, backgroundColor: hot ? fb.amber : fb.haze }]} />
        </View>
        <Text style={styles.marks}>
          {[favorite ? 'Your team' : '', audio ? 'Audio' : onScreen ? 'On screen' : ''].filter(Boolean).join('  ·  ')}
        </Text>
      </View>
    </View>
  );
}

export default function GameRail({ view, order, focused, favorites }: Props) {
  const byId = new Map(view.insights.map((g) => [g.info.id, g]));
  // Only label each game's sport on nights with more than one.
  const mixed = new Set(view.insights.map((g) => g.info.sport ?? 'nba')).size > 1;
  return (
    <View style={styles.rail}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tonight</Text>
        <View style={[styles.teamsBtn, focused === 0 && styles.teamsBtnFocused]}>
          <Text style={[styles.teamsBtnText, focused === 0 && { color: fb.ink }]}>Your teams</Text>
        </View>
      </View>
      {order.map((id, i) => {
        const g = byId.get(id)!;
        const fav = [g.info.home.code, g.info.away.code].some((c) => favorites.includes(c));
        return (
          <Row
            key={id}
            g={g}
            t={view.t}
            onScreen={view.slots.includes(id)}
            audio={view.audio === id}
            focused={focused === i + 1}
            favorite={fav}
            showSport={mixed}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: px(500), flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: px(14), height: px(56) },
  headerTitle: { fontSize: px(34), fontWeight: '800', color: fb.chalk },
  teamsBtn: { borderRadius: px(8), borderWidth: px(2), borderColor: fb.line, paddingHorizontal: px(18), paddingVertical: px(8) },
  teamsBtnFocused: { backgroundColor: fb.amber, borderColor: fb.amber },
  teamsBtnText: { fontSize: px(22), fontWeight: '700', color: fb.chalk },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: px(100),
    paddingHorizontal: px(16),
    marginBottom: px(8),
    borderRadius: px(10),
    backgroundColor: fb.inkRaised,
    borderLeftWidth: px(6),
    borderLeftColor: 'transparent',
    borderWidth: px(3),
    borderColor: 'transparent',
  },
  rowOnScreen: { borderLeftColor: fb.amber, backgroundColor: fb.inkHigh },
  rowFocused: { borderColor: fb.amber },
  teamLine: { flexDirection: 'row', alignItems: 'center', height: px(38) },
  chip: { width: px(10), height: px(26), borderRadius: px(2), marginRight: px(12) },
  code: { fontSize: px(26), fontWeight: '800', color: fb.chalk, width: px(76) },
  score: { fontSize: px(30), color: fb.chalk },
  right: { width: px(240), alignItems: 'flex-end' },
  status: { fontSize: px(22), fontWeight: '700', textAlign: 'right' },
  meter: { width: px(160), height: px(8), borderRadius: px(4), backgroundColor: fb.line, marginTop: px(10), overflow: 'hidden' },
  meterFill: { height: px(8), borderRadius: px(4) },
  glyph: { marginLeft: 'auto', marginRight: px(14) },
  marks: { fontSize: px(17), fontWeight: '600', color: fb.amber, marginTop: px(8), height: px(22) },
});
