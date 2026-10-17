// @vitest-environment jsdom
/** [FS QA · wave G integration] Cross-feature wiring of FS60-FS69 on the integration branch, one test per integration criterion:
 *   routes        367 routes after wave G (338 after wave F + 29 wave-G routes; 380 after wave H, 401 after wave I), each wave-G path registered
 *   benchmarks    every wave-G page names its card's FS01 benchmark chips; every chip is a published registry row with https sources
 *   FS60 inputs   the stored disclosure values equal the formula on the final seed (FS50, FS09/FS36, training records, xAPI, FS30)
 *   FS61          the adoption reference is the FSC figure read from kafaa_benchmarks, never typed into M35 copy
 *   FS62          FS41 Net Zero, FS02 Jahiz groups and the FS09/FS36 AI target are tagged as data; FS74 (wave H) is left to the wave-H file
 *   FS64 <- FS51  only released, suppressed aggregates of released forecasts reach partners; partners read no forecast
 *   FS66 <- 3.9   programme evidence at hire is recorded evidence that an F01 recompute keeps; coverage reuses FS57; the shared lists name it
 *   passport      the skills passport labels evidence from an endorsed university programme
 *   FS69 -> FS32  shares are FS32 record shares (on behalf only with a consent reference); the verify page labels a pre-arrival share
 *   entry links   the partner and university homes link the FS64 regional plan and the FS65 pledges
 *   isolation     alnoor-gm never sees gulfhydro-qa rows (and vice versa) in FS64, FS65 and FS68
 *   FS48          the mentoring card step is guarded on the live version 13 and matches the local FS48 card text
 *   migration     the QA migration is additive (one function replaced with the same signature, one guarded update, no removal words) */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { isRecordedEvidence, RECORDED_REF_TABLES } from '../../src/domain/skills';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { I18nProvider } from '../../src/i18n';
