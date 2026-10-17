import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DEFAULT_PREFS, type TeamPrefs } from '@fastbreak/director';
import RemoteControlManager from '../app/remote-control/RemoteControlManager';
import { SupportedKeys } from '../app/remote-control/SupportedKeys';
import { readDemoConfig, SPEEDS } from './demoConfig';
import { useFastbreak } from './useFastbreak';
import Stage, { STAGE_W } from './Stage';
import GameRail from './GameRail';
import DirectorCaption from './DirectorCaption';
import StatusBar from './StatusBar';
import TeamsScreen, { cycleTeam, LOYALTIES, TEAM_COLS, teamsGrid } from './TeamsScreen';
import { fb, px } from './theme';
import { TEAMS } from '@fastbreak/director';

type Focus = { zone: 'rail'; index: number } | { zone: 'stage'; index: number };


export default function FastbreakApp() {
  const config = useMemo(() => readDemoConfig(), []);
  const fbk = useFastbreak(config, { ...DEFAULT_PREFS, loyalty: 'team-first', favorites: config.favorites, likes: [] });
  const { view } = fbk;
  const [screen, setScreen] = useState<'watch' | 'teams'>('watch');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [teamsFocus, setTeamsFocus] = useState<[number, number]>([0, 0]);
  const [prefs, setPrefsState] = useState<TeamPrefs>(fbk.prefs);

  // Rail order is stable (by tip time) so focus never jumps under the cursor.
  const order = useMemo(
    () => [...fbk.slate.games].sort((a, b) => a.scheduledStart - b.scheduledStart).map((g) => g.id),
    [fbk.slate],
  );

  // Latest state for the key handler without re-subscribing every tick.
  const live = useRef({ view, focus, screen, teamsFocus, prefs, order, fbk });
  live.current = { view, focus, screen, teamsFocus, prefs, order, fbk };

  useEffect(() => {
    const onKey = (key: SupportedKeys) => {
      const s = live.current;
      const tiles = s.view.slots.length;

      if (key === SupportedKeys.PlayPause) return s.fbk.toggleLock();
      if (key === SupportedKeys.FastForward) {
        if (s.view.onDeck) s.fbk.watch(s.view.onDeck);
        return;
      }
      if (key === SupportedKeys.Rewind) {
        const i = SPEEDS.indexOf(s.fbk.speed);
        s.fbk.setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
        return;
      }

      if (s.screen === 'teams') {
        const grid = teamsGrid();
        const [r, c] = s.teamsFocus;
        const clampC = (row: number, col: number) => Math.min(col, grid[row] - 1);
        if (key === SupportedKeys.Back) return setScreen('watch');
        if (key === SupportedKeys.Up) return setTeamsFocus([Math.max(0, r - 1), clampC(Math.max(0, r - 1), c)]);
        if (key === SupportedKeys.Down) return setTeamsFocus([Math.min(grid.length - 1, r + 1), clampC(Math.min(grid.length - 1, r + 1), c)]);
        if (key === SupportedKeys.Left) return setTeamsFocus([r, Math.max(0, c - 1)]);
        if (key === SupportedKeys.Right) return setTeamsFocus([r, Math.min(grid[r] - 1, c + 1)]);
        if (key === SupportedKeys.Enter) {
          let next = s.prefs;
          if (r < 4) next = cycleTeam(s.prefs, TEAMS[r * TEAM_COLS + c].code);
          else if (r === 4 && c < 3) next = { ...s.prefs, loyalty: LOYALTIES[c].id };
          else if (r === 4 && c === 3) next = { ...s.prefs, multiview: !s.prefs.multiview };
          else if (r === 5) return setScreen('watch');
          setPrefsState(next);
          s.fbk.setPrefs(next);
        }
        return;
      }

      // Watch screen. First press only reveals focus.
      if (!s.focus) {
        if (key !== SupportedKeys.Back) setFocus({ zone: 'rail', index: 1 + Math.max(0, s.order.indexOf(s.view.audio ?? '')) });
        return;
      }
      const f = s.focus;
      if (key === SupportedKeys.Back) return setFocus(null);
      if (f.zone === 'rail') {
        const max = s.order.length;
        if (key === SupportedKeys.Up) return setFocus({ zone: 'rail', index: Math.max(0, f.index - 1) });
        if (key === SupportedKeys.Down) return setFocus({ zone: 'rail', index: Math.min(max, f.index + 1) });
        if (key === SupportedKeys.Left) return setFocus({ zone: 'stage', index: tiles - 1 });
        if (key === SupportedKeys.Enter) {
          if (f.index === 0) return setScreen('teams');
          s.fbk.watch(s.order[f.index - 1]);
          setFocus(null);
        }
        return;
      }
      // Stage
      const cols = tiles > 1 ? 2 : 1;
      if (key === SupportedKeys.Right) {
        if (f.index % cols === cols - 1 || f.index + 1 >= tiles) return setFocus({ zone: 'rail', index: 1 });
        return setFocus({ zone: 'stage', index: f.index + 1 });
      }
      if (key === SupportedKeys.Left) return setFocus({ zone: 'stage', index: Math.max(0, f.index - 1) });
      if (key === SupportedKeys.Up && f.index >= 2) return setFocus({ zone: 'stage', index: f.index - 2 });
      if (key === SupportedKeys.Down && f.index + 2 < tiles) return setFocus({ zone: 'stage', index: f.index + 2 });
      if (key === SupportedKeys.Enter) {
        if (tiles > 1) s.fbk.watch(s.view.slots[f.index]);
        else s.fbk.toggleLock();
        setFocus(null);
      }
    };
    const listener = RemoteControlManager.addKeydownListener(onKey);
    return () => RemoteControlManager.removeKeydownListener(listener);
  }, []);

  if (screen === 'teams') {
    return (
      <View style={styles.root}>
        <TeamsScreen prefs={prefs} focus={teamsFocus} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.main}>
        <View>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>Fastbreak</Text>
            <Text style={styles.brandSub}>Autopilot for tonight's games</Text>
          </View>
          <Stage view={view} focusedSlot={focus?.zone === 'stage' ? focus.index : null} />
          <DirectorCaption decisions={view.decisions} width={STAGE_W} />
        </View>
        <View style={{ width: px(24) }} />
        <GameRail view={view} order={order} focused={focus?.zone === 'rail' ? focus.index : null} favorites={prefs.favorites} />
      </View>
      <StatusBar view={view} speed={fbk.speed} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: fb.ink, paddingHorizontal: px(32), paddingTop: px(20), paddingBottom: px(10) },
  main: { flex: 1, flexDirection: 'row' },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', height: px(56), marginBottom: px(14) },
  brand: { fontSize: px(34), fontWeight: '900', color: fb.amber, letterSpacing: px(-0.5) },
  brandSub: { fontSize: px(22), fontWeight: '600', color: fb.dim, marginLeft: px(16) },
});
