// Binary relevance, macro-averaged by vacancy. No score threshold is fitted.
export function rankingMetrics(labels, k = 5) {
 if (!Number.isInteger(k) || k < 1) throw new Error('k must be a positive integer');
 if (!labels.length || labels.some(label => label !== 0 && label !== 1)) throw new Error('Expected a nonempty list of binary labels');
 const positives = labels.reduce((sum, label) => sum + label, 0), size = Math.min(k, labels.length);
 const hits = labels.slice(0, size).reduce((sum, label) => sum + label, 0);
 const discount = index => 1 / Math.log2(index + 2);
 const discounts = Array.from({length: size}, (_, index) => discount(index));
 const dcg = labels.slice(0, size).reduce((sum, label, index) => sum + label * discounts[index], 0);
 const ideal = discounts.slice(0, Math.min(positives, size)).reduce((sum, value) => sum + value, 0);
 const first = labels.indexOf(1);
 return {
  precisionAtK: hits / size, recallAtK: positives ? hits / positives : null,
  ndcgAtK: ideal ? dcg / ideal : null, reciprocalRank: first < 0 ? 0 : 1 / (first + 1),
  randomPrecisionAtK: positives / labels.length,
  randomNdcgAtK: ideal ? (positives / labels.length) * discounts.reduce((sum, value) => sum + value, 0) / ideal : null,
 };
}

export function meanMetrics(rows) {
 if (!rows.length) return null;
 return Object.fromEntries(Object.keys(rows[0]).map(key => {
  const values = rows.map(row => row[key]).filter(value => value !== null);
  return [key, values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null];
 }));
}

// Expected precision for uniform random order within each tied score group.
// This distinguishes actual score separation from an arbitrary ID tie-break.
export function tiedPrecisionAtK(rows, k = 5) {
 const size = Math.min(k, rows.length);
 if (!size) return null;
 let seen = 0, hits = 0;
 for (let index = 0; index < rows.length && seen < size;) {
  let end = index + 1;
  while (end < rows.length && rows[end].tieKey === rows[index].tieKey) end++;
  const group = rows.slice(index, end), take = Math.min(group.length, size - seen);
  hits += take * group.reduce((sum, row) => sum + row.label, 0) / group.length;
  seen += take; index = end;
 }
 return hits / size;
}
