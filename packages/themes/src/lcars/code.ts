// LCARS panels are full of reference numbers. Derive a stable one from a node id, so it never
// changes between renders or displays.
export const lcarsCode = (seed: string): string => {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const head = String(hash % 100).padStart(2, "0");
  const tail = String(Math.floor(hash / 100) % 10000).padStart(4, "0");
  return `${head}-${tail}`;
};
