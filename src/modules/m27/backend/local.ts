// M27 LocalBackend RPC implementations and emitters (owner: W4 · E4, F30 Learning record store). Installed on every LocalRpc
// instance by src/data/ext/local.ts. 1:1 mirror of supabase/migrations/20261009144001_kafaa_w4e4_lrs.sql: the four RPCs (same
// checks, refusal codes and audit rows) and the emitter triggers (installLrsEmitters wraps rawInsert/rawUpdate exactly where the
// SQL AFTER triggers fire, so any RPC of any module that records learning appends one statement). Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result, Table } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { draftFor, lrsAggregateOf, OBJECT_TYPES, schemaErrorMessage, SOURCES, validateStatement, VERBS, type EmitLookups, type Source, type StatementRow } from '../xapi';
import type { M27Rpc, PersonLabel, StatementPage, StatementQuery } from './rpc';

type Row = Record<string, unknown>;
const T_STMT = 'xapi_statements' as Table;
const installed = new WeakSet<object>();

export function localLookups(b: LocalBackend): EmitLookups {
  const get = (t: string, id: string) => (id ? (b.rawGet(t as Table, id) as unknown as Row | undefined) : undefined);
  return {
    course: (id) => get('courses', id) as never, competency: (id) => get('competencies', id) as never, opportunity: (id) => get('opportunities', id) as never,
    template: (id) => get('rotation_templates', id) as never, role: (id) => get('job_roles', id) as never, jpm: (id) => get('jpms', id) as never,
    standard: (id) => get('qual_standards', id) as never, asset: (id) => get('knowledge_assets', id) as never, agreement: (id) => get('mentoring_agreements', id) as never,
    scenario: (id) => get('sim_scenarios', id) as never, debrief: (id) => get('crew_debriefs', id) as never,
    task: (id) => get('task_items', id) as never, // W5E1 (F38)
  };
}

/**
 * The LocalBackend mirror of the SQL emitter triggers (kafaa_xapi_on_source): after a learning record is written, append its
 * statement (idempotent by the deterministic id). An emitter problem never blocks the learning action.
 */
export function installLrsEmitters(b: LocalBackend) {
  if (installed.has(b)) return;
  installed.add(b);
  const ins = b.rawInsert.bind(b);
  const upd = b.rawUpdate.bind(b);
  const L = localLookups(b);
  const emit = (src: Source, row: Row) => {
    try {
      const d = draftFor(src, row, L, nowTs());
      if (!d || b.rawGet(T_STMT, d.id)) return;
      ins(T_STMT, d as never);
      b.changed([T_STMT]);
    } catch {
      /* mirrors the SQL warning: the learning action still succeeds */
    }
  };
  const onInsert: Record<string, (r: Row) => void> = {
    training_records: (r) => emit('m04_course', r),
    refresh_state: (r) => { if (Number(r.attempts) > 0) emit('f14_refresher', r); },
    jpm_results: (r) => emit('m05_jpm', r),
    mentoring_sessions: (r) => emit('f13_mentoring', r),
    asset_uses: (r) => emit('f21_knowledge', r),
    // F28 (W4 integration): the debrief row is written after its member rows; one statement per member marked present.
    ojt_logs: (r) => emit('f38_ojt', r), // W5E1 (F38): one statement per practice entry
    crew_debriefs: (r) => {
      for (const m of b.raw('crew_debrief_members' as Table) as unknown as Row[]) if (m.debrief_id === r.id && m.present === true) emit('f28_simulator', m);
    },
  };
  const onUpdate: Record<string, (n: Row, o: Row) => void> = {
    refresh_state: (n, o) => { if (Number(n.attempts) > Number(o.attempts)) emit('f14_refresher', n); },
    opportunity_applications: (n, o) => { if (n.status === 'completed' && o.status !== 'completed') emit('f08_opportunity', n); },
    rotation_placements: (n, o) => { if (n.status === 'signed_off' && o.status !== 'signed_off') emit('f15_rotation', n); },
    shadow_requests: (n, o) => { if (n.status === 'completed' && o.status !== 'completed') emit('f15_shadowing', n); },
  };
  (b as unknown as { rawInsert: unknown }).rawInsert = (table: Table, row: Row) => {
    const full = ins(table, row as never) as unknown as Row;
    onInsert[table]?.(full);
    return full;
  };
  (b as unknown as { rawUpdate: unknown }).rawUpdate = (table: Table, id: string, patch: Row) => {
    const cur = b.rawGet(table, id) as unknown as Row | undefined;
    const before = cur && onUpdate[table] ? { ...cur } : null;
    upd(table, id, patch as never);
    if (before) onUpdate[table](b.rawGet(table, id) as unknown as Row, before);
  };
}

