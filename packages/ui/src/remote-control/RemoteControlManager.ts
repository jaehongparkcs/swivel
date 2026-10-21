import { Platform } from 'react-native';
import { KeyEmitter } from './KeyEmitter';
import { SupportedKeys } from './SupportedKeys';

/** Web (and keyboard) keys to Swivel keys. */
const KEY_MAPPING: Record<string, SupportedKeys> = {
  ArrowRight: SupportedKeys.Right,
  ArrowLeft: SupportedKeys.Left,
  ArrowUp: SupportedKeys.Up,
  ArrowDown: SupportedKeys.Down,
  Enter: SupportedKeys.Enter,
  Backspace: SupportedKeys.Back,
  GoBack: SupportedKeys.Back, // For LG WebOS Magic Remote
  Escape: SupportedKeys.Back,
  Space: SupportedKeys.PlayPause,
  MediaPlayPause: SupportedKeys.PlayPause,
  BracketRight: SupportedKeys.FastForward,
  MediaFastForward: SupportedKeys.FastForward,
  BracketLeft: SupportedKeys.Rewind,
  MediaRewind: SupportedKeys.Rewind,
};

interface KeyboardEventLike {
  code: string;
  key: string;
}

interface WindowLike {
  addEventListener(type: 'keydown', listener: (event: KeyboardEventLike) => void): void;
}

class RemoteControlManager extends KeyEmitter {
  constructor() {
    super();
    if (Platform.OS === 'web') (globalThis as unknown as WindowLike).addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEventLike): void => {
    const key = KEY_MAPPING[event.code] || KEY_MAPPING[event.key];
    if (key) this.emitKeyDown(key);
  };
}

export default new RemoteControlManager();
