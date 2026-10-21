import { Platform } from 'react-native';

/**
 * The few browser APIs Swivel uses (URL options, saved taste), reached through
 * globalThis so native builds, which have no DOM types, compile and get nothing.
 */
interface WebGlobals {
  location?: { search: string };
  localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
}

function web(): WebGlobals {
  return Platform.OS === 'web' ? (globalThis as unknown as WebGlobals) : {};
}

/** Query-string options (?seed=74&speed=8), on web only. */
export function urlParams(): Record<string, string> {
  const search = web().location?.search ?? '';
  const out: Record<string, string> = {};
  for (const pair of search.replace(/^\?/, '').split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

/** Small string store: localStorage on web, in memory elsewhere (Vega's key-value storage plugs in here). */
export interface KeyValueStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

const memory = new Map<string, string>();

export const keyValueStore: KeyValueStore = {
  get(key) {
    try {
      return web().localStorage?.getItem(key) ?? memory.get(key);
    } catch {
      return memory.get(key);
    }
  },
  set(key, value) {
    memory.set(key, value);
    try {
      web().localStorage?.setItem(key, value);
    } catch {
      /* storage unavailable: the in-memory copy still lasts the session */
    }
  },
};
