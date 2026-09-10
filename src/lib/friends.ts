/**
 * Debts you owe are yours to act on; credits owed to you are the other
 * person's. Sorting owed-by-you first, biggest first, points the ring at
 * what actually needs settling instead of just the biggest number.
 */
export function sortFriendsByBalance<T extends { netCentavos: number }>(friends: T[]): T[] {
  return [...friends].sort((a, b) => {
    const bucket = (n: number) => (n < 0 ? 0 : n > 0 ? 1 : 2);
    const bucketDiff = bucket(a.netCentavos) - bucket(b.netCentavos);
    if (bucketDiff !== 0) return bucketDiff;
    if (a.netCentavos < 0) return a.netCentavos - b.netCentavos;
    return b.netCentavos - a.netCentavos;
  });
}
