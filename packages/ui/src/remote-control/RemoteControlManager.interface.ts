import { SupportedKeys } from './SupportedKeys';

// Define a type for the listener function
export type KeydownListener = (event: SupportedKeys) => void;

export interface RemoteControlManagerInterface {
  /** Returns the listener, to pass to removeKeydownListener later. */
  addKeydownListener(listener: KeydownListener): KeydownListener;
  removeKeydownListener(listener: KeydownListener): void;
  emitKeyDown(key: SupportedKeys): void;
}
