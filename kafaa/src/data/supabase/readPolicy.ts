// Read policy of the SupabaseBackend (readiness fixes 2026-10-13, findings 3 and 4). Import-free so unit tests load it directly.
//
// 1. In-flight sharing: identical reads that are already running share one request. /learn rendered one <Sources> per programme card,
//    each asking for the same `kafaa_sources?select=*` while the first was still on the wire (95-185 requests per visit). Only requests
//    that are running are shared (nothing is cached once a response arrives), and a write or a persona switch starts a new generation,
//    so a read issued after a write never receives a response that was requested before it. Every caller gets its own copy of the rows.
// 2. One retry: a read (an idempotent GET) that fails with an HTTP 5xx (PostgREST statement timeout 57014, 502/503/504 from the
//    gateway) is sent once more after a short pause. 4xx answers (permission, bad request) are returned as they are.

export interface ReadResponse {
  error: { message: string; code?: string } | null;
  status?: number;
}

/** True for a response worth one more attempt: a server-side (5xx) failure. */
export const retryable = (r: ReadResponse) => !!r.error && (r.status ?? 0) >= 500;

/** Run a read; if it fails with a 5xx, wait `pauseMs` and run it once more (a fresh request: `send` builds it again). */
export async function readWithRetry<R extends ReadResponse>(send: () => PromiseLike<R>, pauseMs = 250 + Math.floor(Math.random() * 250)): Promise<R> {
  const first = await send();
  if (!retryable(first)) return first;
  await new Promise((res) => setTimeout(res, pauseMs));
  return send();
}

/** Shares running promises by key within a generation; `bump()` starts a new generation (after a write or a persona switch). */
export class InFlight {
  private running = new Map<string, Promise<unknown>>();
  private gen = 0;
  bump() {
    this.gen++;
    this.running.clear();
  }
  /** Number of requests running now (tests). */
  get size() {
    return this.running.size;
  }
  share<T>(key: string, start: () => Promise<T>, copy: (v: T) => T = (v) => v): Promise<T> {
    const k = `${this.gen}\u0000${key}`;
    let p = this.running.get(k) as Promise<T> | undefined;
    if (!p) {
      const started: Promise<T> = start().finally(() => {
        if (this.running.get(k) === started) this.running.delete(k);
      });
      this.running.set(k, started);
      p = started;
    }
    return p.then(copy);
  }
}

/** A stable key for a read: table, query (keys sorted) and kind. */
export function readKey(kind: string, table: string, q?: unknown): string {
  const canon = (v: unknown): string =>
    Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v as object).sort().map((k) => `${k}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v ?? null);
  return `${kind}|${table}|${canon(q)}`;
}

/** Each caller gets its own array and row objects (pages sort or decorate what they receive). */
export const copyRows = <T,>(rows: T[]): T[] => rows.map((r) => (r && typeof r === 'object' ? ({ ...(r as object) } as T) : r));
export const copyRow = <T,>(row: T | null): T | null => (row && typeof row === 'object' ? ({ ...(row as object) } as T) : row);
