import KeyEvent from 'react-native-keyevent';
import { KeyEmitter } from './KeyEmitter';
import { SupportedKeys } from './SupportedKeys';

/** Android TV key codes to Swivel keys. */
const KEY_CODE_MAPPING: Record<number, SupportedKeys> = {
  21: SupportedKeys.Left,
  22: SupportedKeys.Right,
  20: SupportedKeys.Down,
  19: SupportedKeys.Up,
  66: SupportedKeys.Enter,
  23: SupportedKeys.Enter,
  67: SupportedKeys.Back,
  85: SupportedKeys.PlayPause,
  89: SupportedKeys.Rewind,
  90: SupportedKeys.FastForward,
};

class RemoteControlManager extends KeyEmitter {
  constructor() {
    super();
    KeyEvent.onKeyDownListener(this.handleKeyDown);
  }

  private handleKeyDown = (keyEvent: { keyCode: number }): void => {
    const key = KEY_CODE_MAPPING[keyEvent.keyCode];
    if (key) this.emitKeyDown(key);
  };
}

export default new RemoteControlManager();
