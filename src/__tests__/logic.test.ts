import { DEFAULT_SLOTS, Reminder, at, complete, firstDue, makeRepeat, nextOccurrence, repeatLabel, snoozeOptions, undo, upcoming } from '../model';
import { parse } from '../parse';

// Tuesday 17 November 2026, 9:41 local time
const NOW = new Date(2026, 10, 17, 9, 41).getTime();
const d = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).getTime();
const slots = DEFAULT_SLOTS;

describe('nextOccurrence', () => {
  it('daily: later today, else tomorrow', () => {
    expect(nextOccurrence({ kind: 'daily' }, '12:30', NOW)).toBe(d(17, 12, 30));
    expect(nextOccurrence({ kind: 'daily' }, '08:00', NOW)).toBe(d(18, 8));
  });
  it('specific weekdays', () => {
    // Monday and Thursday
    expect(nextOccurrence({ kind: 'weekdays', days: [1, 4] }, '08:00', NOW)).toBe(d(19, 8));
    expect(nextOccurrence({ kind: 'weekdays', days: [1, 4] }, '08:00', d(19, 8))).toBe(d(23, 8));
  });
  it('weekly keeps its weekday', () => {
    expect(nextOccurrence({ kind: 'weekly', day: 2 }, '08:00', NOW)).toBe(d(24, 8));
  });
  it('monthly clamps to short months', () => {
    expect(nextOccurrence({ kind: 'monthly', date: 31 }, '08:00', NOW)).toBe(d(30, 8));
    expect(nextOccurrence({ kind: 'monthly', date: 31 }, '08:00', d(30, 8))).toBe(new Date(2026, 11, 31, 8).getTime());
  });
  it('once has no next', () => {
    expect(nextOccurrence({ kind: 'once' }, '08:00', NOW)).toBeNull();
  });
});

const base = (over: Partial<Reminder>): Reminder => ({
  id: 'r',
  title: 'Test',
  time: '08:00',
  repeat: { kind: 'once' },
  due: d(17, 8),
  createdAt: 0,
  ...over,
});

describe('complete / undo', () => {
  it('one-off is marked done and can be restored', () => {
    const r = base({});
    const { reminder, entry } = complete(r, NOW);
    expect(reminder.doneAt).toBe(NOW);
    expect(undo(reminder, entry).doneAt).toBeUndefined();
  });
  it('recurring moves to the next occurrence', () => {
    const r = base({ repeat: { kind: 'daily' } });
    expect(complete(r, NOW).reminder.due).toBe(d(18, 8));
  });
  it('completing early skips today only', () => {
    const r = base({ repeat: { kind: 'daily' }, due: d(17, 12, 30), time: '12:30' });
    expect(complete(r, NOW).reminder.due).toBe(d(18, 12, 30));
  });
  it('a snoozed recurring reminder returns to its rule', () => {
    const r = base({ repeat: { kind: 'daily' }, due: d(17, 19) });
    expect(complete(r, d(17, 19, 5)).reminder.due).toBe(d(18, 8));
  });
});

describe('firstDue', () => {
  it('weekdays start on the first matching day', () => {
    const rep = makeRepeat('weekdays', new Date(NOW), [1, 4]);
    expect(firstDue(rep, new Date(2026, 10, 17), '08:00', NOW)).toBe(d(19, 8));
  });
  it('daily in the past starts tomorrow', () => {
    expect(firstDue({ kind: 'daily' }, new Date(2026, 10, 17), '08:00', NOW)).toBe(d(18, 8));
  });
});

describe('upcoming', () => {
  it('skips past occurrences and lists the next ones', () => {
    const r = base({ repeat: { kind: 'daily' } });
    expect(upcoming(r, NOW, 3)).toEqual([d(18, 8), d(19, 8), d(20, 8)]);
  });
  it('done one-off has nothing', () => {
    expect(upcoming(base({ doneAt: NOW }), NOW)).toEqual([]);
  });
});

describe('snoozeOptions', () => {
  it('offers delays, remaining slots and tomorrow morning', () => {
    const o = snoozeOptions(slots, NOW);
    expect(o.map((x) => x.label)).toEqual(['Dans 15 min', 'Dans 1 h', 'Midi', 'Soir', 'Demain matin']);
    expect(o[4].when).toBe(d(18, 9));
  });
});

describe('parse', () => {
  it('tomorrow morning', () => {
    const p = parse('Appeler le comptable demain matin', slots, NOW);
    expect(p.title).toBe('Appeler le comptable');
    expect(at(p.day, p.time)).toBe(d(18, 9));
    expect(p.repeat).toBe('once');
  });
  it('specific days with an hour', () => {
    const p = parse('Sport chaque lundi et jeudi à 18h30', slots, NOW);
    expect(p.title).toBe('Sport');
    expect(p.repeat).toBe('weekdays');
    expect(p.days.sort()).toEqual([1, 4]);
    expect(p.time).toBe('18:30');
  });
  it('tonight', () => {
    const p = parse('sortir les poubelles ce soir', slots, NOW);
    expect(p.title).toBe('Sortir les poubelles');
    expect(at(p.day, p.time)).toBe(d(17, 19));
  });
  it('every day', () => {
    const p = parse('Prendre les vitamines tous les matins', slots, NOW);
    expect(p.title).toBe('Prendre les vitamines');
    expect(p.repeat).toBe('daily');
    expect(p.time).toBe('09:00');
  });
  it('monthly and relative delay', () => {
    expect(parse('payer le loyer chaque mois', slots, NOW).repeat).toBe('monthly');
    const p = parse('rappelle-moi de rappeler Marc dans 2 heures', slots, NOW);
    expect(p.title).toBe('Rappeler Marc');
    expect(at(p.day, p.time)).toBe(d(17, 11, 41));
  });
  it('a past hour without a day means tomorrow', () => {
    const p = parse('Arroser les plantes à 8h', slots, NOW);
    expect(at(p.day, p.time)).toBe(d(18, 8));
  });
  it('labels', () => {
    expect(repeatLabel({ kind: 'weekdays', days: [4, 1] })).toBe('lun, jeu');
    expect(repeatLabel({ kind: 'weekdays', days: [1, 2, 3, 4, 5] })).toBe('En semaine');
  });
});

describe('voice phrasing', () => {
  it.each(["rappelle moi d'acheter la pièce de lave-vaisselle ce soir", 'Rappelle-moi d’acheter la pièce de lave-vaisselle ce soir'])('%s', (t) => {
    const p = parse(t, DEFAULT_SLOTS, NOW);
    expect(p.title).toBe('Acheter la pièce de lave-vaisselle');
    expect(p.time).toBe('19:00');
    expect(p.day.getTime()).toBe(new Date(2026, 10, 17).getTime());
    expect(p.repeat).toBe('once');
  });
});

describe('morning dictation', () => {
  it.each(["Rappelle-moi d'appeler le coiffeur demain matin", 'rappelle-moi d appeler le coiffeur demain matin'])('%s', (t) => {
    const p = parse(t, DEFAULT_SLOTS, NOW);
    expect(p.title).toBe('Appeler le coiffeur');
    expect(at(p.day, p.time)).toBe(d(18, 9));
  });
});
