import React from 'react';
import { View } from 'react-native';
import { fb } from '../../theme';
import { LINE, type VenueProps } from './types';

// Court dimensions in feet.
const CW = 94;
const CH = 50;

/** Ten players drifting around a formation, deterministic from wall time. */
function players(seed: number, offenseLeft: boolean, now: number) {
  const base: Array<[number, number]> = [
    [70, 25],
    [64, 10],
    [64, 40],
    [84, 8],
    [84, 42], // offense (attacking right)
    [76, 25],
    [70, 14],
    [70, 36],
    [86, 15],
    [86, 35], // defense
  ];
  return base.map(([x, y], i) => {
    const ph = seed * 0.37 + i * 1.7;
    const dx = Math.sin(now / 900 + ph) * 3.2 + Math.sin(now / 2300 + ph * 2) * 2;
    const dy = Math.cos(now / 1100 + ph) * 2.6;
    const fx = offenseLeft ? CW - (x + dx) : x + dx;
    return { x: fx, y: Math.min(CH - 2, Math.max(2, y + dy)), offense: i < 5 };
  });
}

/** Basketball court, 94 x 50 ft, with ten players drifting through a set and the ball handler dribbling. */
export default function Court({ g, box, now, live }: VenueProps) {
  const { home, away } = g.info;
  const s = Math.min((box.width - 2 * box.margin) / CW, (box.height - 2 * box.margin) / CH);
  const courtW = CW * s;
  const courtH = CH * s;
  const left = (box.width - courtW) / 2;
  const top = (box.height - courtH) / 2;
  const offenseLeft = g.screen.lastEvent?.team === 'away';
  const ft = (v: number) => v * s;
  const line = LINE;
  const squad = players(g.info.id.charCodeAt(1), offenseLeft, now);
  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width: courtW,
        height: courtH,
        backgroundColor: fb.maple,
        borderWidth: Math.max(1, ft(0.25)),
        borderColor: line,
        overflow: 'hidden',
      }}>
      {/* Floor planks */}
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: (i * courtH) / 10,
            height: courtH / 20,
            backgroundColor: fb.mapleDark,
            opacity: 0.18,
          }}
        />
      ))}
      {/* Three-point arcs */}
      {[0, 1].map((side) => (
        <View
          key={`arc${side}`}
          style={{
            position: 'absolute',
            width: ft(47.5),
            height: ft(47.5),
            borderRadius: ft(23.75),
            borderWidth: Math.max(1, ft(0.2)),
            borderColor: line,
            top: ft(25 - 23.75),
            left: side === 0 ? ft(5.25 - 23.75) : ft(CW - 5.25 - 23.75),
          }}
        />
      ))}
      {/* Painted keys in home color */}
      {[0, 1].map((side) => (
        <View
          key={`key${side}`}
          style={{
            position: 'absolute',
            top: ft(17),
            width: ft(19),
            height: ft(16),
            left: side === 0 ? 0 : ft(CW - 19),
            backgroundColor: home.color,
            opacity: 0.9,
            borderWidth: Math.max(1, ft(0.2)),
            borderColor: line,
          }}
        />
      ))}
      {/* Half-court line and center circle */}
      <View
        style={{
          position: 'absolute',
          left: ft(47) - 1,
          top: 0,
          bottom: 0,
          width: Math.max(1, ft(0.2)),
          backgroundColor: line,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: ft(47 - 6),
          top: ft(25 - 6),
          width: ft(12),
          height: ft(12),
          borderRadius: ft(6),
          borderWidth: Math.max(1, ft(0.2)),
          borderColor: line,
          backgroundColor: home.color,
          opacity: 0.45,
        }}
      />
      {/* Players */}
      {live &&
        squad.map((p, i) => {
          const team = p.offense ? (offenseLeft ? away : home) : offenseLeft ? home : away;
          const r = ft(1.6);
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: ft(p.x) - r,
                top: ft(p.y) - r,
                width: 2 * r,
                height: 2 * r,
                borderRadius: r,
                backgroundColor: team.color,
                borderWidth: Math.max(1, ft(0.35)),
                borderColor: team.alt,
              }}
            />
          );
        })}
      {/* The ball, dribbled by the ball handler (illustrative: play-by-play has no ball tracking) */}
      {live && squad[0] && (
        <View
          style={{
            position: 'absolute',
            left: ft(squad[0].x + (offenseLeft ? -2 : 2)) - ft(0.8),
            top: ft(squad[0].y + 1.2 + Math.abs(Math.sin(now / 160)) * 0.9) - ft(0.8),
            width: ft(1.6),
            height: ft(1.6),
            borderRadius: ft(0.8),
            backgroundColor: '#E07A1F',
            borderWidth: Math.max(1, ft(0.2)),
            borderColor: '#3B1F0A',
          }}
        />
      )}
    </View>
  );
}
