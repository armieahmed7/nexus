/** FS05 (wave A · E4) future role profiles and 2030/2035 role horizons: one test per acceptance criterion, plus RBAC, the
 * saveRoleProfileVersion RPC on the LocalBackend (the SQL mirror is proven equal in scripts/validate/fs14-role-profiles.mjs),
 * the pure rules and i18n coverage. */
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { findPaths } from '../../src/domain/careerGraph';
import { publicTextIsClean } from '../../src/domain/future';
import {
  CHECK_MESSAGES, DRIVERS, HORIZONS, changeSize, checkVersion, diffProfiles, normaliseReqs, profileTextIsClean, publishedByHorizon, reasonsFor, reqsOf, type ProfileReq,
} from '../../src/modules/m01/roleProfiles';
import en from '../../src/i18n/m01.en.json';
import ar from '../../src/i18n/m01.ar.json';
import { routes } from '../../src/modules/m01/routes';

type Row = Record<string, any>;
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const SEC = ['cyber-security-engineer', 'security-officer', 'safeguards-specialist'];

let b: LocalBackend;
const as = async (p: string | null) => {
  b.setPersona(p);
  await b.whenReady();
};
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('FS05 acceptance', () => {
  it('28 of 28 roles have a 2030 version; 11 of 11 future roles have at least 4 requirements and at least 1 inbound edge', async () => {
    await as(null);
    const roles = await b.list('job_roles');
    const versions = await b.list('role_profile_versions');
    const paths = await b.list('career_paths');
    const current = roles.filter((r) => r.lifecycle === 'current');
    const concepts = roles.filter((r) => r.lifecycle === 'concept');
    expect(current).toHaveLength(28);
    expect(current.every((r) => publishedByHorizon(versions, r.id)['2030'])).toBe(true);
    expect(concepts.map((r) => r.id).sort()).toEqual(T.future_roles.map((f) => f.id).sort());
    for (const r of concepts) {
      const v = publishedByHorizon(versions, r.id);
      expect(reqsOf(v['2035'] ?? v['2030']).length).toBeGreaterThanOrEqual(4);
      const inbound = paths.filter((e) => e.kind === 'future' && e.to_role_id === r.id);
      expect(inbound.length).toBeGreaterThanOrEqual(1);
      expect(inbound.length).toBeLessThanOrEqual(3);
      expect(inbound.every((e) => current.some((c) => c.id === e.from_role_id))).toBe(true);
    }
    // every current non-security role also has now and 2035 versions
    expect(current.every((r) => ['now', '2030', '2035'].every((h) => publishedByHorizon(versions, r.id)[h as 'now']))).toBe(true);
  });

  it('findPaths reaches every future role from at least one current role', async () => {
    await as(null);
    const paths = await b.list('career_paths');
    const roles = await b.list('job_roles');
    for (const c of roles.filter((r) => r.lifecycle === 'concept')) {
      const from = roles.filter((r) => r.lifecycle === 'current' && findPaths(paths as never[], r.id, c.id).length > 0);
      expect(from.length, c.id).toBeGreaterThan(0);
    }
    // today's map is unchanged: current edges never point at a concept role
    expect(paths.filter((e) => e.kind !== 'future').every((e) => roles.find((r) => r.id === e.to_role_id)?.lifecycle === 'current')).toBe(true);
  });

  it('all public text passes publicTextIsClean (no headcount, site or deployment wording), in English and Arabic', async () => {
    await as(null);
    const versions = await b.list('role_profile_versions');
    const concepts = (await b.list('job_roles')).filter((r) => r.lifecycle === 'concept');
    const future = (await b.list('career_paths')).filter((e) => e.kind === 'future');
    const texts = [...versions.flatMap((v) => [v.rationale_en, v.rationale_ar, v.requirements]), ...concepts.flatMap((r) => Object.values(r)), ...future.flatMap((e) => [e.label_en, e.label_ar, e.conditions])];
    expect(publicTextIsClean(texts)).toBe(true);
    expect(profileTextIsClean(texts)).toBe(true);
    // the checker itself: headcount, sites and deployment claims are refused in both languages; the disclaimer is allowed
    expect(profileTextIsClean(['We will need 40 engineers'])).toBe(false);
    expect(profileTextIsClean(['A candidate site has been chosen'])).toBe(false);
    expect(profileTextIsClean(['Deployment has been approved'])).toBe(false);
    expect(profileTextIsClean(['سيتم بناء وحدات جديدة'])).toBe(false);
    expect(profileTextIsClean(['نحتاج 40 مهندس'])).toBe(false);
    expect(profileTextIsClean(['Planning assumption; no deployment decision implied.', 'افتراض تخطيطي؛ دون أي قرار نشر ضمني.'])).toBe(true);
  });

  it('security, safeguards and cyber roles carry path-level requirements only', async () => {
    await as(null);
    const versions = (await b.list('role_profile_versions')).filter((v) => SEC.includes(v.role_id));
    expect(versions).toHaveLength(9);
    expect(versions.every((v) => v.path_only && reqsOf(v).length === 0)).toBe(true);
    // and nothing else asks for a security-area skill or competency
    const all = T.role_profile_versions.flatMap((v) => reqsOf(v as never));
    expect(all.some((r) => r.ref_id === 'sk-sa-01' || r.ref_id === 'sa-01')).toBe(false);
    await as('training-mgr');
    const r = await b.rpc.saveRoleProfileVersion({ role_id: 'cyber-security-engineer', horizon: '2030', requirements: [{ kind: 'skill', ref_id: 'sk-da-01', level: 2, importance: 'core' }], drivers: [], rationale_en: 'x'.repeat(30), rationale_ar: 'س'.repeat(30), sources: [], publish: false });
    expect(r.code).toBe('security_restricted');
    const s = await b.rpc.saveRoleProfileVersion({ role_id: 'reactor-operator', horizon: '2030', requirements: [{ kind: 'skill', ref_id: 'sk-sa-01', level: 2, importance: 'core' }], drivers: [], rationale_en: 'x'.repeat(30), rationale_ar: 'س'.repeat(30), sources: [], publish: false });
    expect(s.code).toBe('security_restricted');
  });
});

