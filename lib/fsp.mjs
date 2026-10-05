// Synthetic fixtures, not a contract with the FSP registry. No network requests.
// Each test profile lists achievements as [discipline, event, result, format, year].
const FIXTURES = [
  [['Спортивное программирование', 'Чемпионат России по спортивному программированию', 'Финалист', 'Командный', 2025]],
  [['Продуктовое программирование', 'Кубок ФСП по продуктовому программированию', '8 место', 'Командный', 2025]],
  [['Алгоритмическое программирование', 'Кубок России по алгоритмическому программированию', '3 место', 'Индивидуальный', 2025]],
  [],
  [['Продуктовое программирование', 'Хакатон ФСП: инфраструктура продуктов', 'Участник финала', 'Командный', 2025]],
  [['Программирование ИИ', 'Чемпионат ФСП по программированию ИИ', '1 место', 'Командный', 2025]],
  [],
  [],
  [['Алгоритмическое программирование', 'Кубок России по алгоритмическому программированию', '2 место', 'Индивидуальный', 2024]],
  [['Продуктовое программирование', 'Хакатон ФСП: сервисы для бизнеса', 'Участник', 'Командный', 2025]],
  [
    ['Спортивное программирование', 'Чемпионат России по спортивному программированию', 'Финалист', 'Командный', 2023],
    ['Продуктовое программирование', 'Кубок ФСП по продуктовому программированию', '2 место', 'Командный', 2022],
  ],
  [['Продуктовое программирование', 'Кубок ФСП по продуктовому программированию', '1 место', 'Командный', 2024]],
  [['Программирование ИИ', 'Чемпионат ФСП по программированию ИИ', 'Участник', 'Командный', 2025]],
  [['Продуктовое программирование', 'Хакатон ФСП: инфраструктура продуктов', 'Участник финала', 'Командный', 2025]],
];
export const FSP_DEMO_IDS = FIXTURES.map((_, i) => `DEMO-FSP-${String(i + 1).padStart(3, '0')}`);

// A registry adapter would receive places and statuses in different shapes;
// one normalised level lets ranking compare results of different events.
export function achievementLevel(result) {
  const value = String(result).toLowerCase();
  const place = Number(value.match(/(\d+)\s*место/)?.[1]) || null;
  if (place === 1 || /победител|чемпион/.test(value)) return 'winner';
  if (place === 2 || place === 3 || /призер|призёр/.test(value)) return 'prize';
  if ((place && place <= 10) || /финал|топ-?\s?10/.test(value)) return 'final';
  return 'participant';
}

export function mockFspProfile(id) {
  const index = FSP_DEMO_IDS.indexOf(id);
  if (index < 0) return null;
  return {
    id,
    source: 'demo',
    status: 'demo',
    achievements: FIXTURES[index].map(([discipline, event, result, format, year], k) => ({
      id: `demo-event-${index + 1}${k ? `-${k + 1}` : ''}`, discipline, event,
      result, level: achievementLevel(result), format, year, source: 'demo',
    })),
  };
}

// Explicit projection keeps adapter metadata and any future credentials private.
export function publicFspProfile(profile) {
  if (!profile || profile.source !== 'demo' || profile.status !== 'demo') return null;
  const fixture = mockFspProfile(profile.id);
  return fixture ? {...fixture, linkedAt: profile.linkedAt} : null;
}
