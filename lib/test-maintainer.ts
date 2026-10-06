/** Server-owned permission; browser roles and request bodies never grant it. */
export function isTestMaintainer(userId: string, bindings: unknown): boolean {
  const ids = (bindings as { TEST_MAINTAINER_IDS?: string }).TEST_MAINTAINER_IDS || '';
  return ids.split(',').map(s => s.trim()).filter(Boolean).includes(userId)
    || (import.meta.env.DEV && userId === 'local_seedy');
}
