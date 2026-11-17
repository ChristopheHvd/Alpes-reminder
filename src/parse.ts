import { DAY_FULL, RepeatKind, Slot, addDays, at, startOfDay } from './model';

export type Draft = {
  title: string;
  day: Date;
  time: string;
  repeat: RepeatKind;
  days: number[];
};

type Found = Partial<Omit<Draft, 'title'>> & { dayGiven?: boolean; timeGiven?: boolean };

const DAY_RE = DAY_FULL.join('|');
const pad = (n: number) => String(n).padStart(2, '0');

/** Default draft: the next slot still ahead today, else tomorrow's first slot. */
export function defaultDraft(slots: Slot[], now: number): Draft {
  const sorted = [...slots].sort((a, b) => a.time.localeCompare(b.time));
  const next = sorted.find((s) => at(now, s.time) > now);
  return {
    title: '',
    day: next ? startOfDay(now) : addDays(startOfDay(now), 1),
    time: (next ?? sorted[0])?.time ?? '09:00',
    repeat: 'once',
    days: [],
  };
}

/**
 * Reads a French sentence such as "appeler le comptable demain matin" or
 * "sport chaque lundi et jeudi à 18h30" and extracts the title, day, time and repeat rule.
 */
export function parse(text: string, slots: Slot[], now: number): Draft {
  const draft = defaultDraft(slots, now);
  const lower = text.toLowerCase().replace(/’/g, "'");
  const cut: [number, number][] = [];
  const found: Found = {};

  const take = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    const g = new RegExp(re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = g.exec(lower))) {
      const span: [number, number] = [m.index, m.index + m[0].length];
      if (cut.some(([a, b]) => span[0] < b && span[1] > a)) continue;
      fn(m);
      cut.push(span);
    }
  };

  take(/^(rappelle[- ]moi|n'oublie pas|il faut)\s+(de |d'|que )?/, () => {});

  // Repeat rules
  take(new RegExp(`\\b(?:chaque|tous les|le)\\s+((?:${DAY_RE})s?(?:\\s*(?:,|et)\\s*(?:le\\s+)?(?:${DAY_RE})s?)*)\\b`), (m) => {
    const names = m[1].match(new RegExp(DAY_RE, 'g')) ?? [];
    const days = [...new Set(names.map((n) => DAY_FULL.indexOf(n)))];
    if (/^le\s/.test(m[0]) && days.length === 1) {
      found.day = nextWeekday(now, days[0]);
      found.dayGiven = true;
    } else {
      found.repeat = 'weekdays';
      found.days = days;
    }
  });
  take(/\ben semaine\b/, () => {
    found.repeat = 'weekdays';
    found.days = [1, 2, 3, 4, 5];
  });
  take(/\b(?:chaque|tous les)\s+(?:jours?|matins?|midis?|soirs?)\b/, (m) => {
    found.repeat = 'daily';
    const slot = slots.find((s) => m[0].includes(s.name.toLowerCase()));
    if (slot) {
      found.time = slot.time;
      found.timeGiven = true;
    }
  });
  take(/\b(?:chaque|toutes les)\s+semaines?\b/, () => (found.repeat = 'weekly'));
  take(/\b(?:chaque|tous les)\s+mois\b/, () => (found.repeat = 'monthly'));

  // Relative delay: "dans 10 minutes", "dans 2 heures"
  take(/\bdans\s+(\d+)\s*(minutes?|min|heures?|h)\b/, (m) => {
    const n = Number(m[1]);
    const t = now + n * (m[2].startsWith('h') ? 3600000 : 60000);
    found.day = startOfDay(t);
    found.time = `${pad(new Date(t).getHours())}:${pad(new Date(t).getMinutes())}`;
    found.dayGiven = found.timeGiven = true;
  });

  // Day
  take(/\bapr[eè]s[- ]demain\b/, () => {
    found.day = addDays(startOfDay(now), 2);
    found.dayGiven = true;
  });
  take(/\bdemain\b/, () => {
    if (!found.dayGiven) found.day = addDays(startOfDay(now), 1);
    found.dayGiven = true;
  });
  take(/\baujourd'hui\b/, () => {
    found.day = startOfDay(now);
    found.dayGiven = true;
  });
  take(new RegExp(`\\b(${DAY_RE})(?:\\s+prochain)?\\b`), (m) => {
    found.day = nextWeekday(now, DAY_FULL.indexOf(m[1]));
    found.dayGiven = true;
  });

  // Time: "à 18h30", "18 h", "9 heures", "14:15"
  take(/(?:à\s+)?\b(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?\b/, (m) => {
    const h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    if (h < 24 && min < 60) {
      found.time = `${pad(h)}:${pad(min)}`;
      found.timeGiven = true;
    }
  });

  // Slot names: "ce soir", "le matin", "demain midi"
  for (const s of slots) {
    const name = s.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    take(new RegExp(`\\b(?:ce |cet |cette |le |au |en )?${name}\\b`), (m) => {
      if (!found.timeGiven) found.time = s.time;
      found.timeGiven = true;
      if (/^ce/.test(m[0]) && !found.dayGiven) {
        found.day = startOfDay(now);
        found.dayGiven = true;
      }
    });
  }

  const title = strip(text, cut);
  const result: Draft = {
    title,
    day: found.day ?? draft.day,
    time: found.time ?? draft.time,
    repeat: found.repeat ?? 'once',
    days: found.days ?? [],
  };
  // A time given without a day that is already past today means tomorrow.
  if (!found.dayGiven && found.timeGiven && result.repeat === 'once' && at(startOfDay(now), result.time) <= now) {
    result.day = addDays(startOfDay(now), 1);
  } else if (!found.dayGiven && found.timeGiven) {
    result.day = startOfDay(now);
  }
  return result;
}

function nextWeekday(now: number, wd: number): Date {
  const today = startOfDay(now);
  const diff = (wd - today.getDay() + 7) % 7 || 7;
  return addDays(today, diff);
}

function strip(text: string, cut: [number, number][]): string {
  const keep = [...text].map((c, i) => (cut.some(([a, b]) => i >= a && i < b) ? ' ' : c)).join('');
  const t = keep
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(de|d'|à|et|,)\s+/i, '')
    .replace(/\s+(de|à|et|le|la|les|,)$/i, '')
    .replace(/[\s,.;]+$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
