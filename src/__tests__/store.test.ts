import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadState } from '../store';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('loadState', () => {
  it('moves an untouched 8:00 morning slot to 9:00 once', async () => {
    await AsyncStorage.setItem('rappels:v1', JSON.stringify({ reminders: [], log: [], slots: [{ id: 'matin', name: 'Matin', time: '08:00' }] }));
    const s = await loadState();
    expect(s.slots[0].time).toBe('09:00');
    expect(s.version).toBe(2);
  });
  it('keeps a morning time chosen after the migration', async () => {
    await AsyncStorage.setItem('rappels:v1', JSON.stringify({ reminders: [], log: [], version: 2, slots: [{ id: 'matin', name: 'Matin', time: '08:00' }] }));
    expect((await loadState()).slots[0].time).toBe('08:00');
  });
});