describe('FS05 RBAC and the saveRoleProfileVersion RPC (LocalBackend = SQL)', () => {
  const ro = () => T.role_profile_versions.find((v) => v.id === 'rpv-reactor-operator-2030-v2')!;
  const input = (o: Record<string, unknown> = {}) => ({
    role_id: 'reactor-operator', horizon: '2035' as const, requirements: ro().requirements as ProfileReq[], drivers: ['ai_assistance'],
    rationale_en: 'A planning assumption for the 2035 operator profile.', rationale_ar: 'افتراض تخطيطي لملف المشغّل لعام 2035.', sources: ro().sources as never[], publish: false, ...o,
  });

  it('published versions are public; drafts and history are read by training, admins, instructors and auditors only', async () => {
    const hidden = T.role_profile_versions.filter((v) => v.status !== 'published').length;
    expect(hidden).toBeGreaterThanOrEqual(3);
    for (const p of [null, 'k-ro', 'sro', 'k-hr-analyst', 'alnoor-gm']) {
      await as(p);
      const rows = await b.list('role_profile_versions');
      expect(rows.every((v) => v.status === 'published'), String(p)).toBe(true);
    }
    for (const p of ['training-mgr', 'k-admin', 'k-auditor', 'k-instructor']) {
      await as(p);
      expect((await b.list('role_profile_versions')).length, p).toBe(T.role_profile_versions.length);
    }
  });

  it('only the training manager or an admin can save; refusals are audited', async () => {
    for (const p of ['k-ro', 'sro', 'k-instructor', 'k-auditor', 'k-hr-analyst']) {
      await as(p);
      expect((await b.rpc.saveRoleProfileVersion(input())).code, p).toBe('forbidden');
    }
    await as(null);
    expect((await b.rpc.saveRoleProfileVersion(input())).code).toBe('not_signed_in');
    expect(b.raw('audit_events').filter((a) => a.action === 'role_profile.save' && a.outcome === 'refused').length).toBeGreaterThanOrEqual(6);
  });

  it('draft -> update -> publish supersedes the previous version; audit always, NEXUS ledger on publish only', async () => {
    await as('training-mgr');
    const led0 = b.raw('ledger_local').length;
    const d1 = await b.rpc.saveRoleProfileVersion(input());
    expect(d1.ok).toBe(true);
    expect(d1.data).toEqual({ id: 'rpv-reactor-operator-2035-v2', version: 2, status: 'draft', supersedes_id: null });
    const row = b.rawGet('role_profile_versions', d1.data!.id)!;
    expect(row.status).toBe('draft');
    expect(row.is_public).toBe(false);
    expect(row.requirements).toEqual(normaliseReqs(input().requirements));
    expect(b.raw('ledger_local').length).toBe(led0);
    const d2 = await b.rpc.saveRoleProfileVersion(input({ rationale_en: 'A revised planning assumption for the 2035 operator profile.' }));
    expect(d2.data!.id).toBe(d1.data!.id);
    expect(b.raw('role_profile_versions').filter((v) => v.role_id === 'reactor-operator' && v.horizon === '2035' && v.status === 'draft')).toHaveLength(1);
    await as(null);
    expect((await b.list('role_profile_versions')).some((v) => v.id === d1.data!.id)).toBe(false);
    await as('training-mgr');
    const p = await b.rpc.saveRoleProfileVersion(input({ publish: true }));
    expect(p.ok).toBe(true);
    expect(p.data!.supersedes_id).toBe('rpv-reactor-operator-2035-v1');
    expect(b.rawGet('role_profile_versions', 'rpv-reactor-operator-2035-v1')).toMatchObject({ status: 'superseded', is_public: false, superseded_by_id: p.data!.id });
    expect(b.rawGet('role_profile_versions', p.data!.id)).toMatchObject({ status: 'published', is_public: true, supersedes_id: 'rpv-reactor-operator-2035-v1' });
    const aud = b.raw('audit_events').filter((a) => a.action === 'role_profile.publish').at(-1)!;
    expect(aud.outcome).toBe('ok');
    expect(b.raw('ledger_local').length).toBe(led0 + 1);
    expect(aud.ledger_status).toBe('written');
    await as(null);
    expect((await b.list('role_profile_versions')).filter((v) => v.role_id === 'reactor-operator' && v.horizon === '2035').map((v) => v.id)).toEqual([p.data!.id]);
    // an admin (Kafa'a-only persona, no NEXUS profile) can publish too; the ledger write is then skipped, as for every RPC
    await as('k-admin');
    const a = await b.rpc.saveRoleProfileVersion(input({ horizon: 'now', requirements: reqsOf(T.role_profile_versions.find((v) => v.id === 'rpv-reactor-operator-now-v1') as never), drivers: [], publish: true }));
    expect(a.ok).toBe(true);
    expect(b.raw('audit_events').filter((x) => x.action === 'role_profile.publish').at(-1)!.ledger_status).toBe('skipped');
  });

  it('refuses unclean text, too few concept requirements, missing sources, unknown references and bad levels', async () => {
    await as('training-mgr');
    const codes = [
      await b.rpc.saveRoleProfileVersion(input({ rationale_en: 'We will need 40 engineers for this new unit by 2035.' })),
      await b.rpc.saveRoleProfileVersion(input({ role_id: 'fr-digital-twin', requirements: [{ kind: 'skill', ref_id: 'sk-da-01-twins', level: 3, importance: 'core' }], publish: true })),
      await b.rpc.saveRoleProfileVersion(input({ sources: [], publish: true })),
      await b.rpc.saveRoleProfileVersion(input({ requirements: [{ kind: 'skill', ref_id: 'sk-nope', level: 2, importance: 'core' }] })),
      await b.rpc.saveRoleProfileVersion(input({ requirements: [{ kind: 'skill', ref_id: 'sk-da-01', level: 5, importance: 'core' }] })),
      await b.rpc.saveRoleProfileVersion(input({ horizon: '2040' })),
      await b.rpc.saveRoleProfileVersion(input({ role_id: 'nope' })),
    ].map((r) => r.code);
    expect(codes).toEqual(['unclean_text', 'too_few', 'source_required', 'unknown_ref', 'invalid_requirements', 'invalid', 'not_found']);
  });

  it('profile rows cannot be written directly', async () => {
    await as('training-mgr');
    const r = await b.insert('role_profile_versions', { id: 'x', role_id: 'reactor-operator', horizon: 'now', rationale_en: 'x', rationale_ar: 'x', as_of: '2026-10-10' } as never);
    expect(r.ok).toBe(false);
  });
});