import { useEvidenceLabel } from '../../src/modules/m17/PassportView';
import { sharePurpose } from '../../src/modules/m17/learnerRecord';
import { referenceOf, adoptionRate } from '../../src/modules/m35/pilots';
import { disclosureFromTables, staffRungs } from '../../src/modules/m35/disclosureData';
import { effectiveLinks, TARGET_TABLES } from '../../src/modules/m37/national';
import { demandRows } from '../../src/modules/m36/regional';
import VerifyRecordPage from '../../src/modules/m17/VerifyRecordPage';
import PartnerPage from '../../src/modules/m09/PartnerPage';
import PartnerUniversityPage from '../../src/modules/m10/PartnerUniversityPage';
// @ts-expect-error untyped seed builder (.mjs)
import { FS48_CARD } from '../../scripts/seed/ext/fs46-future-leadership.mjs';
// @ts-expect-error untyped seed builder (.mjs)
import { applyFs48CardStep, FS48_LIVE_STEP, SHARED_EVIDENCE_LISTS, WAVE_G_REF_TABLES } from '../../scripts/seed/ext/fsqa7-integration.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = ((seed as any).tables ?? seed) as Record<string, Row[]>;
const W = { timeout: 60000 };
const QA = 'supabase/migrations/20261010279001_kafaa_fs7qa_integration.sql';
const WAVE_G: [string, string, string, string][] = [
  ['m35', 'workforce-disclosure', '/workforce/disclosure', 'FS60'], ['m35', 'workforce-disclosure-metrics', '/workforce/disclosure/metrics', 'FS60'],
  ['m35', 'workforce-disclosure-pack', '/workforce/disclosure/:period/pack', 'FS60'], ['m35', 'workforce-pilots', '/workforce/pilots', 'FS61'],
  ['m35', 'workforce-pilot', '/workforce/pilots/:id', 'FS61'], ['m35', 'skills-pilots', '/skills/pilots', 'FS61'],
  ['m37', 'national-alignment', '/national/alignment', 'FS62'], ['m37', 'national-alignment-tag', '/national/alignment/:tagId', 'FS62'],
  ['m37', 'national-report', '/national/report', 'FS62'], ['m37', 'admin-national-tags', '/admin/national-tags', 'FS62'], ['m37', 'national-occupations', '/national/occupations', 'FS63'],
  ['m36', 'ecosystem-regional-plan', '/ecosystem/regional-plan', 'FS64'], ['m36', 'ecosystem-commitments', '/ecosystem/regional-plan/commitments', 'FS64'],
  ['m36', 'ecosystem-commitment', '/ecosystem/regional-plan/commitments/:id', 'FS64'], ['m36', 'ecosystem-demand-release', '/ecosystem/regional-plan/release', 'FS64'],
  ['m36', 'ecosystem-pledges', '/ecosystem/pledges', 'FS65'], ['m36', 'ecosystem-pledges-register', '/ecosystem/pledges/register', 'FS65'],
  ['m10', 'partner-university-programmes', '/partner/university/programmes', 'FS66'], ['m10', 'training-university-programmes', '/training/university-programmes', 'FS66'],
  ['m10', 'university-programme', '/universities/programmes/:id', 'FS66'], ['m10', 'workforce-graduate-hires', '/workforce/graduate-hires', 'FS66'],
  ['m10', 'universities-fellowships', '/universities/fellowships', 'FS67'], ['m10', 'university-fellowship', '/universities/fellowships/:id', 'FS67'],
  ['m10', 'workforce-fellowships', '/workforce/fellowships', 'FS67'],
  ['m09', 'partner-future-readiness', '/partner/workforce/future-readiness', 'FS68'], ['m09', 'admin-supplier-future-readiness', '/admin/suppliers/future-readiness', 'FS68'],
  ['m09', 'partner-prearrival', '/partner/workforce/prearrival', 'FS69'], ['m09', 'training-equivalency-prearrival', '/training/equivalency/prearrival', 'FS69'],
  ['m09', 'training-equivalency-prearrival-share', '/training/equivalency/prearrival/:shareId', 'FS69'],
];
const pageFile = (m: string, id: string) => {
  const line = readFileSync(`src/modules/${m}/routes.ts`, 'utf8').split('\n').find((l) => l.includes(`id: '${id}'`))!;
  return `src/modules/${m}/${line.match(/import\('\.\/([^']+)'\)/)![1]}.tsx`;
};
const fresh = async (persona: string | null = null) => {
  const b = new LocalBackend(); await b.whenReady(); await b.reset();
  b.setPersona(persona); await b.whenReady();
  return b;
};

afterEach(() => { vi.useRealTimers(); });

describe('FS wave G · route registry', () => {
  it('367 routes after wave G (380 after wave H, 401 after wave I), and the 29 wave-G routes are registered', async () => {
    const { loadRoutes } = await import('../smoke/routes');
    const R = loadRoutes();
    expect(R.length).toBe(404); // Help centre 2026-10-17: + 3 (help, help-glossary, help-guide). FS wave I QA: + 21 (FS78/FS79 M34 5: my-learning-balance, team-study-time, workforce-learning-balances, my-external-certs, external-certs-queue; FS80 M29 4: workforce-ai-automations, workforce-ai-automation, my-ai-builds, admin-ai-automations; FS81 M30 4: my-transition-plan, workforce-transition-plans, workforce-transition-plan, workforce-rung-alerts; FS82/FS83 M36 6: my-grants, ecosystem-grants, workforce-grants, ecosystem-consortium, ecosystem-consortium-cohort, my-consortium; FS84 M17 2: team-skills-future, workforce-skills-inventory). FS wave H QA: + 13 (FS70-FS72 M28 7: skills-rising, skills-rising-method, workforce-skill-signals, my-manager-pulse, skills-technologies, admin-skills-technologies, my-skills-suggestions; FS73/FS74 M37 3: national-emirati-pipeline, my-future-wallet, national-future-wallet; FS77 M06 3: pathways-starter, my-induction, workforce-intake-baselines; FS75 shell digest and FS76 M13 none). FS wave G QA: + 29 (M35 6, M37 5, M36 6, M10 7, M09 5)
    const byId = new Map(R.map((r) => [r.id, r.path]));
    expect(WAVE_G.length).toBe(29);
    for (const [, id, path] of WAVE_G) expect(byId.get(id), id).toBe(path);
  });
});

