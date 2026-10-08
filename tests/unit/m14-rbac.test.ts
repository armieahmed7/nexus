/**
 * M14 RBAC suite: every persona x every table, consequential RPC and route guard, compared with the policy matrix
 * (src/auth/policy.ts). Expectations are derived from MATRIX and the schema read/write rules independently of the
 * LocalBackend access code, so a drift between the matrix and what the repository returns fails the build.
 * The same invariants are checked against Postgres RLS by scripts/validate-migrations.mjs.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA, TABLE_NAMES, type TableName } from '../../src/data/schema';
import { MATRIX, grantsFor, type Level, type PlatformRole, type Resource } from '../../src/auth/policy';
import { checkGuard } from '../../src/auth/guards';
import { ROUTES } from '../../src/routes/registry';
import personas from '../../src/seed/personas.json';

type Card = { persona: string; roles: PlatformRole[] };
const CARDS = personas as unknown as Card[];
let b: LocalBackend;

const levels = (roles: readonly PlatformRole[], res: string) => grantsFor(roles, res as Resource);
const any = (s: Set<Level>, ls: Level[]) => ls.some((l) => s.has(l));

beforeAll(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('policy matrix shape', () => {
  it('every schema rule points at a resource in the matrix', () => {
    for (const t of TABLE_NAMES) {
      for (const r of SCHEMA[t].read) expect(MATRIX, `${t} read ${r.res}`).toHaveProperty(r.res);
      const w = SCHEMA[t].write;
      if (w.res) expect(MATRIX, `${t} write ${w.res}`).toHaveProperty(w.res);
    }
  });
  it('concern cases are visible only to the ECP officer role', () => {
    const holders = Object.entries(MATRIX.concern_cases).filter(([, l]) => l && l.length).map(([r]) => r);
    expect(holders).toEqual(['ecp_officer']);
  });
});

describe.each(CARDS.map((c) => [c.persona, c] as const))('persona %s', (_id, card) => {
  let roles: PlatformRole[] = [];
  let me: string | null = null;
  beforeAll(async () => {
    b.setPersona(card.persona);
    await b.whenReady();
    const who = await b.whoami();
    roles = who.roles;
    me = who.personId;
  });

  it('reads match the matrix for every table', async () => {
    for (const t of TABLE_NAMES) {
      const rules = SCHEMA[t].read;
      const raw = b.raw(t as TableName);
      const seen = await b.list(t as TableName);
      const g = rules.map((r) => levels(roles, r.res));
      // No level at all on any rule resource: nothing may come back.
      if (g.every((s) => s.size === 0)) {
        expect(seen.length, `${card.persona} must not read ${t}`).toBe(0);
        continue;
      }
      // An unconditional R/W/A grant: every row comes back.
      const full = rules.some((r, i) => !r.special && !r.where && any(g[i], ['R', 'W', 'A']));
      if (full) expect(seen.length, `${card.persona} should read all of ${t}`).toBe(raw.length);
      // Only Own-type grants (no R/W/A/Scope/OwnOrg/Agg anywhere): every visible row is the caller's own or public.
      const ownOnly = g.every((s) => !any(s, ['R', 'W', 'A', 'Scope', 'OwnOrg', 'OrgW', 'Agg']));
      if (ownOnly) {
        for (const row of seen as Record<string, unknown>[]) {
          const mine = rules.some((r) => r.person && row[r.person] === me);
          expect(mine, `${card.persona} saw a ${t} row that is not theirs`).toBe(true);
        }
      }
    }
  });

  it('cannot write rpc-only, append-only or read-only tables directly', async () => {
    for (const t of TABLE_NAMES) {
      const w = SCHEMA[t].write;
      if (w.mode === 'direct') continue;
      const r = await b.insert(t as TableName, { id: `rbac-probe-${t}` } as never);
      expect(r.ok, `${card.persona} inserted into ${t}`).toBe(false);
    }
  });

  it('cannot write direct tables without a level on the write resource', async () => {
    for (const t of TABLE_NAMES) {
      const w = SCHEMA[t].write;
      if (w.mode !== 'direct' || w.anonInsert || !w.res) continue;
      if (levels(roles, w.res).size > 0) continue;
      const r = await b.insert(t as TableName, { id: `rbac-probe-${t}` } as never);
      expect(r.ok, `${card.persona} inserted into ${t}`).toBe(false);
      expect(r.code).toBe('forbidden');
    }
  });

  it('consequential RPCs refuse callers the matrix does not authorise', async () => {
    const has = (res: Resource, ls: Level[]) => any(levels(roles, res), ls);
    if (!has('users_roles', ['W'])) {
      expect((await b.rpc.approveRole('ra-none')).ok).toBe(false);
      expect((await b.rpc.reviewRoleAccess('ra-none', 'keep', '')).code).toBe('forbidden');
    }
    if (!has('users_roles', ['W', 'OrgW'])) expect((await b.rpc.grantRole('p-none', 'employee', 'self', null)).ok).toBe(false);
    if (!has('dalil_config', ['A'])) expect((await b.rpc.setDalilEnabled(true)).ok).toBe(false);
    if (!has('audit_log', ['R'])) expect((await b.rpc.auditVerify()).code).toBe('forbidden');
    if (!has('concern_cases', ['A'])) {
      expect((await b.rpc.logConcernReferral({ received_on: '2026-10-01', channel: 'phone', anonymous: true, category: 'other', ecp_system_ref: 'X' })).ok).toBe(false);
      expect((await b.rpc.triageConcernV2('cc-1', 'triaged', 'routine', null)).ok).toBe(false);
    }
    if (!has('frameworks', ['W', 'A'])) expect((await b.rpc.reviseStandard('none', 'reason')).code).toBe('forbidden');
  });

  it('route guards follow the roles (deny by default for staff, partner and admin zones)', () => {
    const s = { status: 'signed_in' as const, roles };
    for (const r of ROUTES) {
      const res = checkGuard(r.guard, s);
      if (r.guard.anyRole && !r.guard.grant) expect(res === 'ok', `${card.persona} ${r.path}`).toBe(r.guard.anyRole.some((x) => roles.includes(x)));
    }
  });
});

describe('route table invariants', () => {
  it('every non-public route requires sign-in; every admin route also requires a role', () => {
    for (const r of ROUTES) {
      if (r.zone !== 'public') expect(r.guard.signedIn || !!r.guard.anyRole || !!r.guard.grant, r.path).toBe(true);
      if (r.zone === 'admin') expect(!!r.guard.anyRole || !!r.guard.grant, r.path).toBe(true);
    }
  });
  it('anonymous visitors are sent to sign-in for every guarded route', () => {
    for (const r of ROUTES) {
      const needs = r.guard.signedIn || !!r.guard.anyRole || !!r.guard.grant;
      expect(checkGuard(r.guard, { status: 'anon', roles: ['public'] }), r.path).toBe(needs ? 'signin' : 'ok');
    }
  });
  it('no debug or internal API routes exist', () => {
    expect(ROUTES.filter((r) => /\/(api|debug|_internal)(\/|$)/.test(r.path))).toEqual([]);
  });
  it('speak-up is public and marked no-telemetry', () => {
    const r = ROUTES.find((x) => x.path === '/speak-up')!;
    expect(r.guard.noTelemetry).toBe(true);
    expect(checkGuard(r.guard, { status: 'anon', roles: ['public'] })).toBe('ok');
  });
});
