import { Dimensions } from 'react-native';

/** Layouts are designed at 1920x1080 and scaled by screen diagonal to the real display. */
const DESIGN = { width: 1920, height: 1080 };

const { width, height } = Dimensions.get('window');
const RATIO = Math.hypot(width, height) / Math.hypot(DESIGN.width, DESIGN.height);

/** Design pixels (at 1920x1080) to device pixels. */
export function scaledPixels(size: number): number {
  return RATIO * size;
}
