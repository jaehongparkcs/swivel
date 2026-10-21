import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PREFS, SPORT_IDS, SPORTS, type SportId, type TeamPrefs } from '@swivel/director';
import RemoteControlManager from '../remote-control/RemoteControlManager';
import { SupportedKeys } from '../remote-control/SupportedKeys';
import SetupScreen from './screens/SetupScreen';
import SplashScreen from './screens/SplashScreen';
import WatchScreen from './screens/WatchScreen';
import { readDemoConfig } from './state/demoConfig';
import { demoLineup } from './state/lineup';
import { tonightsTeams } from './state/teams';

/** Splash, then "Set up tonight", then watching. The replay clock starts when you press Start watching. */
export default function SwivelApp() {
  const config = useMemo(() => readDemoConfig(), []);
  const [stage, setStage] = useState<'splash' | 'setup' | 'watch'>(config.intro === false ? 'watch' : 'splash');
  const initial: TeamPrefs = { ...DEFAULT_PREFS, loyalty: 'team-first', favorites: config.favorites, likes: [] };
  const [prefs, setPrefs] = useState<TeamPrefs>(initial);
  const lineup = useMemo(() => demoLineup(config), [config]);
  const games = useMemo(() => lineup.source.games(), [lineup]);
  const teams = useMemo(() => tonightsTeams(games), [games]);
  const toSetup = useCallback(() => setStage('setup'), []);

  // OK skips the splash.
  useEffect(() => {
    if (stage !== 'splash') return;
    const listener = RemoteControlManager.addKeydownListener((key: SupportedKeys) => {
      if (key === SupportedKeys.Enter) setStage('setup');
    });
    return () => RemoteControlManager.removeKeydownListener(listener);
  }, [stage]);

  if (stage === 'splash') {
    const count = (id: SportId) => games.filter((g) => (g.sport ?? 'nba') === id).length;
    const parts = SPORT_IDS.filter((id) => count(id)).map((id) => `${count(id)} ${SPORTS[id].name.toLowerCase()}`);
    return <SplashScreen games={games.length} sports={`Play-by-play for ${parts.join(', ')}`} onDone={toSetup} />;
  }
  if (stage === 'setup') {
    return (
      <SetupScreen
        teams={teams}
        initial={prefs}
        onStart={(p) => {
          setPrefs(p);
          setStage('watch');
        }}
      />
    );
  }
  return <WatchScreen lineup={lineup} speed={config.speed} initialPrefs={prefs} />;
}
