/**
 * SupabaseBackend: the same Repository over supabase-js against kafaa_* tables and RPCs in the NEXUS project,
 * authenticated with the NEXUS same-origin role-card session (third-party accessToken mode, exactly like NEXUS).
 * Row access is enforced by RLS (generated from src/data/schema.ts + src/auth/policy.ts); consequential actions
 * go through SECURITY DEFINER kafaa_* RPCs that audit and append to the NEXUS ledger.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config';
import { sqlName } from '../schema';
import type { Identity, Query, Repository, Result, RowOf, Rpc, Table, NexusReads, SignoffInput, AggregateRow, CertificateCheck } from '../types';
import type { PlatformRole } from '../../auth/policy';
import { accessTokenFor } from '../../auth/nexusSession';

type AnyQ = any; // supabase-js builder types are deep; kept local to this file

export class SupabaseBackend implements Repository {
  readonly backend = 'supabase' as const;
  private client: SupabaseClient;
  private listeners = new Set<(t: Table[]) => void>();
  readonly rpc: Rpc;
  readonly nexus: NexusReads;

  constructor(private persona: string | null) {
    this.client = this.makeClient();
    this.rpc = this.makeRpc();
    this.nexus = this.makeNexus();
  }
  private makeClient(): SupabaseClient {
    const persona = this.persona;
    return createClient(config.supabaseUrl, config.supabaseAnonKey, persona
      ? { accessToken: async () => (await accessTokenFor(persona)) ?? config.supabaseAnonKey }
      : { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'kafaa.anon' } });
  }
  setPersona(persona: string | null) {
    if (persona === this.persona) return;
    this.persona = persona;
    this.client = this.makeClient();
    this.emit([]);
  }

  // ───────────── reads
  private applyQuery(b: AnyQ, q?: Query<Record<string, unknown>>): AnyQ {
    if (!q) return b;
    for (const [k, cond] of Object.entries(q.filter ?? {})) {
      if (Array.isArray(cond)) b = b.in(k, cond);
      else if (cond !== null && typeof cond === 'object') {
        const c = cond as Record<string, unknown>;
        if ('neq' in c) b = b.neq(k, c.neq);
        if ('gte' in c) b = b.gte(k, c.gte);
        if ('lte' in c) b = b.lte(k, c.lte);
        if ('gt' in c) b = b.gt(k, c.gt);
        if ('lt' in c) b = b.lt(k, c.lt);
        if ('isNull' in c) b = c.isNull ? b.is(k, null) : b.not(k, 'is', null);
        if ('ilike' in c) b = b.ilike(k, `%${String(c.ilike).replace(/%/g, '')}%`);
        if ('contains' in c) b = b.contains(k, [c.contains]);
      } else if (cond === null) b = b.is(k, null);
      else b = b.eq(k, cond);
    }
    if (q.search?.term.trim()) {
      const t = q.search.term.trim().replace(/[,()]/g, ' ');
      b = b.or(q.search.columns.map((c) => `${String(c)}.ilike.%${t}%`).join(','));
    }
    for (const [col, dir] of q.order ?? []) b = b.order(col, { ascending: dir === 'asc', nullsFirst: false });
    if (q.limit != null) b = b.range(q.offset ?? 0, (q.offset ?? 0) + q.limit - 1);
    return b;
  }
  async list<K extends Table>(table: K, q?: Query<RowOf<K>>): Promise<RowOf<K>[]> {
    // PostgREST caps responses (1000 rows by default): page through when no limit is given.
    if (q?.limit != null) {
      const { data, error } = await this.applyQuery(this.client.from(sqlName(table)).select('*'), q as never);
      if (error) throw new Error(error.message);
      return (data ?? []) as RowOf<K>[];
    }
    const out: RowOf<K>[] = [];
    for (let off = 0; ; off += 1000) {
      const { data, error } = await this.applyQuery(this.client.from(sqlName(table)).select('*'), { ...((q ?? {}) as object), limit: 1000, offset: off } as never);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as RowOf<K>[]));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async get<K extends Table>(table: K, id: string): Promise<RowOf<K> | null> {
    const { data, error } = await this.client.from(sqlName(table)).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as RowOf<K>) ?? null;
  }
  async count<K extends Table>(table: K, q?: Query<RowOf<K>>): Promise<number> {
    const { count, error } = await this.applyQuery(this.client.from(sqlName(table)).select('id', { count: 'exact', head: true }), { ...((q ?? {}) as object), limit: undefined, order: undefined } as never);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
  private toResult<T>(error: { message: string; code?: string } | null, data?: T): Result<T> {
    if (!error) return { ok: true, code: 'ok', message: 'Saved', data };
    const forbidden = error.code === '42501' || /row-level security|permission denied/i.test(error.message);
    return { ok: false, code: forbidden ? 'forbidden' : error.code === '23505' ? 'conflict' : 'invalid', message: forbidden ? 'Not permitted' : error.message };
  }
  async insert<K extends Table>(table: K, row: Partial<RowOf<K>>): Promise<Result<RowOf<K>>> {
    const withId = { id: (row as { id?: string }).id ?? `${table.slice(0, 3)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`, ...row };
    const { data, error } = await this.client.from(sqlName(table)).insert(withId as never).select('*').maybeSingle();
    const r = this.toResult(error, (data as RowOf<K>) ?? (withId as RowOf<K>));
    if (r.ok) this.emit([table]);
    return r;
  }
  async update<K extends Table>(table: K, id: string, patch: Partial<RowOf<K>>): Promise<Result<RowOf<K>>> {
    const { data, error } = await this.client.from(sqlName(table)).update(patch as never).eq('id', id).select('*').maybeSingle();
    if (!error && !data) return { ok: false, code: 'not_found', message: 'Not found or not permitted' };
    const r = this.toResult(error, data as RowOf<K>);
    if (r.ok) this.emit([table]);
    return r;
  }

  async whoami(): Promise<Identity> {
    if (!this.persona) return { personId: null, personaId: null, orgId: null, roles: ['public'], assignments: [] };
    const { data, error } = await this.client.rpc('kafaa_whoami');
    if (error || !data) return { personId: null, personaId: this.persona, orgId: null, roles: ['public'], assignments: [] };
    const d = data as { person_id: string | null; persona_id: string | null; org_id: string | null; roles: PlatformRole[]; assignments: Identity['assignments'] };
    return { personId: d.person_id, personaId: d.persona_id, orgId: d.org_id, roles: d.roles ?? ['public'], assignments: (d.assignments ?? []).filter((a) => a.status === 'active') };
  }

  subscribe(fn: (t: Table[]) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit(t: Table[]) {
    for (const l of this.listeners) l(t);
  }

  // ───────────── RPCs (same names and argument order as supabase/migrations/*_kafaa_rpcs.sql)
  private async call<T>(fn: string, args: Record<string, unknown>, touched: Table[] = []): Promise<Result<T>> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) return { ok: false, code: error.code === '42501' ? 'forbidden' : 'error', message: error.message };
    const r = data as Result<T>;
    if (r?.ok && touched.length) this.emit(touched);
    return r;
  }
  private makeRpc(): Rpc {
    return {
      signoffEvaluation: (p: SignoffInput) => this.call('kafaa_signoff_evaluation', { p }, ['evaluations', 'qual_records']),
      setLicenceStatus: (id, status, reason) => this.call('kafaa_set_licence_status', { p_licence_id: id, p_status: status, p_reason: reason }, ['licences', 'licensing_tasks', 'reporting_obligations']),
      detectLicensingEvents: () => this.call('kafaa_detect_licensing_events', {}, ['licences', 'licensing_tasks']),
      decidePartnerOnboarding: (id, decision, note) => this.call('kafaa_decide_partner_onboarding', { p_id: id, p_decision: decision, p_note: note }, ['partner_onboarding']),
      decideApplication: (id, stage, note) => this.call('kafaa_decide_application', { p_id: id, p_stage: stage, p_note: note }, ['applications', 'application_events']),
      triageConcern: (id, status, priority) => this.call('kafaa_triage_concern', { p_id: id, p_status: status, p_priority: priority }, ['concern_cases']),
      decideEquivalency: (id, status, note) => this.call('kafaa_decide_equivalency', { p_id: id, p_status: status, p_note: note }, ['equivalency_requests']),
      getEquivalency: async (id) => {
        const { data, error } = await this.client.rpc('kafaa_get_equivalency', { p_id: id });
        if (error) return { ok: false, code: 'error', message: error.message };
        const r = data as Result<RowOf<'equivalency_requests'>>;
        return r;
      },
      observerReportAction: (id, action, orgIds = []) => this.call('kafaa_observer_report_action', { p_id: id, p_action: action, p_org_ids: orgIds }, ['observer_reports']),
      screenResearchChallenge: (id, s, e) => this.call('kafaa_screen_research_challenge', { p_id: id, p_security_ok: s, p_export_ok: e }, ['research_challenges']),
      setDalilEnabled: (enabled) => this.call('kafaa_set_dalil_enabled', { p_enabled: enabled }, ['dalil_settings']),
      reviseStandard: (id, reason) => this.call('kafaa_revise_standard', { p_id: id, p_reason: reason }, ['qual_standards', 'task_items', 'qual_records']),
      grantRole: (personId, role, scopeType, scopeValue) => this.call('kafaa_grant_role', { p_person_id: personId, p_role: role, p_scope_type: scopeType, p_scope_value: scopeValue }, ['role_assignments']),
      approveRole: (id) => this.call('kafaa_approve_role', { p_id: id }, ['role_assignments']),
      revokeRole: (id, reason) => this.call('kafaa_revoke_role', { p_id: id, p_reason: reason }, ['role_assignments']),
      itemReview: (id, action) => this.call('kafaa_item_review', { p_item_id: id, p_action: action }, ['items']),
      recordJpm: (jpmId, personId, steps) => this.call('kafaa_record_jpm', { p_jpm_id: jpmId, p_person_id: personId, p_steps: steps }, ['jpm_results']),
      bookSimulator: (slotId, kind, crew) => this.call('kafaa_book_simulator', { p_slot_id: slotId, p_kind: kind, p_crew: crew }, ['simulator_slots']),
      assignCurriculum: (personId) => this.call('kafaa_assign_curriculum', { p_person_id: personId }, ['enrolments']),
      verifyCertificate: async (no) => {
        const { data, error } = await this.client.rpc('kafaa_verify_certificate', { p_no: no });
        if (error) return { found: false };
        return data as CertificateCheck;
      },
      workforceAggregate: async (period, measure) => {
        const { data, error } = await this.client.rpc('kafaa_workforce_aggregate', { p_period: period, p_measure: measure });
        if (error) throw new Error(error.message);
        return (data ?? []) as AggregateRow[];
      },
      applicationFunnel: async () => {
        const { data, error } = await this.client.rpc('kafaa_application_funnel');
        if (error) throw new Error(error.message);
        return (data ?? []) as { programme_id: string; stage: string; n: number | null; suppressed: boolean }[];
      },
      logDenied: async (route, resource) => {
        await this.client.rpc('kafaa_log_denied', { p_route: route, p_resource: resource });
      },
      auditVerify: async () => {
        const { data, error } = await this.client.rpc('kafaa_audit_verify');
        if (error) return { ok: false, code: 'error', message: error.message };
        return { ok: true, code: 'ok', message: `Chain verified (${data} entries)`, data: { entries: Number(data) } };
      },
    };
  }
  private makeNexus(): NexusReads {
    const read = async (fn: string) => {
      const { data, error } = await this.client.rpc(fn);
      if (error) throw new Error(error.message);
      return (data ?? []) as never;
    };
    return {
      source: 'live',
      personas: () => read('kafaa_nexus_personas'),
      authority: () => read('kafaa_nexus_authority'),
      trainingPrograms: () => read('kafaa_nexus_training_programs'),
      peopleQuals: () => read('kafaa_nexus_people_quals'),
      ecoCourses: () => read('kafaa_nexus_eco_courses'),
      ecoEnrolments: () => read('kafaa_nexus_eco_enrolments'),
      ecoScholarships: () => read('kafaa_nexus_eco_scholarships'),
      ecoPartnerships: () => read('kafaa_nexus_eco_partnerships'),
    };
  }
}
