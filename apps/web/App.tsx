import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { LogBox } from 'react-native';
import { SwivelApp } from '@swivel/ui';

if (__DEV__) {
  LogBox.ignoreLogs([/findNodeHandle is deprecated/, /findHostInstance_DEPRECATED is deprecated/]);
}

SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return <SwivelApp />;
}
