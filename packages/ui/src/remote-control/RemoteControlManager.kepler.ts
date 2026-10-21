import { KeyEmitter, type HWEvent } from './KeyEmitter';
import { SupportedKeys } from './SupportedKeys';

/** Vega remote: TVEventHandler event types to Swivel keys. */
const EVENT_TYPE_MAPPING: Record<string, SupportedKeys> = {
  left: SupportedKeys.Left,
  right: SupportedKeys.Right,
  down: SupportedKeys.Down,
  up: SupportedKeys.Up,
  select: SupportedKeys.Enter,
  back: SupportedKeys.Back,
  playpause: SupportedKeys.PlayPause,
  skip_backward: SupportedKeys.Rewind,
  skip_forward: SupportedKeys.FastForward,
};

interface TVEventHandlerLike {
  enable(component: unknown, callback: (component: unknown, event: HWEvent) => void): void;
  disable(): void;
}

class RemoteControlManager extends KeyEmitter {
  private tvEventHandler: TVEventHandlerLike;

  constructor() {
    super();
    // Vega's React Native provides TVEventHandler at runtime; it isn't in the shared typings.
    const { TVEventHandler } = require('react-native') as { TVEventHandler: new () => TVEventHandlerLike };
    this.tvEventHandler = new TVEventHandler();
    this.tvEventHandler.enable(this, this.handleHWEvent);
  }

  private handleHWEvent = (_component: unknown, event: HWEvent): void => {
    if (event.eventKeyAction !== 0 && event.eventKeyAction !== undefined) return; // key down only
    const key = EVENT_TYPE_MAPPING[event.eventType];
    if (key) this.emitKeyDown(key);
  };

  cleanup = (): void => {
    this.tvEventHandler.disable();
  };
}

export default new RemoteControlManager();
