/**
 * F02 ModelGatewayEngine: the disabled slot. Reads VITE_KAFAA_MODEL_URL (absent in the demo: no LLM key exists).
 * With no URL every surface falls back to its deterministic engine and shows "model unavailable"; nothing throws.
 * When a gateway exists, rank() posts { surface, candidates, context } and expects [{ id, score, reasons }].
 */
import type { Ranked, Surface } from './types';

export const modelGatewayUrl = (): string | null => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const u = env?.VITE_KAFAA_MODEL_URL;
  return u && u.trim() ? u.trim() : null;
};
export class ModelGatewayEngine {
  constructor(readonly url: string | null = modelGatewayUrl()) {}
  get available(): boolean {
    return !!this.url;
  }
  get status(): 'disabled' | 'configured' {
    return this.url ? 'configured' : 'disabled';
  }
  async rank(surface: Surface, candidates: unknown[], context: unknown): Promise<Ranked[]> {
    if (!this.url) throw new Error('model unavailable');
    const res = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ surface, candidates, context }) });
    if (!res.ok) throw new Error(`model gateway ${res.status}`);
    const out = (await res.json()) as Ranked[];
    if (!Array.isArray(out) || out.some((r) => !r.reasons?.length)) throw new Error('model gateway returned results without reasons');
    return out;
  }
}
