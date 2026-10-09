/**
 * F38 offline queue (W5 · E1). Entries written while the device is offline (or when the call fails on the network) are kept on the
 * device under `kafaa.ojt.queue.v1:<person>` with the client key generated when they were written. Syncing re-sends them through
 * rpc.logPractice, which is idempotent by client key: an entry is recorded exactly once however often it is re-sent, and a business
 * refusal (for example an unqualified preceptor) stays in the queue with its reason until the trainee fixes or discards it.
 * Storage access never throws (private windows, blocked storage). The service worker (public/ojt-sw.js) only caches the logbook
 * page so it opens offline; it never queues, reads or sends entries itself.
 */
import type { LogInput } from './ojt';

export interface Queued { input: LogInput; queued_at: string; attempts: number; code: string | null; message: string | null }
export interface SyncResult { synced: number; duplicates: number; refused: number; kept: number }
type Store = Pick<Storage, 'getItem' | 'setItem'>;
type Send = (input: LogInput) => Promise<{ ok: boolean; code: string; message?: string; data?: { duplicate?: boolean } | null }>;

export const queueKey = (person: string) => `kafaa.ojt.queue.v1:${person}`;
const storage = (): Store | null => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } };

export function readQueue(person: string, s: Store | null = storage()): Queued[] {
  try {
    const raw = s?.getItem(queueKey(person));
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => x && x.input && typeof x.input.client_key === 'string') : [];
  } catch { return []; }
}
export function writeQueue(person: string, q: Queued[], s: Store | null = storage()): void {
  try { s?.setItem(queueKey(person), JSON.stringify(q)); } catch { /* storage unavailable: the entry stays in memory only */ }
}
/** Add an entry (same client key = replaced, never duplicated). */
export function enqueue(person: string, input: LogInput, s: Store | null = storage(), now = new Date().toISOString()): Queued[] {
  const q = readQueue(person, s).filter((x) => x.input.client_key !== input.client_key);
  q.push({ input: { ...input, offline: true }, queued_at: now, attempts: 0, code: null, message: null });
  writeQueue(person, q, s);
  return q;
}
export function discard(person: string, clientKey: string, s: Store | null = storage()): Queued[] {
  const q = readQueue(person, s).filter((x) => x.input.client_key !== clientKey);
  writeQueue(person, q, s);
  return q;
}
/** Send every queued entry once. Network failures keep the entry for the next sync; refusals keep it with the reason. */
export async function flushQueue(person: string, send: Send, s: Store | null = storage()): Promise<SyncResult> {
  const out: SyncResult = { synced: 0, duplicates: 0, refused: 0, kept: 0 };
  const left: Queued[] = [];
  for (const item of readQueue(person, s)) {
    let r: Awaited<ReturnType<Send>> | null = null;
    try { r = await send(item.input); } catch { r = null; }
    if (!r) { left.push({ ...item, attempts: item.attempts + 1 }); out.kept++; continue; }
    if (r.ok) { if (r.data?.duplicate) out.duplicates++; else out.synced++; continue; }
    left.push({ ...item, attempts: item.attempts + 1, code: r.code, message: r.message ?? null });
    out.refused++;
  }
  writeQueue(person, left, s);
  return out;
}

/** Service worker scope for the logbook: only /kafaa/my/ojt (and the Arabic /kafaa/ar/my/ojt). Never wider. */
export function ojtSwScope(base: string, lang: 'en' | 'ar'): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}${lang === 'ar' ? 'ar/' : ''}my/ojt`;
}
export const OJT_SW_FILE = 'ojt-sw.js';
export const OJT_SYNC_TAG = 'kafaa-ojt-sync';
