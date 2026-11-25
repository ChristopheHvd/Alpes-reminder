import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SLOTS, State } from './model';

const KEY = 'rappels:v1';

const VERSION = 2;

export const emptyState = (): State => ({ reminders: [], slots: DEFAULT_SLOTS, log: [], version: VERSION });

// v2: the morning slot moved from 8:00 to 9:00; untouched stored slots follow.
function migrate(state: State): State {
  if ((state.version ?? 1) >= VERSION) return state;
  const slots = state.slots.map((s) => (s.id === 'matin' && s.time === '08:00' ? { ...s, time: '09:00' } : s));
  return { ...state, slots, version: VERSION };
}

export async function loadState(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyState();
    return migrate({ ...emptyState(), version: 1, ...JSON.parse(raw) });
  } catch {
    return emptyState();
  }
}

export async function saveState(state: State): Promise<void> {
  const log = state.log.slice(0, 50);
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...state, log }));
}
