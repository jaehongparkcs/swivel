import { KeyEmitter, type HWEvent } from './KeyEmitter';
import { SupportedKeys } from './SupportedKeys';

/** tvOS remote (react-native-tvos): event types and swipes to Swivel keys. */
const KEY_MAPPING: Record<string, SupportedKeys> = {
  right: SupportedKeys.Right,
  left: SupportedKeys.Left,
  up: SupportedKeys.Up,
  down: SupportedKeys.Down,
  select: SupportedKeys.Enter,
  swipeLeft: SupportedKeys.Left,
  swipeRight: SupportedKeys.Right,
  swipeUp: SupportedKeys.Up,
  swipeDown: SupportedKeys.Down,
};

interface TVEventHandlerStatic {
  addListener(callback: (event: HWEvent) => void): { remove(): void };
}

class RemoteControlManager extends KeyEmitter {
  private subscription: { remove(): void };

  constructor() {
    super();
    // react-native-tvos provides TVEventHandler at runtime; it isn't in the shared typings.
    const { TVEventHandler } = require('react-native') as { TVEventHandler: TVEventHandlerStatic };
    this.subscription = TVEventHandler.addListener(this.handleKeyDown);
  }

  private handleKeyDown = (event: HWEvent): void => {
    const key = event && KEY_MAPPING[event.eventType];
    if (key) this.emitKeyDown(key);
  };

  cleanup = (): void => {
    this.subscription.remove();
  };
}

export default new RemoteControlManager();
