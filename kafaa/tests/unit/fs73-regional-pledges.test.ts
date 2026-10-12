/** FS64 Regional skills plan for Al Dhafra + FS65 Skills pledges ledger (FS wave G · E3, M36): one named test per acceptance criterion on
 *  the local path, plus partner isolation, the shared rules, RBAC, the seed, routes, benchmarks and i18n. The SQL path (kafaa_rg_* =
 *  regional.ts, kafaa_pl_* = pledges.ts, the seven RPCs, RLS, grants, seed rows) is proved by scripts/validate/fs73-regional-pledges.mjs
 *  (PGlite). University flows run on the local backend only (k-university has no NEXUS account). */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { todayIso } from '../../src/domain/rules';
import { grantsFor } from '../../src/auth/policy';
import en from '../../src/i18n/m36.en.json';
import ar from '../../src/i18n/m36.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m36/routes';
import {
  DEMAND_AREAS, LAST_TERM, cellOf as rgCell, commitmentProblem, commitmentView, coverageByArea, deliveryProblem, demandReasons, demandRows, firstOpenTerm, lockedTerms, openTerms,
  termDelivery, termEnd, termStart, termState,
} from '../../src/modules/m36/regional';
import { MIN_GROUP, MIN_ORGS, PLEDGE_AREAS, cellOf, countOf, latestProgress, pledgeLedger, pledgeProblem, pledgeStatus, progressProblem } from '../../src/modules/m36/pledges';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const today = todayIso();
const skillArea = Object.fromEntries(T.skills.map((s) => [s.id, s.area]));
const ctxSkills = Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]);
const audits = (action: string) => raw('audit_events').filter((a) => a.action === action);
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

const fo = firstOpenTerm(today);
const cbase = {
  action: 'create' as const, area: 'maintenance', kind: 'cohort', title_en: 'Pump maintenance cohort', title_ar: 'دفعة صيانة المضخات', summary_en: 'A cohort on pump maintenance and testing.',
  summary_ar: 'دفعة حول صيانة المضخات واختبارها.', skill_ids: [] as string[], level: 2, plan: [{ term: fo, seats: 10 }, { term: '2027S2', seats: 12 }],
};

