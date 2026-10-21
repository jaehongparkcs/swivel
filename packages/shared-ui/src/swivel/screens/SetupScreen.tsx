import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SPORT_IDS, SPORTS, sportOfTeam, type Team, type TeamPrefs } from '@swivel/director';
import RemoteControlManager from '../../remote-control/RemoteControlManager';
import { SupportedKeys } from '../../remote-control/SupportedKeys';
import { cycleTeam, LOYALTIES } from '../state/teams';
import { fb, px } from '../theme';

/**
 * "Set up tonight": pick teams from tonight's lineup (grouped by sport) and how the
 * autopilot should drive, then start watching. Focus starts on Start so one OK
 * gets you watching.
 */
export default function SetupScreen({
  teams,
  initial,
  onStart,
}: {
  teams: Team[];
  initial: TeamPrefs;
  onStart: (prefs: TeamPrefs) => void;
}) {
  const hasFavorite = (list: Team[]) => list.some((t) => initial.favorites.includes(t.code));
  const groups = useMemo(
    () =>
      SPORT_IDS.map((sport) => ({ sport, teams: teams.filter((t) => sportOfTeam(t.code) === sport) }))
        .filter((g) => g.teams.length)
        // Sports with one of your favorites first.
        .sort((a, b) => Number(hasFavorite(b.teams)) - Number(hasFavorite(a.teams))),
    [teams],
  );
  const optRow = groups.length;
  const startRow = optRow + 1;
  const rowLen = (r: number) => (r < optRow ? groups[r].teams.length : r === optRow ? 4 : 1);
  const [prefs, setPrefs] = useState<TeamPrefs>(initial);
  const [focus, setFocus] = useState<[number, number]>([startRow, 0]);
  const live = useRef({ prefs, focus });
  live.current = { prefs, focus };

  useEffect(() => {
    const onKey = (key: SupportedKeys) => {
      const {
        prefs: p,
        focus: [r, c],
      } = live.current;
      const clampC = (row: number, col: number) => Math.min(col, rowLen(row) - 1);
      if (key === SupportedKeys.Up) return setFocus([Math.max(0, r - 1), clampC(Math.max(0, r - 1), c)]);
      if (key === SupportedKeys.Down)
        return setFocus([Math.min(startRow, r + 1), clampC(Math.min(startRow, r + 1), c)]);
      if (key === SupportedKeys.Left) return setFocus([r, Math.max(0, c - 1)]);
      if (key === SupportedKeys.Right) return setFocus([r, Math.min(rowLen(r) - 1, c + 1)]);
      if (key !== SupportedKeys.Enter) return;
      if (r < optRow) setPrefs(cycleTeam(p, groups[r].teams[c].code));
      else if (r === optRow && c < 3) setPrefs({ ...p, loyalty: LOYALTIES[c].id });
      else if (r === optRow) setPrefs({ ...p, multiview: !p.multiview });
      else onStart(p);
    };
    const listener = RemoteControlManager.addKeydownListener(onKey);
    return () => RemoteControlManager.removeKeydownListener(listener);
  }, [groups]);

  const [fr, fc] = focus;
  const yours = [...prefs.favorites, ...prefs.likes];
  const summary = yours.length
    ? `Following ${prefs.favorites.length ? prefs.favorites.join(', ') : 'no favorites'}${prefs.likes.length ? `; liking ${prefs.likes.join(', ')}` : ''}.`
    : 'No teams yet: Swivel will chase the best game on.';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Image source={require('../../assets/images/swivel_mark.png')} style={styles.mark} />
        <View>
          <Text style={styles.h1}>Set up tonight</Text>
          <Text style={styles.lede}>
            {`${teams.length / 2} games on your lineup: ${groups.map((g) => `${g.teams.length / 2} ${SPORTS[g.sport].name.toLowerCase()}`).join(', ')}. Press OK on a team: favorite, then like, then off.`}
          </Text>
        </View>
      </View>

      {groups.map((g, r) => (
        <View key={g.sport} style={styles.sportRow}>
          <Text style={styles.sportName}>{SPORTS[g.sport].name}</Text>
          {g.teams.map((t, c) => {
            const fav = prefs.favorites.includes(t.code);
            const like = prefs.likes.includes(t.code);
            const focused = fr === r && fc === c;
            return (
              <View key={t.code} style={[styles.team, (fav || like) && styles.teamOn, focused && styles.focused]}>
                <View style={[styles.swatch, { backgroundColor: t.color, borderColor: t.alt }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.teamName, t.name.length > 11 && styles.teamNameLong]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text
                    style={[styles.teamState, fav && { color: fb.amber }, like && { color: fb.chalk }]}
                    numberOfLines={1}>
                    {fav ? 'Favorite' : like ? 'Like' : `${t.code} · ${t.city}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.optionsRow}>
        {LOYALTIES.map((l, c) => {
          const on = prefs.loyalty === l.id;
          return (
            <View
              key={l.id}
              style={[styles.option, on && styles.optionOn, fr === optRow && fc === c && styles.optionFocused]}>
              <Text style={[styles.optionLabel, on && { color: fb.ink }]}>{l.label}</Text>
              <Text style={[styles.optionDetail, on && { color: fb.inkHigh }]} numberOfLines={2}>
                {l.detail}
              </Text>
            </View>
          );
        })}
        <View
          style={[
            styles.option,
            prefs.multiview && styles.optionOn,
            fr === optRow && fc === 3 && styles.optionFocused,
          ]}>
          <Text
            style={[
              styles.optionLabel,
              prefs.multiview && { color: fb.ink },
            ]}>{`Split & quad: ${prefs.multiview ? 'on' : 'off'}`}</Text>
          <Text style={[styles.optionDetail, prefs.multiview && { color: fb.inkHigh }]} numberOfLines={2}>
            When 2+ games are in crunch time
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.start, fr === startRow && styles.startFocused]}>
          <Text style={[styles.startText, fr === startRow && { color: fb.ink }]}>{'Start watching  ▸'}</Text>
        </View>
        <Text style={styles.summary}>{summary} You can change all of this later in Your teams.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: fb.ink, paddingHorizontal: px(96), justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: px(36) },
  mark: { width: px(112), height: px(112), marginRight: px(28) },
  h1: { fontSize: px(52), fontWeight: '800', color: fb.chalk },
  lede: { fontSize: px(24), color: fb.haze, marginTop: px(6), maxWidth: px(1450) },
  sportRow: { flexDirection: 'row', alignItems: 'center', marginTop: px(20) },
  sportName: { width: px(220), fontSize: px(26), fontWeight: '800', color: fb.haze },
  team: {
    width: px(248),
    height: px(100),
    marginRight: px(14),
    borderRadius: px(10),
    backgroundColor: fb.inkRaised,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: px(14),
    borderWidth: px(3),
    borderColor: 'transparent',
  },
  teamOn: { backgroundColor: fb.inkHigh },
  focused: { borderColor: fb.amber },
  swatch: { width: px(36), height: px(36), borderRadius: px(18), borderWidth: px(4), marginRight: px(12) },
  teamName: { fontSize: px(23), fontWeight: '700', color: fb.chalk },
  teamNameLong: { fontSize: px(19) },
  teamState: { fontSize: px(18), fontWeight: '600', color: fb.dim, marginTop: px(3) },
  optionsRow: { flexDirection: 'row', marginTop: px(44), marginLeft: px(220) },
  option: {
    width: px(372),
    height: px(112),
    marginRight: px(14),
    borderRadius: px(10),
    borderWidth: px(3),
    borderColor: fb.line,
    padding: px(16),
  },
  optionOn: { backgroundColor: fb.amber, borderColor: fb.amber },
  optionFocused: { borderColor: fb.chalk, borderWidth: px(5) },
  optionLabel: { fontSize: px(25), fontWeight: '800', color: fb.chalk },
  optionDetail: { fontSize: px(19), color: fb.haze, marginTop: px(6) },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: px(48), marginLeft: px(220) },
  start: {
    borderRadius: px(12),
    borderWidth: px(4),
    borderColor: fb.amber,
    paddingHorizontal: px(48),
    paddingVertical: px(20),
  },
  startFocused: { backgroundColor: fb.amber },
  startText: { fontSize: px(32), fontWeight: '900', color: fb.amber },
  summary: { fontSize: px(22), color: fb.haze, marginLeft: px(32), flex: 1 },
});