describe('FS wave G · benchmark chips', () => {
  it('every wave-G page names its card\'s chips, and every chip is a published registry row with https sources and an as-of date', () => {
    for (const [m, id, , fs] of WAVE_G) expect(new RegExp(`feature=(\\{['"]?${fs}['"]?\\}|"${fs}")`).test(readFileSync(pageFile(m, id), 'utf8')), `${id} ${fs}`).toBe(true);
    const bench = new Map(T.benchmarks.map((b) => [b.id, b]));
    for (const fs of ['FS60', 'FS61', 'FS62', 'FS63', 'FS64', 'FS65', 'FS66', 'FS67', 'FS68', 'FS69']) {
      expect(FEATURE_BENCHMARKS[fs]?.length, fs).toBeGreaterThan(0);
      for (const id of FEATURE_BENCHMARKS[fs]) {
        const b = bench.get(id);
        expect(b, `${fs} ${id}`).toBeTruthy();
        expect((b.urls as string[]).every((u) => u.startsWith('https://')) && !!b.as_of && b.listed, id).toBe(true);
      }
    }
  });
});

describe('FS wave G · FS60 inputs', () => {
  it('the stored ISO 30414 disclosures equal the formula on the final seed, and the local RPC gives the same values', async () => {
    const seedRaw = (t: string) => T[t] ?? [];
    const q2 = T.hc_disclosures.find((d) => d.period === '2026-Q2');
    const q3 = T.hc_disclosures.find((d) => d.period === '2026-Q3');
    expect(q2.metric_values).toEqual(disclosureFromTables((t) => (t === 'hc_disclosures' ? [] : seedRaw(t)), '2026-Q2'));
    expect(q3.metric_values).toEqual(disclosureFromTables((t) => (t === 'hc_disclosures' ? [q2] : seedRaw(t)), '2026-Q3'));
    const inputs = new Set(T.hc_metrics.flatMap((m) => m.source_tables));
    for (const t of ['critical_skills', 'ai_rungs', 'training_records', 'xapi_statements', 'credit_ledger']) expect(inputs.has(t), t).toBe(true); // FS50, FS09/FS36, records, xAPI, FS30
    const b = await fresh('chco');
    const raw = (t: string) => b.raw(t as never) as unknown as Row[];
    const r = await b.rpc.computeDisclosure('2026-Q3');
    expect(r.ok).toBe(true);
    expect(r.data).toEqual(disclosureFromTables(raw, '2026-Q3', staffRungs(raw)));
  }, 120000);
});

