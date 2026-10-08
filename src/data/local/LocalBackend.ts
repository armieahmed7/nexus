/**
 * LocalBackend: the default demo backend. An in-browser copy of the kafaa_* tables, seeded from src/seed/seed.json
 * (the same object that renders supabase/seed.sql), persisted to localStorage under "kafaa.local.v1".
 * It enforces the SAME rules as the database: row reads and direct writes through AccessContext (mirror of the RLS
 * policies), consequential actions through LocalRpc (mirror of the kafaa_* RPCs), and an append-only hash-chained
 * audit log plus a local mirror of NEXUS ledger appends.
 */
import { SCHEMA, columnsOf } from '../schema';
import type { Identity, Query, Repository, Result, RowOf, Table, NexusReads, Assignment } from '../types';
import { AccessContext, type PersonLite } from '../access';
import { applyQuery, newId } from './store';
import { chainHash, GENESIS, nowTs, sha256Hex, ledgerCanonical, type AuditFields } from '../audit';
import { config } from '../../config';
import type { PlatformRole } from '../../auth/policy';
import { LocalRpc } from './rpc';
import { directWriteGuard } from './guards';
import nexusSnapshot from '../../seed/nexus_snapshot.json';

type Rows = Record<string, Record<string, unknown>[]>;
interface Persisted {
  v: 1;
  seedStamp: string;
  tables: Rows;
}
interface SeedFile {
  meta: { generated_at: string; demo_today: string };
  personas: { persona: string; person_id: string; nexus: boolean }[];
  tables: Rows;
}

let seedPromise: Promise<SeedFile> | null = null;
export const loadSeed = () => (seedPromise ??= import('../../seed/seed.json').then((m) => (m.default ?? m) as unknown as SeedFile));

export class LocalBackend implements Repository {
  readonly backend = 'local' as const;
  private tables: Rows = {};
  private byId: Record<string, Map<string, Record<string, unknown>>> = {};
  private listeners = new Set<(t: Table[]) => void>();
  private ready: Promise<void>;
  private personaId: string | null = null;
  private nexusPersonas = new Set<string>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private auditQueue: Promise<unknown> = Promise.resolve();
  readonly rpc: LocalRpc;
  readonly nexus: NexusReads;

  constructor() {
    this.ready = this.init();
    this.rpc = new LocalRpc(this);
    this.nexus = this.makeNexusReads();
  }

