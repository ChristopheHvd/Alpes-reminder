import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { State, complete, fmtTime, timeOf, upcoming } from './model';
import { loadState, saveState } from './store';

export const CHANNEL = 'rappels';
export const CATEGORY = 'rappel';
export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';
const TASK = 'rappels-notification-action';

type Payload = { reminderId: string; at: number };

export async function setupNotifications(): Promise<boolean> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rappels',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#1D6B62',
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: ACTION_SNOOZE, buttonTitle: 'Reporter', options: { opensAppToForeground: true } },
    { identifier: ACTION_DONE, buttonTitle: 'Fait', options: { opensAppToForeground: false } },
  ]);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replaces every scheduled notification with the ones the current state needs. */
export async function syncNotifications(state: State): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const jobs: Promise<string>[] = [];
  for (const r of state.reminders) {
    for (const t of upcoming(r, now)) {
      const data: Payload = { reminderId: r.id, at: t };
      jobs.push(
        Notifications.scheduleNotificationAsync({
          identifier: `${r.id}.${t}`,
          content: { title: r.title, body: fmtTime(timeOf(t)), data, categoryIdentifier: CATEGORY },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t, channelId: CHANNEL },
        }),
      );
    }
  }
  await Promise.all(jobs);
}

export function payloadOf(response: Notifications.NotificationResponse): (Payload & { notificationId: string }) | null {
  const data = response.notification.request.content.data as Partial<Payload> | undefined;
  if (!data?.reminderId || typeof data.at !== 'number') return null;
  return { reminderId: data.reminderId, at: data.at, notificationId: response.notification.request.identifier };
}

/** Applies "Fait" to the stored state. Stale taps (an occurrence already handled) are ignored. */
export function applyDone(state: State, reminderId: string, occurrence: number, now: number): State {
  const r = state.reminders.find((x) => x.id === reminderId);
  if (!r || r.doneAt || occurrence < r.due) return state;
  const { reminder, entry } = complete({ ...r, due: Math.max(r.due, occurrence) }, now);
  entry.prevDue = r.due;
  return {
    ...state,
    reminders: state.reminders.map((x) => (x.id === r.id ? reminder : x)),
    log: [entry, ...state.log],
  };
}

export async function handleDoneInBackground(response: Notifications.NotificationResponse): Promise<void> {
  const p = payloadOf(response);
  if (!p) return;
  const state = applyDone(await loadState(), p.reminderId, p.at, Date.now());
  await saveState(state);
  await Notifications.dismissNotificationAsync(p.notificationId);
  await syncNotifications(state);
}

// Android runs this task when "Fait" is tapped while the app is in the background or closed.
TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data }) => {
  if (data && 'actionIdentifier' in data && data.actionIdentifier === ACTION_DONE) {
    await handleDoneInBackground(data);
  }
});

export function registerBackgroundTask() {
  Notifications.registerTaskAsync(TASK).catch(() => {});
}
