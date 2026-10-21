import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  breakName,
  durationLabel,
  gameClock,
  isCommercial,
  runnersLabel,
  sportOf,
  type GameInsight,
} from '@swivel/director';
import { fb, px, type } from './theme';

interface Props {
  g: GameInsight;
  width: number;
  height: number;
  audio: boolean;
  focused: boolean;
  compact: boolean;
}

// Court dimensions in feet.
const CW = 94;
const CH = 50;

/** Ten players drifting around a formation, deterministic from wall time. */
function players(seed: number, offenseLeft: boolean, now: number) {
  const base: Array<[number, number]> = [
    [70, 25], [64, 10], [64, 40], [84, 8], [84, 42], // offense (attacking right)
    [76, 25], [70, 14], [70, 36], [86, 15], [86, 35], // defense
  ];
  return base.map(([x, y], i) => {
    const ph = seed * 0.37 + i * 1.7;
    const dx = Math.sin(now / 900 + ph) * 3.2 + Math.sin(now / 2300 + ph * 2) * 2;
    const dy = Math.cos(now / 1100 + ph) * 2.6;
    const fx = offenseLeft ? CW - (x + dx) : x + dx;
    return { x: fx, y: Math.min(CH - 2, Math.max(2, y + dy)), offense: i < 5 };
  });
}

function BreakCard({ g, compact }: { g: GameInsight; compact: boolean }) {
  const kind = g.screen.breakKind ?? 'timeout';
  const commercial = isCommercial(kind);
  const sub =
    g.resumeIncomingInMs !== undefined
      ? `Play resumed · on air in ${durationLabel(g.resumeIncomingInMs)}`
      : commercial
        ? `${kind === 'halftime' ? 'Halftime' : 'Commercial'} · ${durationLabel(g.breakElapsedMs ?? 0)} so far · watching for play`
        : 'Play stopped';
  return (
    <View style={[styles.breakCard, { backgroundColor: commercial ? fb.scrim : 'rgba(8,14,24,0.55)' }]}>
      <Text style={[styles.breakKind, compact && { fontSize: px(26) }]}>{breakName(g.info, kind)}</Text>
      <Text style={[styles.breakSub, compact && { fontSize: px(20) }, g.resumeIncomingInMs !== undefined && { color: fb.amber }]}>{sub}</Text>
    </View>
  );
}

interface SurfaceProps {
  g: GameInsight;
  box: { width: number; height: number; margin: number };
  now: number;
  live: boolean;
}

const LINE = 'rgba(242,244,247,0.75)';

/** Basketball court, 94 x 50 ft. */
function Court({ g, box, now, live }: SurfaceProps) {
  const { home, away } = g.info;
  const s = Math.min((box.width - 2 * box.margin) / CW, (box.height - 2 * box.margin) / CH);
  const courtW = CW * s;
  const courtH = CH * s;
  const left = (box.width - courtW) / 2;
  const top = (box.height - courtH) / 2;
  const offenseLeft = g.screen.lastEvent?.team === 'away';
  const ft = (v: number) => v * s;
  const line = LINE;
  return (
      <View
        style={{
          position: 'absolute',
          left,
          top,
          width: courtW,
          height: courtH,
          backgroundColor: fb.maple,
          borderWidth: Math.max(1, ft(0.25)),
          borderColor: line,
          overflow: 'hidden',
        }}
      >
        {/* Floor planks */}
        {Array.from({ length: 10 }).map((_, i) => (
          <View
            key={i}
            style={{ position: 'absolute', left: 0, right: 0, top: (i * courtH) / 10, height: courtH / 20, backgroundColor: fb.mapleDark, opacity: 0.18 }}
          />
        ))}
        {/* Three-point arcs */}
        {[0, 1].map((side) => (
          <View
            key={`arc${side}`}
            style={{
              position: 'absolute',
              width: ft(47.5),
              height: ft(47.5),
              borderRadius: ft(23.75),
              borderWidth: Math.max(1, ft(0.2)),
              borderColor: line,
              top: ft(25 - 23.75),
              left: side === 0 ? ft(5.25 - 23.75) : ft(CW - 5.25 - 23.75),
            }}
          />
        ))}
        {/* Painted keys in home color */}
        {[0, 1].map((side) => (
          <View
            key={`key${side}`}
            style={{
              position: 'absolute',
              top: ft(17),
              width: ft(19),
              height: ft(16),
              left: side === 0 ? 0 : ft(CW - 19),
              backgroundColor: home.color,
              opacity: 0.9,
              borderWidth: Math.max(1, ft(0.2)),
              borderColor: line,
            }}
          />
        ))}
        {/* Half-court line and center circle */}
        <View style={{ position: 'absolute', left: ft(47) - 1, top: 0, bottom: 0, width: Math.max(1, ft(0.2)), backgroundColor: line }} />
        <View
          style={{
            position: 'absolute',
            left: ft(47 - 6),
            top: ft(25 - 6),
            width: ft(12),
            height: ft(12),
            borderRadius: ft(6),
            borderWidth: Math.max(1, ft(0.2)),
            borderColor: line,
            backgroundColor: home.color,
            opacity: 0.45,
          }}
        />
        {/* Players */}
        {live &&
          players(g.info.id.charCodeAt(1), offenseLeft, now).map((p, i) => {
            const team = (p.offense ? (offenseLeft ? away : home) : offenseLeft ? home : away);
            const r = ft(1.6);
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: ft(p.x) - r,
                  top: ft(p.y) - r,
                  width: 2 * r,
                  height: 2 * r,
                  borderRadius: r,
                  backgroundColor: team.color,
                  borderWidth: Math.max(1, ft(0.35)),
                  borderColor: team.alt,
                }}
              />
            );
          })}
      </View>
  );
}

