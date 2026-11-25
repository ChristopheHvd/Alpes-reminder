import { NotificationResponse } from 'expo-notifications';
import { payloadOf } from '../notifications';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const response = (content: object) =>
  ({ actionIdentifier: 'done', notification: { request: { identifier: 'r1.5', content } } }) as unknown as NotificationResponse;

describe('payloadOf', () => {
  it('reads data from the foreground listener', () => {
    expect(payloadOf(response({ data: { reminderId: 'r1', at: 5 } }))).toEqual({ reminderId: 'r1', at: 5, notificationId: 'r1.5' });
  });
  it('reads the JSON string sent to the Android background task', () => {
    expect(payloadOf(response({ dataString: '{"reminderId":"r1","at":5}' }))).toEqual({ reminderId: 'r1', at: 5, notificationId: 'r1.5' });
  });
});