describe('FS05 rules', () => {
  const r = (ref_id: string, level: number, importance: ProfileReq['importance'] = 'core'): ProfileReq => ({ kind: ref_id.startsWith('sk-') ? 'skill' : 'competency', ref_id, level, importance });
  it('diffProfiles and changeSize classify new, raised, unchanged, lowered and dropped requirements', () => {
    const d = diffProfiles([r('co-01', 3), r('hu-01', 3), r('pf-01', 4)], [r('co-01', 4), r('hu-01', 3), r('pf-01', 3), r('sk-da-01', 2, 'important')]);
    expect(Object.fromEntries(d.map((x) => [x.ref_id, x.change]))).toEqual({ 'sk-da-01': 'new', 'co-01': 'raised', 'pf-01': 'lowered', 'hu-01': 'same' });
    expect(diffProfiles([r('co-01', 3)], [])[0].change).toBe('dropped');
    expect(changeSize([r('co-01', 3)], [r('co-01', 4), r('sk-da-01', 2)])).toEqual({ added: 1, raised: 1, dropped: 0, score: 3 });
  });
  it('the seeded 2030 operator profiles add plant-data literacy and AI output verification at level 2', () => {
    for (const id of ['reactor-operator', 'local-operator']) {
      const v = publishedByHorizon(T.role_profile_versions as never[], id)['2030']!;
      const reqs = reqsOf(v);
      expect(reqs.find((x) => x.ref_id === 'sk-da-01')?.level).toBe(2);
      expect(reqs.find((x) => x.ref_id === 'sk-da-02-review')?.level).toBe(2);
    }
    const m = publishedByHorizon(T.role_profile_versions as never[], 'maintenance-technician-engineer')['2030']!;
    expect(reqsOf(m).map((x) => x.ref_id)).toEqual(expect.arrayContaining(['sk-mp-01-remote', 'sk-en-02-perf']));
  });
  it('digital requirements spread from 4 roles today to most roles by 2030 (the audit gap FS05 closes)', () => {
    const area = new Map(T.skills.map((s) => [s.id, s.area]));
    const dom = new Map(T.competencies.map((c) => [c.id, c.domain]));
    const count = (h: string) => T.job_roles.filter((jr) => jr.lifecycle === 'current' && reqsOf(publishedByHorizon(T.role_profile_versions as never[], jr.id)[h as 'now']).some((x) => (x.kind === 'skill' ? area.get(x.ref_id) : dom.get(x.ref_id)) === 'digital')).length;
    expect(count('now')).toBe(3); // corporate, systems and procurement (the cyber role is shown at path level)
    expect(count('2030')).toBeGreaterThanOrEqual(24);
    expect(count('2035')).toBeGreaterThanOrEqual(count('2030'));
  });
  it('every refusal code has a message, and reasons point at i18n keys that exist in EN and AR', () => {
    const codes = ['invalid', 'not_found', 'invalid_requirements', 'unknown_ref', 'security_restricted', 'unclean_text', 'source_required', 'too_few'];
    for (const c of codes) {
      expect(CHECK_MESSAGES[c as keyof typeof CHECK_MESSAGES]).toBeTruthy();
      expect((en.fs05.check as Record<string, string>)[c]).toBeTruthy();
      expect((ar.fs05.check as Record<string, string>)[c]).toBeTruthy();
    }
    const get = (o: unknown, k: string) => k.split('.').reduce<unknown>((x, p) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[p] : undefined), o);
    for (const v of T.role_profile_versions.filter((x) => x.status === 'published')) {
      const prevH = HORIZONS[HORIZONS.indexOf(v.horizon) - 1];
      const prev = prevH ? publishedByHorizon(T.role_profile_versions as never[], v.role_id)[prevH] : undefined;
      for (const d of diffProfiles(reqsOf(prev), reqsOf(v as never)))
        for (const reason of reasonsFor(d, v.horizon)) {
          const k = reason.key.replace(/^m01\./, '');
          expect(get(en, k), reason.key).toBeTypeOf('string');
          expect(get(ar, k), reason.key).toBeTypeOf('string');
        }
    }
    for (const d of DRIVERS) expect(get(ar, `fs05.driver.${d}`)).toBeTypeOf('string');
  });
  it('checkVersion follows the documented order (the SQL mirror kafaa_rpv_check uses the same order)', () => {
    const ctx = { role: { id: 'r', lifecycle: 'current', security_sensitive: true }, competencies: new Map([['sa-01', 'security']]), skills: new Map([['sk-x', 'digital']]) };
    const base = { role_id: 'r', horizon: '2030', requirements: [{ kind: 'skill' as const, ref_id: 'sk-y', level: 2, importance: 'core' as const }], drivers: [], rationale_en: 'x'.repeat(25), rationale_ar: 'y'.repeat(25), sources: [], publish: true };
    expect(checkVersion(base, ctx)).toBe('unknown_ref');
    expect(checkVersion({ ...base, requirements: [{ ...base.requirements[0], ref_id: 'sk-x' }] }, ctx)).toBe('security_restricted');
    expect(checkVersion({ ...base, requirements: [] }, ctx)).toBe('source_required');
    expect(checkVersion({ ...base, requirements: [], sources: [{ id: 's', label: 'S', url: 'https://x.org' }] }, ctx)).toBe('ok');
  });
});

