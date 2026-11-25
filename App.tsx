import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, useFonts } from '@expo-google-fonts/figtree';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Completion, Reminder, State, dayLabel, fmtTime, firstDue, makeRepeat, newId, repeatLabel, timeOf, undo } from './src/model';
import { ACTION_DONE, ACTION_SNOOZE, applyDone, payloadOf, setupNotifications, syncNotifications } from './src/notifications';
import { Draft } from './src/parse';
import { emptyState, loadState, saveState } from './src/store';
import { c, f } from './src/theme';
import { EditSheet, EditTarget } from './src/ui/EditSheet';
import { Check, Chevron, ClockIcon, MicIcon } from './src/ui/parts';
import { SlotsScreen } from './src/ui/SlotsScreen';
import { SnoozeSheet } from './src/ui/SnoozeSheet';

const VOICE_LINK = 'rappels://dicter';

function whenLabel(t: number): string {
  const label = dayLabel(t, Date.now());
  const day = label === "Aujourd'hui" ? "aujourd'hui" : label === 'Demain' ? 'demain' : new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day}, ${fmtTime(timeOf(t))}`;
}

export default function App() {
  const [fontsLoaded] = useFonts({ BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold });
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {fontsLoaded ? <Main /> : <View style={{ flex: 1, backgroundColor: c.bg }} />}
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(Date.now());
  const [screen, setScreen] = useState<'list' | 'slots'>('list');
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [snoozing, setSnoozing] = useState<Reminder | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [toast, setToast] = useState('');
  const [toastAnim] = useState(() => new Animated.Value(0));
  const stateRef = useRef<State | null>(null);
  stateRef.current = state;

  const commit = useCallback((next: State) => {
    setState(next);
    saveState(next);
    syncNotifications(next).catch(() => {});
  }, []);

  const say = useCallback(
    (msg: string) => {
      setToast(msg);
      toastAnim.setValue(0);
      Animated.sequence([
        Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    },
    [toastAnim],
  );

  const handleResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const p = payloadOf(response);
      if (!p) return;
      const current = stateRef.current ?? (await loadState());
      if (response.actionIdentifier === ACTION_DONE) {
        commit(applyDone(current, p.reminderId, p.at, Date.now()));
        Notifications.dismissNotificationAsync(p.notificationId);
        return;
      }
      const r = current.reminders.find((x) => x.id === p.reminderId);
      if (response.actionIdentifier === ACTION_SNOOZE && r) {
        Notifications.dismissNotificationAsync(p.notificationId);
        setScreen('list');
        setSnoozing(r);
      }
    },
    [commit],
  );

  // Load, ask for notification permission, catch the tap that opened the app.
  useEffect(() => {
    (async () => {
      const loaded = await loadState();
      setState(loaded);
      stateRef.current = loaded;
      await setupNotifications().catch(() => false);
      syncNotifications(loaded).catch(() => {});
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        await Notifications.clearLastNotificationResponseAsync();
        handleResponse(last);
      }
    })();
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      Notifications.clearLastNotificationResponseAsync();
      handleResponse(r);
    });
    // The background task may have changed the stored list while the app was away.
    const app = AppState.addEventListener('change', async (s) => {
      if (s !== 'active') return;
      setNow(Date.now());
      const fresh = await loadState();
      setState(fresh);
      syncNotifications(fresh).catch(() => {});
    });
    // Launched as the Android assistant: go straight to dictation.
    const openVoice = (url?: string | null) => {
      if (url !== VOICE_LINK) return;
      setScreen('list');
      setSnoozing(null);
      setEdit({ mode: 'voice' });
    };
    Linking.getInitialURL().then(openVoice);
    const link = Linking.addEventListener('url', (e) => openVoice(e.url));
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      sub.remove();
      link.remove();
      app.remove();
      clearInterval(tick);
    };
  }, [handleResponse]);

  if (!state) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const save = (d: Draft, id?: string) => {
    const repeat = makeRepeat(d.repeat, d.day, d.days);
    const due = firstDue(repeat, d.day, d.time, Date.now());
    const old = id ? state.reminders.find((r) => r.id === id) : undefined;
    const r: Reminder = { id: id ?? newId(), title: d.title, time: d.time, repeat, due, createdAt: old?.createdAt ?? Date.now() };
    commit({ ...state, reminders: old ? state.reminders.map((x) => (x.id === id ? r : x)) : [...state.reminders, r] });
    setEdit(null);
    say(old ? 'Rappel modifié' : `Ajouté : ${whenLabel(due)}`);
  };

  const remove = (id: string) => {
    commit({ ...state, reminders: state.reminders.filter((r) => r.id !== id) });
    setEdit(null);
    say('Rappel supprimé');
  };

  const markDone = (r: Reminder) => {
    const next = applyDone(state, r.id, r.due, Date.now());
    commit(next);
    const after = next.reminders.find((x) => x.id === r.id);
    if (after && !after.doneAt) say(`Prochain : ${whenLabel(after.due)}`);
  };

  const undoDone = (e: Completion) => {
    const r = state.reminders.find((x) => x.id === e.reminderId);
    commit({
      ...state,
      reminders: r ? state.reminders.map((x) => (x.id === r.id ? undo(x, e) : x)) : state.reminders,
      log: state.log.filter((x) => x.id !== e.id),
    });
  };

  const snooze = (when: number) => {
    if (!snoozing) return;
    commit({ ...state, reminders: state.reminders.map((x) => (x.id === snoozing.id ? { ...x, due: when, doneAt: undefined } : x)) });
    setSnoozing(null);
    say(`Reporté : ${whenLabel(when)}`);
  };

  if (screen === 'slots') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SlotsScreen slots={state.slots} onChange={(slots) => commit({ ...state, slots })} onBack={() => setScreen('list')} topInset={insets.top} />
      </View>
    );
  }

  const todo = state.reminders.filter((r) => !r.doneAt).sort((a, b) => a.due - b.due);
  const late = todo.filter((r) => r.due <= now);
  const groups: { label: string; items: Reminder[] }[] = [];
  for (const r of todo.filter((x) => x.due > now)) {
    const label = dayLabel(r.due, now);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(r);
    else groups.push({ label, items: [r] });
  }
  const done = state.log.slice(0, 30);

  const row = (r: Reminder, i: number, isLate = false) => {
    const rec = repeatLabel(r.repeat);
    return (
      <Pressable key={r.id} onPress={() => setEdit({ mode: 'edit', reminder: r })} style={({ pressed }) => [st.item, i > 0 && st.sep, pressed && st.pressed]}>
        <Check done={false} onPress={() => markDone(r)} label={`Marquer « ${r.title} » fait`} />
        <View style={st.itemText}>
          <Text style={st.title}>{r.title}</Text>
          <View style={st.meta}>
            <Text style={[st.metaText, isLate && { color: c.late }]}>{isLate ? `${dayLabel(r.due, now)}, ${fmtTime(timeOf(r.due))}` : fmtTime(timeOf(r.due))}</Text>
            {rec ? <Text style={[st.metaText, st.rec]}>↻ {rec}</Text> : null}
          </View>
        </View>
        {isLate ? (
          <Pressable onPress={() => setSnoozing(r)} hitSlop={8} style={st.later} accessibilityLabel={`Reporter « ${r.title} »`}>
            <Text style={st.laterText}>Reporter</Text>
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={st.head}>
          <Text style={st.h1}>Rappels</Text>
          <Pressable onPress={() => setScreen('slots')} hitSlop={10} style={st.icon} accessibilityLabel="Créneaux">
            <ClockIcon />
          </Pressable>
        </View>

        {!todo.length ? <Text style={st.empty}>Aucun rappel en attente.{'\n'}Touche le micro et dis par exemple « appeler le garage demain matin ».</Text> : null}

        {late.length ? (
          <>
            <Text style={[st.dayH, { color: c.late }]}>En retard</Text>
            <View style={st.list}>{late.map((r, i) => row(r, i, true))}</View>
          </>
        ) : null}

        {groups.map((g) => (
          <View key={g.label}>
            <Text style={st.dayH}>{g.label}</Text>
            <View style={st.list}>{g.items.map((r, i) => row(r, i))}</View>
          </View>
        ))}

        {done.length ? (
          <>
            <Pressable onPress={() => setShowDone(!showDone)} style={st.doneToggle} accessibilityRole="button" accessibilityState={{ expanded: showDone }}>
              <Chevron open={showDone} />
              <Text style={st.doneLabel}>Faits ({done.length})</Text>
            </Pressable>
            {showDone ? (
              <View style={st.list}>
                {done.map((e, i) => (
                  <View key={e.id} style={[st.item, i > 0 && st.sep]}>
                    <Check done onPress={() => undoDone(e)} label={`Remettre « ${e.title} » à faire`} />
                    <View style={st.itemText}>
                      <Text style={[st.title, st.titleDone]}>{e.title}</Text>
                      <Text style={st.metaText}>
                        {dayLabel(e.at, now)}, {fmtTime(timeOf(e.at))}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <Animated.View pointerEvents="none" style={[st.toast, { bottom: 86 + insets.bottom, opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <Text style={st.toastText}>{toast}</Text>
      </Animated.View>

      <View style={[st.composer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable onPress={() => setEdit({ mode: 'text' })} style={st.field} accessibilityRole="button">
          <Text style={st.fieldText}>Ajouter un rappel…</Text>
        </Pressable>
        <Pressable onPress={() => setEdit({ mode: 'voice' })} style={({ pressed }) => [st.mic, pressed && { opacity: 0.8 }]} accessibilityLabel="Dicter un rappel">
          <MicIcon />
        </Pressable>
      </View>

      <EditSheet target={edit} slots={state.slots} onClose={() => setEdit(null)} onSave={save} onDelete={remove} />
      <SnoozeSheet reminder={snoozing} slots={state.slots} onClose={() => setSnoozing(null)} onSnooze={snooze} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 18, paddingBottom: 32 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  h1: { fontFamily: f.display, fontSize: 32, color: c.fg, letterSpacing: -0.3 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: f.body, fontSize: 15, lineHeight: 22, color: c.muted, marginTop: 40, textAlign: 'center', paddingHorizontal: 24 },
  dayH: { fontFamily: f.semi, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: c.muted, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  list: { backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { borderTopWidth: 1, borderTopColor: c.line },
  pressed: { backgroundColor: c.bg },
  itemText: { flex: 1, minWidth: 0 },
  title: { fontFamily: f.medium, fontSize: 16, color: c.fg },
  titleDone: { color: c.done, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 3 },
  metaText: { fontFamily: f.body, fontSize: 13, color: c.muted, fontVariant: ['tabular-nums'] },
  rec: { color: c.warm, fontFamily: f.semi },
  later: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: c.bg },
  laterText: { fontFamily: f.semi, fontSize: 13, color: c.fg },
  doneToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 8, paddingVertical: 6, paddingHorizontal: 4, alignSelf: 'flex-start' },
  doneLabel: { fontFamily: f.semi, fontSize: 14, color: c.muted },
  composer: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line },
  field: { flex: 1, height: 48, borderRadius: 24, backgroundColor: c.bg, justifyContent: 'center', paddingHorizontal: 18 },
  fieldText: { fontFamily: f.body, fontSize: 15, color: c.muted },
  mic: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: c.fg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  toastText: { fontFamily: f.semi, fontSize: 14, color: c.bg },
});