// Football field, yards: 100 between the goal lines plus two 10-yard end zones.
const FW = 120;
const FH = 53.3;

/** Football: end zones in team colors, the ball at its real field position, both lines set at the line of scrimmage. */
function FootballField({ g, box, now, live }: SurfaceProps) {
  const { home, away } = g.info;
  const s = Math.min((box.width - 2 * box.margin) / FW, (box.height - 2 * box.margin) / FH);
  const w = FW * s;
  const h = FH * s;
  const yd = (v: number) => v * s;
  // Home defends the left end zone, so home attacks right.
  const attacking = g.screen.possession ?? 'home';
  const pos = g.screen.fieldPos ?? 25;
  const lineX = attacking === 'home' ? 10 + pos : 110 - pos;
  const dir = attacking === 'home' ? 1 : -1;
  const offense = attacking === 'home' ? home : away;
  const defense = attacking === 'home' ? away : home;
  const formation: Array<[number, number, boolean]> = [
    // offense: line, QB, back, receivers (depth behind the line, y)
    [-1, 22.6, true], [-1, 24.6, true], [-1, 26.6, true], [-1, 28.6, true], [-1, 30.6, true],
    [-5, 26.6, true], [-7.5, 26.6, true], [-1.5, 5, true], [-1.5, 48, true], [-2, 34, true], [-2, 18, true],
    // defense
    [1.2, 23.6, false], [1.2, 26, false], [1.2, 28.4, false], [1.2, 30.8, false], [5, 20, false], [5, 26.6, false], [5, 33, false],
    [7, 6, false], [7, 47, false], [12, 18, false], [12, 36, false],
  ];
  return (
    <View
      style={{
        position: 'absolute',
        left: (box.width - w) / 2,
        top: (box.height - h) / 2,
        width: w,
        height: h,
        backgroundColor: '#2D6A3E',
        borderWidth: Math.max(1, yd(0.3)),
        borderColor: LINE,
        overflow: 'hidden',
      }}
    >
      {/* Mowing stripes */}
      {Array.from({ length: 10 }).map((_, i) => (
        <View key={`m${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: yd(10 + i * 10), width: yd(5), backgroundColor: '#336F44' }} />
      ))}
      {/* End zones */}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: yd(10), backgroundColor: home.color, opacity: 0.85 }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: yd(10), backgroundColor: away.color, opacity: 0.85 }} />
      {/* Yard lines every 10 */}
      {Array.from({ length: 11 }).map((_, i) => (
        <View key={`y${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: yd(10 + i * 10) - 1, width: Math.max(1, yd(0.25)), backgroundColor: LINE }} />
      ))}
      {live && (
        <>
          {/* Line of scrimmage and first-down marker */}
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: yd(lineX) - 1, width: Math.max(2, yd(0.4)), backgroundColor: '#4CC9F0' }} />
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: yd(Math.max(10, Math.min(110, lineX + 10 * dir))) - 1, width: Math.max(2, yd(0.4)), backgroundColor: '#FFD166' }} />
          {formation.map(([depth, y, isOffense], i) => {
            const ph = i * 1.3 + g.info.id.charCodeAt(1) * 0.37;
            const x = lineX + dir * depth + Math.sin(now / 900 + ph) * 0.5;
            const yy = y + Math.cos(now / 1100 + ph) * 0.6;
            const team = isOffense ? offense : defense;
            const r = yd(1.1);
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: yd(x) - r,
                  top: yd(yy) - r,
                  width: 2 * r,
                  height: 2 * r,
                  borderRadius: r,
                  backgroundColor: team.color,
                  borderWidth: Math.max(1, yd(0.25)),
                  borderColor: team.alt,
                }}
              />
            );
          })}
        </>
      )}
    </View>
  );
}

