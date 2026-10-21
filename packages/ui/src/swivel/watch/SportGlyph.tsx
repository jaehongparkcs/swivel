import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { SportId } from '@swivel/director';
import { fb, px } from '../theme';

/** A tiny ball so mixed nights show each game's sport without crowding the scores. */
const GLYPHS: Record<SportId, () => React.ReactElement> = {
  nba: () => (
    <View
      style={{
        width: px(16),
        height: px(16),
        borderRadius: px(8),
        backgroundColor: '#E07A1F',
        justifyContent: 'center',
      }}>
      <View style={{ height: px(1.5), backgroundColor: '#3B1F0A' }} />
    </View>
  ),
  nfl: () => (
    <View
      style={{
        width: px(22),
        height: px(14),
        borderRadius: px(7),
        backgroundColor: '#8B4A2B',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <View style={{ width: px(9), height: px(2), backgroundColor: fb.chalk }} />
    </View>
  ),
  mlb: () => (
    <View
      style={{
        width: px(16),
        height: px(16),
        borderRadius: px(8),
        backgroundColor: fb.chalk,
        borderWidth: px(2),
        borderColor: '#D62828',
      }}
    />
  ),
};

export default function SportGlyph({ sport, style }: { sport: SportId; style?: StyleProp<ViewStyle> }) {
  const Glyph = GLYPHS[sport];
  return (
    <View style={style}>
      <Glyph />
    </View>
  );
}
