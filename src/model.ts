export type Repeat =
  | { kind: 'once' }
  | { kind: 'daily' }
  | { kind: 'weekly'; day: number }
  | { kind: 'monthly'; date: number }
  | { kind: 'weekdays'; days: number[] };

export type RepeatKind = Repeat['kind'];

export type Reminder = {
  id: string;
  title: string;
  time: string;
  repeat: Repeat;
  due: number;
  doneAt?: number;
  createdAt: number;
};

export type Slot = { id: string; name: string; time: string };

export type Completion = {
  id: string;
  reminderId: string;
  title: string;
  at: number;
  prevDue: number;
};

export type State = { reminders: Reminder[]; slots: Slot[]; log: Completion[] };

export const DEFAULT_SLOTS: Slot[] = [
  { id: 'matin', name: 'Matin', time: '08:00' },
  { id: 'midi', name: 'Midi', time: '12:30' },
  { id: 'soir', name: 'Soir', time: '19:00' },
];

// Display order Monday first, values are JS getDay() indexes.
export const WEEK = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
export const DAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const DAY_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function parseTime(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number);
  return [h, m];
}

export function at(day: Date | number, time: string): number {
  const d = new Date(day);
  const [h, m] = parseTime(time);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export function startOfDay(t: number | Date): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(t: number | Date, n: number): Date {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d;
}

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** First occurrence of the repeat rule strictly after `after`. Null for one-off reminders. */
export function nextOccurrence(repeat: Repeat, time: string, after: number): number | null {
  switch (repeat.kind) {
    case 'once':
      return null;
    case 'daily':
    case 'weekly':
    case 'weekdays': {
      const days =
        repeat.kind === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : repeat.kind === 'weekly' ? [repeat.day] : repeat.days;
      if (!days.length) return null;
      for (let i = 0; i <= 7; i++) {
        const d = addDays(startOfDay(after), i);
        const t = at(d, time);
        if (t > after && days.includes(d.getDay())) return t;
      }
      return null;
    }
    case 'monthly': {
      const base = new Date(after);
      for (let i = 0; i <= 12; i++) {
        const y = base.getFullYear();
        const m = base.getMonth() + i;
        const first = new Date(y, m, 1);
        const day = Math.min(repeat.date, daysInMonth(first.getFullYear(), first.getMonth()));
        const t = at(new Date(first.getFullYear(), first.getMonth(), day), time);
        if (t > after) return t;
      }
      return null;
    }
  }
}

/** Builds the repeat rule for a draft, anchoring weekly/monthly on the chosen day. */
export function makeRepeat(kind: RepeatKind, day: Date, days: number[]): Repeat {
  switch (kind) {
    case 'weekly':
      return { kind, day: day.getDay() };
    case 'monthly':
      return { kind, date: day.getDate() };
    case 'weekdays':
      return { kind, days: [...days].sort() };
    default:
      return { kind };
  }
}

/** First due time for a new reminder: the chosen day if it fits the rule and is ahead, else the next match. */
export function firstDue(repeat: Repeat, day: Date, time: string, now: number): number {
  const chosen = at(day, time);
  if (repeat.kind === 'once') return chosen;
  const fits = repeat.kind !== 'weekdays' || repeat.days.includes(day.getDay());
  if (fits && chosen > now) return chosen;
  return nextOccurrence(repeat, time, Math.max(now, chosen - 1)) ?? chosen;
}

/** Marks the current occurrence done. Recurring reminders move to their next occurrence. */
export function complete(r: Reminder, now: number): { reminder: Reminder; entry: Completion } {
  const entry: Completion = { id: newId(), reminderId: r.id, title: r.title, at: now, prevDue: r.due };
  if (r.repeat.kind === 'once') return { reminder: { ...r, doneAt: now }, entry };
  const next = nextOccurrence(r.repeat, r.time, Math.max(now, r.due));
  return { reminder: { ...r, due: next ?? r.due }, entry };
}

export function undo(r: Reminder, entry: Completion): Reminder {
  const { doneAt, ...rest } = r;
  return { ...rest, due: entry.prevDue };
}

/** Times to schedule a notification for, from the next pending one onwards. */
export function upcoming(r: Reminder, now: number, count = 10): number[] {
  if (r.doneAt) return [];
  const out: number[] = [];
  if (r.due > now) out.push(r.due);
  if (r.repeat.kind === 'once') return out;
  let t = Math.max(now, r.due);
  while (out.length < count) {
    const n = nextOccurrence(r.repeat, r.time, t);
    if (n === null) break;
    out.push(n);
    t = n;
  }
  return out;
}

export function fmtTime(time: string): string {
  const [h, m] = parseTime(time);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export function timeOf(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function repeatLabel(repeat: Repeat): string {
  switch (repeat.kind) {
    case 'once':
      return '';
    case 'daily':
      return 'Chaque jour';
    case 'weekly':
      return `Chaque ${DAY_FULL[repeat.day]}`;
    case 'monthly':
      return `Le ${repeat.date === 1 ? '1er' : repeat.date} du mois`;
    case 'weekdays': {
      const d = [...repeat.days].sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b));
      if (d.length === 5 && !d.includes(0) && !d.includes(6)) return 'En semaine';
      return d.map((x) => DAY_SHORT[x]).join(', ');
    }
  }
}

export function dayLabel(t: number, now: number): string {
  const diff = Math.round((startOfDay(t).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  const d = new Date(t);
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type SnoozeOption = { label: string; when: number };

/** Choices offered by the Reporter panel. */
export function snoozeOptions(slots: Slot[], now: number): SnoozeOption[] {
  const opts: SnoozeOption[] = [
    { label: 'Dans 15 min', when: now + 15 * 60000 },
    { label: 'Dans 1 h', when: now + 60 * 60000 },
  ];
  const sorted = [...slots].sort((a, b) => a.time.localeCompare(b.time));
  for (const s of sorted) {
    const t = at(now, s.time);
    if (t > now + 60 * 60000) opts.push({ label: s.name, when: t });
  }
  if (sorted[0]) opts.push({ label: `Demain ${sorted[0].name.toLowerCase()}`, when: at(addDays(now, 1), sorted[0].time) });
  return opts;
}