describe('FS64 · only released, suppressed aggregates reach partners (acceptance 1)', () => {
  it('a partner reads released rows only: every cell null, 0 or 10+, no withheld or security skill, and never the FS51 forecast itself', async () => {
    await as('alnoor-gm');
    const rows = await b.list('regional_demand' as never) as unknown as Row[];
    expect(rows.length).toBe(T.regional_demand.length);
    const withheld = new Set(T.skill_forecasts.flatMap((f) => f.results.suppressed ?? []));
    for (const r of rows) {
      expect(r.released).toBe(true);
      for (const c of [r.demand_low, r.demand_high, r.gap_low, r.gap_high, r.gap_plan]) expect(c === null || c === 0 || c >= MIN_GROUP).toBe(true);
      for (const s of r.skill_ids) { expect(withheld.has(s)).toBe(false); expect(skillArea[s]).not.toBe('security'); }
      expect(Object.keys(r)).not.toEqual(expect.arrayContaining(['supply']));
    }
    expect(await b.list('skill_forecasts' as never)).toHaveLength(0);
    await as('k-university');
    expect((await b.list('regional_demand' as never)).length).toBe(T.regional_demand.length);
    await as(null);
    expect(await b.list('regional_demand' as never)).toHaveLength(0);
  });
  it('demandRows suppresses cells of 1-9 and areas measured on fewer than 10 holders, and never releases a security skill', () => {
    const synth = (vals: [string, string, number, number, number][]) => ({ years: [2026, 2028, 2030, 2035], suppressed: [],
      skills: vals.map(([id, area, basis, d, s]) => ({ skill_id: id, area, basis_n: basis, sc: Object.fromEntries(['baseline', 'advance', 'accelerated'].map((sc, i) => [sc, { d: [0, 1, 2, 3].map((y) => [d + i + y, d + i + y, 1, 0]), s: [0, 1, 2, 3].map(() => [s, s, 0, 0]) }])) })) });
    const small = demandRows(synth([['a', 'operations', 12, 5, 0], ['b', 'operations', 4, 3, 1]]), 'advance', {});
    expect(small[0].gap_low).toBeNull();
    expect(small[0].suppressed).toBe(true);
    expect(demandRows(synth([['c', 'safety', 8, 40, 0]]), 'advance', {}).every((r) => r.demand_low === null && r.gap_plan === null)).toBe(true);
    expect(demandRows(synth([['d', 'security', 50, 100, 10]]), 'advance', {})).toHaveLength(0);
    expect([0, 5, 9, 10, 250].map(rgCell)).toEqual([0, null, null, 10, 250]);
    expect(DEMAND_AREAS).not.toContain('security');
  });
  it('the stored release equals demandRows() of its released FS51 forecast (computed, never typed)', () => {
    const f = T.skill_forecasts.find((x) => x.id === T.regional_demand[0].forecast_id)!;
    expect(f.status).toBe('released');
    const exp = demandRows(f.results, f.scenario, skillArea);
    expect(T.regional_demand).toHaveLength(exp.length);
    for (const e of exp) {
      const r = T.regional_demand.find((x) => x.area === e.area && x.year === e.year)!;
      expect([r.demand_low, r.demand_high, r.gap_low, r.gap_high, r.gap_plan, r.skills_n, r.withheld_n, r.skill_ids]).toEqual([e.demand_low, e.demand_high, e.gap_low, e.gap_high, e.gap_plan, e.skills_n, e.withheld_n, e.skill_ids]);
    }
    expect(demandReasons(T.regional_demand[0], f.scenario).length).toBeGreaterThan(0);
  });
  it('releaseRegionalDemand: only the HR director, only a released forecast, a clean note; the previous release is superseded (audit + ledger)', async () => {
    const note = { note_en: 'The 2026 annual refresh, shared with providers for the next intake.', note_ar: 'التحديث السنوي لعام 2026، مشارك مع الجهات المزودة للدفعة القادمة.' };
    await as('k-hr-analyst');
    expect((await b.rpc.releaseRegionalDemand({ forecast_id: 'sf-2026-v1', ...note })).code).toBe('forbidden');
    await as('alnoor-gm');
    expect((await b.rpc.releaseRegionalDemand({ forecast_id: 'sf-2026-v1', ...note })).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.releaseRegionalDemand({ forecast_id: 'sf-2026-v2', ...note })).code).toBe('not_released');
    expect((await b.rpc.releaseRegionalDemand({ forecast_id: 'sf-2026-v1', note_en: 'We need 120 operators by 2030.', note_ar: note.note_ar })).code).toBe('not_clean');
    expect((await b.rpc.releaseRegionalDemand({ forecast_id: 'sf-2025-v1', ...note })).code).toBe('already_current');
    const l0 = raw('ledger_local').length;
    const r = await b.rpc.releaseRegionalDemand({ forecast_id: 'sf-2026-v1', ...note });
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ release_id: 'rdr-2026-1', superseded: 'rdr-2025-1' });
    expect(raw('ledger_local').length).toBe(l0 + 1);
    const f = T.skill_forecasts.find((x) => x.id === 'sf-2026-v1')!;
    expect(raw('regional_demand').filter((x) => x.status === 'current')).toHaveLength(demandRows(f.results, f.scenario, skillArea).length);
    expect(raw('regional_demand').filter((x) => x.release_id === 'rdr-2025-1').every((x) => x.status === 'superseded')).toBe(true);
    await b.reset();
  }, 60000);
});

