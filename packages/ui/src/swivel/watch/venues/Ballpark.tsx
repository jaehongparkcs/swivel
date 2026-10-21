import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fb } from '../../theme';
import { LINE, type VenueProps } from './types';

// Baseball: a ballpark seen from above, home plate at the bottom. Distances are in
// "base lengths" (90 ft); the fence is 3.3 base lengths out (pulled in a little so
// the infield reads at TV distance).
const FENCE = 3.3;
const MOUND = 0.672; // 60.5 ft
const DIRT = 1.06; // the infield dirt arc, 95 ft around the mound
/** Fielders by angle from the first-base line (0) to the third-base line (90) and distance from home. */
const FIELDERS: Array<[number, number]> = [
  [45, MOUND],
  [45, -0.13],
  [12, 1.08],
  [32, 1.45],
  [58, 1.45],
  [78, 1.08],
  [76, 2.6],
  [45, 2.9],
  [14, 2.6],
];
const GRASS = '#2E7A3F';
const DIRT_COLOR = '#B9825A';
const TRACK = '#9C6B44';
const STANDS = '#16243A';

/** Baseball: fair territory, the infield, occupied bases lit, fielders in position, batter, runners and the pitch. */
export default function Ballpark({ g, box, now, live }: VenueProps) {
  const { home, away } = g.info;
  // Fit the fan (fence R straight up, foul poles at 45°) plus the catcher below home.
  const avail = { w: box.width - 2 * box.margin, h: box.height - 2 * box.margin };
  const b = Math.min(avail.h / (FENCE + 0.35), avail.w / (2 * FENCE * Math.SQRT1_2)); // px per base length
  const R = FENCE * b;
  const hx = box.width / 2;
  const hy = box.margin + (avail.h + R + 0.15 * b) / 2; // home plate, field centered vertically
  /** Field point at `deg` from the first-base line and `d` base lengths from home, in tile pixels. */
  const at = (deg: number, d: number): [number, number] => {
    const a = ((45 - deg) * Math.PI) / 180; // 0 = straight up to center field
    return [hx + Math.sin(a) * d * b, hy - Math.cos(a) * d * b];
  };
  const awayBats = g.screen.period % 2 === 1;
  const batting = awayBats ? away : home;
  const fielding = awayBats ? home : away;
  const bases = g.screen.bases ?? 0;
  const S = R; // side of the rotated fair-territory square; its bottom corner sits on home plate
  const local = (deg: number, d: number) => {
    // The same point in the square's own (unrotated) coordinates: home is (S, S).
    const r = (deg * Math.PI) / 180;
    return [S - d * b * Math.sin(r), S - d * b * Math.cos(r)];
  };
  const [mx, my] = local(45, MOUND);
  const dot = (x: number, y: number, team: typeof home, key: string, size = 0.075) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: x - size * b,
        top: y - size * b,
        width: 2 * size * b,
        height: 2 * size * b,
        borderRadius: size * b,
        backgroundColor: team.color,
        borderWidth: Math.max(1, 0.018 * b),
        borderColor: team.alt,
      }}
    />
  );
  const bag = (x: number, y: number, key: string, color: string, size = 0.085) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: x - size * b,
        top: y - size * b,
        width: 2 * size * b,
        height: 2 * size * b,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
  const sway = (i: number) => Math.sin(now / 1000 + i * 1.7) * 0.03;
  const baseSpots: Array<[number, number]> = [at(0, 1), at(45, Math.SQRT2), at(90, 1)];
  // The pitch: mound to plate in the first third of a 2.4 s cycle.
  const phase = (now % 2400) / 2400;
  const pitch = phase < 0.33 ? at(45, MOUND * (1 - phase / 0.33) + 0.05) : undefined;

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: box.width, height: box.height, overflow: 'hidden' }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: STANDS }]} />
      {/* Foul territory behind home and down the lines */}
      <View
        style={{
          position: 'absolute',
          left: hx - 1.9 * b,
          top: hy - 1.9 * b,
          width: 3.8 * b,
          height: 3.8 * b,
          borderRadius: 1.9 * b,
          backgroundColor: '#24603A',
        }}
      />
      {/* Fair territory: a square rotated 45° with its bottom corner on home plate, clipping a fence-radius circle into a fan */}
      <View
        style={{
          position: 'absolute',
          left: hx - S / 2,
          top: hy - S * Math.SQRT1_2 - S / 2,
          width: S,
          height: S,
          overflow: 'hidden',
          transform: [{ rotate: '45deg' }],
        }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 2 * S,
            height: 2 * S,
            borderRadius: S,
            backgroundColor: TRACK,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0.06 * b,
            top: 0.06 * b,
            width: 2 * S - 0.12 * b,
            height: 2 * S - 0.12 * b,
            borderRadius: S - 0.06 * b,
            backgroundColor: GRASS,
          }}
        />
        {/* Infield dirt arc around the mound, the infield grass inside the base paths, the home-plate circle */}
        <View
          style={{
            position: 'absolute',
            left: mx - DIRT * b,
            top: my - DIRT * b,
            width: 2 * DIRT * b,
            height: 2 * DIRT * b,
            borderRadius: DIRT * b,
            backgroundColor: DIRT_COLOR,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: S - 0.92 * b,
            top: S - 0.92 * b,
            width: 0.84 * b,
            height: 0.84 * b,
            backgroundColor: GRASS,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: S - 0.22 * b,
            top: S - 0.22 * b,
            width: 0.44 * b,
            height: 0.44 * b,
            borderRadius: 0.22 * b,
            backgroundColor: DIRT_COLOR,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: mx - 0.1 * b,
            top: my - 0.1 * b,
            width: 0.2 * b,
            height: 0.2 * b,
            borderRadius: 0.1 * b,
            backgroundColor: DIRT_COLOR,
          }}
        />
        {/* Foul lines */}
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: Math.max(2, 0.02 * b),
            backgroundColor: LINE,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: Math.max(2, 0.02 * b),
            backgroundColor: LINE,
          }}
        />
      </View>
      {/* Bases (lit when occupied) and home plate */}
      {baseSpots.map(([x, y], i) => bag(x, y, `b${i}`, live && bases & (1 << i) ? fb.amber : LINE))}
      {bag(hx, hy, 'home', LINE, 0.06)}
      {live && (
        <>
          {FIELDERS.map(([deg, d], i) => {
            const [x, y] = at(deg + sway(i) * 20, d + sway(i + 3));
            return dot(x, y, fielding, `f${i}`);
          })}
          {dot(hx - 0.14 * b, hy - 0.02 * b, batting, 'batter')}
          {baseSpots.map(([x, y], i) =>
            bases & (1 << i)
              ? dot(x + (i === 1 ? 0 : i === 0 ? -0.12 * b : 0.12 * b), y + 0.1 * b, batting, `r${i}`, 0.065)
              : null,
          )}
          {pitch && (
            <View
              style={{
                position: 'absolute',
                left: pitch[0] - 0.035 * b,
                top: pitch[1] - 0.035 * b,
                width: 0.07 * b,
                height: 0.07 * b,
                borderRadius: 0.035 * b,
                backgroundColor: fb.chalk,
              }}
            />
          )}
        </>
      )}
    </View>
  );
}
