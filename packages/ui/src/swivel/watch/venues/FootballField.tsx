import React from 'react';
import { View } from 'react-native';
import { fb } from '../../theme';
import { LINE, type VenueProps } from './types';

// Football field, yards: 100 between the goal lines plus two 10-yard end zones.
const FW = 120;
const FH = 53.3;

/** Football: end zones in team colors, the ball at its real field position, both lines set at the line of scrimmage. */
export default function FootballField({ g, box, now, live }: VenueProps) {
  const { home, away } = g.info;
  const s = Math.min((box.width - 2 * box.margin) / FW, (box.height - 2 * box.margin) / FH);
  const w = FW * s;
  const h = FH * s;
  const yd = (v: number) => v * s;
  // Home defends the left end zone, so home attacks right.
  const attacking = g.screen.possession ?? 'home';
  const pos = g.screen.fieldPos ?? 25;
  const lineX = attacking === 'home' ? 10 + pos : 110 - pos;
  const dir = attacking === 'home' ? 1 : -1;
  const offense = attacking === 'home' ? home : away;
  const defense = attacking === 'home' ? away : home;
  const formation: Array<[number, number, boolean]> = [
    // offense: line, QB, back, receivers (depth behind the line, y)
    [-1, 22.6, true],
    [-1, 24.6, true],
    [-1, 26.6, true],
    [-1, 28.6, true],
    [-1, 30.6, true],
    [-5, 26.6, true],
    [-7.5, 26.6, true],
    [-1.5, 5, true],
    [-1.5, 48, true],
    [-2, 34, true],
    [-2, 18, true],
    // defense
    [1.2, 23.6, false],
    [1.2, 26, false],
    [1.2, 28.4, false],
    [1.2, 30.8, false],
    [5, 20, false],
    [5, 26.6, false],
    [5, 33, false],
    [7, 6, false],
    [7, 47, false],
    [12, 18, false],
    [12, 36, false],
  ];
  return (
    <View
      style={{
        position: 'absolute',
        left: (box.width - w) / 2,
        top: (box.height - h) / 2,
        width: w,
        height: h,
        backgroundColor: '#2D6A3E',
        borderWidth: Math.max(1, yd(0.3)),
        borderColor: LINE,
        overflow: 'hidden',
      }}>
      {/* Mowing stripes */}
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={`m${i}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: yd(10 + i * 10),
            width: yd(5),
            backgroundColor: '#336F44',
          }}
        />
      ))}
      {/* End zones */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: yd(10),
          backgroundColor: home.color,
          opacity: 0.85,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: yd(10),
          backgroundColor: away.color,
          opacity: 0.85,
        }}
      />
      {/* Yard lines every 10 */}
      {Array.from({ length: 11 }).map((_, i) => (
        <View
          key={`y${i}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: yd(10 + i * 10) - 1,
            width: Math.max(1, yd(0.25)),
            backgroundColor: LINE,
          }}
        />
      ))}
      {live && (
        <>
          {/* Line of scrimmage and first-down marker */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: yd(lineX) - 1,
              width: Math.max(2, yd(0.4)),
              backgroundColor: '#4CC9F0',
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: yd(Math.max(10, Math.min(110, lineX + 10 * dir))) - 1,
              width: Math.max(2, yd(0.4)),
              backgroundColor: '#FFD166',
            }}
          />
          {/* The ball at its real spot from the feed, in the quarterback's hands */}
          <View
            style={{
              position: 'absolute',
              left: yd(lineX - dir * 4.2) - yd(0.9),
              top: yd(26.6) - yd(0.55),
              width: yd(1.8),
              height: yd(1.1),
              borderRadius: yd(0.55),
              backgroundColor: '#8B4A2B',
              borderWidth: Math.max(1, yd(0.15)),
              borderColor: fb.chalk,
              zIndex: 2,
            }}
          />
          {formation.map(([depth, y, isOffense], i) => {
            const ph = i * 1.3 + g.info.id.charCodeAt(1) * 0.37;
            const x = lineX + dir * depth + Math.sin(now / 900 + ph) * 0.5;
            const yy = y + Math.cos(now / 1100 + ph) * 0.6;
            const team = isOffense ? offense : defense;
            const r = yd(1.1);
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: yd(x) - r,
                  top: yd(yy) - r,
                  width: 2 * r,
                  height: 2 * r,
                  borderRadius: r,
                  backgroundColor: team.color,
                  borderWidth: Math.max(1, yd(0.25)),
                  borderColor: team.alt,
                }}
              />
            );
          })}
        </>
      )}
    </View>
  );
}
