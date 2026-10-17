import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BREAK_NAMES,
  clockLabel,
  durationLabel,
  isCommercial,
  periodLabel,
  type GameInsight,
} from '@fastbreak/director';
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
  return (
    <View style={[styles.breakCard, { backgroundColor: commercial ? fb.scrim : 'rgba(8,14,24,0.55)' }]}>
      <Text style={[styles.breakKind, compact && { fontSize: px(26) }]}>{BREAK_NAMES[kind]}</Text>
      {commercial ? (
        <Text style={[styles.breakSub, compact && { fontSize: px(20) }]}>
          {kind === 'halftime' ? 'Halftime show' : 'Commercial break'}
          {g.breakRemainingMs ? `  ·  back in ~${durationLabel(g.breakRemainingMs)}` : ''}
        </Text>
      ) : (
        <Text style={[styles.breakSub, compact && { fontSize: px(20) }]}>Play stopped</Text>
      )}
    </View>
  );
}

function BroadcastTile({ g, width, height, audio, focused, compact }: Props) {
  const { home, away, channel } = g.info;
  const bugH = compact ? px(56) : px(72);
  const margin = compact ? px(16) : px(28);
  const s = Math.min((width - 2 * margin) / CW, (height - bugH - 2 * margin) / CH);
  const courtW = CW * s;
  const courtH = CH * s;
  const left = (width - courtW) / 2;
  const top = (height - bugH - courtH) / 2;
  const now = Date.now();
  const offenseLeft = g.screen.lastEvent?.team === 'away';
  const live = g.screen.phase === 'live';
  const crunch = g.tags.includes('crunch') || g.tags.includes('overtime');
  const ft = (v: number) => v * s;
  const line = 'rgba(242,244,247,0.75)';

  return (
    <View style={[styles.tile, { width, height }, focused && styles.focused]}>
      {/* Arena backdrop */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1424' }]} />
      {/* Court */}
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
        <Text style={[styles.channel, compact && { fontSize: px(16) }]} numberOfLines={1}>
          {`${channel.number}  ${channel.name}`}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          {crunch && live && (
            <View style={styles.crunchPill}>
              <Text style={[styles.crunchText, compact && { fontSize: px(16) }]}>
                {g.tags.includes('overtime') ? 'Overtime' : 'Crunch time'}
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
          <View key={t.code} style={[styles.bugTeam, { borderLeftColor: t.color }]}>
            <Text style={[styles.bugCode, compact && { fontSize: px(24) }]}>{t.code}</Text>
            <Text style={[styles.bugScore, type.digits, compact && { fontSize: px(30) }]}>
              {String(i === 0 ? g.screen.awayScore : g.screen.homeScore)}
            </Text>
          </View>
        ))}
        <View style={styles.bugClock}>
          <Text style={[styles.bugPeriod, compact && { fontSize: px(20) }]}>{periodLabel(g.screen.period)}</Text>
          <Text style={[styles.bugTime, type.digits, compact && { fontSize: px(26) }]}>{clockLabel(g.displayClock)}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[styles.sim, compact && { fontSize: px(14) }]}>Simulated feed</Text>
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