describe('FS wave G · FS61 reference', () => {
  it('the adoption rate is computed from statuses and the reference is the FSC figure in kafaa_benchmarks, never typed into M35 copy', async () => {
    const ref = referenceOf(T.benchmarks);
    expect(ref).toMatchObject({ id: 'FSC', figure: 'adoption_rate' });
    expect(ref!.url).toMatch(/^https:\/\//);
    const b = await fresh('chco');
    const s = await b.rpc.pilotStats();
    expect(s.ok).toBe(true);
    expect(JSON.stringify(s.data)).toContain(String(ref!.value));
    expect(adoptionRate(T.skill_pilots).rate).toBe(75);
    const copy = ['en', 'ar'].map((l) => readFileSync(`src/i18n/m35.${l}.json`, 'utf8')).join('\n');
    expect(/\b78\s*%|78 ?٪|٧٨/.test(copy)).toBe(false);
  });
});

describe('FS wave G · FS62 tags as data', () => {
  it('FS41 Net Zero competences and FS02 Jahiz groups are derived from the data, the FS09/FS36 AI target is linked; FS74 waits for wave H', () => {
    const links = effectiveLinks({ tags: T.national_tags, links: T.tag_links, skills: T.skills, cec_competences: T.cec_competences });
    expect(links.filter((l) => l.basis === 'net_zero').length).toBe(T.cec_competences.filter((c) => c.net_zero).length);
    expect(links.filter((l) => l.basis === 'net_zero').length).toBe(12);
    const fg = links.filter((l) => l.basis === 'future_group');
    const groups = new Set(T.national_tags.filter((t) => t.derive === 'future_group' && t.status === 'active').map((t) => t.future_group));
    expect(fg.length).toBe(T.skills.filter((s) => groups.has(s.future_group) && s.lifecycle !== 'obsolete').length);
    expect(groups.has('nuclear_excellence')).toBe(false); // ENEC's own group is not a national tag
    expect(T.tag_links.some((l) => l.target_table === 'skills' && T.national_tags.find((t) => t.id === l.tag_id)?.derive === 'future_group')).toBe(false); // never stored
    expect(links.some((l) => l.target_table === 'ai_org_targets' && l.tag_id === 'nt-ai-2031')).toBe(true);
    expect(Object.keys(TARGET_TABLES)).not.toContain('future_targets'); // FS74 (wave H) adds its own table and SQL lists in the wave-H file
  });
});

describe('FS wave G · FS64 <- FS51', () => {
  it('only released, suppressed aggregates of released forecasts reach partners; partners read no forecast row', async () => {
    const area = Object.fromEntries(T.skills.map((s) => [s.id, s.area]));
    for (const rel of new Set(T.regional_demand.map((r) => r.release_id))) {
      const rows = T.regional_demand.filter((r) => r.release_id === rel);
      const f = T.skill_forecasts.find((x) => x.id === rows[0].forecast_id);
      expect(f.status).toBe('released');
      const want = demandRows(f.results, f.scenario, area).map((r) => `${r.area}:${r.year}:${r.gap_plan}`).sort();
      expect(rows.map((r) => `${r.area}:${r.year}:${r.gap_plan}`).sort()).toEqual(want);
    }
    for (const p of ['alnoor-gm', 'gulfhydro-qa', 'k-university']) {
      const b = await fresh(p);
      expect((await b.list('skill_forecasts' as never)).length, p).toBe(0);
      const dem = await b.list('regional_demand' as never) as Row[];
      expect(dem.length, p).toBeGreaterThan(0);
      expect(dem.every((r) => r.released && ['demand_low', 'demand_high', 'gap_low', 'gap_high', 'gap_plan'].every((k) => r[k] == null || r[k] === 0 || r[k] >= 10)), p).toBe(true);
    }
  }, 120000);
});

describe('FS wave G · FS66 recorded evidence (handover 3.9)', () => {
  it('evidence at hire from an endorsed programme survives an F01 recompute; the shared invariant lists name programme_alignments', async () => {
    expect(WAVE_G_REF_TABLES).toEqual(['programme_alignments']);
    expect(isRecordedEvidence({ kind: 'credential', ref_table: 'programme_alignments' })).toBe(true); // recorded by kind (FS29 / FS31 precedent)
    expect(RECORDED_REF_TABLES).not.toContain('programme_alignments');
    for (const f of SHARED_EVIDENCE_LISTS) expect(readFileSync(f, 'utf8'), f).toContain("'programme_alignments'");
    const b = await fresh('k-admin');
    const today = new Date().toISOString().slice(0, 10);
    const e = await b.rpc.endorseProgramme('ua-ku-bsc-nuc', { decision: 'endorse', note: 'All criteria checked by the reviewer', criteria: { assessment: true, placement: true, accreditation: true }, covers_from: `${Number(today.slice(0, 4)) - 1}${today.slice(4)}` } as never);
    expect(e.ok, e.message).toBe(true);
    const ev = (b.raw('skill_evidence') as unknown as Row[]).filter((x) => x.ref_table === 'programme_alignments' && x.active);
    expect(ev.length).toBeGreaterThan(0);
    for (const p of new Set(ev.map((x) => x.person_id))) await applySkills(b, p, today);
    for (const x of ev) expect((b.rawGet('skill_evidence' as never, x.id) as unknown as Row).active, x.id).toBe(true);
    // coverage reuses the FS57 rule (imported, not copied)
    expect(readFileSync('src/modules/m10/alignment.ts', 'utf8')).toMatch(/from '\.\.\/m25\/coverage(\.ts)?'/);
    expect(readFileSync(QA, 'utf8')).not.toMatch(/create or replace function kafaa_skills_apply|create or replace function kafaa_skill_states_v2/);
  }, 120000);
});

describe('FS wave G · skills passport label', () => {
  it('labels evidence from an endorsed university programme', () => {
    let title = '', system = '';
    const d = { courses: [], quals: [], standards: [], training: [], attempts: [], forms: [], badges: [], mcAwards: [] } as never;
    function Probe() {
      const label = useEvidenceLabel(d);
      const r = label({ kind: 'credential', basis: 'validated', ref_table: 'programme_alignments', ref_id: 'ua-ku-bsc-nuc' });
      title = r.title; system = r.system;
      return null;
    }
    render(<MemoryRouter><I18nProvider><Probe /></I18nProvider></MemoryRouter>);
    expect(title).toBe('Endorsed university programme');
    expect(system).toBe('Programme alignment (validated at hire)');
  });
});

describe('FS wave G · FS69 -> FS32', () => {
  it('pre-arrival shares are FS32 record shares (on behalf only with a consent reference) and the public verify page labels them', async () => {
    const shares = new Map(T.record_shares.map((s) => [s.id, s]));
    for (const p of T.prearrival_shares) {
      const s = shares.get(p.share_id);
      expect(sharePurpose(s.consents), p.id).toBe('prearrival');
      if (p.created_via === 'on_behalf') expect(!!p.consent_ref && s.consents.on_behalf, p.id).toBe(true);
    }
    expect(sharePurpose(shares.get('rs-kro-digital-rotation').consents)).toBe('record');
    const active = shares.get('rs-pa-calnoor01-mech');
    const b = await fresh(null);
    const v = await b.rpc.verifyRecordShare(active.token);
    expect(v.ok && v.data!.status).toBe('active');
    expect(v.data!.purpose).toBe('prearrival');
    const closed = await b.rpc.verifyRecordShare(shares.get('rs-pa-calnoor05-qa').token);
    expect(closed.data!.status).toBe('revoked');
    expect('purpose' in closed.data!).toBe(false);
    await renderPage(<VerifyRecordPage />, { persona: null, path: `/verify/record/${active.token}`, route: '/verify/record/:token' });
    expect((await screen.findByTestId('m17-lr-verify-purpose', {}, W)).textContent).toMatch(/pre-arrival check/);
    expect(readFileSync(QA, 'utf8')).toContain("'purpose', coalesce(nullif(s.consents ->> 'purpose', ''), 'record')");
  }, 120000);
});

describe('FS wave G · entry links', () => {
  it('the partner home and the university pages link the FS64 regional plan and the FS65 pledges', async () => {
    await renderPage(<PartnerPage />, { persona: 'alnoor-gm', path: '/partner' });
    expect((await screen.findByTestId('m09-home-link-regional', {}, W)).getAttribute('href')).toMatch(/\/ecosystem\/regional-plan$/);
    expect(screen.getByTestId('m09-home-link-pledgesRegister').getAttribute('href')).toMatch(/\/ecosystem\/pledges\/register$/);
    await renderPage(<PartnerPage />, { persona: 'alnoor-qaqc', path: '/partner' });
    expect((await screen.findByTestId('m09-home-link-pledges', {}, W)).getAttribute('href')).toMatch(/\/ecosystem\/pledges$/);
    await renderPage(<PartnerUniversityPage />, { persona: 'k-university', path: '/partner/university' });
    expect((await screen.findByTestId('m10-link-regional', {}, W)).getAttribute('href')).toMatch(/\/ecosystem\/regional-plan$/);
    expect(screen.getByTestId('m10-link-pledges').getAttribute('href')).toMatch(/\/ecosystem\/pledges\/register$/);
  }, 120000);
});

describe('FS wave G · partner isolation', () => {
  it('alnoor-gm never sees gulfhydro-qa rows (and vice versa) in FS64 commitments, FS65 pledges and FS68 readiness', async () => {
    for (const [p, mine] of [['alnoor-gm', 'org-alnoor'], ['gulfhydro-qa', 'org-gulfhydro']]) {
      const b = await fresh(p);
      const c = await b.list('provider_commitments' as never) as Row[];
      const pl = await b.list('pledges' as never) as Row[];
      expect(c.length + pl.length, p).toBeGreaterThan(0);
      expect([...c, ...pl].every((r) => r.org_id === mine), p).toBe(true);
      const fr = await b.rpc.supplierFutureReadiness();
      expect(fr.scope, p).toBe('own');
      expect(fr.orgs.map((o: Row) => o.org_id), p).toEqual([mine]);
    }
  }, 120000);
});

describe('FS wave G · FS48 mentoring card', () => {
  it('the QA step is guarded on the live version 13, writes the local FS48 card text as version 14 and is a no-op on the local card', () => {
    const local = T.engine_cards.find((c) => c.id === 'mentoring');
    expect(local.version).toBe(FS48_CARD.version);
    expect(applyFs48CardStep(local)).toBe(local);
    const pre = { ...local, version: 13, scoring_functions: ['src/modules/m04/match.ts#rankMentors'], inputs_used: local.inputs_used.filter((x: Row) => x.key !== 'wfn_participants'),
      limitations_en: 'Only mentors who opted in and have capacity appear.', limitations_ar: 'يظهر فقط المرشدون الذين اختاروا المشاركة ولديهم طاقة استيعابية.' };
    const after = applyFs48CardStep(pre);
    expect(after).toMatchObject({ version: 14, scoring_functions: FS48_CARD.scoring_functions, limitations_en: FS48_CARD.limitations_en, limitations_ar: FS48_CARD.limitations_ar });
    expect(after.inputs_used).toEqual(local.inputs_used);
    expect(applyFs48CardStep(after)).toBe(after);
    const sql = readFileSync(QA, 'utf8');
    expect(sql).toMatch(/where c\.id = 'mentoring' and c\.version = 13;/);
    expect(sql).toContain(`version = ${FS48_LIVE_STEP.to_version},`);
    expect(sql).toContain(FS48_CARD.extra_input.en);
    expect(sql).toContain(FS48_CARD.limitations_en.replace('Only mentors who opted in and have capacity appear.', '').trim());
    expect(sql).toContain(FS48_CARD.limitations_ar.replace('يظهر فقط المرشدون الذين اختاروا المشاركة ولديهم طاقة استيعابية.', '').trim());
  });
});

describe('FS wave G · QA migration', () => {
  it('is additive: one function replaced with the same signature, one guarded update, no removal words, no new object', () => {
    const sql = readFileSync(QA, 'utf8');
    expect(/\b(drop|delete|truncate)\b/i.test(sql)).toBe(false);
    const body = sql.replace(/--.*$/gm, '');
    const top = body.replace(/\$\$[\s\S]*?\$\$/g, "''");
    expect([...body.matchAll(/create or replace function (\w+)\(([^)]*)\)/g)].map((m) => `${m[1]}(${m[2]})`)).toEqual(['kafaa_verify_record_share(p_token text)']);
    expect([...top.matchAll(/\bupdate (\w+)/g)].map((m) => m[1])).toEqual(['kafaa_engine_cards']);
    expect(/\balter\b|\bcreate (table|index|policy|trigger)\b|\binsert into\b/i.test(top)).toBe(false);
    expect(top).toContain('grant execute on function kafaa_verify_record_share(text) to authenticated, anon;');
  });
});
