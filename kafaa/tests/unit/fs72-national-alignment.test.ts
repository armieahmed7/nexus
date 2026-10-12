/** FS62 national-strategy alignment layer + FS63 MoHRE occupation and skill-level mapping (FS wave G · E2, M37): one named test per
 *  acceptance criterion on the local path, plus the shared rules, the FS02/FS41/FS09 wiring, RBAC, refusals, audit and ledger, the seed,
 *  routes and i18n. The SQL path (kafaa_na_* / kafaa_ro_* = national.ts / occupations.ts, the seven RPCs, RLS, guards, grants, seed rows)
 *  is proved by scripts/validate/fs72-national-alignment.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { publicTextIsClean } from '../../src/domain/future';
import { MATRIX } from '../../src/auth/policy';
import en from '../../src/i18n/m37.en.json';
import ar from '../../src/i18n/m37.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m37/routes';
import {
  JAHIZ_GROUPS, STRATEGIES, effectiveLinks, linkProblem, nationalReport, reportCsv, sourceTier, tagProblem, tagSourceView, typedTotalFree, worldFrom,
  type LinkRow, type NationalReport, type TagRow,
} from '../../src/modules/m37/national';
import { codeProblem, codeView, indicativeLevel, occupationProblem, occupationTrend, type OccupationRow } from '../../src/modules/m37/occupations';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const tags = T.national_tags as unknown as TagRow[];
const links = T.tag_links as unknown as LinkRow[];
const occ = T.role_occupations as unknown as OccupationRow[];
const pack = readFileSync('../docs/kafaa/ref/research/national_systems.md', 'utf8');
const W = worldFrom((n) => T[n] ?? []);
const TODAY = '2026-10-12';

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]);
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

describe('FS62 · every tag cites an official source (acceptance 1; settled decision: the most official URL in the pack, secondary ones flagged)', () => {
  it('every tag cites one to five sources from the research pack, each https with an as-of date and a stored tier equal to sourceTier', () => {
    for (const t of tags) {
      expect(t.sources.length).toBeGreaterThanOrEqual(1);
      for (const s of t.sources) {
        expect(s.url).toMatch(/^https:\/\//);
        expect(pack.includes(s.url), `${t.id} ${s.url}`).toBe(true);
        expect(s.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.tier).toBe(sourceTier(s.url));
      }
    }
  });
  it('the primary source is the most official one; tags whose best source is secondary or indirect are flagged and say why in EN and AR', () => {
    const flagged = tags.filter((t) => tagSourceView(t.sources, t.source_scope)!.flagged);
    expect(flagged.map((t) => t.id).sort()).toEqual(['nt-centennial-2071', 'nt-net-zero-2050', 'nt-we-uae-2031', 'nt-we-uae-2031-economy', 'nt-we-uae-2031-society']);
    for (const t of flagged) { expect(t.source_note_en).toBeTruthy(); expect(t.source_note_ar).toMatch(/[؀-ۿ]/); }
    for (const t of tags.filter((x) => !flagged.includes(x))) expect(tagSourceView(t.sources, t.source_scope)!.primary.tier).toBe('official');
    const ai = tags.find((t) => t.id === 'nt-ai-2031')!;
    expect(ai.sources[0].tier).toBe('secondary');
    expect(tagSourceView(ai.sources, ai.source_scope)!.primary.url).toBe('https://dge.gov.ae/en/what-we-do');
  });
  it('sourceTier: UAE government domains are official, UN/OECD bodies intergovernmental, press and look-alike domains secondary', () => {
    expect(sourceTier('https://u.ae/about-the-uae')).toBe('official');
    expect(sourceTier('https://www.wam.ae/en/article/x')).toBe('official');
    expect(sourceTier('https://www.fahr.gov.ae/en/news')).toBe('official');
    expect(sourceTier('https://andp.unescwa.org/plans/1491')).toBe('intergovernmental');
    expect(sourceTier('https://www.khaleejtimes.com/x')).toBe('secondary');
    expect(sourceTier('https://u.ae.example.com/x')).toBe('secondary');
    expect(sourceTier('http://u.ae/x')).toBe('secondary');
  });
  it('a tag without a source, with a non-https link or a future as-of date is refused', () => {
    const t = tags[0];
    expect(tagProblem(t, { tags, today: TODAY })).toBeNull();
    expect(tagProblem({ ...t, sources: [] }, { tags, today: TODAY })).toBe('sources');
    expect(tagProblem({ ...t, sources: [{ label: 'x x x', url: 'http://u.ae', as_of: '2026-10-10' }] }, { tags, today: TODAY })).toBe('sources');
    expect(tagProblem({ ...t, sources: [{ ...t.sources[0], as_of: '2099-01-01' }] }, { tags, today: TODAY })).toBe('sources');
  });
});

describe('FS62 · reports are filters over data, with no typed totals (acceptance 2)', () => {
  it('no M37 table stores a total, count or measure; tag and link text name years only (typedTotalFree)', () => {
    for (const t of ['national_tags', 'tag_links', 'role_occupations']) {
      const nums = Object.entries(SCHEMA[t].cols).filter(([, d]) => /^(int|num)/.test(d)).map(([k]) => k);
      expect(nums.every((k) => ['horizon_year', 'sort', 'version', 'skill_level'].includes(k)), `${t}: ${nums}`).toBe(true);
    }
    expect(typedTotalFree(tags.flatMap((t) => [t.name_en, t.name_ar, t.summary_en, t.summary_ar, t.owner_en, t.owner_ar, t.source_note_en, t.source_note_ar]))).toBe(true);
    expect(typedTotalFree(links.flatMap((l) => [l.note_en, l.note_ar]))).toBe(true);
    expect(typedTotalFree(['Reaches 610,000 by 2031'])).toBe(false);
    expect(typedTotalFree(['UAE Centennial 2071', 'مهارات 10X'])).toBe(true);
    expect(tagProblem({ ...tags[0], summary_en: 'A national target of 610,000 workers by 2031 in total.' }, { tags, today: TODAY })).not.toBeNull();
  });
  it('the report is recomputed from the data: a skill moved to another Jahiz group, an unlinked row and a retired pillar change it at once', () => {
    const before = nationalReport(W, {}, true);
    const skills = W.skills.map((s) => (s.id === 'sk-fs-tr-analytical' ? { ...s, future_group: 'digital' } : s));
    const tg = W.tags.map((t) => (t.id === 'nt-we-uae-2031-economy' ? { ...t, status: 'retired' } : t));
    const lk = W.links.map((l) => (l.id === links[0].id ? { ...l, active: false } : l));
    const after = nationalReport({ ...W, skills, tags: tg, links: lk }, {}, true);
    const n = (r: NationalReport, id: string) => r.tags.find((x) => x.tag_id === id)!.skills;
    expect(n(after, 'nt-jahiz-digital')).toBe(n(before, 'nt-jahiz-digital') + 1);
    expect(n(after, 'nt-jahiz-10x')).toBe(n(before, 'nt-jahiz-10x') - 1);
    expect(after.tags.some((x) => x.tag_id === 'nt-we-uae-2031-economy')).toBe(false);
    expect(after.items.some((i) => i.link_id === links[0].id)).toBe(false);
  });
  it('the local RPC returns exactly the rule over the live tables; counts are distinct linked items and people counts under 10 are suppressed', async () => {
    await as('k-hr-analyst');
    const r = (await b.rpc.nationalReport({ strategy: 'net_zero_2050' }))!;
    expect(r).toEqual(nationalReport(worldFrom(raw), { strategy: 'net_zero_2050' }, true));
    const s = r.tags.find((x) => x.tag_id === 'nt-net-zero-2050')!;
    expect(s.skills).toBe(new Set(r.items.filter((i) => i.kind === 'skill').map((i) => i.target_id)).size);
    expect(r.items.every((i) => !i.measure || i.measure.n === null || i.measure.n >= 10)).toBe(true);
    expect(r.items.every((i) => !i.measure || i.measure.base === null || i.measure.base >= 10)).toBe(true);
    expect(r.tags.every((x) => x.reach === null || x.reach >= 10)).toBe(true);
  });
  it('the CSV export is the filtered report row for row, with suppressed counts written as "suppressed"', () => {
    const r = nationalReport(W, { strategy: 'ai_2031' }, true);
    const csv = reportCsv(r, 'en', (id) => id).split('\n');
    expect(csv.length).toBe(r.items.length + 1);
    expect(csv[0]).toContain('measure');
    expect(reportCsv(nationalReport(W, { strategy: 'ai_2031' }, false), 'en', (id) => id).split('\n')[0]).not.toContain('measure');
  });
});

describe('FS62 · every tag exists in EN and AR (acceptance 3)', () => {
  it('every tag name and summary and every link note is present in English and Arabic', () => {
    for (const t of tags) {
      expect(t.name_en.length).toBeGreaterThan(1); expect(t.summary_en.length).toBeGreaterThan(19);
      expect(t.name_ar).toMatch(/[؀-ۿ]/); expect(t.summary_ar).toMatch(/[؀-ۿ]/);
    }
    for (const l of links) { expect(l.note_en.length).toBeGreaterThan(9); expect(l.note_ar).toMatch(/[؀-ۿ]/); }
  });
  it('the save check refuses a tag missing its Arabic name or summary', () => {
    expect(tagProblem({ ...tags[2], name_ar: '' }, { tags, today: TODAY })).toBe('name');
    expect(tagProblem({ ...tags[2], summary_ar: 'قصير' }, { tags, today: TODAY })).toBe('summary');
  });
  it('the M37 strings are in parity in EN and AR (strategies, kinds, tiers, reasons, problems)', () => {
    const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(ar).sort()).toEqual(keys(en).sort());
    for (const s of STRATEGIES) expect((en as Row).strategy[s]).toBeTruthy();
    expect(publicTextIsClean([en, ar])).toBe(true);
  });
});

describe('FS62 · the six strategies, tags on skills, programmes and targets, and the FS02 / FS41 / FS09 wiring', () => {
  it('the six strategies of the card are tagged, with pillars, goals and the four Jahiz groups', () => {
    expect(new Set(tags.filter((t) => t.kind === 'strategy').map((t) => t.strategy))).toEqual(new Set(STRATEGIES));
    expect(tags.filter((t) => t.strategy === 'jahiz' && t.kind === 'group').map((t) => t.future_group).sort()).toEqual([...JAHIZ_GROUPS].sort());
    expect(tags.filter((t) => t.strategy === 'we_uae_2031' && t.kind === 'pillar').length).toBe(2);
  });
  it('FS02: Jahiz-group links come from skills.future_group (never stored); nuclear excellence is not a national tag', () => {
    const eff = effectiveLinks(W);
    const fg = eff.filter((l) => l.basis === 'future_group');
    expect(fg.length).toBe(T.skills.filter((s) => (JAHIZ_GROUPS as readonly string[]).includes(s.future_group) && s.lifecycle !== 'obsolete').length);
    expect(fg.every((l) => l.link_id === null)).toBe(true);
    expect(links.some((l) => l.target_table === 'skills' && tags.find((t) => t.id === l.tag_id)?.derive === 'future_group')).toBe(false);
    expect(eff.some((l) => T.skills.find((s) => s.id === l.target_id)?.future_group === 'nuclear_excellence' && l.basis === 'future_group')).toBe(false);
  });
  it('FS41: the twelve Net Zero competences link to UAE Net Zero 2050 from the data; FS09/FS36: the AI fluency target links to the AI strategy', () => {
    const eff = effectiveLinks(W);
    expect(eff.filter((l) => l.basis === 'net_zero' && l.tag_id === 'nt-net-zero-2050').length).toBe(T.cec_competences.filter((c) => c.net_zero).length);
    expect(eff.some((l) => l.tag_id === 'nt-ai-2031' && l.target_table === 'ai_org_targets' && l.target_id === 'aot-practitioner-2027')).toBe(true);
    const kinds = new Set(eff.map((l) => l.target_table));
    for (const t of ['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets']) expect(kinds.has(t), t).toBe(true);
  });
  it('MC-H2-HEAT stays a draft and is not tagged (settled decision); ADVANCE/SMR notes say "no deployment decision implied"', () => {
    expect(links.some((l) => l.target_id.includes('h2-heat'))).toBe(false);
    for (const l of links.filter((x) => /smr|adv-/.test(x.target_id))) expect(l.note_en).toMatch(/no deployment decision implied/);
  });
  it('linkProblem refuses derived links, security skills, missing notes and typed numbers', () => {
    const jz = tags.find((t) => t.id === 'nt-jahiz-digital')!;
    const base = { tag_id: 'nt-nes-2031', target_table: 'skills', target_id: 'sk-fs-ai-use', active: true, note_en: 'A note long enough.', note_ar: 'ملاحظة طويلة بما يكفي.' };
    expect(linkProblem(base, tags[0], { exists: true, area: 'digital' })).toBeNull();
    expect(linkProblem({ ...base, tag_id: jz.id }, jz, { exists: true, area: 'digital' })).toBe('derived');
    expect(linkProblem(base, tags[0], { exists: true, area: 'security' })).toBe('security');
    expect(linkProblem({ ...base, note_ar: '' }, tags[0], { exists: true })).toBe('note');
    expect(linkProblem({ ...base, note_en: 'Covers 40 roles in total.' }, tags[0], { exists: true })).toBe('typed_total');
    expect(linkProblem({ ...base, target_table: 'people' }, tags[0], { exists: true })).toBe('table');
  });
});

describe('FS62 · RBAC: national_alignment R for staff; W for the HR director and admins; measures for Agg/W/A', () => {
  it('the policy matrix and the routes follow the card', () => {
    expect(MATRIX.national_alignment.hr_director).toEqual(['R', 'W']);
    expect(MATRIX.national_alignment.admin).toEqual(['R', 'W', 'A']);
    expect(MATRIX.national_alignment.public).toBeUndefined();
    expect(routes.find((r) => r.id === 'national-alignment')!.guard.grant).toEqual({ res: 'national_alignment', levels: ['R', 'Agg', 'W', 'A'] });
    expect(routes.find((r) => r.id === 'admin-national-tags')!.guard.grant).toEqual({ res: 'national_alignment', levels: ['W', 'A'] });
  });
  it('staff read the report without measures; HR gets measures; partners, observers and anonymous get nothing', async () => {
    await as('sro');
    const staff = (await b.rpc.nationalReport({}))!;
    expect(staff.measures).toBe(false);
    expect(staff.items.every((i) => i.measure === null)).toBe(true);
    await as('chco');
    expect((await b.rpc.nationalReport({}))!.measures).toBe(true);
    for (const p of ['alnoor-gm', 'k-observer', null]) { await as(p); expect(await b.rpc.nationalReport({})).toBeNull(); }
  });
  it('saveNationalTag: staff refused (audited); the HR director adds a goal (ledger); a second strategy-level tag and duplicate codes refused', async () => {
    const input = { strategy: 'nes_2031', kind: 'goal', parent_id: 'nt-nes-2031', code: 'NES-DIGITAL', name_en: 'Digital skills for the workforce', name_ar: 'المهارات الرقمية للقوى العاملة',
      summary_en: 'A goal added to show how a new goal is tagged and reported.', summary_ar: 'هدف أُضيف لبيان كيفية وسم هدف جديد والإبلاغ عنه.', sources: [{ label: 'u.ae NES page', url: 'https://u.ae/about-the-uae', as_of: '2026-10-10' }] };
    await as('sro');
    const a0 = raw('audit_events').length;
    expect((await b.rpc.saveNationalTag(input)).code).toBe('forbidden');
    expect(raw('audit_events').length).toBe(a0 + 1);
    await as('chco');
    const l0 = raw('ledger_local').length;
    const ok = await b.rpc.saveNationalTag(input);
    expect(ok.ok).toBe(true);
    expect(raw('ledger_local').length).toBe(l0 + 1);
    expect((b.rawGet('national_tags' as never, 'nt-nes-digital') as unknown as TagRow).sources[0].tier).toBe('official');
    expect((await b.rpc.saveNationalTag(input)).code).toBe('code_taken');
    expect((await b.rpc.saveNationalTag({ ...input, kind: 'strategy', parent_id: null, code: 'NES-AGAIN' })).code).toBe('conflict');
    expect((await b.rpc.saveNationalTag({ ...input, code: 'NES-TYPED', summary_en: 'A goal reaching 610,000 by 2031 across sectors.' })).message).toMatch(/typed number/);
  });
  it('setTagLink links and unlinks (the row is deactivated and kept); derived links are refused', async () => {
    await as('k-admin');
    const ok = await b.rpc.setTagLink({ tag_id: 'nt-nes-2031-skills', target_table: 'skills', target_id: 'sk-fs-dp-robotics', active: true, note_en: 'Robotics is a labour-market skill.', note_ar: 'الروبوتات مهارة مطلوبة في سوق العمل.' });
    expect(ok.ok).toBe(true);
    const off = await b.rpc.setTagLink({ tag_id: 'nt-nes-2031-skills', target_table: 'skills', target_id: 'sk-fs-dp-robotics', active: false, note_en: '', note_ar: '' });
    expect(off.data!.active).toBe(false);
    const row = b.rawGet('tag_links' as never, 'tl:nt-nes-2031-skills:skills:sk-fs-dp-robotics') as unknown as LinkRow;
    expect(row.active).toBe(false); expect(row.note_en).toMatch(/Robotics/);
    const derived = await b.rpc.setTagLink({ tag_id: 'nt-jahiz-digital', target_table: 'skills', target_id: 'sk-fs-ai-use', active: true, note_en: 'Should be refused here.', note_ar: 'يجب رفضه هنا لأنه مشتق.' });
    expect(derived.code).toBe('invalid');
    expect(derived.message).toMatch(/derived/);
  });
});

describe('FS63 · no code is shown unless verified from the source (acceptance 1)', () => {
  it('the 28 current roles are mapped and every code reads "code pending review" (the research pack verifies none)', () => {
    expect(occ.length).toBe(28);
    expect(occ.every((o) => o.code_status === 'pending_review' && o.mohre_code === null)).toBe(true);
    expect(occ.every((o) => codeView(o).shown === null && codeView(o).pending)).toBe(true);
    expect(occ.some((o) => T.job_roles.find((r) => r.id === o.role_id)?.lifecycle === 'concept')).toBe(false);
  });
  it('codeView shows a code only with status verified and an https source; codeProblem accepts only official UAE government pages', () => {
    expect(codeView({ mohre_code: '1234', code_status: 'pending_review', code_source: null, verified_on: null }).shown).toBeNull();
    expect(codeView({ mohre_code: '1234', code_status: 'verified', code_source: { label: 'x', url: 'https://www.mohre.gov.ae', as_of: '2026-10-10' }, verified_on: '2026-10-12' }).shown).toBe('1234');
    const c = { role_id: 'reactor-operator', code: '3131.1', source_label: 'MoHRE classification', source_url: 'https://www.mohre.gov.ae/en/x', source_as_of: '2026-10-10' };
    expect(codeProblem(c, TODAY)).toBeNull();
    expect(codeProblem({ ...c, source_url: 'https://www.khaleejtimes.com/uae/government/uae-ministry-launches-new-job-classification-scheme' }, TODAY)).toBe('host');
    expect(codeProblem({ ...c, source_url: 'https://mohre.gov.ae.example.com' }, TODAY)).toBe('host');
    expect(codeProblem({ ...c, source_as_of: '2099-01-01' }, TODAY)).toBe('date');
  });
  it('verifyOccupationCode: the HR director cannot verify; a press page never verifies; an admin verifies (ledger); the last editor cannot (maker-checker); clearing returns "pending"', async () => {
    const code = { role_id: 'reactor-operator', code: '3131.1', source_label: 'MoHRE classification (test)', source_url: 'https://www.mohre.gov.ae/en/test', source_as_of: '2026-10-10' };
    await as('chco');
    expect((await b.rpc.verifyOccupationCode(code)).code).toBe('forbidden');
    await as('ai-governance');
    expect((await b.rpc.verifyOccupationCode({ ...code, source_url: 'https://gulfnews.com/x' })).message).toMatch(/official UAE government/);
    const l0 = raw('ledger_local').length;
    expect((await b.rpc.verifyOccupationCode(code)).ok).toBe(true);
    expect(raw('ledger_local').length).toBe(l0 + 1);
    const row = b.rawGet('role_occupations' as never, 'ro-reactor-operator') as unknown as OccupationRow;
    expect(codeView(row).shown).toBe('3131.1');
    expect((await b.rpc.saveRoleOccupation({ role_id: 'local-operator', label_en: 'Power plant field operator', label_ar: 'مشغّل ميداني في محطة طاقة', skill_level: 3, level_basis: 'education_rule' })).ok).toBe(true);
    expect((await b.rpc.verifyOccupationCode({ ...code, role_id: 'local-operator' })).code).toBe('maker_checker');
    await as('k-admin');
    expect((await b.rpc.clearOccupationCode('reactor-operator', 'short')).code).toBe('invalid');
    expect((await b.rpc.clearOccupationCode('reactor-operator', 'Source page withdrawn; re-check needed.')).ok).toBe(true);
    expect(codeView(b.rawGet('role_occupations' as never, 'ro-reactor-operator') as unknown as OccupationRow).shown).toBeNull();
  });
});

describe('FS63 · Kafa\'a states it is not a MoHRE system (acceptance 2)', () => {
  it('the statement is in both languages and the mapping page and RPC docs carry it', () => {
    expect((en as Row).ro.notMohre.title).toMatch(/not a MoHRE system/);
    expect((ar as Row).ro.notMohre.title).toMatch(/ليست نظاماً/);
    expect((en as Row).ro.notMohre.body).toMatch(/does not issue, validate or submit/);
    expect(readFileSync('src/modules/m37/NationalOccupationsPage.tsx', 'utf8')).toContain('<NotMohreCallout />');
  });
  it('concept roles get no mapping and labels carry no numbers; the indicative level follows the education rule unless reviewed with a rationale', () => {
    const concept = T.job_roles.find((r) => r.lifecycle === 'concept')!;
    const o = occ[0];
    const role = T.job_roles.find((r) => r.id === o.role_id)!;
    expect(occupationProblem({ ...o, role_id: concept.id }, concept as never)).toBe('concept');
    expect(occupationProblem({ ...o, label_en: 'Operator 3' }, role as never)).toBe('clean');
    expect(occupationProblem({ ...o, skill_level: 5 }, role as never)).toBe('basis');
    expect(occupationProblem({ ...o, skill_level: 2, level_basis: 'reviewed', rationale_en: 'Reviewed against the classification.', rationale_ar: 'تمت مراجعته مقابل التصنيف المعتمد.' }, role as never)).toBeNull();
    for (const x of occ) expect(x.skill_level).toBe(indicativeLevel(T.job_roles.find((r) => r.id === x.role_id)!.education));
  });
});

describe('FS63 · the uplift trend is labelled SIMULATED and suppressed under 10 (acceptance 3)', () => {
  it('occupationTrend is SIMULATED, every count under 10 is suppressed and a year under 10 people shows nothing', () => {
    const tr = occupationTrend(T.people as never, occ, TODAY);
    expect(tr.simulated).toBe(true);
    for (const y of tr.years) {
      expect(y.total === null || y.total >= 10).toBe(true);
      for (const l of y.levels) expect(l.n === null || l.n >= 10).toBe(true);
      if (y.total === null) expect([y.upper_pct, y.mean]).toEqual([null, null]);
    }
    expect(tr.years.some((y) => y.levels.some((l) => l.n === null))).toBe(true);
    const tiny = occupationTrend((T.people as Row[]).slice(0, 30) as never, occ, TODAY);
    expect(tiny.years.every((y) => y.total === null || y.total >= 10)).toBe(true);
  });
  it('the trend RPC is for HR and admins only (Agg/W/A) and equals the rule; staff get null', async () => {
    await as('sro');
    expect(await b.rpc.occupationTrend()).toBeNull();
    await as('k-hr-analyst');
    expect(await b.rpc.occupationTrend()).toEqual(occupationTrend(raw('people') as never, raw('role_occupations') as never, new Date().toISOString().slice(0, 10)));
    expect((en as Row).ro.trendNote).toMatch(/^SIMULATED/);
  });
});

describe('M37 · routes, benchmarks and seed', () => {
  it('five routes with i18n titles; the tag route has a smoke param; every page renders the feature chips', () => {
    expect(routes.map((r) => r.id).sort()).toEqual(['admin-national-tags', 'national-alignment', 'national-alignment-tag', 'national-occupations', 'national-report']);
    for (const r of routes) { expect((en as Row).routes[r.id].title).toBeTruthy(); expect((ar as Row).routes[r.id].title).toMatch(/[؀-ۿ]/); }
    expect(JSON.parse(readFileSync('src/modules/m37/smoke.json', 'utf8'))['national-alignment-tag'].tagId).toBe('nt-ai-2031');
    expect(FEATURE_BENCHMARKS.FS62).toEqual(['JAHIZ', 'UAE-AI', 'NAFIS']);
    expect(FEATURE_BENCHMARKS.FS63).toEqual(['MOHRE', 'ESCO']);
    for (const f of ['NationalAlignmentPage', 'NationalTagPage', 'NationalReportPage', 'AdminNationalTagsPage']) expect(readFileSync(`src/modules/m37/${f}.tsx`, 'utf8')).toContain('<BenchmarkChips feature="FS62" />');
    expect(readFileSync('src/modules/m37/NationalOccupationsPage.tsx', 'utf8')).toContain('<BenchmarkChips feature="FS63" />');
  });
  it('no ranking function lives in M37 (filters, not rankings: no engine card needed for the FS55 lint)', () => {
    for (const f of ['national.ts', 'occupations.ts']) expect(readFileSync(`src/modules/m37/${f}`, 'utf8')).not.toMatch(/export function (rank|match|suggest|recommend)/);
  });
});
