import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { fb, px } from './theme';

const STEPS = ['Reading your live TV lineup', 'Syncing play-by-play', 'Ready'];
const DURATION_MS = 2400;

/** Opening screen while tonight's lineup "loads". Calls onDone when finished (OK skips it). */
export default function SplashScreen({ games, sports, onDone }: { games: number; sports: string; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        setTimeout(onDone, 250);
      }
    }, 50);
    return () => clearInterval(id);
  }, [onDone]);
  const step = progress < 0.45 ? 0 : progress < 0.95 ? 1 : 2;
  const detail = step === 0 ? `${games} games on your channels tonight` : step === 1 ? sports : 'Starting autopilot';

  return (
    <View style={styles.root}>
      <Image source={require('../assets/images/swivel_mark.png')} style={styles.mark} />
      <Text style={styles.brand}>Swivel</Text>
      <Text style={styles.tagline}>Autopilot for tonight's games</Text>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.step}>{STEPS[step]}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: fb.ink, alignItems: 'center', justifyContent: 'center' },
  mark: { width: px(260), height: px(260) },
  brand: { fontSize: px(96), fontWeight: '900', color: fb.amber, letterSpacing: px(-2), marginTop: px(12) },
  tagline: { fontSize: px(30), fontWeight: '600', color: fb.haze, marginTop: px(4) },
  bar: { width: px(520), height: px(10), borderRadius: px(5), backgroundColor: fb.inkHigh, marginTop: px(64), overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: fb.amber },
  step: { fontSize: px(26), fontWeight: '700', color: fb.chalk, marginTop: px(24) },
  detail: { fontSize: px(22), fontWeight: '500', color: fb.dim, marginTop: px(6) },
});