// Baseball view from behind home plate, in arbitrary units.
const BW = 100;
const BH = 80;
const BASES: Array<[number, number]> = [
  [64, 58], // first
  [50, 44], // second
  [36, 58], // third
];
const FIELDERS: Array<[number, number]> = [
  [50, 60], [50, 77], [66, 53], [58, 45], [42, 45], [34, 53], [24, 28], [50, 17], [76, 28],
];

/** Baseball: the diamond with occupied bases lit, fielders in position, and the batter and runners. */
function BaseballDiamond({ g, box, now, live }: SurfaceProps) {
  const { home, away } = g.info;
  const s = Math.min((box.width - 2 * box.margin) / BW, (box.height - 2 * box.margin) / BH);
  const w = BW * s;
  const h = BH * s;
  const u = (v: number) => v * s;
  const awayBats = g.screen.period % 2 === 1;
  const batting = awayBats ? away : home;
  const fielding = awayBats ? home : away;
  const bases = g.screen.bases ?? 0;
  const dot = (x: number, y: number, team: typeof home, key: string, size = 1.6) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: u(x) - u(size),
        top: u(y) - u(size),
        width: 2 * u(size),
        height: 2 * u(size),
        borderRadius: u(size),
        backgroundColor: team.color,
        borderWidth: Math.max(1, u(0.35)),
        borderColor: team.alt,
      }}
    />
  );
  const sway = (i: number) => Math.sin(now / 1000 + i * 1.7) * 0.4;
  return (
    <View
      style={{
        position: 'absolute',
        left: (box.width - w) / 2,
        top: (box.height - h) / 2,
        width: w,
        height: h,
        backgroundColor: '#1F4D2B',
        borderRadius: u(3),
        overflow: 'hidden',
      }}
    >
      {/* Outfield grass, bounded by the fence */}
      <View style={{ position: 'absolute', left: u(50 - 62), top: u(74 - 62), width: u(124), height: u(124), borderRadius: u(62), backgroundColor: '#2F6B3B', borderWidth: Math.max(2, u(0.6)), borderColor: home.color }} />
      {/* Infield dirt and grass */}
      <View style={{ position: 'absolute', left: u(50 - 15), top: u(58 - 15), width: u(30), height: u(30), backgroundColor: '#B07A4E', transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', left: u(50 - 9.5), top: u(58 - 9.5), width: u(19), height: u(19), backgroundColor: '#2F6B3B', transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', left: u(50 - 2.4), top: u(60 - 2.4), width: u(4.8), height: u(4.8), borderRadius: u(2.4), backgroundColor: '#B07A4E' }} />
      {/* Home plate and bases (lit when occupied) */}
      <View style={{ position: 'absolute', left: u(50 - 1.3), top: u(72 - 1.3), width: u(2.6), height: u(2.6), backgroundColor: LINE, transform: [{ rotate: '45deg' }] }} />
      {BASES.map(([x, y], i) => {
        const on = live && (bases & (1 << i)) !== 0;
        return (
          <View
            key={`b${i}`}
            style={{
              position: 'absolute',
              left: u(x - 1.6),
              top: u(y - 1.6),
              width: u(3.2),
              height: u(3.2),
              backgroundColor: on ? fb.amber : LINE,
              transform: [{ rotate: '45deg' }],
            }}
          />
        );
      })}
      {live && (
        <>
          {FIELDERS.map(([x, y], i) => dot(x + sway(i), y + sway(i + 4), fielding, `f${i}`))}
          {dot(46.5, 72, batting, 'batter')}
          {BASES.map(([x, y], i) => ((bases & (1 << i)) !== 0 ? dot(x - 2.5, y + 1, batting, `r${i}`, 1.4) : null))}
        </>
      )}
    </View>
  );
}
function BroadcastTile({ g, width, height, audio, focused, compact }: Props) {
  const { home, away, channel } = g.info;
  const tiny = width < px(520);
  const bugH = compact ? px(56) : px(72);
  const margin = compact ? px(16) : px(28);
  const now = Date.now();
  const live = g.screen.phase === 'live';
  const sport = sportOf(g.info);
  const crunch = g.tags.includes('crunch') || g.tags.includes('overtime');
  const [period, clock] = gameClock(g);
  const runners = sport.id === 'mlb' && live ? runnersLabel(g.screen.bases) : undefined;
  const box = { width, height: height - bugH, margin };

  return (
    <View style={[styles.tile, { width, height }, focused && styles.focused]}>
      {/* Arena backdrop */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1424' }]} />
      {sport.id === 'nfl' ? (
        <FootballField g={g} box={box} now={now} live={live} />
      ) : sport.id === 'mlb' ? (
        <BaseballDiamond g={g} box={box} now={now} live={live} />
      ) : (
        <Court g={g} box={box} now={now} live={live} />
      )}

      {!live && g.screen.phase === 'break' && <BreakCard g={g} compact={compact} />}
      {g.screen.phase === 'final' && (
        <View style={[styles.breakCard, { backgroundColor: fb.scrim }]}>
          <Text style={styles.breakKind}>Final</Text>
        </View>
      )}
      {g.screen.phase === 'pregame' && (
        <View style={[styles.breakCard, { backgroundColor: fb.scrim }]}>
          <Text style={styles.breakKind}>Pregame</Text>
        </View>
      )}

      {/* Channel + simulated label */}
      <View style={styles.topRow}>
        <Text style={[styles.channel, compact && { fontSize: px(16) }, tiny && { fontSize: px(14) }]} numberOfLines={1}>
          {`${channel.number}  ${channel.name}`}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          {crunch && live && (
            <View style={styles.crunchPill}>
              <Text style={[styles.crunchText, compact && { fontSize: px(16) }, tiny && { fontSize: px(14) }]}>
                {g.tags.includes('overtime') ? (sport.id === 'mlb' ? 'Extra innings' : 'Overtime') : sport.crunchWord.charAt(0).toUpperCase() + sport.crunchWord.slice(1)}
              </Text>
            </View>
          )}
          {audio && (
            <View style={styles.audioPill}>
              <Text style={[styles.audioText, compact && { fontSize: px(16) }]}>Audio</Text>
            </View>
          )}
        </View>
      </View>

      {/* Scorebug */}
      <View style={[styles.bug, { height: bugH }]}>
        {[away, home].map((t, i) => (
          <View key={t.code} style={[styles.bugTeam, { borderLeftColor: t.color }, tiny && { marginRight: px(10), paddingLeft: px(8), borderLeftWidth: px(6) }]}>
            <Text style={[styles.bugCode, compact && { fontSize: px(24) }, tiny && { fontSize: px(19), marginRight: px(8) }]}>{t.code}</Text>
            <Text style={[styles.bugScore, type.digits, compact && { fontSize: px(30) }, tiny && { fontSize: px(23) }]}>
              {String(i === 0 ? g.screen.awayScore : g.screen.homeScore)}
            </Text>
          </View>
        ))}
        <View style={styles.bugClock}>
          <Text style={[styles.bugPeriod, compact && { fontSize: px(20) }, tiny && { fontSize: px(17), marginRight: px(6) }]}>{period}</Text>
          <Text style={[styles.bugTime, type.digits, compact && { fontSize: px(26) }, tiny && { fontSize: px(21) }]}>{clock}</Text>
          {!compact && runners && <Text style={[styles.bugPeriod, { marginLeft: px(12) }, compact && { fontSize: px(18) }]}>{runners}</Text>}
        </View>
        <View style={{ flex: 1 }} />
        {!tiny && <Text style={[styles.sim, compact && { fontSize: px(14) }]}>{`${sport.tag} · Simulated feed`}</Text>}
      </View>
    </View>
  );
}

export default React.memo(BroadcastTile);

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    borderRadius: px(10),
    borderWidth: px(4),
    borderColor: 'transparent',
    backgroundColor: fb.ink,
  },
  focused: { borderColor: fb.amber },
  topRow: {
    position: 'absolute',
    top: px(14),
    left: px(18),
    right: px(18),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channel: { fontSize: px(20), fontWeight: '700', color: 'rgba(242,244,247,0.8)', maxWidth: '55%' },
  crunchPill: { backgroundColor: fb.amber, borderRadius: px(6), paddingHorizontal: px(10), paddingVertical: px(3), marginLeft: px(8) },
  crunchText: { fontSize: px(20), fontWeight: '800', color: fb.ink },
  audioPill: { backgroundColor: fb.chalk, borderRadius: px(6), paddingHorizontal: px(10), paddingVertical: px(3), marginLeft: px(8) },
  audioText: { fontSize: px(20), fontWeight: '800', color: fb.ink },
  bug: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,20,36,0.94)',
    paddingHorizontal: px(10),
  },
  bugTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: px(8),
    paddingLeft: px(12),
    marginRight: px(18),
  },
  bugCode: { fontSize: px(28), fontWeight: '800', color: fb.chalk, marginRight: px(12) },
  bugScore: { fontSize: px(38), color: fb.chalk },
  bugClock: { flexDirection: 'row', alignItems: 'baseline', marginLeft: px(8) },
  bugPeriod: { fontSize: px(24), fontWeight: '700', color: fb.haze, marginRight: px(10) },
  bugTime: { fontSize: px(32), color: fb.amber },
  sim: { fontSize: px(16), fontWeight: '600', color: fb.dim },
  breakCard: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakKind: { fontSize: px(40), fontWeight: '800', color: fb.chalk },
  breakSub: { fontSize: px(24), fontWeight: '600', color: fb.buzzer, marginTop: px(8) },
});
