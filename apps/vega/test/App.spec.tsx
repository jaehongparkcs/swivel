/**
 * Smoke tests for the Vega shell: Swivel opens on the splash screen, and the
 * remote takes you through "Set up tonight" into the watch screen.
 */

import 'react-native';
import {act, render} from '@testing-library/react-native';
import * as React from 'react';

import {App} from '../src/App';

// Remote input is hardware: keep the listeners so tests can press keys.
const mockListeners = new Set<(key: string) => void>();
jest.mock(
  '../../../packages/ui/src/remote-control/RemoteControlManager',
  () => ({
    __esModule: true,
    default: {
      addKeydownListener: (l: (key: string) => void) => (
        mockListeners.add(l),
        l
      ),
      removeKeydownListener: (l: (key: string) => void) =>
        mockListeners.delete(l),
      emitKeyDown: () => undefined,
    },
  }),
);
const press = (key: string) =>
  act(() => [...mockListeners].forEach((l) => l(key)));

describe('App', () => {
  it('opens on the Swivel splash screen', () => {
    const screen = render(<App />);
    expect(screen.getByText('Swivel')).toBeTruthy();
    expect(screen.getByText("Autopilot for tonight's games")).toBeTruthy();
    screen.unmount();
  });

  it('goes from setup to watching with two presses of OK', () => {
    const screen = render(<App />);
    press('Enter'); // skip the splash
    expect(screen.getByText('Set up tonight')).toBeTruthy();
    press('Enter'); // Start watching is focused
    expect(screen.getByText('Tonight')).toBeTruthy();
    expect(screen.getByText('Your teams')).toBeTruthy();
    screen.unmount();
  });
});
