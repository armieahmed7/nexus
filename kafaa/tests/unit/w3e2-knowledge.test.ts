/** F20 Knowledge loss risk assessment and F21 Knowledge capture studio (W3 · E2, M24): every acceptance criterion on the local
 *  path, the rules shared with SQL, the seed and i18n. The SQL path is checked by scripts/validate/w3e2-knowledge.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SearchIndex } from '../../src/domain/search';
import { hasKey } from '../../src/i18n';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import { SCHEMA } from '../../src/data/schema';
import { bandOf, computeHeatmap, mitigationState, proposeFactors, quarterEndIso, quarterOfIso, validThresholds, positionOf, DEPARTMENTS } from '../../src/modules/m24/klra';
import { reviewState, assetText, TEMPLATE_IDS, TEMPLATES } from '../../src/modules/m24/capture';
import { enrich, rake, tfidf } from '../../src/modules/m24/enrich';
import { kbDocs, searchKb, type AssetLite } from '../../src/modules/m24/kb';
import { postGuard, POST_FLOOR } from '../../src/modules/m22/domain';
import { routes } from '../../src/modules/m24/routes';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const lastAudit = () => [...b.raw('audit_events')].sort((x, y) => x.seq - y.seq).pop()!;
const today = new Date().toISOString().slice(0, 10);
const Q = quarterOfIso(today);
const TH = { high: 16, medium: 8 };
const AGE = /birth|"age"|_age"|\bdob\b|date_of_birth|retire_on|retirement_date/i;

describe('F20 · totals, factors and bands (acceptance: total = attrition x position for every row)', () => {
  it('every seeded assessment total equals attrition x position, and the proposal is the deterministic rule', () => {
    expect(T.klra_assessments.length).toBeGreaterThan(200);
    for (const a of T.klra_assessments) expect(a.total, a.id).toBe(a.attrition_factor * a.position_factor);
    for (const a of T.klra_assessments.filter((x) => !x.adjusted)) {
      const pos = T.klra_positions.find((p) => p.id === a.position_id);
      expect([a.attrition_factor, a.position_factor], a.id).toEqual([a.proposed_attrition, a.proposed_position]);
      expect(a.drivers.retire).toBe(proposeFactors(pos, a.drivers.assets).drivers.retire);
    }
    expect(T.klra_assessments.filter((x) => x.adjusted).every((x) => (x.note ?? '').length >= 10 && x.reasons.at(-1).code === 'adjusted')).toBe(true);
  });
  it('the factor scales follow the IAEA KLRM bands', () => {
    const base = { id: 'x', department: 'operations', retirement_band: 'na', contract_kind: 'permanent', contract_end_band: 'none', criticality: 'general', spof_skill_ids: [], codified_base: 90, replace_months: 3 };
    expect(proposeFactors(base).attrition).toBe(1);
    expect(proposeFactors({ ...base, retirement_band: 'within_2' }).attrition).toBe(5);
    expect(proposeFactors({ ...base, contract_kind: 'ossa', contract_end_band: '2_5' }).attrition).toBe(4);
    expect(proposeFactors({ ...base, contract_kind: 'fixed_term', contract_end_band: '1_2' }).attrition).toBe(4);
    expect(proposeFactors(base).position).toBe(1);
    const top = proposeFactors({ ...base, criticality: 'critical', spof_skill_ids: ['a', 'b'], codified_base: 0, replace_months: 72, retirement_band: 'within_2' });
    expect([top.attrition, top.position, top.total]).toEqual([5, 5, 25]);
    expect(positionOf(3, 3, 3, 3)).toBe(3);
    // codification loop: published assets raise the codified share and can lower the position factor
    const p = { ...base, criticality: 'critical', spof_skill_ids: ['a'], codified_base: 10, replace_months: 48 };
    expect(proposeFactors(p, 3).drivers.codified_pct).toBe(55);
    expect(proposeFactors(p, 3).position).toBeLessThanOrEqual(proposeFactors(p, 0).position);
    expect(proposeFactors(p, 3).reasons.some((r) => r.code === 'assets')).toBe(true);
  });
  it('every reason key exists in both languages', () => {
    const codes = new Set(T.klra_assessments.flatMap((a) => a.reasons.map((r: { key: string }) => r.key)));
    for (const k of codes) expect(hasKey(k), k).toBe(true);
  });
  it('bands follow the thresholds; thresholds are validated', () => {
    expect(bandOf(16, TH)).toBe('high');
    expect(bandOf(15, TH)).toBe('medium');
    expect(bandOf(7, TH)).toBe('low');
    expect(validThresholds(16, 8)).toBe(true);
    expect(validThresholds(8, 8)).toBe(false);
    expect(validThresholds(26, 8)).toBe(false);
    expect(validThresholds(10, 1)).toBe(false);
  });
});

describe('F20 · RBAC: KLRA rows are never staff-wide', () => {
  it('table reads: employees, HR and auditors see no KLRA row; a department head only their scope', async () => {
    for (const p of ['k-ro', 'chco', 'k-hr-analyst', 'k-auditor', 'qc-inspector']) {
      await as(p);
      for (const tb of ['klra_positions', 'klra_assessments', 'klra_actions', 'klra_settings'] as const) expect((await b.list(tb)).length, `${p}/${tb}`).toBe(0);
    }
    await as('sro');
    const crewB = new Set(T.people.filter((p) => p.crew === 'B').map((p) => p.id));
    const rows = await b.list('klra_positions');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => crewB.has(r.person_id!))).toBe(true);
    expect(SCHEMA.klra_assessments.read.every((r) => r.where === 'open_read')).toBe(true);
  });
  it('register: KM owner all, department head scope, HR aggregates only, employees nothing', async () => {
    await as('training-mgr');
    const all = await b.rpc.klraRegister();
    expect(all.mode).toBe('all');
    expect(all.rows.length + all.pending.length).toBe(T.klra_positions.length);
    await as('ops-ceo');
    const ops = await b.rpc.klraRegister();
    expect(ops.mode).toBe('scope');
    expect(ops.rows.some((r) => r.position.kind === 'ossa')).toBe(true);
    expect(ops.rows.length).toBeLessThan(all.rows.length);
    await as('chco');
    const hr = await b.rpc.klraRegister();
    expect([hr.mode, hr.rows.length]).toEqual(['agg', 0]);
    expect(await b.rpc.klraPosition('pos-w-sro-02')).toBeNull();
    await as('k-ro');
    expect((await b.rpc.klraRegister()).mode).toBe('none');
    expect(await b.rpc.klraHeatmap()).toBeNull();
  });
});

describe('F20 · no birth date or age in any payload (acceptance)', () => {
  it('the register, the position detail, the heatmap and the seed carry bands only', async () => {
    await as('training-mgr');
    const payload = JSON.stringify([await b.rpc.klraRegister(), await b.rpc.klraRegister('2026-Q3'), await b.rpc.klraPosition('pos-w-sro-02'), await b.rpc.klraPosition('pos-ossa-01'), await b.rpc.klraHeatmap()]);
    expect(payload).not.toMatch(AGE);
    expect(Object.keys(SCHEMA.klra_positions.cols).join(' ')).not.toMatch(/birth|age\b|dob/);
    expect(new Set(T.klra_positions.map((p) => p.retirement_band))).toEqual(new Set(['within_2', '2_5', '5_plus', 'na']));
    expect(T.people.some((p) => 'birth_date' in p || 'age' in p)).toBe(false);
  });
});

describe('F20 · thresholds configurable by the KM owner and audited (acceptance)', () => {
  it('the KM owner changes them (audit + ledger), bands follow; others are refused and audited', async () => {
    await as('k-ro');
    const no = await b.rpc.setKlraThresholds(20, 10);
    expect(no.code).toBe('forbidden');
    expect(lastAudit()).toMatchObject({ action: 'klra.thresholds', outcome: 'refused' });
    await as('ops-ceo');
    expect((await b.rpc.setKlraThresholds(20, 10)).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.setKlraThresholds(8, 9)).code).toBe('invalid');
    const led0 = b.raw('ledger_local').length;
    const ok = await b.rpc.setKlraThresholds(12, 6);
    expect(ok.ok).toBe(true);
    expect(lastAudit()).toMatchObject({ action: 'klra.thresholds', outcome: 'ok', actor_role: 'training_manager', reason: 'high 12, medium 6' });
    expect(b.raw('ledger_local').length).toBe(led0 + 1);
    const reg = await b.rpc.klraRegister();
    expect(reg.thresholds).toEqual({ high: 12, medium: 6 });
    expect(reg.rows.every((r) => r.band === bandOf(r.total, { high: 12, medium: 6 }))).toBe(true);
    expect(reg.rows.filter((r) => r.band === 'high').length).toBeGreaterThan(T.klra_assessments.filter((a) => a.period === Q && a.total >= 16).length);
  });
});

describe('F20 · every high-risk row has a mitigation action before the quarter closes, or shows overdue (acceptance)', () => {
  it('mitigation state: needed before the quarter end, overdue after, planned or done with actions', () => {
    const end = quarterEndIso('2026-Q3');
    expect(end).toBe('2026-09-30');
    expect(mitigationState('high', '2026-Q3', [], '2026-09-30')).toBe('needed');
    expect(mitigationState('high', '2026-Q3', [], '2026-10-01')).toBe('overdue');
    expect(mitigationState('high', '2026-Q3', [{ assessment_id: 'a', status: 'planned', due_on: '2026-09-01' }], '2026-10-01')).toBe('planned');
    expect(mitigationState('high', '2026-Q3', [{ assessment_id: 'a', status: 'done', due_on: '2026-09-01' }], '2026-10-01')).toBe('done');
    expect(mitigationState('high', '2026-Q3', [{ assessment_id: 'a', status: 'cancelled', due_on: '2026-09-01' }], '2026-10-01')).toBe('overdue');
    expect(mitigationState('medium', '2026-Q3', [], '2026-10-01')).toBe('not_required');
  });
  it('the closed quarter: every high row has an action or reads overdue; the open quarter reads needed until it closes', async () => {
    await as('training-mgr');
    const q3 = await b.rpc.klraRegister('2026-Q3');
    const high = q3.rows.filter((r) => r.band === 'high');
    expect(high.length).toBeGreaterThan(10);
    for (const r of high) expect(r.actions.some((a) => a.status !== 'cancelled') || r.mitigation === 'overdue', r.id).toBe(true);
    expect(high.some((r) => r.mitigation === 'overdue')).toBe(true);
    const cur = await b.rpc.klraRegister();
    const needed = cur.rows.find((r) => r.mitigation === 'needed')!;
    expect(needed).toBeTruthy();
    const plan = await b.rpc.planMitigation({ assessment_id: needed.id, kind: 'capture', owner_role: 'km_owner', due_on: today });
    expect(plan.ok).toBe(true);
    expect((await b.rpc.planMitigation({ assessment_id: needed.id, kind: 'capture', owner_role: 'km_owner', due_on: today })).code).toBe('conflict');
    expect((await b.rpc.klraRegister()).rows.find((r) => r.id === needed.id)!.mitigation).toBe('planned');
    expect((await b.rpc.closeAction(plan.data!.id, 'cancelled', '')).code).toBe('invalid');
    expect((await b.rpc.closeAction(plan.data!.id, 'done', 'Interview held')).ok).toBe(true);
    expect((await b.rpc.klraRegister()).rows.find((r) => r.id === needed.id)!.mitigation).toBe('done');
  });
  it('assessPosition needs a note when the proposal changes; reassessQuarter fills the quarter; closed quarters are refused', async () => {
    await as('training-mgr');
    const reg = await b.rpc.klraRegister();
    const pend = reg.pending[0];
    const d = (await b.rpc.klraPosition(pend.id))!;
    const other = d.proposal.attrition === 5 ? 4 : d.proposal.attrition + 1;
    expect((await b.rpc.assessPosition({ position_id: pend.id, attrition_factor: other, position_factor: d.proposal.position })).code).toBe('note_required');
    expect((await b.rpc.assessPosition({ position_id: pend.id, attrition_factor: 0, position_factor: 2 })).code).toBe('invalid');
    const ok = await b.rpc.assessPosition({ position_id: pend.id, attrition_factor: other, position_factor: d.proposal.position, note: 'Secondment extension not yet agreed' });
    expect(ok.ok && ok.data!.total).toBe(other * d.proposal.position);
    const re = await b.rpc.reassessQuarter();
    expect(re.ok && re.data!.created).toBe(reg.pending.length - 1);
    expect((await b.rpc.reassessQuarter('2026-Q3')).code).toBe('closed_period');
    expect((await b.rpc.klraRegister()).pending).toHaveLength(0);
    await as('sro');
    expect((await b.rpc.assessPosition({ position_id: 'pos-w-rp-01', attrition_factor: 1, position_factor: 1 })).code).toBe('not_found');
  });
});

describe('F20 · department heatmap suppresses cells below 10 (acceptance)', () => {
  it('every cell is either >= 10 or suppressed with no value; HR gets the heatmap', async () => {
    await as('chco');
    const h = (await b.rpc.klraHeatmap())!;
    expect(h.departments.map((d) => d.id)).toEqual([...DEPARTMENTS]);
    const cells = h.departments.flatMap((d) => [d.n, d.high, d.medium, d.low, d.mitigated]).concat([h.total.n, h.total.high]);
    for (const c of cells) expect((c.suppressed && c.n === null) || (!c.suppressed && (c.n as number) >= MIN_GROUP_SIZE)).toBe(true);
    expect(cells.some((c) => c.suppressed)).toBe(true);
    expect(cells.some((c) => !c.suppressed)).toBe(true);
    expect(h.excluded).toEqual(['security', 'cyber', 'safeguards']);
  });
  it('a small department is fully suppressed', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, period: '2026-Q4', department: 'corporate', total: 20 }));
    const h = computeHeatmap(rows, [], TH, '2026-Q4');
    const c = h.departments.find((d) => d.id === 'corporate')!;
    expect([c.n.suppressed, c.high.suppressed, c.n.n, c.high.n]).toEqual([true, true, null, null]);
  });
});

describe('F21 · two-person review before publishing (acceptance)', () => {
  const draft = (extra: Record<string, unknown> = {}) => ({
    title_en: 'Valve stroke timing tips', title_ar: 'نصائح توقيت شوط الصمام', summary_en: 'How to read stroke times and when a slow valve needs attention.', summary_ar: 'كيف تقرأ أزمنة الشوط ومتى يحتاج الصمام البطيء إلى اهتمام.',
    body: 'Stroke timing trends matter more than a single result; compare against the last three tests and the acceptance band before raising a work order.', key_points: [{ en: 'Trend the last three tests', ar: 'تتبع آخر ثلاثة اختبارات' }],
    skill_ids: ['sk-mp-01-mech'], standard_ids: ['qs-mech'], system_family: 'maintenance', submit: true, ...extra,
  });
  it('cannot publish without a technical pass and a security pass by two people other than the author', async () => {
    await as('sme-reviewer');
    const sub = await b.rpc.submitAsset(draft());
    expect(sub.ok && sub.data!.status).toBe('review');
    const id = sub.data!.id;
    expect((await b.rpc.reviewAsset({ asset_id: id, kind: 'technical', outcome: 'pass', checks: { accurate: true } })).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.publishAsset(id)).code).toBe('reviews_missing');
    expect((await b.rpc.reviewAsset({ asset_id: id, kind: 'security', outcome: 'pass', checks: { deidentified: true } })).code).toBe('invalid');
    expect((await b.rpc.reviewAsset({ asset_id: id, kind: 'security', outcome: 'pass', checks: { deidentified: true, no_security: true } })).ok).toBe(true);
    expect((await b.rpc.publishAsset(id)).code).toBe('reviews_missing');
    expect((await b.rpc.reviewAsset({ asset_id: id, kind: 'technical', outcome: 'pass', checks: { accurate: true } })).code).toBe('conflict');
    await as('head-sq');
    expect((await b.rpc.reviewAsset({ asset_id: id, kind: 'technical', outcome: 'pass', checks: { accurate: true } })).ok).toBe(true);
    expect((await b.rpc.publishAsset(id)).code).toBe('forbidden');
    await as('training-mgr');
    const led0 = b.raw('ledger_local').length;
    const pub = await b.rpc.publishAsset(id);
    expect(pub.ok).toBe(true);
    expect(b.raw('ledger_local').length).toBe(led0 + 1);
    expect(b.rawGet('knowledge_assets', id)!.reviewers).toEqual(['p-head-sq', 'p-training-mgr']);
  });
  it('the author or the SME can never review their own asset; changes send it back and supersede earlier reviews', async () => {
    await as('head-sq');
    const r = await b.rpc.reviewAsset({ asset_id: 'kas-007', kind: 'security', outcome: 'pass', checks: { deidentified: true, no_security: true } });
    expect(r.ok).toBe(true); // head-sq is neither author (chem-sup) nor SME (w-chem-01)
    await as('training-mgr');
    expect((await b.rpc.publishAsset('kas-007')).ok).toBe(true); // technical pass by rp-lead (seed) + security pass by head-sq
    const st = reviewState([{ asset_id: 'x', reviewer_id: 'a', kind: 'technical', outcome: 'pass', superseded: false }, { asset_id: 'x', reviewer_id: 'a', kind: 'security', outcome: 'pass', superseded: false }], 'au', 'sm');
    expect(st.ready).toBe(false);
    expect(st.missing).toEqual(['second_person']);
    expect(reviewState([{ asset_id: 'x', reviewer_id: 'au', kind: 'technical', outcome: 'pass', superseded: false }, { asset_id: 'x', reviewer_id: 'b', kind: 'security', outcome: 'pass', superseded: false }], 'au', 'sm').ready).toBe(false);
    expect(reviewState([{ asset_id: 'x', reviewer_id: 'c', kind: 'technical', outcome: 'pass', superseded: true }, { asset_id: 'x', reviewer_id: 'b', kind: 'security', outcome: 'pass', superseded: false }], 'au', 'sm').ready).toBe(false);
    // changes requested -> draft; the author resubmits; earlier reviews no longer count
    await as('rp-lead');
    const ch = await b.rpc.reviewAsset({ asset_id: 'kas-008', kind: 'technical', outcome: 'changes', note: 'Add the expected count-rate doubling behaviour' });
    expect(ch.ok && ch.data!.status).toBe('draft');
    expect(b.raw('notifications').some((n) => n.person_id === 'p-k-instructor' && n.kind === 'knowledge')).toBe(true);
    await as('k-instructor');
    const a = b.rawGet('knowledge_assets', 'kas-008')!;
    const re = await b.rpc.submitAsset({ id: a.id, title_en: a.title_en, title_ar: a.title_ar, summary_en: a.summary_en, summary_ar: a.summary_ar, body: `${a.body} The count rate roughly doubles each time the remaining reactivity halves.`, key_points: a.key_points as never, skill_ids: a.skill_ids, standard_ids: a.standard_ids, system_family: a.system_family, submit: true });
    expect(re.ok).toBe(true);
    expect(b.raw('asset_reviews').filter((r) => r.asset_id === 'kas-008').every((r) => r.superseded)).toBe(true);
    expect(b.rawGet('knowledge_assets', 'kas-008')!.version).toBe(2);
  });
  it('publishing an asset from a KLRA-linked interview closes the capture action and lowers the tacit share', async () => {
    await as('training-mgr');
    const before = (await b.rpc.klraPosition('pos-w-sro-01'))!;
    // w-sro-01 has no persona; the interviewer (sro) records and drafts
    await as('sro');
    const tr = 'During power changes the crew agrees the plan at the boards first, names who watches which parameter and states the stop points aloud. '.repeat(3);
    expect((await b.rpc.recordCapture('cs-012', { status: 'transcribed', held_on: today, transcript: tr })).ok).toBe(true);
    const sub = await b.rpc.submitAsset({ session_id: 'cs-012', title_en: 'Crew decisions during power changes', title_ar: 'قرارات الطاقم أثناء تغيير القدرة', summary_en: 'How crew B agrees the plan and stop points before a power change.', summary_ar: 'كيف يتفق الطاقم ب على الخطة ونقاط التوقف قبل تغيير القدرة.', body: tr, key_points: [{ en: 'State the stop points aloud', ar: 'اذكر نقاط التوقف بصوت مسموع' }], skill_ids: ['sk-co-01'], standard_ids: [], system_family: 'human_performance', submit: true });
    expect(sub.ok).toBe(true);
    await as('head-sq');
    expect((await b.rpc.reviewAsset({ asset_id: sub.data!.id, kind: 'technical', outcome: 'pass', checks: { accurate: true }, decisions: Object.fromEntries((b.rawGet('knowledge_assets', sub.data!.id)!.suggestions as { kind: string; ref: string }[]).map((s) => [`${s.kind}:${s.ref}`, 'rejected'])) })).ok).toBe(true);
    await as('training-mgr');
    expect((await b.rpc.reviewAsset({ asset_id: sub.data!.id, kind: 'security', outcome: 'pass', checks: { deidentified: true, no_security: true } })).ok).toBe(true);
    const pub = await b.rpc.publishAsset(sub.data!.id);
    expect(pub.ok && pub.data!.action_closed).toBe('ka-seed-q4-w-sro-01-capture');
    expect(b.rawGet('klra_actions', 'ka-seed-q4-w-sro-01-capture')!.status).toBe('done');
    const after = (await b.rpc.klraPosition('pos-w-sro-01'))!;
    expect(after.proposal.drivers.codified_pct).toBeGreaterThan(before.proposal.drivers.codified_pct);
  });
});

describe('F21 · restricted text blocks submission and shows guidance (acceptance)', () => {
  it('security, safeguards and cyber patterns and contact details are refused; the audit row names the category only', async () => {
    await as('sme-reviewer');
    const base = { title_en: 'Valve stroke timing tips', title_ar: 'نصائح توقيت شوط الصمام', summary_en: 'How to read stroke times and when a slow valve needs attention.', summary_ar: 'كيف تقرأ أزمنة الشوط ومتى يحتاج الصمام البطيء إلى اهتمام.', key_points: [{ en: 'Trend tests', ar: 'تتبع الاختبارات' }], skill_ids: [], standard_ids: [], system_family: 'maintenance', submit: true };
    const n0 = b.raw('knowledge_assets').length;
    for (const [cat, text] of [['security', 'Note where the CCTV cameras and guard posts sit along the perimeter fence near the valve gallery.'], ['safeguards', 'The nuclear material inventory and material balance figures are in the fuel building ledger.'], ['cyber', 'The SCADA firewall password is written on the panel inside the cabinet door.']] as const) {
      const r = await b.rpc.submitAsset({ ...base, body: text });
      expect(r.code, cat).toBe('restricted_content');
      expect(r.message).toMatch(new RegExp(`${cat} content is not allowed`));
      expect(r.message).toMatch(/leave out plant security arrangements/);
      expect(lastAudit().reason).not.toMatch(/cctv|inventory|password/i);
    }
    expect((await b.rpc.submitAsset({ ...base, body: 'Stroke timing trends matter; call me on +971 50 123 4567 for the acceptance band details.' })).code).toBe('contact_details');
    expect(b.raw('knowledge_assets').length).toBe(n0);
    await as('sro');
    expect((await b.rpc.recordCapture('cs-012', { status: 'transcribed', transcript: 'The patrol routes and the armed response force timings are what newcomers ask about first. '.repeat(4) })).code).toBe('restricted_content');
    expect(Object.values(POST_FLOOR).flat().every((p) => postGuard(assetText({ body: `x ${p} x` })) !== null)).toBe(true);
  });
  it('seeded assets, transcripts and SME headlines pass the blocker', () => {
    for (const a of T.knowledge_assets) expect(postGuard(assetText(a), T.refusal_policies), a.id).toBeNull();
    for (const s of T.capture_sessions) expect(postGuard(s.transcript, T.refusal_policies), s.id).toBeNull();
  });
});

describe('F21 · knowledge base search (acceptance: a seeded topic returns the asset and the related OE lesson, with citations)', () => {
  const build = (assets: AssetLite[]) => {
    const docs = kbDocs(assets, T.oe_lessons, T.courses.filter((c) => !c.competency_ids.includes('sa-01')));
    return { docs, index: new SearchIndex(docs) };
  };
  it('"peer check redundant train" returns kas-001 and OE-1; Arabic works too', () => {
    const assets = T.knowledge_assets.filter((a) => a.published) as AssetLite[];
    const { docs, index } = build(assets);
    const data = { assets, oe: T.oe_lessons, courses: T.courses };
    const hits = searchKb(index, docs, 'peer check redundant train', data);
    expect(hits.slice(0, 2).some((h) => h.id === 'asset:kas-001')).toBe(true);
    expect(hits.some((h) => h.id === 'oe:oe-1')).toBe(true);
    expect(hits.every((h) => h.doc.route)).toBe(true);
    expect(T.knowledge_assets.find((a) => a.id === 'kas-001').oe_ids).toContain('oe-1');
    const ar = searchKb(index, docs, 'المسارات الاحتياطية', data, {}, 'ar');
    expect(ar.slice(0, 3).some((h) => h.id === 'asset:kas-001')).toBe(true);
    // filters: system family keeps assets only; skill keeps matching assets
    expect(searchKb(index, docs, 'peer check redundant train', data, { family: 'maintenance' }).every((h) => h.kind === 'asset')).toBe(true);
    expect(searchKb(index, docs, 'foreign material outage', data, { kind: 'oe' }).every((h) => h.kind === 'oe')).toBe(true);
  });
  it('withdrawn assets disappear from search within one refresh', async () => {
    await as('k-ro');
    const before = await b.list('knowledge_assets');
    expect(before.some((a) => a.id === 'kas-001')).toBe(true);
    expect(before.some((a) => a.id === 'kas-010')).toBe(false); // seeded withdrawn
    await as('training-mgr');
    expect((await b.rpc.withdrawAsset('kas-001', 'Superseded by the revised procedure')).ok).toBe(true);
    await as('k-ro');
    const after = await b.list('knowledge_assets');
    expect(after.some((a) => a.id === 'kas-001')).toBe(false);
    const { docs, index } = build(after as unknown as AssetLite[]);
    expect(searchKb(index, docs, 'peer check redundant train', { assets: after as never, oe: T.oe_lessons, courses: T.courses }).some((h) => h.id === 'asset:kas-001')).toBe(false);
  });
  it('"used by" counts each person once; staff read published assets only', async () => {
    await as('k-ro');
    const r1 = await b.rpc.markAssetUsed('kas-003');
    const r2 = await b.rpc.markAssetUsed('kas-003');
    expect(r1.ok && r2.ok && r2.data!.used_by).toBe(7);
    expect((await b.rpc.markAssetUsed('kas-009')).code).toBe('not_found');
    expect((await b.list('knowledge_assets')).every((a) => a.published)).toBe(true);
    expect(T.knowledge_assets.find((a) => a.id === 'kas-001').used_by).toBeGreaterThanOrEqual(10);
  });
});

describe('F21 · capture workflow, enrichment and seed', () => {
  it('plan -> hold -> transcribe: interviewers only, no security skills, transcripts 200 to 60,000 characters', async () => {
    await as('k-ro');
    expect((await b.rpc.planCapture({ sme_id: 'w-mnt-03', template: 'rules_of_thumb', planned_on: today, title: 'Pump alignment habits' })).code).toBe('forbidden');
    await as('head-sq');
    expect((await b.rpc.planCapture({ sme_id: 'w-mnt-03', template: 'rules_of_thumb', planned_on: today, title: 'Pump alignment habits', skill_ids: ['sk-sa-01'] })).code).toBe('invalid');
    expect((await b.rpc.planCapture({ sme_id: 'w-mnt-03', interviewer_id: 'w-mnt-03', template: 'rules_of_thumb', planned_on: today, title: 'Pump alignment habits' })).code).toBe('invalid');
    const p = await b.rpc.planCapture({ sme_id: 'w-mnt-03', template: 'rules_of_thumb', planned_on: today, title: 'Pump alignment habits', skill_ids: ['sk-mp-01-mech'] });
    expect(p.ok).toBe(true);
    expect(b.rawGet('sme_profiles', 'sme:w-mnt-03')!.listed).toBe(false);
    expect((await b.rpc.recordCapture(p.data!.id, { status: 'transcribed', transcript: 'short' })).code).toBe('invalid');
    expect((await b.rpc.recordCapture(p.data!.id, { status: 'held' })).ok).toBe(true);
    const tr = await b.rpc.recordCapture(p.data!.id, { status: 'transcribed', transcript: 'Alignment is where most pump problems start. '.repeat(8) });
    expect(tr.ok && tr.data!.words).toBe(56);
    await as('k-ro');
    expect((await b.rpc.recordCapture(p.data!.id, { status: 'cancelled' })).code).toBe('forbidden');
    expect((await b.rpc.captureBoard()).sessions).toHaveLength(0);
    await as('training-mgr');
    expect((await b.rpc.captureBoard()).sessions.length).toBe(T.capture_sessions.length + 1);
  });
  it('enrichment is deterministic and explains itself', () => {
    const text = T.capture_sessions.find((s) => s.id === 'cs-001').transcript;
    const refs = { skills: T.skills.map((s) => ({ id: s.id, text: `${s.name_en} ${s.description_en}` })), oe: T.oe_lessons.map((o) => ({ id: o.id, text: `${o.title_en} ${o.summary_en} ${o.lesson_en}` })), courses: [] };
    const a = enrich(text, refs), c = enrich(text, refs);
    expect(a).toEqual(c);
    expect(a.suggestions.find((s) => s.ref === 'oe-1')?.terms).toEqual(expect.arrayContaining(['redundant', 'train']));
    expect(rake('the peer check at the local panel. stage tools on the correct train').map((p) => p.phrase)).toContain('peer check');
    expect(tfidf('redundant train redundant train pump', ['pump pump pump'])[0].term).toBe('redundant');
  });
  it('the seed: SME profiles, sessions in every state, assets in every state, routes and templates', () => {
    expect(new Set(T.capture_sessions.map((s) => s.status))).toEqual(new Set(['planned', 'held', 'transcribed', 'cancelled']));
    expect(new Set(T.knowledge_assets.map((a) => a.status))).toEqual(new Set(['published', 'review', 'draft', 'withdrawn']));
    for (const a of T.knowledge_assets.filter((x) => x.status === 'published')) {
      expect(a.reviewers).toHaveLength(2);
      expect(a.reviewers).not.toContain(a.author_id);
      expect(a.reviewers).not.toContain(a.sme_id);
    }
    expect(T.klra_positions.filter((p) => p.kind === 'ossa')).toHaveLength(16);
    expect(T.klra_positions.some((p) => ['security', 'cyber', 'safeguards'].includes(p.family_id))).toBe(false);
    expect(TEMPLATE_IDS.every((id) => TEMPLATES[id].prompts.length >= 3)).toBe(true);
    expect(routes.map((r) => r.id)).toEqual(['knowledge', 'knowledge-asset', 'knowledge-capture', 'knowledge-capture-session', 'knowledge-review', 'knowledge-klra', 'knowledge-klra-position',
      'knowledge-lectures', 'knowledge-lecture', 'knowledge-contributions', 'knowledge-localisation']); // FS44/FS45 (fsEe3): four routes added
    const klra = routes.find((r) => r.id === 'knowledge-klra')!;
    expect(klra.guard.grant?.levels).toEqual(['A', 'Scope', 'Agg']);
    for (const r of routes) expect(hasKey(`m24.routes.${r.id}.title`) && hasKey(`m24.routes.${r.id}.purpose`)).toBe(true);
  });
});
