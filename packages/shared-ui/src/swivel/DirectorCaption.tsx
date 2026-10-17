import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { Decision } from '@swivel/director';
import { fb, px } from './theme';

/** The director's caption: why the screen just changed, in one line. */
export default function DirectorCaption({ decisions, width }: { decisions: Decision[]; width: number }) {
  const shown = decisions.filter((d) => !d.title.startsWith('Audio to'));
  const latest = shown[shown.length - 1];
  const prev = shown[shown.length - 2];
  const anim = useRef(new Animated.Value(1)).current;
  const key = latest ? `${latest.t}-${latest.kind}-${latest.to ?? ''}` : '';

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [key, anim]);

  if (!latest) return <View style={[styles.wrap, { width }]} />;
  const urgent = latest.kind === 'break-hop' || latest.kind === 'final-hop';
  const learned = latest.kind === 'learned';
  const recap = latest.recap;
  return (
    <View style={[styles.wrap, { width }]}>
      <View style={[styles.bar, { backgroundColor: urgent ? fb.buzzer : learned ? fb.chalk : fb.amber }]} />
      <Animated.View
        style={{
          flex: 1,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [px(14), 0] }) }],
        }}
      >
        <Text style={[styles.title, recap && { fontSize: px(32) }]} numberOfLines={1}>
          {latest.title}
        </Text>
        <Text style={[styles.detail, recap && { fontSize: px(23), marginTop: px(4) }]} numberOfLines={recap ? 1 : 2}>
          {latest.detail}
        </Text>
        {recap && (
          <View style={styles.recapRow}>
            <Text style={styles.recapLabel} numberOfLines={1}>
              {recap.label}
            </Text>
            <Text style={styles.recapText} numberOfLines={1}>
              {recap.text}
            </Text>
          </View>
        )}
      </Animated.View>
      {prev && (
        <View style={styles.prev}>
          <Text style={styles.prevLabel} numberOfLines={1}>
            Before that
          </Text>
          <Text style={styles.prevText} numberOfLines={2}>
            {prev.title}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: px(124), flexDirection: 'row', alignItems: 'center', marginTop: px(16) },
  bar: { width: px(8), alignSelf: 'stretch', borderRadius: px(4), marginRight: px(22) },
  title: { fontSize: px(36), fontWeight: '800', color: fb.chalk },
  detail: { fontSize: px(25), fontWeight: '500', color: fb.haze, marginTop: px(6) },
  recapRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: px(8) },
  recapLabel: { fontSize: px(20), fontWeight: '700', color: fb.amber, marginRight: px(14) },
  recapText: { flex: 1, fontSize: px(23), fontWeight: '600', color: fb.chalk },
  prev: { width: px(300), marginLeft: px(24), paddingLeft: px(20), borderLeftWidth: px(2), borderLeftColor: fb.line },
  prevLabel: { fontSize: px(18), fontWeight: '600', color: fb.dim },
  prevText: { fontSize: px(21), fontWeight: '600', color: fb.haze, marginTop: px(4) },
});