describe('FS05 routes and i18n', () => {
  it('the overview is public and the editor is limited to the training manager and admins', () => {
    const h = routes.find((r) => r.id === 'careers-horizons')!;
    const e = routes.find((r) => r.id === 'careers-profile-edit')!;
    expect(h.guard).toEqual({});
    expect(e.guard).toEqual({ anyRole: ['training_manager', 'admin'] });
    for (const id of ['careers-horizons', 'careers-profile-edit']) {
      expect((en.routes as Record<string, { title: string }>)[id].title).toBeTruthy();
      expect((ar.routes as Record<string, { title: string }>)[id].title).toBeTruthy();
    }
  });
  it('every static m01.fs05 key used in the M01 sources exists in English and Arabic', () => {
    const dir = 'src/modules/m01';
    const src = readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
    const keys = [...new Set([...src.matchAll(/'m01\.(fs05\.[A-Za-z0-9_.]+[A-Za-z0-9_])'/g)].map((m) => m[1]))];
    expect(keys.length).toBeGreaterThan(100);
    const get = (o: unknown, k: string) => k.split('.').reduce<unknown>((x, p) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[p] : undefined), o);
    const missing = keys.filter((k) => typeof get(en, k) !== 'string' || typeof get(ar, k) !== 'string');
    expect(missing).toEqual([]);
  });
});
