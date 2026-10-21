/** Minimal typings for react-native-keyevent (Android TV key events), which ships none. */
declare module 'react-native-keyevent' {
  interface KeyEventModule {
    onKeyDownListener(callback: (event: { keyCode: number }) => void): void;
    onKeyUpListener(callback: (event: { keyCode: number }) => void): void;
    removeKeyDownListener(): void;
    removeKeyUpListener(): void;
  }
  const KeyEvent: KeyEventModule;
  export default KeyEvent;
}
