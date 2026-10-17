import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TEAMS, type Loyalty, type TeamPrefs } from '@fastbreak/director';
import { fb, px } from './theme';

export const TEAM_COLS = 4;
export const LOYALTIES: Array<{ id: Loyalty; label: string; detail: string }> = [
  { id: 'team-first', label: 'My teams first', detail: 'Leave only for breaks or big drama' },
  { id: 'balanced', label: 'Balanced', detail: 'Your teams get a head start' },
  { id: 'drama', label: 'Best game on', detail: 'Always chase the tightest game' },
];

/** Focus grid: rows 0-3 teams, row 4 loyalty + multiview, row 5 done + forget learning. */
export function teamsGrid(): number[] {
  return [TEAM_COLS, TEAM_COLS, TEAM_COLS, TEAM_COLS, 4, 2];
}

export function cycleTeam(prefs: TeamPrefs, code: string): TeamPrefs {
  const fav = prefs.favorites.includes(code);
  const like = prefs.likes.includes(code);
  const favorites = prefs.favorites.filter((c) => c !== code);
  const likes = prefs.likes.filter((c) => c !== code);
  if (!fav && !like) favorites.push(code);
  else if (fav) likes.push(code);
  return { ...prefs, favorites, likes };
}

interface Learned {
  likes: string[];
  dislikes: string[];
  signals: number;
}

export default function TeamsScreen({ prefs, focus, learned }: { prefs: TeamPrefs; focus: [number, number]; learned: Learned }) {
  const [fr, fc] = focus;
  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Your teams</Text>
      <Text style={styles.lede}>Press OK to cycle a team: favorite, then like, then off. Fastbreak keeps your favorites on screen unless they're on a break or another game is going down to the wire.</Text>
      <View style={styles.grid}>
        {TEAMS.map((t, i) => {
          const r = Math.floor(i / TEAM_COLS);
          const c = i % TEAM_COLS;
          const focused = fr === r && fc === c;
          const fav = prefs.favorites.includes(t.code);
          const like = prefs.likes.includes(t.code);
          return (
            <View key={t.code} style={[styles.team, (fav || like) && styles.teamOn, focused && styles.focused]}>
              <View style={[styles.swatch, { backgroundColor: t.color, borderColor: t.alt }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName} numberOfLines={1}>{`${t.city} ${t.name}`}</Text>
                <Text style={[styles.teamState, fav && { color: fb.amber }, !fav && !like && learned.likes.includes(t.code) && { color: fb.chalk }]}>
                  {fav
                    ? 'Favorite'
                    : like
                      ? 'Like'
                      : learned.likes.includes(t.code)
                        ? 'Learned: you watch them'
                        : learned.dislikes.includes(t.code)
                          ? 'Learned: you skip them'
                          : t.code}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.optionsRow}>
        {LOYALTIES.map((l, c) => {
          const on = prefs.loyalty === l.id;
          const focused = fr === 4 && fc === c;
          return (
            <View key={l.id} style={[styles.option, on && styles.optionOn, focused && styles.optionFocused]}>
              <Text style={[styles.optionLabel, on && { color: fb.ink }]}>{l.label}</Text>
              <Text style={[styles.optionDetail, on && { color: fb.inkHigh }]} numberOfLines={2}>{l.detail}</Text>
            </View>
          );
        })}
        <View style={[styles.option, prefs.multiview && styles.optionOn, fr === 4 && fc === 3 && styles.optionFocused]}>
          <Text style={[styles.optionLabel, prefs.multiview && { color: fb.ink }]}>{`Split & quad: ${prefs.multiview ? 'on' : 'off'}`}</Text>
          <Text style={[styles.optionDetail, prefs.multiview && { color: fb.inkHigh }]} numberOfLines={2}>When 2+ games are in crunch time</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.done, fr === 5 && fc === 0 && styles.doneFocused]}>
          <Text style={[styles.doneText, fr === 5 && fc === 0 && { color: fb.ink }]}>Back to games</Text>
        </View>
        <View style={[styles.done, { marginLeft: px(20) }, fr === 5 && fc === 1 && styles.doneFocused]}>
          <Text style={[styles.doneText, fr === 5 && fc === 1 && { color: fb.ink }]}>Forget what Fastbreak learned</Text>
        </View>
        <Text style={styles.learnNote}>
          {learned.signals
            ? `Learned from ${learned.signals} remote ${learned.signals === 1 ? 'press' : 'presses'}: picking a game, skipping one, or holding one.`
            : 'Fastbreak learns from what you pick, skip and hold.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: px(96), paddingTop: px(64) },
  h1: { fontSize: px(52), fontWeight: '800', color: fb.chalk },
  lede: { fontSize: px(26), color: fb.haze, marginTop: px(12), maxWidth: px(1300), lineHeight: px(36) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: px(36), marginHorizontal: px(-10) },
  team: {
    width: px(398),
    height: px(96),
    margin: px(10),
    borderRadius: px(10),
    backgroundColor: fb.inkRaised,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: px(18),
    borderWidth: px(3),
    borderColor: 'transparent',
  },
  teamOn: { backgroundColor: fb.inkHigh },
  focused: { borderColor: fb.amber },
  swatch: { width: px(44), height: px(44), borderRadius: px(22), borderWidth: px(5), marginRight: px(18) },
  teamName: { fontSize: px(26), fontWeight: '700', color: fb.chalk },
  teamState: { fontSize: px(20), fontWeight: '600', color: fb.dim, marginTop: px(4) },
  optionsRow: { flexDirection: 'row', marginTop: px(28), marginHorizontal: px(-10) },
  option: {
    width: px(398),
    height: px(118),
    margin: px(10),
    borderRadius: px(10),
    borderWidth: px(3),
    borderColor: fb.line,
    padding: px(18),
  },
  optionOn: { backgroundColor: fb.amber, borderColor: fb.amber },
  optionFocused: { borderColor: fb.chalk, borderWidth: px(5) },
  optionLabel: { fontSize: px(26), fontWeight: '800', color: fb.chalk },
  optionDetail: { fontSize: px(20), color: fb.haze, marginTop: px(6) },
  done: { alignSelf: 'flex-start', marginTop: px(28), borderRadius: px(10), borderWidth: px(3), borderColor: fb.line, paddingHorizontal: px(36), paddingVertical: px(16) },
  doneFocused: { backgroundColor: fb.amber, borderColor: fb.amber },
  learnNote: { fontSize: px(20), color: fb.dim, marginLeft: px(28), marginTop: px(28), flex: 1 },
  doneText: { fontSize: px(28), fontWeight: '800', color: fb.chalk },
});
