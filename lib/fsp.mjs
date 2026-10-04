// Synthetic fixtures, not a contract with the FSP registry. No network requests.
const FIXTURES = [
  ['Спортивное программирование', 'Чемпионат России по спортивному программированию', 'Финалист', 'Командный'],
  ['Продуктовое программирование', 'Кубок ФСП по продуктовому программированию', '8 место', 'Командный'],
  ['Алгоритмическое программирование', 'Кубок России по алгоритмическому программированию', '3 место', 'Индивидуальный'],
  null,
  ['Продуктовое программирование', 'Хакатон ФСП: инфраструктура продуктов', 'Участник финала', 'Командный'],
  ['Программирование ИИ', 'Чемпионат ФСП по программированию ИИ', '1 место', 'Командный'],
  null,
  null,
];

export function mockFspProfile(id) {
  const index = Array.from({length: FIXTURES.length}, (_, i) => `DEMO-FSP-${String(i + 1).padStart(3, '0')}`).indexOf(id);
  if (index < 0) return null;
  const fixture = FIXTURES[index];
  return {
    id,
    source: 'demo',
    status: 'demo',
    achievements: fixture ? [{
      id: `demo-event-${index + 1}`, discipline: fixture[0], event: fixture[1],
      result: fixture[2], format: fixture[3], year: 2025, source: 'demo',
    }] : [],
  };
}

// Explicit projection keeps adapter metadata and any future credentials private.
export function publicFspProfile(profile) {
  if (!profile || profile.source !== 'demo' || profile.status !== 'demo') return null;
  const fixture = mockFspProfile(profile.id);
  return fixture ? {...fixture, linkedAt: profile.linkedAt} : null;
}
