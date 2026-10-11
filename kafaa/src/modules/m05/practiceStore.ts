/** Per-viewer convenience: best practice score per quiz, kept only in this browser (never sent anywhere). */
const KEY = 'kafaa.practice.best.v1';
function read(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, number>;
  } catch {
    return {};
  }
}
export function readBest(formId: string): number | null {
  const v = read()[formId];
  return typeof v === 'number' ? v : null;
}
export function saveBest(formId: string, score: number) {
  try {
    const all = read();
    if (all[formId] == null || score > all[formId]) localStorage.setItem(KEY, JSON.stringify({ ...all, [formId]: score }));
  } catch {
    /* storage blocked: the quiz still works */
  }
}
