import mitt from 'mitt';
import type { KeydownListener, RemoteControlManagerInterface } from './RemoteControlManager.interface';
import type { SupportedKeys } from './SupportedKeys';

/** Listener bookkeeping shared by every platform; subclasses only translate their input into SupportedKeys. */
export class KeyEmitter implements RemoteControlManagerInterface {
  private emitter = mitt<{ keyDown: SupportedKeys }>();

  addKeydownListener = (listener: KeydownListener): KeydownListener => {
    this.emitter.on('keyDown', listener);
    return listener;
  };

  removeKeydownListener = (listener: KeydownListener): void => {
    this.emitter.off('keyDown', listener);
  };

  emitKeyDown = (key: SupportedKeys): void => {
    this.emitter.emit('keyDown', key);
  };
}

/** A TV remote event as Vega (TVEventHandler) and tvOS deliver it. */
export interface HWEvent {
  eventType: string;
  /** 0 = key down, 1 = key up, -1 or missing = not reported. */
  eventKeyAction?: number;
}
