import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { DAY_FULL, DAY_LETTER, Reminder, RepeatKind, Slot, WEEK, addDays, at, startOfDay, timeOf } from '../model';
import { Draft, defaultDraft, parse } from '../parse';
import { c, f } from '../theme';
import { Chip, Label, PrimaryButton, Sheet } from './parts';

const REPEATS: [RepeatKind, string][] = [
  ['once', 'Une fois'],
  ['daily', 'Chaque jour'],
  ['weekly', 'Chaque semaine'],
  ['monthly', 'Chaque mois'],
  ['weekdays', 'Jours précis'],
];

export type EditTarget = { mode: 'voice' } | { mode: 'text' } | { mode: 'edit'; reminder: Reminder };

type Props = {
  target: EditTarget | null;
  slots: Slot[];
  onClose: () => void;
  onSave: (draft: Draft, id?: string) => void;
  onDelete: (id: string) => void;
};

function fromReminder(r: Reminder): Draft {
  const rep = r.repeat;
  return {
    title: r.title,
    day: startOfDay(r.due),
    time: r.time === timeOf(r.due) ? r.time : timeOf(r.due),
    repeat: rep.kind,
    days: rep.kind === 'weekdays' ? rep.days : [],
  };
}

export function EditSheet(props: Props) {
  const [key, setKey] = useState(0);
  const [last, setLast] = useState<EditTarget | null>(null);
  if (props.target !== last) {
    setLast(props.target);
    if (props.target) setKey((k) => k + 1);
  }
  return (
    <Sheet visible={!!props.target} onClose={props.onClose}>
      {props.target ? <EditBody key={key} {...props} target={props.target} /> : null}
    </Sheet>
  );
}

