import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { durationLabel, matchup, type DirectorView } from '@fastbreak/director';
import { fb, px } from './theme';

function Key({ label, action, dim }: { label: string; action: string; dim?: boolean }) {
  return (
    <View style={styles.key}>
      <View style={styles.keyCap}>
        <Text style={styles.keyCapText}>{label}</Text>
      </View>
      <Text style={[styles.hint, dim && { color: fb.dim }]}>{action}</Text>
    </View>
  );
}

export default function StatusBar({ view, speed }: { view: DirectorView; speed: number }) {
  const byId = new Map(view.insights.map((g) => [g.info.id, g]));
  const audio = view.audio ? byId.get(view.audio) : undefined;
  const deck = view.onDeck ? byId.get(view.onDeck) : undefined;
  const back = view.returnTo ? byId.get(view.returnTo) : undefined;
  const state = view.locked
    ? `Holding ${audio ? matchup(audio.info) : 'this game'}`
    : back
      ? back.resumeIncomingInMs !== undefined
        ? `Back to ${matchup(back.info)} in ${durationLabel(back.resumeIncomingInMs)}`
        : `Back to ${matchup(back.info)} the moment play resumes`
      : deck
        ? `Next up: ${matchup(deck.info)}`
        : 'Autopilot on';

  return (
    <View style={styles.bar}>
      <View style={[styles.dot, { backgroundColor: view.locked ? fb.haze : fb.amber }]} />
      <Text style={styles.mode}>{view.locked ? 'Autopilot paused' : 'Autopilot'}</Text>
      <Text style={styles.state} numberOfLines={1}>
        {state}
      </Text>
      <View style={{ flex: 1 }} />
      <Key label="OK" action="Watch" />
      <Key label="Play" action={view.locked ? 'Resume autopilot' : 'Hold this game'} />
      <Key label="Fwd" action="Skip game" />
      <Key label="Rew" action={`Replay ${speed}x`} dim />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: px(60), flexDirection: 'row', alignItems: 'center', borderTopWidth: px(2), borderTopColor: fb.line, marginTop: px(16) },
  dot: { width: px(14), height: px(14), borderRadius: px(7), marginRight: px(12) },
  mode: { fontSize: px(24), fontWeight: '800', color: fb.chalk, marginRight: px(22) },
  state: { fontSize: px(24), fontWeight: '500', color: fb.haze, maxWidth: px(760) },
  key: { flexDirection: 'row', alignItems: 'center', marginLeft: px(30) },
  keyCap: { borderWidth: px(2), borderColor: fb.dim, borderRadius: px(6), paddingHorizontal: px(8), paddingVertical: px(1), marginRight: px(10) },
  keyCapText: { fontSize: px(17), fontWeight: '800', color: fb.haze },
  hint: { fontSize: px(22), fontWeight: '600', color: fb.haze },
});
