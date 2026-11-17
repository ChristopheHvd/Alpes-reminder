import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SLOTS, State } from './model';

const KEY = 'rappels:v1';

export const emptyState = (): State => ({ reminders: [], slots: DEFAULT_SLOTS, log: [] });

export async function loadState(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    return emptyState();
  }
}

export async function saveState(state: State): Promise<void> {
  const log = state.log.slice(0, 50);
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...state, log }));
}