function EditBody({ target, slots, onSave, onDelete }: Props & { target: EditTarget }) {
  const [now] = useState(() => Date.now());
  const [draft, setDraft] = useState<Draft>(() => (target.mode === 'edit' ? fromReminder(target.reminder) : defaultDraft(slots, now)));
  const [text, setText] = useState(target.mode === 'edit' ? target.reminder.title : '');
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const input = useRef<TextInputInstance>(null);
  const heard = useRef('');

  async function startListening() {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setMicError("Micro refusé. Autorise-le dans les réglages d'Android.");
      return;
    }
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'fr-FR', interimResults: true, continuous: false });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the mic once when the sheet opens
    if (target.mode === 'voice') startListening();
    const t = target.mode === 'text' ? setTimeout(() => input.current?.focus(), 300) : undefined;
    return () => {
      clearTimeout(t);
      ExpoSpeechRecognitionModule.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyText = (t: string) => {
    setText(t);
    if (target.mode !== 'edit') setDraft(parse(t, slots, Date.now()));
  };

  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results[0]?.transcript ?? '';
    heard.current = t;
    applyText(t);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    // Dictation adds the reminder straight away; the sheet stays open only if nothing usable was heard.
    if (target.mode !== 'voice' || !heard.current.trim()) return;
    const d = parse(heard.current, slots, Date.now());
    heard.current = '';
    if (d.title) onSave(d);
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error !== 'no-speech' && e.error !== 'aborted') setMicError("Je n'ai pas compris. Réessaie ou écris.");
  });

  const pickDate = () =>
    DateTimePickerAndroid.open({
      value: draft.day,
      mode: 'date',
      minimumDate: startOfDay(Date.now()),
      onChange: (e, d) => e.type === 'set' && d && setDraft({ ...draft, day: startOfDay(d) }),
    });
  const pickTime = () =>
    DateTimePickerAndroid.open({
      value: new Date(at(Date.now(), draft.time)),
      mode: 'time',
      is24Hour: true,
      onChange: (e, d) => e.type === 'set' && d && setDraft({ ...draft, time: timeOf(d.getTime()) }),
    });

  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const isToday = draft.day.getTime() === today.getTime();
  const isTomorrow = draft.day.getTime() === tomorrow.getTime();
  const otherDay = !isToday && !isTomorrow;
  const slotHit = slots.some((s) => s.time === draft.time);
  const title = (target.mode === 'edit' ? text : draft.title || text).trim();
  const editing = target.mode === 'edit';

  return (
    <>
      {listening ? (
        <Pressable onPress={() => ExpoSpeechRecognitionModule.stop()} style={st.listening} accessibilityLabel="Arrêter l'écoute">
          <View style={st.dot} />
          <Text style={st.listeningText}>{"Je t'écoute…"}</Text>
        </Pressable>
      ) : null}
      {micError ? <Text style={st.error}>{micError}</Text> : null}
      <TextInput
        ref={input}
        value={text}
        onChangeText={applyText}
        placeholder="Ex. : appeler le comptable demain matin"
        placeholderTextColor={c.muted}
        style={st.input}
        returnKeyType="done"
        multiline={false}
      />
      {!editing && draft.title && draft.title !== text.trim() ? <Text style={st.preview}>{draft.title}</Text> : null}

      <Label>Quand</Label>
      <View style={st.row}>
        <Chip label="Aujourd'hui" on={isToday} onPress={() => setDraft({ ...draft, day: today })} />
        <Chip label="Demain" on={isTomorrow} onPress={() => setDraft({ ...draft, day: tomorrow })} />
        <Chip
          label={otherDay ? draft.day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Autre date'}
          on={otherDay}
          onPress={pickDate}
        />
      </View>

      <Label>Heure</Label>
      <View style={st.row}>
        {slots.map((s) => (
          <Chip key={s.id} label={s.name} sub={s.time.replace(':', 'h')} on={draft.time === s.time} onPress={() => setDraft({ ...draft, time: s.time })} />
        ))}
        <Chip label={slotHit ? 'Autre heure' : draft.time.replace(':', 'h')} on={!slotHit} onPress={pickTime} />
      </View>

      <Label>Répéter</Label>
      <View style={st.row}>
        {REPEATS.map(([k, l]) => (
          <Chip
            key={k}
            label={l}
            on={draft.repeat === k}
            onPress={() => setDraft({ ...draft, repeat: k, days: k === 'weekdays' && !draft.days.length ? [draft.day.getDay()] : draft.days })}
          />
        ))}
      </View>
      {draft.repeat === 'weekdays' ? (
        <View style={[st.row, { marginTop: 12, gap: 6 }]}>
          {WEEK.map((d) => {
            const on = draft.days.includes(d);
            return (
              <Pressable
                key={d}
                accessibilityLabel={DAY_FULL[d]}
                accessibilityState={{ selected: on }}
                onPress={() => setDraft({ ...draft, days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d] })}
                style={[st.wd, on && st.wdOn]}
              >
                <Text style={[st.wdText, on && { color: c.onAccent }]}>{DAY_LETTER[d]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <PrimaryButton
        title={editing ? 'Enregistrer' : 'Ajouter'}
        disabled={!title || (draft.repeat === 'weekdays' && !draft.days.length)}
        onPress={() => onSave({ ...draft, title }, target.mode === 'edit' ? target.reminder.id : undefined)}
      />
      {editing ? (
        <Pressable onPress={() => target.mode === 'edit' && onDelete(target.reminder.id)} style={st.delete} accessibilityRole="button">
          <Text style={st.deleteText}>Supprimer</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { fontFamily: f.body, fontSize: 18, color: c.fg, borderBottomWidth: 2, borderBottomColor: c.line, paddingVertical: 8 },
  preview: { fontFamily: f.body, fontSize: 13, color: c.muted, marginTop: 6 },
  listening: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.late },
  listeningText: { fontFamily: f.semi, fontSize: 14, color: c.accent },
  error: { fontFamily: f.medium, fontSize: 13, color: c.late, marginBottom: 6 },
  wd: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  wdOn: { backgroundColor: c.accent, borderColor: c.accent },
  wdText: { fontFamily: f.semi, fontSize: 13, color: c.fg },
  delete: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  deleteText: { fontFamily: f.semi, fontSize: 15, color: c.late },
});
