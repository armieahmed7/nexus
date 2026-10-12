// F37 / FS76: role detection shared by Dalil career mode (engine.ts) and the future-skills intents (future.ts). Pure.
import { tokenize } from '../dalil/text';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const ROLE_TOKENS: Record<string, string> = { qsro: 'senior-reactor-operator', qro: 'reactor-operator', qlo: 'local-operator', qshiftsup: 'shift-supervisor' };
/** A role named in the question: domain tokens (SRO, RO, LO, shift supervisor) or most of a role title in either language. */
export function findRole(q: string, roles: Row[]): string | null {
  const toks = tokenize(q);
  const byTok = toks.map((t) => ROLE_TOKENS[t]).find((id) => id && roles.some((r) => r.id === id));
  if (byTok) return byTok;
  const qt = new Set(toks);
  let best: string | null = null;
  let bestScore = 0;
  for (const r of roles) for (const title of [r.title_en, r.title_ar]) {
    const tt = new Set(tokenize(String(title ?? '')));
    if (!tt.size) continue;
    const overlap = [...tt].filter((x) => qt.has(x)).length;
    const score = overlap / tt.size;
    if ((overlap >= 2 || score >= 0.6) && overlap > 0 && score > bestScore) { best = r.id; bestScore = score; }
  }
  return best;
}
