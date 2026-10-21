import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DirectorView, GameInsight } from '@swivel/director';
import BroadcastTile from './BroadcastTile';
import { fb, px, type } from '../theme';

export const STAGE_W = px(1332);
export const STAGE_H = px(749);
const GAP = px(16);

interface Props {
  view: DirectorView;
  focusedSlot: number | null;
}

function frames(layout: DirectorView['layout']): Array<{ x: number; y: number; w: number; h: number }> {
  if (layout === 'single') return [{ x: 0, y: 0, w: STAGE_W, h: STAGE_H }];
  if (layout === 'split') {
    const w = (STAGE_W - GAP) / 2;
    return [0, 1].map((i) => ({ x: i * (w + GAP), y: 0, w, h: (w * 9) / 16 }));
  }
  if (layout === 'trio') {
    // One large tile (your team / audio) and two stacked on the right, all 16:9.
    const ws = (STAGE_W - (GAP * 25) / 9) / 3;
    const hs = (ws * 9) / 16;
    const wb = STAGE_W - GAP - ws;
    const hb = (wb * 9) / 16;
    const top = (STAGE_H - hb) / 2;
    return [
      { x: 0, y: top, w: wb, h: hb },
      { x: wb + GAP, y: top, w: ws, h: hs },
      { x: wb + GAP, y: top + hs + GAP, w: ws, h: hs },
    ];
  }
  const w = (STAGE_W - GAP) / 2;
  const h = (STAGE_H - GAP) / 2;
  return [0, 1, 2, 3].map((i) => ({ x: (i % 2) * (w + GAP), y: Math.floor(i / 2) * (h + GAP), w, h }));
}

export default function Stage({ view, focusedSlot }: Props) {
  const byId = new Map<string, GameInsight>(view.insights.map((g) => [g.info.id, g]));
  const tiles = view.slots.map((id) => byId.get(id)).filter((g): g is GameInsight => !!g);
  const fr = frames(view.layout);
  const multi = view.layout !== 'single';
  return (
    <View style={{ width: STAGE_W, height: STAGE_H }}>
      {tiles.slice(0, fr.length).map((g, i) => (
        <View key={g.info.id} style={{ position: 'absolute', left: fr[i].x, top: fr[i].y }}>
          <BroadcastTile
            g={g}
            width={fr[i].w}
            height={fr[i].h}
            audio={multi && view.audio === g.info.id}
            focused={focusedSlot === i}
            compact={multi && !(view.layout === 'trio' && i === 0)}
          />
          {view.layout === 'split' && <SplitPanel g={g} width={fr[i].w} />}
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
  bar: {
    flexDirection: 'row',
    height: px(14),
    borderRadius: px(7),
    overflow: 'hidden',
    marginTop: px(10),
    backgroundColor: fb.line,
  },
  probRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: px(8) },
  prob: { fontSize: px(22), color: fb.haze },
});
