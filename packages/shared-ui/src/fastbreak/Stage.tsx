import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DirectorView, GameInsight } from '@fastbreak/director';
import BroadcastTile from './BroadcastTile';
import { fb, px, type } from './theme';

export const STAGE_W = px(1332);
export const STAGE_H = px(749);
const GAP = px(16);

interface Props {
  view: DirectorView;
  focusedSlot: number | null;
}

export default function Stage({ view, focusedSlot }: Props) {
  const byId = new Map<string, GameInsight>(view.insights.map((g) => [g.info.id, g]));
  const tiles = view.slots.map((id) => byId.get(id)).filter((g): g is GameInsight => !!g);
  const n = view.layout === 'single' ? 1 : view.layout === 'split' ? 2 : 4;
  const cols = n === 1 ? 1 : 2;
  const rows = n === 4 ? 2 : 1;
  const w = n === 1 ? STAGE_W : (STAGE_W - GAP) / 2;
  const h = n === 1 ? STAGE_H : n === 2 ? (w * 9) / 16 : (STAGE_H - GAP) / 2;

  return (
    <View style={{ width: STAGE_W, height: STAGE_H, flexDirection: 'row', flexWrap: 'wrap', alignContent: n === 2 ? 'flex-start' : 'center', justifyContent: 'space-between' }}>
      {tiles.slice(0, cols * rows).map((g, i) => (
        <View key={g.info.id} style={{ marginBottom: rows === 2 && i < 2 ? GAP : 0 }}>
          <BroadcastTile
            g={g}
            width={w}
            height={h}
            audio={n > 1 && view.audio === g.info.id}
            focused={focusedSlot === i}
            compact={n > 1}
          />
          {n === 2 && <SplitPanel g={g} width={w} />}
        </View>
      ))}
    </View>
  );
}

/** Under each split-screen game: what just happened and who's likely to win. */
function SplitPanel({ g, width }: { g: GameInsight; width: number }) {
  const { home, away } = g.info;
  const pHome = Math.round(g.homeWinProb * 100);
  const last = g.screen.lastEvent?.text ?? '';
  return (
    <View style={[panel.wrap, { width }]}>
      <Text style={panel.label}>Last play</Text>
      <Text style={panel.play} numberOfLines={1}>
        {last}
      </Text>
      <Text style={[panel.label, { marginTop: px(22) }]}>Win probability</Text>
      <View style={panel.bar}>
        <View style={{ flex: 100 - pHome, backgroundColor: away.color }} />
        <View style={{ flex: pHome, backgroundColor: home.color }} />
      </View>
      <View style={panel.probRow}>
        <Text style={[panel.prob, type.digits]}>{`${away.code} ${100 - pHome}%`}</Text>
        <Text style={[panel.prob, type.digits]}>{`${pHome}% ${home.code}`}</Text>
      </View>
    </View>
  );
}

const panel = StyleSheet.create({
  wrap: { marginTop: px(18), paddingHorizontal: px(8) },
  label: { fontSize: px(19), fontWeight: '600', color: fb.dim },
  play: { fontSize: px(28), fontWeight: '700', color: fb.chalk, marginTop: px(6) },
  bar: { flexDirection: 'row', height: px(14), borderRadius: px(7), overflow: 'hidden', marginTop: px(10), backgroundColor: fb.line },
  probRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: px(8) },
  prob: { fontSize: px(22), color: fb.haze },
});
