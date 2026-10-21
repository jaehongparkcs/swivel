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
import { fb, px, type } from '../theme';
import { VENUES } from './venues';

interface Props {
  g: GameInsight;
  width: number;
  height: number;
  audio: boolean;
  focused: boolean;
  compact: boolean;
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
      <Text
        style={[
          styles.breakSub,
          compact && { fontSize: px(20) },
          g.resumeIncomingInMs !== undefined && { color: fb.amber },
        ]}>
        {sub}
      </Text>
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
  const runners = live ? runnersLabel(g.screen.bases) : undefined; // baseball only: other sports have no bases
  const Venue = VENUES[sport.id];
  const box = { width, height: height - bugH, margin };

  return (
    <View style={[styles.tile, { width, height }, focused && styles.focused]}>
      {/* Arena backdrop */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1424' }]} />
      <Venue g={g} box={box} now={now} live={live} />

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
                {capitalize(g.tags.includes('overtime') ? sport.overtimeWord : sport.crunchWord)}
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
          <View
            key={t.code}
            style={[
              styles.bugTeam,
              { borderLeftColor: t.color },
              tiny && { marginRight: px(10), paddingLeft: px(8), borderLeftWidth: px(6) },
            ]}>
            <Text
              style={[
                styles.bugCode,
                compact && { fontSize: px(24) },
                tiny && { fontSize: px(19), marginRight: px(8) },
              ]}>
              {t.code}
            </Text>
            <Text style={[styles.bugScore, type.digits, compact && { fontSize: px(30) }, tiny && { fontSize: px(23) }]}>
              {String(i === 0 ? g.screen.awayScore : g.screen.homeScore)}
            </Text>
          </View>
        ))}
        <View style={styles.bugClock}>
          <Text
            style={[
              styles.bugPeriod,
              compact && { fontSize: px(20) },
              tiny && { fontSize: px(17), marginRight: px(6) },
            ]}>
            {period}
          </Text>
          <Text style={[styles.bugTime, type.digits, compact && { fontSize: px(26) }, tiny && { fontSize: px(21) }]}>
            {clock}
          </Text>
          {!compact && runners && (
            <Text style={[styles.bugPeriod, { marginLeft: px(12) }, compact && { fontSize: px(18) }]}>{runners}</Text>
          )}
        </View>
        <View style={{ flex: 1 }} />
        {!tiny && <Text style={[styles.sim, compact && { fontSize: px(14) }]}>{`${sport.tag} · Simulated feed`}</Text>}
      </View>
    </View>
  );
}

export default React.memo(BroadcastTile);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
  crunchPill: {
    backgroundColor: fb.amber,
    borderRadius: px(6),
    paddingHorizontal: px(10),
    paddingVertical: px(3),
    marginLeft: px(8),
  },
  crunchText: { fontSize: px(20), fontWeight: '800', color: fb.ink },
  audioPill: {
    backgroundColor: fb.chalk,
    borderRadius: px(6),
    paddingHorizontal: px(10),
    paddingVertical: px(3),
    marginLeft: px(8),
  },
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