describe('FS64 · each commitment shows its delivery status (acceptance 2)', () => {
  it('every seeded commitment has a computed status with reasons; the statuses on track, at risk, behind, not started and withdrawn all occur', () => {
    const seen = new Set<string>();
    for (const c of T.provider_commitments) {
      const v = commitmentView(c, today);
      expect(['on_track', 'at_risk', 'behind', 'not_started', 'delivered', 'withdrawn']).toContain(v.status);
      expect(v.reasons.length).toBeGreaterThan(0);
      expect(v.terms).toHaveLength(c.plan.length);
      seen.add(v.status);
    }
    for (const s of ['on_track', 'at_risk', 'behind', 'not_started', 'withdrawn']) expect(seen.has(s)).toBe(true);
    expect(Object.keys(SCHEMA.provider_commitments.cols)).not.toContain('delivery_status');
  });
  it('term rule: 90% filled is on track / delivered, 60% at risk / partly, below that behind / missed; no report is awaiting or not reported', () => {
    expect(termDelivery({ term: '2025S1', seats: 10 }, { enrolled: 9 }, '2026-10-12').status).toBe('delivered');
    expect(termDelivery({ term: '2025S1', seats: 10 }, { enrolled: 6 }, '2026-10-12').status).toBe('partly');
    expect(termDelivery({ term: '2025S1', seats: 10 }, { enrolled: 5 }, '2026-10-12').status).toBe('missed');
    expect(termDelivery({ term: '2025S1', seats: 10 }, undefined, '2026-10-12').status).toBe('not_reported');
    expect(termDelivery({ term: '2026S1', seats: 10 }, undefined, '2026-10-12').status).toBe('awaiting_report');
    expect(termDelivery({ term: '2026S1', seats: 20 }, { enrolled: 11 }, '2026-10-12').status).toBe('behind');
    expect(termDelivery({ term: '2027S1', seats: 20 }, undefined, '2026-10-12').status).toBe('planned');
    expect([termStart('2026S1'), termEnd('2026S1'), termStart('2026S2'), termEnd('2026S2')]).toEqual(['2026-09-01', '2027-01-31', '2027-02-01', '2027-07-31']);
    expect([termState('2026S1', '2026-10-12'), firstOpenTerm('2026-08-15'), firstOpenTerm('2026-07-31')]).toEqual(['current', '2026S1', '2025S2']);
    expect(openTerms('2026-10-12').at(-1)).toBe(LAST_TERM);
  });
  it('coverage: planned seats of active commitments against each area\'s released 2030 gap', () => {
    const cov = coverageByArea(T.regional_demand.filter((d) => d.status === 'current'), T.provider_commitments, today);
    const m = cov.find((x) => x.area === 'maintenance')!;
    expect(m.commitments).toBe(T.provider_commitments.filter((c) => c.area === 'maintenance' && c.status !== 'withdrawn').length);
    expect(m.pct).toBe(Math.round((m.seats * 100) / (m.gap_plan as number)));
    expect(cov.find((x) => x.area === 'radiation_chemistry')!.pct).toBeNull();
  });
});

