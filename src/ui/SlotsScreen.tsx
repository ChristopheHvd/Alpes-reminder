import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Slot, at, fmtTime, newId, timeOf } from '../model';
import { c, f } from '../theme';
import { BackIcon } from './parts';

type Props = { slots: Slot[]; onChange: (slots: Slot[]) => void; onBack: () => void; topInset: number };

const pickTime = (time: string, done: (t: string) => void) =>
  DateTimePickerAndroid.open({
    value: new Date(at(Date.now(), time)),
    mode: 'time',
    is24Hour: true,
    onChange: (e, d) => e.type === 'set' && d && done(timeOf(d.getTime())),
  });

export function SlotsScreen({ slots, onChange, onBack, topInset }: Props) {
  const [name, setName] = useState('');
  const sorted = [...slots].sort((a, b) => a.time.localeCompare(b.time));

  const add = () => {
    const n = name.trim();
    if (!n) return;
    pickTime('16:00', (time) => {
      onChange([...slots, { id: newId(), name: n, time }]);
      setName('');
    });
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.wrap, { paddingTop: topInset + 8 }]} keyboardShouldPersistTaps="handled">
      <View style={st.head}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Retour" style={st.back}>
          <BackIcon />
        </Pressable>
        <Text style={st.h1}>Créneaux</Text>
      </View>
      <Text style={st.hint}>Les heures proposées quand tu ajoutes ou reportes un rappel.</Text>

      <View style={st.list}>
        {sorted.map((s, i) => (
          <View key={s.id} style={[st.item, i > 0 && st.sep]}>
            <Text style={st.name}>{s.name}</Text>
            <Pressable onPress={() => pickTime(s.time, (t) => onChange(slots.map((x) => (x.id === s.id ? { ...x, time: t } : x))))} style={st.time} accessibilityLabel={`Changer l'heure de ${s.name}`}>
              <Text style={st.timeText}>{fmtTime(s.time)}</Text>
            </Pressable>
            {slots.length > 1 ? (
              <Pressable onPress={() => onChange(slots.filter((x) => x.id !== s.id))} hitSlop={10} accessibilityLabel={`Supprimer ${s.name}`}>
                <Text style={st.remove}>Retirer</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <View style={[st.item, st.sep]}>
          <TextInput value={name} onChangeText={setName} placeholder="Nouveau créneau (ex. Après-midi)" placeholderTextColor={c.muted} style={st.input} onSubmitEditing={add} returnKeyType="next" />
          <Pressable onPress={add} disabled={!name.trim()} hitSlop={10}>
            <Text style={[st.addText, !name.trim() && { opacity: 0.4 }]}>Ajouter</Text>
          </Pressable>
        </View>
      </View>
      <Text style={st.hint}>Dire « demain matin » ou « ce soir » choisit le créneau tout seul.</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 18, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  h1: { fontFamily: f.display, fontSize: 30, color: c.fg },
  hint: { fontFamily: f.body, fontSize: 14, color: c.muted, lineHeight: 20, marginVertical: 12 },
  list: { backgroundColor: c.surface, borderRadius: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  sep: { borderTopWidth: 1, borderTopColor: c.line },
  name: { flex: 1, fontFamily: f.medium, fontSize: 16, color: c.fg },
  time: { backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  timeText: { fontFamily: f.medium, fontSize: 15, color: c.fg, fontVariant: ['tabular-nums'] },
  remove: { fontFamily: f.medium, fontSize: 14, color: c.muted },
  input: { flex: 1, fontFamily: f.body, fontSize: 15, color: c.fg, paddingVertical: 4 },
  addText: { fontFamily: f.semi, fontSize: 15, color: c.accent },
});