  // ───────────── lifecycle
  private async init() {
    const seed = await loadSeed();
    this.nexusPersonas = new Set(seed.personas.filter((p) => p.nexus).map((p) => p.persona));
    const stamp = `${seed.meta.generated_at}:${Object.values(seed.tables).reduce((n, r) => n + r.length, 0)}`;
    let persisted: Persisted | null = null;
    try {
      const raw = localStorage.getItem(config.localStorageKey);
      if (raw) persisted = JSON.parse(raw) as Persisted;
    } catch {
      persisted = null;
    }
    const base = persisted && persisted.v === 1 && persisted.seedStamp === stamp ? persisted.tables : structuredClone(seed.tables);
    this.load(base);
    this.seedStamp = stamp;
  }
  private seedStamp = '';
  private load(tables: Rows) {
    this.tables = {};
    this.byId = {};
    for (const t of Object.keys(SCHEMA)) {
      this.tables[t] = tables[t] ?? [];
      this.byId[t] = new Map(this.tables[t].map((r) => [String(r.id), r]));
    }
  }
  async whenReady() {
    await this.ready;
  }
  private persist() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        const payload: Persisted = { v: 1, seedStamp: this.seedStamp, tables: this.tables };
        localStorage.setItem(config.localStorageKey, JSON.stringify(payload));
      } catch {
        /* storage full or blocked: keep working in memory */
      }
    }, 250);
  }
  async reset() {
    const seed = await loadSeed();
    this.load(structuredClone(seed.tables));
    try {
      localStorage.removeItem(config.localStorageKey);
    } catch {
      /* ignore */
    }
    this.emit(Object.keys(SCHEMA) as Table[]);
  }

  // ───────────── identity
  setPersona(personaId: string | null) {
    this.personaId = personaId;
    this.emit(Object.keys(SCHEMA) as Table[]);
  }
  /** Identity of the current persona, computed exactly like kafaa_me()/kafaa_my_roles(). */
  identity(): Identity {
    if (!this.personaId) return { personId: null, personaId: null, orgId: null, roles: ['public'], assignments: [] };
    const person = this.tables.people?.find((p) => p.persona_id === this.personaId && p.status !== 'leaver');
    if (!person) return { personId: null, personaId: this.personaId, orgId: null, roles: ['public'], assignments: [] };
    const today = new Date().toISOString().slice(0, 10);
    const assignments: Assignment[] = (this.tables.role_assignments ?? [])
      .filter((a) => a.person_id === person.id && a.status === 'active' && (!a.expires_at || String(a.expires_at) >= today))
      .map((a) => ({ role: a.role as PlatformRole, scope_type: String(a.scope_type), scope_value: (a.scope_value as string) ?? null, status: String(a.status) }));
    const roles = Array.from(new Set<PlatformRole>([...assignments.map((a) => a.role), 'public']));
    return { personId: String(person.id), personaId: this.personaId, orgId: (person.org_id as string) ?? null, roles, assignments };
  }
  isNexusPersona(personaId: string | null) {
    return !!personaId && this.nexusPersonas.has(personaId);
  }
  access(): AccessContext {
    const people = new Map<string, PersonLite>((this.tables.people ?? []).map((p) => [String(p.id), p as unknown as PersonLite]));
    return new AccessContext(this.identity(), people);
  }
  async whoami(): Promise<Identity> {
    await this.ready;
    return this.identity();
  }

  // ───────────── reads
  async list<K extends Table>(table: K, q?: Query<RowOf<K>>): Promise<RowOf<K>[]> {
    await this.ready;
    const ctx = this.access();
    const visible = (this.tables[table] ?? []).filter((r) => ctx.canReadRow(table, r));
    return structuredClone(applyQuery(visible, q as Query<Record<string, unknown>>)) as unknown as RowOf<K>[];
  }
  async get<K extends Table>(table: K, id: string): Promise<RowOf<K> | null> {
    await this.ready;
    const r = this.byId[table]?.get(id);
    if (!r || !this.access().canReadRow(table, r)) return null;
    return structuredClone(r) as unknown as RowOf<K>;
  }
  async count<K extends Table>(table: K, q?: Query<RowOf<K>>): Promise<number> {
    return (await this.list(table, { ...q, limit: undefined, offset: undefined })).length;
  }

  // ───────────── direct writes (only where the table's write rule allows; mirrors the RLS insert/update policies)
  private withDefaults(table: string, row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const c of columnsOf(table)) {
      let v = row[c.name];
      if (v === undefined) {
        const d = c.def;
        if (d === undefined) v = null;
        else if (d === 'now') v = nowTs();
        else if (d === '[]') v = [];
        else if (d === '{}') v = {};
        else if (d === 'true' || d === 'false') v = d === 'true';
        else if (/^-?\d+(\.\d+)?$/.test(d)) v = Number(d);
        else if (d.startsWith("'")) v = d.slice(1, -1);
        else if (c.type === 'json') v = JSON.parse(d);
        else v = d;
      }
      out[c.name] = v;
    }
    return out;
  }
  private validate(table: string, row: Record<string, unknown>): string | null {
    for (const c of columnsOf(table)) {
      const v = row[c.name];
      if ((v === null || v === undefined) && !c.nullable && !c.pk) return `${c.name} is required`;
      if (v != null && c.enumValues && !c.enumValues.includes(String(v))) return `${c.name} must be one of ${c.enumValues.join(', ')}`;
      if (v != null && c.ref && !this.byId[c.ref]?.has(String(v))) return `${c.name} refers to a missing ${c.ref}`;
    }
    return null;
  }
  async insert<K extends Table>(table: K, input: Partial<RowOf<K>>): Promise<Result<RowOf<K>>> {
    await this.ready;
    const def = SCHEMA[table];
    const row = this.withDefaults(table, { ...(input as Record<string, unknown>), id: (input as { id?: string }).id ?? newId(table.slice(0, 3)) });
    const ctx = this.access();
    if (!ctx.canWriteRow(table, row, 'insert')) {
      await this.audit(`insert:${table}`, table, String(row.id), 'refused', 'RLS: insert not permitted');
      return { ok: false, code: 'forbidden', message: 'Not permitted' };
    }
    const guard = directWriteGuard(table, null, row, ctx); // G2: column guards (./guards.ts), mirrored by SQL triggers
    if (guard) {
      await this.audit(`insert:${table}`, table, String(row.id), 'refused', `guard: ${guard}`);
      return { ok: false, code: 'forbidden', message: guard };
    }
    if (this.byId[table].has(String(row.id))) return { ok: false, code: 'conflict', message: 'Duplicate id' };
    const err = this.validate(table, row);
    if (err) return { ok: false, code: 'invalid', message: err };
    this.tables[table].push(row);
    this.byId[table].set(String(row.id), row);
    if (def.write.mode === 'direct') await this.audit(`insert:kafaa_${table}`, `kafaa_${table}`, String(row.id), 'ok', null);
    this.changed([table]);
    return { ok: true, code: 'ok', message: 'Saved', data: structuredClone(row) as unknown as RowOf<K> };
  }
  async update<K extends Table>(table: K, id: string, patch: Partial<RowOf<K>>): Promise<Result<RowOf<K>>> {
    await this.ready;
    const def = SCHEMA[table];
    const current = this.byId[table]?.get(id);
    const ctx = this.access();
    if (!current || !ctx.canReadRow(table, current)) return { ok: false, code: 'not_found', message: 'Not found' };
    if (def.write.mode === 'append') return { ok: false, code: 'forbidden', message: `${table} is append-only: corrections create a new entry with a reason` };
    const next = { ...current, ...(patch as Record<string, unknown>), id };
    if (!ctx.canWriteRow(table, current, 'update') || !ctx.canWriteRow(table, next, 'update')) {
      await this.audit(`update:${table}`, table, id, 'refused', 'RLS: update not permitted');
      return { ok: false, code: 'forbidden', message: 'Not permitted' };
    }
    const guard = directWriteGuard(table, current, next, ctx); // G2: column guards (./guards.ts), mirrored by SQL triggers
    if (guard) {
      await this.audit(`update:${table}`, table, id, 'refused', `guard: ${guard}`);
      return { ok: false, code: 'forbidden', message: guard };
    }
    const err = this.validate(table, next);
    if (err) return { ok: false, code: 'invalid', message: err };
    Object.assign(current, next);
    await this.audit(`update:kafaa_${table}`, `kafaa_${table}`, id, 'ok', null);
    this.changed([table]);
    return { ok: true, code: 'ok', message: 'Saved', data: structuredClone(current) as unknown as RowOf<K> };
  }

  // ───────────── internals used by LocalRpc (definer rights: bypass row rules, like SECURITY DEFINER)
  raw<K extends Table>(table: K): RowOf<K>[] {
    return this.tables[table] as unknown as RowOf<K>[];
  }
  rawGet<K extends Table>(table: K, id: string): RowOf<K> | undefined {
    return this.byId[table]?.get(id) as unknown as RowOf<K> | undefined;
  }
  rawInsert<K extends Table>(table: K, row: Partial<RowOf<K>>): RowOf<K> {
    const full = this.withDefaults(table, row as Record<string, unknown>);
    this.tables[table].push(full);
    this.byId[table].set(String(full.id), full);
    return full as unknown as RowOf<K>;
  }
  rawUpdate<K extends Table>(table: K, id: string, patch: Partial<RowOf<K>>) {
    const r = this.byId[table]?.get(id);
    if (r) Object.assign(r, patch);
  }
  changed(tables: Table[]) {
    this.persist();
    this.emit(tables);
  }

  /** kafaa_audit: append-only, hash-chained; serialised so seq and prev_hash never race. */
  audit(action: string, table: string | null, entity: string | null, outcome: 'ok' | 'refused' | 'error', reason: string | null, ledgerStatus: 'written' | 'skipped' | 'not_applicable' = 'not_applicable', ledgerSeq: number | null = null, role: string | null = null) {
    const run = async () => {
      const list = this.tables.audit_events;
      const last = list[list.length - 1];
      const e: AuditFields = { seq: (Number(last?.seq) || 0) + 1, ts: nowTs(), actor_person_id: this.identity().personId, actor_role: role, action, entity_table: table, entity_id: entity, outcome, reason };
      const prev = (last?.hash as string) || GENESIS;
      const hash = await chainHash(prev, e);
      const row = { id: `AE-${String(e.seq).padStart(7, '0')}`, ...e, before_hash: null, after_hash: null, request_id: null, prev_hash: prev, hash, ledger_status: ledgerStatus, ledger_seq: ledgerSeq };
      list.push(row);
      this.byId.audit_events.set(row.id, row);
      this.changed(['audit_events']);
      return row;
    };
    const p = this.auditQueue.then(run, run);
    this.auditQueue = p;
    return p;
  }
  /** Mirror of kafaa_ledger(): NEXUS personas get a local ledger entry (same hash scheme); Kafa'a-only personas are skipped. */
  async ledger(action: string, reason: string, plane = 'PEOPLE', domain = 'KAFAA'): Promise<number | null> {
    const who = this.identity();
    if (!this.isNexusPersona(who.personaId)) return null;
    const list = this.tables.ledger_local;
    const last = list[list.length - 1];
    const seq = (Number(last?.seq) || 0) + 1;
    const ts = nowTs();
    const role = who.personaId!;
    const entry = { seq, ts, actor: role, role, plane, domain, action, evidence_class: 'USER_ACTION', reason, case_id: null, agent_id: null };
    const prev = (last?.hash as string) || GENESIS;
    const hash = await sha256Hex(prev + ledgerCanonical(entry));
    const row = { id: `LG-${seq}`, ...entry, prev_hash: prev, hash, actor_persona_id: who.personaId };
    list.push(row);
    this.byId.ledger_local.set(row.id, row);
    return seq;
  }

  // ───────────── events
  subscribe(fn: (t: Table[]) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit(tables: Table[]) {
    for (const l of this.listeners) l(tables);
  }

  // ───────────── NEXUS reads: bundled read-only snapshot in local mode (same Kafa'a checks as the SQL functions)
  private makeNexusReads(): NexusReads {
    const snap = nexusSnapshot as unknown as Record<string, Record<string, unknown>[]>;
    const ctx = () => this.access();
    return {
      source: 'snapshot',
      personas: async () => snap.personas as never,
      authority: async () => snap.authority as never,
      trainingPrograms: async () => (snap.training_programs.filter((t) => t.basis === 'public' || ctx().has('internal_content', ['R'])) as never),
      peopleQuals: async () => (ctx().has('workforce_analytics', ['Agg', 'R']) || ctx().has('qual_records', ['Scope', 'Agg', 'R']) ? (snap.people_quals.map((q) => ({ ...q, headcount: Number(q.headcount) < 10 ? null : q.headcount, suppressed: Number(q.headcount) < 10 })) as never) : []),
      ecoCourses: async () => snap.eco_courses as never,
      ecoEnrolments: async () => {
        const c = ctx();
        return snap.eco_enrolments.filter((e) => c.has('training', ['R', 'W', 'A']) || (e.org_id === c.who.orgId && c.has('training', ['Own', 'OwnOrg']))) as never;
      },
      ecoScholarships: async () => (ctx().has('cohorts', ['Scope', 'R']) || ctx().has('workforce_analytics', ['Agg', 'R']) ? (snap.eco_scholarships as never) : []),
      ecoPartnerships: async () => snap.eco_partnerships.filter((p) => p.basis === 'public' || ctx().has('research', ['R', 'A'])) as never,
    };
  }
}