describe('FS64 · commitments are written only through the RPC and carry an audit row (acceptance 3)', () => {
  it('the table is RPC-only; a direct insert is refused; commitProvision writes the row with an audit row and a ledger row', async () => {
    expect(SCHEMA.provider_commitments.write.mode).toBe('rpc');
    await as('alnoor-gm');
    const direct = await b.insert('provider_commitments' as never, { id: 'pc-x', org_id: 'org-alnoor' } as never).catch(() => ({ ok: false }));
    expect(direct.ok).toBe(false);
    const a0 = audits('commitment.commit').length, l0 = raw('ledger_local').length;
    const r = await b.rpc.commitProvision(cbase);
    expect(r.ok).toBe(true);
    const n = T.provider_commitments.filter((c) => c.org_id === 'org-alnoor').length;
    expect(r.data!.id).toBe(`pc-org-alnoor-${n + 1}`);
    expect(audits('commitment.commit').length).toBe(a0 + 1);
    expect(audits('commitment.commit').at(-1)).toMatchObject({ outcome: 'ok', entity_id: r.data!.id });
    expect(raw('ledger_local').length).toBe(l0 + 1);
    const row = raw('provider_commitments').find((c) => c.id === r.data!.id)!;
    expect(row).toMatchObject({ org_id: 'org-alnoor', hr_status: 'pending', version: 1, status: 'active' });
    await b.reset();
  }, 60000);
  it('refusals are audited: partner users and HR cannot commit; closed terms and unreleased areas are refused', async () => {
    await as('alnoor-qaqc');
    const a0 = audits('commitment.commit').length;
    expect((await b.rpc.commitProvision(cbase)).code).toBe('forbidden');
    expect(audits('commitment.commit').length).toBe(a0 + 1);
    expect(audits('commitment.commit').at(-1)!.outcome).toBe('refused');
    await as('chco');
    expect((await b.rpc.commitProvision(cbase)).code).toBe('forbidden');
    await as('alnoor-gm');
    expect((await b.rpc.commitProvision({ ...cbase, plan: [{ term: '2024S1', seats: 5 }] })).code).toBe('invalid');
    expect((await b.rpc.commitProvision({ ...cbase, area: 'engineering' })).message).toMatch(/current regional release/);
  });
  it('partner isolation: alnoor-gm never sees gulfhydro-qa rows and vice versa; another organisation\'s commitment reads as not found', async () => {
    for (const [p, org] of [['alnoor-gm', 'org-alnoor'], ['gulfhydro-qa', 'org-gulfhydro'], ['alnoor-qaqc', 'org-alnoor'], ['k-university', 'ku']] as const) {
      await as(p);
      for (const t of ['provider_commitments', 'pledges', 'pledge_progress']) {
        const rows = await b.list(t as never) as unknown as Row[];
        expect(rows.length).toBe(T[t].filter((r) => r.org_id === org).length);
        expect(rows.every((r) => r.org_id === org)).toBe(true);
      }
    }
    await as('gulfhydro-qa');
    expect((await b.rpc.commitProvision({ ...cbase, action: 'revise', id: 'pc-org-alnoor-1' })).code).toBe('not_found');
    expect((await b.rpc.reportCommitmentDelivery({ commitment_id: 'pc-org-alnoor-1', term: '2025S2', enrolled: 1, completed: 0 })).code).toBe('not_found');
    expect((await b.rpc.recordPledgeProgress({ pledge_id: 'pl-org-alnoor-1', as_of: today, started: 30, completed: 20 })).code).toBe('not_found');
    for (const p of ['nse', 'training-mgr', 'k-observer']) {
      await as(p);
      expect(await b.list('provider_commitments' as never)).toHaveLength(0);
      expect(await b.list('pledges' as never)).toHaveLength(0);
    }
    for (const p of ['chco', 'k-auditor']) {
      await as(p);
      expect((await b.list('provider_commitments' as never)).length).toBe(T.provider_commitments.length);
    }
  });
  it('revise keeps started terms locked and asks ENEC to review again; withdraw needs a reason and stays listed; HR acknowledges or queries', async () => {
    await as('alnoor-gm');
    const c = T.provider_commitments.find((x) => x.id === 'pc-org-alnoor-1')!;
    const locked = lockedTerms(c.plan, today);
    const lk = await b.rpc.commitProvision({ ...cbase, action: 'revise', id: c.id, plan: [{ term: '2025S2', seats: 14 }] });
    expect(lk.code).toBe('invalid');
    const rv = await b.rpc.commitProvision({ action: 'revise', id: c.id, area: c.area, kind: c.kind, title_en: c.title_en, title_ar: c.title_ar, summary_en: c.summary_en, summary_ar: c.summary_ar,
      skill_ids: c.skill_ids, level: c.level, plan: [...locked, { term: '2027S2', seats: 14 }] });
    expect(rv.ok).toBe(true);
    expect(raw('provider_commitments').find((x) => x.id === c.id)).toMatchObject({ version: 2, hr_status: 'pending' });
    expect((await b.rpc.commitProvision({ ...cbase, action: 'withdraw', id: 'pc-org-alnoor-2', reason: 'x' })).code).toBe('invalid');
    expect((await b.rpc.commitProvision({ ...cbase, action: 'withdraw', id: 'pc-org-alnoor-2', reason: 'Moves to the supplier academy.' })).ok).toBe(true);
    expect(raw('provider_commitments').find((x) => x.id === 'pc-org-alnoor-2')!.status).toBe('withdrawn');
    expect((await b.rpc.reviewCommitment({ commitment_id: c.id, decision: 'acknowledged' })).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.reviewCommitment({ commitment_id: c.id, decision: 'queried' })).code).toBe('invalid');
    expect((await b.rpc.reviewCommitment({ commitment_id: c.id, decision: 'queried', note: 'Please confirm the start date.' })).data).toMatchObject({ hr_status: 'queried' });
    expect((await b.rpc.reviewCommitment({ commitment_id: 'pc-org-alnoor-2', decision: 'acknowledged' })).code).toBe('withdrawn');
    await b.reset();
  }, 60000);
  it('university flows (local backend): k-university commits provision for its own university and reports delivery', async () => {
    await as('k-university');
    const r = await b.rpc.commitProvision({ ...cbase, area: 'digital', title_en: 'Data quality short course', title_ar: 'دورة قصيرة في جودة البيانات' });
    expect(r.ok).toBe(true);
    expect(r.data!.id.startsWith('pc-ku-')).toBe(true);
    const d = await b.rpc.reportCommitmentDelivery({ commitment_id: 'pc-ku-3', term: '2025S2', enrolled: 30, completed: 29 });
    expect(d.ok).toBe(true);
    expect(deliveryProblem({ term: '2030S1', enrolled: 1, completed: 0 }, [{ term: '2030S1', seats: 5 }], today)).toBe('future');
    await b.reset();
  }, 60000);
  it('the commit check refuses every malformed field (same rule as SQL)', () => {
    const areas = [...new Set(T.regional_demand.map((r) => r.area))];
    const ctx = { areas, skills: ctxSkills, today };
    expect(commitmentProblem(cbase, ctx)).toBeNull();
    expect(commitmentProblem({ ...cbase, kind: 'degree' }, ctx)).toBe('kind');
    expect(commitmentProblem({ ...cbase, title_ar: 'English only' }, ctx)).toBe('title');
    expect(commitmentProblem({ ...cbase, skill_ids: ['sk-sa-01'] }, ctx)).toBe('skills');
    expect(commitmentProblem({ ...cbase, level: 7 }, ctx)).toBe('level');
    expect(commitmentProblem({ ...cbase, plan: [{ term: '2031S1', seats: 5 }] }, ctx)).toBe('plan');
    expect(commitmentProblem({ ...cbase, plan: [{ term: '2027S1', seats: 5 }] }, ctx, [{ term: '2025S2', seats: 5 }])).toBe('locked');
  });
});

