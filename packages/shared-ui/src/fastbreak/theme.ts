import { scaledPixels } from '../hooks/useScale';

/** Arena-at-night palette: navy concourse, maple floor, scoreboard amber, shot-clock red. */
export const fb = {
  ink: '#0E1A2C',
  inkRaised: '#15253C',
  inkHigh: '#1D3150',
  line: '#2A4064',
  chalk: '#F2F4F7',
  haze: '#9AABC6',
  dim: '#62779A',
  amber: '#FFB000',
  amberSoft: 'rgba(255, 176, 0, 0.16)',
  maple: '#C98D52',
  mapleDark: '#B07841',
  buzzer: '#FF5A36',
  buzzerSoft: 'rgba(255, 90, 54, 0.16)',
  scrim: 'rgba(8, 14, 24, 0.82)',
};

export const px = scaledPixels;

export const type = {
  display: { fontSize: px(44), fontWeight: '800' as const, color: fb.chalk, letterSpacing: px(-0.5) },
  title: { fontSize: px(30), fontWeight: '700' as const, color: fb.chalk },
  body: { fontSize: px(24), fontWeight: '500' as const, color: fb.haze },
  small: { fontSize: px(20), fontWeight: '600' as const, color: fb.haze },
  digits: { fontVariant: ['tabular-nums' as const], fontWeight: '800' as const },
};
