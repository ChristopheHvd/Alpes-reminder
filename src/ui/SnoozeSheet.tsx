import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Reminder, Slot, dayLabel, fmtTime, snoozeOptions, timeOf } from '../model';
import { c, f } from '../theme';
import { Sheet } from './parts';

type Props = { reminder: Reminder | null; slots: Slot[]; onClose: () => void; onSnooze: (when: number) => void };

export function SnoozeSheet(props: Props) {
  return (
    <Sheet visible={!!props.reminder} onClose={props.onClose}>
      {props.reminder ? <SnoozeBody key={props.reminder.id + props.reminder.due} {...props} reminder={props.reminder} /> : null}
    </Sheet>
  );
}

function SnoozeBody({ reminder, slots, onSnooze }: Props & { reminder: Reminder }) {
  const [now] = useState(() => Date.now());
  const opts = snoozeOptions(slots, now);

  const custom = () => {
    const base = new Date(now + 60 * 60000);
    DateTimePickerAndroid.open({
      value: base,
      mode: 'date',
      minimumDate: new Date(now),
      onChange: (e, day) => {
        if (e.type !== 'set' || !day) return;
        DateTimePickerAndroid.open({
          value: base,
          mode: 'time',
          is24Hour: true,
          onChange: (e2, t) => {
            if (e2.type !== 'set' || !t) return;
            const when = new Date(day);
            when.setHours(t.getHours(), t.getMinutes(), 0, 0);
            onSnooze(when.getTime());
          },
        });
      },
    });
  };

  return (
    <>
      <Text style={st.h}>Reporter</Text>
      <Text style={st.sub} numberOfLines={2}>
        {reminder.title}
      </Text>
      {opts.map((o) => (
        <Pressable key={o.label} onPress={() => onSnooze(o.when)} style={({ pressed }) => [st.opt, pressed && st.pressed]} accessibilityRole="button">
          <Text style={st.optText}>{o.label}</Text>
          <Text style={st.optWhen}>
            {dayLabel(o.when, now) === "Aujourd'hui" ? '' : 'demain '}
            {fmtTime(timeOf(o.when))}
          </Text>
        </Pressable>
      ))}
      <Pressable onPress={custom} style={({ pressed }) => [st.opt, pressed && st.pressed]} accessibilityRole="button">
        <Text style={st.optText}>Choisir…</Text>
        <Text style={st.optWhen}>date et heure</Text>
      </Pressable>
      <View style={{ height: 4 }} />
    </>
  );
}

const st = StyleSheet.create({
  h: { fontFamily: f.display, fontSize: 22, color: c.fg },
  sub: { fontFamily: f.body, fontSize: 14, color: c.muted, marginTop: 2, marginBottom: 10 },
  opt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: c.line },
  pressed: { backgroundColor: c.bg },
  optText: { fontFamily: f.medium, fontSize: 16, color: c.fg },
  optWhen: { fontFamily: f.body, fontSize: 15, color: c.muted, fontVariant: ['tabular-nums'] },
});