describe('FS65 · pledged, started and completed never merge into one number (acceptance 1)', () => {
  it('three separate columns and three separate ledger cells; no total anywhere', async () => {
    expect(Object.keys(SCHEMA.pledges.cols)).toContain('people');
    expect(Object.keys(SCHEMA.pledge_progress.cols)).toEqual(expect.arrayContaining(['started', 'completed']));
    for (const t of ['pledges', 'pledge_progress']) expect(Object.keys(SCHEMA[t].cols).some((c) => /total|sum|achieved/.test(c))).toBe(false);
    await as('nse');
    const r = await b.rpc.pledgeLedger();
    expect(r.ok).toBe(true);
    for (const g of [r.data!.totals, ...r.data!.by_area, ...r.data!.by_type, ...r.data!.by_year]) {
      expect(Object.keys(g).sort()).toEqual(['completed', 'key', 'orgs', 'pledged', 'pledges', 'started']);
    }
  });
  it('no code path sums them: no expression in M36 (TS and SQL) adds pledged, started or completed to one another', () => {
    const M = ['pledged', 'started', 'completed', 'people'];
    const files = [...readdirSync('src/modules/m36').filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => `src/modules/m36/${f}`), 'supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql', 'scripts/seed/ext/fs64-regional-plan.mjs'];
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|--|\*)/.test(line)) return;
        for (const seg of line.split(/[;,{}]|=>|\bthen\b|\belse\b/)) {
          if (!/\+/.test(seg)) continue;
          const found = new Set(M.filter((m) => new RegExp(`\\b${m}\\b`).test(seg)));
          if (found.size >= 2) bad.push(`${f}:${i + 1}: ${seg.trim()}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });
});

describe('FS65 · small counts are suppressed (acceptance 2)', () => {
  it('a cell is suppressed under 10 people or under two organisations; pledge counts follow the organisation rule', () => {
    expect([cellOf(0, 3), cellOf(5, 3), cellOf(10, 3), cellOf(40, 1)]).toEqual([{ value: 0, suppressed: false }, { value: null, suppressed: true }, { value: 10, suppressed: false }, { value: null, suppressed: true }]);
    expect([countOf(0, 0), countOf(1, 1), countOf(3, 2)]).toEqual([{ value: 0, suppressed: false }, { value: null, suppressed: true }, { value: 3, suppressed: false }]);
    expect([MIN_GROUP, MIN_ORGS]).toEqual([10, 2]);
  });
  it('the seeded ledger suppresses single-organisation and small cells and shows nothing below 10', () => {
    const l = pledgeLedger({ pledges: T.pledges, progress: T.pledge_progress, orgs: Object.fromEntries(T.pledges.map((p) => [p.org_id, p.org_kind])) }, today);
    const gs = [l.totals, ...l.by_area, ...l.by_type, ...l.by_year];
    expect(gs.some((g) => g.pledged.suppressed)).toBe(true);
    expect(l.by_area.find((g) => g.key === 'advanced_reactor')!.pledged.suppressed).toBe(true);
    for (const g of gs) for (const k of ['pledged', 'started', 'completed'] as const) {
      if (!g[k].suppressed) { expect(g.orgs).toBeGreaterThanOrEqual(2); expect(g[k].value === 0 || (g[k].value as number) >= 10).toBe(true); }
    }
  });
  it('the ledger RPC is open to ecosystem readers only and names no organisation or pledge', async () => {
    for (const p of ['nse', 'alnoor-qaqc', 'k-university', 'chco']) {
      await as(p);
      const r = await b.rpc.pledgeLedger();
      expect(r.ok).toBe(true);
      expect(JSON.stringify(r.data)).not.toMatch(/org-|"ku"|pl-/);
    }
    for (const p of ['k-observer', 'k-student']) { await as(p); expect((await b.rpc.pledgeLedger()).code).toBe('forbidden'); }
    await as(null);
    expect((await b.rpc.pledgeLedger()).code).toBe('not_signed_in');
  });
});

describe('FS65 · each pledge names its organisation, skill area and date (acceptance 3)', () => {
  it('every seeded pledge names its organisation (EN/AR), a skill area and a target date and passes the register check', () => {
    expect(T.pledges.length).toBe(16);
    for (const p of T.pledges) {
      expect(p.org_id && p.org_name_en && /[؀-ۿ]/.test(p.org_name_ar)).toBeTruthy();
      expect(PLEDGE_AREAS as readonly string[]).toContain(p.area);
      expect(p.target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(pledgeProblem(p as never, p.pledged_on)).toBeNull();
    }
  });
  it('registerPledge: partner admins for their own organisation, HR for ENEC entities only; a pledge without area or date is refused (audit + ledger)', async () => {
    const pin = { area: 'quality', people: 20, target_date: '2028-06-30', title_en: 'Inspection skills for machinists', title_ar: 'مهارات الفحص للعاملين في التشغيل' };
    await as('alnoor-gm');
    const l0 = raw('ledger_local').length;
    const r = await b.rpc.registerPledge(pin);
    expect(r.ok).toBe(true);
    expect(raw('pledges').find((p) => p.id === r.data!.id)).toMatchObject({ org_id: 'org-alnoor', area: 'quality', target_date: '2028-06-30', pledged_on: today });
    expect(raw('ledger_local').length).toBe(l0 + 1);
    expect((await b.rpc.registerPledge({ ...pin, org_id: 'org-gulfhydro' })).code).toBe('org');
    expect((await b.rpc.registerPledge({ ...pin, area: '' })).message).toMatch(/skill area/);
    expect((await b.rpc.registerPledge({ ...pin, target_date: '' })).message).toMatch(/target date/);
    await as('chco');
    expect((await b.rpc.registerPledge({ ...pin, org_id: 'enec-ops' })).ok).toBe(true);
    expect((await b.rpc.registerPledge({ ...pin, org_id: 'org-alnoor' })).code).toBe('org');
    for (const p of ['nse', 'alnoor-qaqc']) { await as(p); expect((await b.rpc.registerPledge(pin)).code).toBe('forbidden'); }
    await b.reset();
  }, 60000);
  it('progress: dated, cumulative and never decreasing; status met / lapsed / not started / in progress', async () => {
    await as('alnoor-gm');
    expect((await b.rpc.recordPledgeProgress({ pledge_id: 'pl-org-alnoor-1', as_of: today, started: 14, completed: 9 })).message).toMatch(/go down/);
    const ok = await b.rpc.recordPledgeProgress({ pledge_id: 'pl-org-alnoor-1', as_of: today, started: 18, completed: 11 });
    expect(ok.ok).toBe(true);
    expect(progressProblem({ as_of: '2026-05-01', started: 3, completed: 4 }, { pledged_on: '2026-01-01' }, null, today)).toBe('numbers');
    const st = (id: string) => { const p = T.pledges.find((x) => x.id === id)!; return pledgeStatus(p, latestProgress(T.pledge_progress, id, today), today); };
    expect([st('pl-org-gulfhydro-2'), st('pl-org-tarsus-1'), st('pl-org-liwa-1'), st('pl-enec-ops-2')]).toEqual(['met', 'lapsed', 'not_started', 'in_progress']);
    await b.reset();
  }, 60000);
});

describe('FS64 / FS65 · routes, RBAC, benchmarks and i18n', () => {
  it('six M36 routes with the ecosystem guards; every route title in EN and AR; benchmarks from the cards', () => {
    expect(routes.map((r) => r.id)).toEqual(['ecosystem-regional-plan', 'ecosystem-commitments', 'ecosystem-commitment', 'ecosystem-demand-release', 'ecosystem-pledges', 'ecosystem-pledges-register']);
    for (const r of routes) {
      expect((en.routes as Record<string, { title: string }>)[r.id].title).toBeTruthy();
      expect((ar.routes as Record<string, { title: string }>)[r.id].title).toMatch(/[؀-ۿ]/);
      expect(r.guard.signedIn).toBe(true);
    }
    expect(FEATURE_BENCHMARKS.FS64).toEqual(['FORECAST', 'EU-PACT']);
    expect(FEATURE_BENCHMARKS.FS65).toEqual(['EU-PACT', 'ENERGY-JOBS']);
    expect([...grantsFor(['partner_user'], 'ecosystem')]).toEqual(expect.arrayContaining(['R', 'OwnOrg']));
    expect(grantsFor(['partner_user'], 'ecosystem').has('OrgW')).toBe(false);
  });
  it('synthetic only: commitments and pledges are SAMPLE rows; the two new providers are synthetic and not publicly listed', () => {
    expect(T.provider_commitments.every((c) => c.sample) && T.pledges.every((p) => p.sample)).toBe(true);
    for (const id of ['org-dhafra-tech', 'org-ruwais-vti']) expect(T.organisations.find((o) => o.id === id)).toMatchObject({ synthetic: true, public_listed: false, category: 'synthetic' });
  });
});