const cmp = (a: string, c: string) => (a < c ? -1 : a > c ? 1 : 0);
const ms = (t: string) => Date.parse(t);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function makeLocalM27(b: LocalBackend, h: LocalRpcHelpers): M27Rpc {
  installLrsEmitters(b);
  const stmts = () => b.raw(T_STMT) as unknown as StatementRow[];
  return {
    async storeStatement(statement) {
      await b.whenReady();
      type R = { id: string };
      const me = b.identity().personId;
      if (!me) return h.refuse<R>('lrs.store', 'xapi_statements', null, 'not_signed_in', 'Sign in first');
      const role = b.access().actingRole('integrations', ['A']);
      if (!role) return h.refuse<R>('lrs.store', 'xapi_statements', null, 'forbidden', "Statements are written by the Kafa'a emitters; the test console is for platform admins");
      const secure = (b.raw('items') as unknown as Row[]).filter((i) => i.bank === 'secure').map((i) => String(i.id));
      const { errors, mapped } = validateStatement(statement, { isPerson: (id) => !!b.rawGet('people', id), secureItemIds: secure, now: new Date() });
      if (errors.length || !mapped) return h.refuse<R>('lrs.store', 'xapi_statements', null, 'schema_error', schemaErrorMessage(errors), role);
      if (mapped.actor_person_id !== me) return h.refuse<R>('lrs.store', 'xapi_statements', null, 'not_self', 'The test console stores statements about yourself only', role);
      const id = mapped.id ?? crypto.randomUUID();
      if (b.rawGet(T_STMT, id)) return h.refuse<R>('lrs.store', 'xapi_statements', id, 'conflict', 'A statement with this id already exists; statements are immutable', role);
      const ts = nowTs();
      const row: StatementRow = {
        id, actor_person_id: me, verb: mapped.verb, object_type: mapped.object_type, object_id: mapped.object_id, object_name: mapped.object_name, result: mapped.result,
        context: mapped.context, occurred_at: mapped.occurred_at ?? ts, stored_at: ts, source: 'console', source_ref: id, stored_by: me, version: '2.0.0',
      };
      b.rawInsert(T_STMT, row as never);
      return h.done<R>('lrs.store', 'xapi_statements', id, `console ${mapped.verb} ${mapped.object_type}/${mapped.object_id}`, role, null, '', 'Statement stored', { id }, [T_STMT]);
    },

    async queryStatements(q: StatementQuery = {}) {
      await b.whenReady();
      type R = StatementPage;
      const me = b.identity().personId;
      if (!me) return h.refuse<R>('lrs.query', 'xapi_statements', null, 'not_signed_in', 'Sign in first');
      const c = b.access();
      const all = c.has('lrs', ['R']);
      const scope = c.has('lrs', ['Scope']);
      const own = c.has('lrs', ['Own', 'Scope']);
      const role = c.actingRole('lrs', ['R', 'Scope', 'Own']);
      if (!(all || own)) {
        if (c.has('lrs', ['Agg'])) return h.refuse<R>('lrs.query', 'xapi_statements', null, 'aggregate_only', 'Your role sees learning records as aggregates only', c.actingRole('lrs', ['Agg']));
        return h.refuse<R>('lrs.query', 'xapi_statements', null, 'forbidden', 'Learning records are not available to your role');
      }
      const bad =
        (q.verb !== undefined && !(VERBS as readonly string[]).includes(q.verb)) || (q.object_type !== undefined && !(OBJECT_TYPES as readonly string[]).includes(q.object_type)) ||
        (q.source !== undefined && !(SOURCES as readonly string[]).includes(q.source)) || (q.since !== undefined && !DATE.test(String(q.since))) || (q.until !== undefined && !DATE.test(String(q.until))) ||
        (q.limit !== undefined && typeof q.limit !== 'number') || (q.offset !== undefined && typeof q.offset !== 'number');
      if (bad) return h.refuse<R>('lrs.query', 'xapi_statements', null, 'invalid', 'Unknown filter value', role);
      const actor = q.actor ? q.actor : null;
      if (actor && actor !== me && !all && !(scope && c.inScope('lrs', actor))) return h.refuse<R>('lrs.query', 'xapi_statements', actor, 'not_in_scope', 'This person is outside your scope', role);
      const lim = Math.min(Math.max(Math.trunc(q.limit ?? 200), 1), 1000);
      const off = Math.max(Math.trunc(q.offset ?? 0), 0);
      const since = q.since ? ms(`${q.since}T00:00:00Z`) : null;
      const until = q.until ? ms(`${q.until}T00:00:00Z`) + 86400000 : null;
      const vis = stmts().filter((s) =>
        (all || (s.actor_person_id === me && own) || (scope && c.inScope('lrs', s.actor_person_id))) && (!actor || s.actor_person_id === actor) &&
        (q.id === undefined || s.id === q.id) && (q.verb === undefined || s.verb === q.verb) && (q.object_type === undefined || s.object_type === q.object_type) &&
        (q.object_id === undefined || s.object_id === q.object_id) && (q.source === undefined || s.source === q.source) &&
        (since == null || ms(s.occurred_at) >= since) && (until == null || ms(s.occurred_at) < until));
      vis.sort((x, y) => ms(y.occurred_at) - ms(x.occurred_at) || cmp(x.id, y.id));
      const rows = vis.slice(off, off + lim).map((s) => structuredClone(s));
      const ids = [...new Set(rows.map((r) => r.actor_person_id))].sort(cmp);
      const people: PersonLabel[] = ids.map((id) => b.rawGet('people', id)).filter(Boolean).map((p) => ({ id: p!.id, name: p!.display_name, name_ar: p!.display_name_ar, role_id: p!.job_role_id ?? null }));
      const data: R = { rows, total: vis.length, people, scope: all ? 'all' : scope ? 'scope' : 'own' };
      if ((all || scope) && actor !== me) {
        return h.done<R>('lrs.query', 'xapi_statements', actor, `${rows.length} of ${vis.length} statements${actor == null ? ' in scope' : ''}`, role, null, '', 'Statements', data, ['audit_events' as Table]);
      }
      return { ok: true, code: 'ok', message: 'Statements', audit_seq: null, ledger_seq: null, data } as Result<R>;
    },

    async exportStatements() {
      await b.whenReady();
      type R = { rows: StatementRow[]; count: number };
      const me = b.identity().personId;
      if (!me) return h.refuse<R>('lrs.export', 'xapi_statements', null, 'not_signed_in', 'Sign in first');
      const role = b.access().actingRole('lrs', ['Own', 'Scope', 'R']);
      if (!role) return h.refuse<R>('lrs.export', 'xapi_statements', me, 'forbidden', 'Learning records are not available to your role');
      const rows = stmts().filter((s) => s.actor_person_id === me).sort((x, y) => ms(x.occurred_at) - ms(y.occurred_at) || cmp(x.id, y.id)).map((s) => structuredClone(s));
      return h.done<R>('lrs.export', 'xapi_statements', me, `${rows.length} statements exported as JSON lines`, role, null, '', 'Your learning record is ready to download', { rows, count: rows.length }, ['audit_events' as Table]);
    },

    async lrsAggregate() {
      await b.whenReady();
      if (!b.access().has('lrs', ['Agg', 'R'])) throw new Error("Kafa'a · learning record analytics are aggregate-only and restricted");
      return lrsAggregateOf(stmts(), MIN_GROUP_SIZE);
    },
  };
}

