/** FS29 Recognition of prior learning + FS30 NQF levels and learning credits (FS wave D · E2, M34): one test per acceptance criterion on
 *  the local path, plus the rules shared with SQL, RBAC, the seed and i18n. The SQL path (TS = SQL parity for kafaa_rpl_options,
 *  kafaa_rpl_statement, kafaa_rpl_pack, kafaa_cr_compute; RLS; live RPC flows; grants; additive SQL) is checked by
 *  scripts/validate/fs42-rpl-credits.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import en from '../../src/i18n/m34.en.json';
import ar from '../../src/i18n/m34.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m34/routes';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { creditWorld, optionWorld } from '../../src/modules/m34/backend/local';
import { RPL_MSG, checkDecide, maskFanr, packIsClean, rplOptions } from '../../src/modules/m34/rpl';
import { CR_MSG, NQF_BY_LEVEL, checkTag, creditsFor, creditsOf, ledgerTotal, stackProgress } from '../../src/modules/m34/credits';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]> };
const T = S.tables;
const NARR = { narrative_en: 'Six years leading primary system walkdowns and post-maintenance testing.', narrative_ar: 'ست سنوات في قيادة جولات النظام الأولي واختبارات ما بعد الصيانة.' };
const RAT = { rationale_en: 'Two debriefs and a confirmed attestation support independent practice.', rationale_ar: 'جلستا استخلاص وإفادة مؤكدة تدعم الممارسة المستقلة.' };
const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const INDICATIVE_EN = 'indicative until agreed with the NQC and the partner';
const INDICATIVE_AR = 'إرشادي إلى حين الاتفاق مع المركز الوطني للمؤهلات والشريك';

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]) ?? [];
const rawGet = (t: string, id: string) => b.rawGet(t as never, id) as unknown as Row | undefined;
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

/** Open a request for p-sro on sk-pf-02 L4 with two simulator debriefs and a confirmed attestation, then submit it. */
async function submittedSro() {
  await as('sro');
  const op = await b.rpc.submitRpl({ action: 'open', target_kind: 'skill', skill_id: 'sk-pf-02', level: 4, ...NARR } as never);
  expect(op.ok).toBe(true);
  const id = op.data!.id;
  const sim = rplOptions('p-sro', optionWorld(raw)).filter((o) => o.kind === 'simulator' && !o.restricted).slice(0, 2);
  expect(sim.length).toBe(2);
  for (const o of sim) expect((await b.rpc.submitRpl({ action: 'attach', id, kind: 'simulator', ref_table: o.ref_table, ref_id: o.ref_id } as never)).ok).toBe(true);
  const at = await b.rpc.submitRpl({ action: 'attach', id, kind: 'attestation', attester_id: 'p-outage-manager', note: 'Please confirm my primary system walkdowns.' } as never);
  expect(at.ok).toBe(true);
  await as('outage-manager');
  expect((await b.rpc.attestRpl({ evidence_id: at.data!.evidence_id!, confirm: true, text_en: 'They led the primary system walkdowns for three outages and trained new operators on them.' })).ok).toBe(true);
  await as('sro');
  expect((await b.rpc.submitRpl({ action: 'submit', id } as never)).ok).toBe(true);
  return id;
}

describe('FS29 acceptance', () => {
  it('a decision needs two different people: staff cannot decide, the recommender cannot confirm, nobody decides their own request', async () => {
    const id = await submittedSro();
    await as('sro');
    const r0 = await b.rpc.decideRpl({ action: 'recommend', id, outcome: 'partial', credited_level: 3, hours: 30, ...RAT });
    expect(r0.ok).toBe(false);
    expect(r0.code).toBe('forbidden');
    expect(r0.message).toBe(RPL_MSG.forbidden_assessor);
    await as('sq-lead');
    expect((await b.rpc.decideRpl({ action: 'recommend', id, outcome: 'full', credited_level: 3, hours: 40, ...RAT })).message).toBe(RPL_MSG.level_decide);
    expect((await b.rpc.decideRpl({ action: 'recommend', id, outcome: 'partial', credited_level: 3, hours: 30, ...RAT })).ok).toBe(true);
    const mc = await b.rpc.decideRpl({ action: 'confirm', id });
    expect(mc.code).toBe('maker_checker');
    expect(mc.message).toBe(RPL_MSG.maker_checker);
    expect(rawGet('rpl_requests', id)!.status).toBe('recommended');
    await as('training-mgr');
    const cf = await b.rpc.decideRpl({ action: 'confirm', id });
    expect(cf.ok).toBe(true);
    const row = rawGet('rpl_requests', id)!;
    expect(row.status).toBe('decided');
    expect(row.recommended_by).toBe('p-sq-lead');
    expect(row.decided_by).toBe('p-training-mgr');
    expect(row.recommended_by).not.toBe(row.decided_by);
    // the rule itself: same person, and the person themself
    const rec = { ...row, status: 'recommended' };
    expect(checkDecide({ action: 'confirm' } as never, rec as never, 'p-sq-lead', 4)).toBe('maker_checker');
    expect(checkDecide({ action: 'recommend', outcome: 'full', credited_level: 4, hours: 10, ...RAT } as never, { ...row, status: 'submitted', recommended_by: null } as never, 'p-sro', 4)).toBe('self');
  }, 60000);

  it('no security-restricted item can be attached (refusal code security_restricted); it is listed without detail', async () => {
    await as('nuc-security');
    const op = await b.rpc.submitRpl({ action: 'open', target_kind: 'skill', skill_id: 'sk-hu-01', level: 3, ...NARR } as never);
    expect(op.ok).toBe(true);
    const opts = await b.rpc.rplEvidenceOptions(null);
    const sec = opts.find((o) => o.ref_id === 'qr-p-nuc-security-qs-sec')!;
    expect(sec.restricted).toBe(true);
    expect(sec.title_en).toBe('Security-restricted record');
    expect(sec.skill_ids.length).toBe(0);
    const at = await b.rpc.submitRpl({ action: 'attach', id: op.data!.id, kind: 'qualification', ref_table: 'qual_records', ref_id: 'qr-p-nuc-security-qs-sec' } as never);
    expect(at.ok).toBe(false);
    expect(at.code).toBe('security_restricted');
    expect(at.message).toBe(RPL_MSG.security_restricted);
    expect(raw('rpl_evidence').some((e) => e.ref_id === 'qr-p-nuc-security-qs-sec')).toBe(false);
    // security skills are not recognised individually either
    const sk = await b.rpc.submitRpl({ action: 'open', target_kind: 'skill', skill_id: 'sk-sa-01', level: 2, ...NARR } as never);
    expect(sk.code).toBe('security_restricted');
    // no seeded pack holds a restricted item
    const restricted = new Set(T.people.flatMap((p) => rplOptions(p.id, optionWorld((t) => T[t] ?? [])).filter((o) => o.restricted).map((o) => `${o.ref_table}|${o.ref_id}`)));
    expect(restricted.size).toBeGreaterThan(0);
    expect(T.rpl_evidence.some((e) => restricted.has(`${e.ref_table}|${e.ref_id}`))).toBe(false);
  }, 60000);

  it('credit is written as validated evidence and recomputes skills; the credit ledger gains the RPL row; one NEXUS ledger row', async () => {
    const id = await submittedSro();
    await as('sq-lead');
    await b.rpc.decideRpl({ action: 'recommend', id, outcome: 'partial', credited_level: 3, hours: 30, ...RAT });
    const ledger0 = raw('ledger_local').length;
    await as('training-mgr');
    expect((await b.rpc.decideRpl({ action: 'confirm', id })).ok).toBe(true);
    const ev = rawGet('skill_evidence', `se:rpl:${id}:sk-pf-02`)!;
    expect(ev).toBeTruthy();
    expect(ev.kind).toBe('credential');
    expect(ev.basis).toBe('validated');
    expect(ev.ref_table).toBe('rpl_requests');
    expect(Number(ev.level)).toBe(3);
    const st = raw('person_skills').find((x) => x.person_id === 'p-sro' && x.skill_id === 'sk-pf-02' && x.active !== false)!;
    expect(Number(st.level)).toBeGreaterThanOrEqual(3);
    const led = rawGet('credit_ledger', `cl:p-sro:rpl:${id}`)!;
    expect(led.status).toBe('counted');
    expect(Number(led.credits)).toBe(3);
    expect(raw('ledger_local').length).toBe(ledger0 + 1);
    const row = rawGet('rpl_requests', id)!;
    expect(row.rpl_statement_en).toMatch(/partial credit/);
    expect(row.rpl_statement_ar).toMatch(/اعتراف جزئي/);
  }, 60000);

  it('the NQC-ready export carries no FANR wording, initials only and roles not names; other staff cannot export', async () => {
    for (const [p, ok] of [['sro', true], ['k-auditor', true], ['qc-inspector', false]] as const) {
      await as(p);
      const ex = await b.rpc.exportRpl('rpl-p-sro-01');
      expect(ex.ok).toBe(ok);
      if (ok) {
        expect(packIsClean(ex.data)).toBe(true);
        expect(JSON.stringify(ex.data)).not.toMatch(/fanr|الهيئة الاتحادية للرقابة النووية/i);
        expect((ex.data as Row).subject.initials).toBe('SR');
        expect(JSON.stringify(ex.data)).not.toContain(T.people.find((x) => x.id === 'p-sro')!.display_name);
      }
    }
    // even when a narrative or an attestation names the regulator, the pack masks it
    expect(maskFanr('Passed the FANR (Federal Authority for Nuclear Regulation) inspection walkdown')).toBe('Passed the regulator inspection walkdown');
    expect(maskFanr('Briefed the Federal Authority for Nuclear Regulation team')).toBe('Briefed the regulator team');
    expect(maskFanr('اجتاز تفتيش الهيئة الاتحادية للرقابة النووية')).toContain('الجهة الرقابية');
    await as('sro');
    expect((await b.rpc.exportRpl('rpl-p-sro-02')).code).toBe('invalid');
  }, 60000);
});

describe('FS30 acceptance', () => {
  it('every published micro-credential has an NQF level and credit tag marked indicative', () => {
    const current = T.microcred_defs.filter((d) => d.status === 'current');
    expect(current.length).toBeGreaterThan(0);
    const tags = new Map(T.credit_tags.filter((t) => t.status === 'published').map((t) => [`${t.item_kind}|${t.item_id}`, t]));
    for (const d of current) {
      const t = tags.get(`microcred|${d.id}`);
      expect(t, d.id).toBeTruthy();
      expect(t!.indicative).toBe(true);
      expect(t!.nqf_level).toBeGreaterThanOrEqual(1);
      expect(t!.nqf_level).toBeLessThanOrEqual(10);
      expect(Number(t!.credits)).toBe(creditsOf(t!.notional_hours));
    }
    expect(T.credit_tags.every((t) => t.indicative === true)).toBe(true);
    expect(Object.values(NQF_BY_LEVEL)).toEqual([3, 4, 5, 7]);
  });

  it('ledger totals equal the sum of completed items (creditsFor), in the seed and after a tag edit and a sync', async () => {
    const people = [...new Set(T.credit_ledger.map((r) => r.person_id))];
    expect(people.length).toBeGreaterThan(20);
    const W = creditWorld((t) => T[t] ?? []);
    for (const p of people) {
      const got = T.credit_ledger.filter((r) => r.person_id === p && r.status === 'counted');
      const want = creditsFor(p, W);
      expect(ledgerTotal(got as never), p).toBe(ledgerTotal(want));
      expect(got.map((r) => r.id).sort()).toEqual(want.map((r) => r.id).sort());
    }
    await as('sro');
    expect((await b.rpc.tagCredit({ item_kind: 'course', item_id: 'c-hu', nqf_level: 4, notional_hours: 30, basis_en: 'x'.repeat(30), basis_ar: 'ق'.repeat(30) } as never)).message).toBe(CR_MSG.forbidden);
    await as('k-instructor');
    const tg = await b.rpc.tagCredit({ item_kind: 'course', item_id: 'c-hu', nqf_level: 4, notional_hours: 37, basis_en: 'Twelve contact hours with practice on real work packages and a briefing log.', basis_ar: 'اثنتا عشرة ساعة تواصل مع ممارسة على حزم عمل فعلية وسجل إحاطات.', stack_ids: ['st-safe-performance'] } as never);
    expect(tg.ok).toBe(true);
    expect(tg.data!.credits).toBe(3.7);
    const W2 = creditWorld(raw);
    for (const p of [...new Set(raw('credit_ledger').map((r) => r.person_id))]) {
      expect(ledgerTotal(raw('credit_ledger').filter((r) => r.person_id === p && r.status === 'counted') as never), p).toBe(ledgerTotal(creditsFor(p, W2)));
    }
    const rt = await b.rpc.tagCredit({ item_kind: 'course', item_id: 'c-hu', retire: true } as never);
    expect(rt.ok).toBe(true);
    const used = raw('credit_ledger').filter((r) => r.tag_id === 'ct:course:c-hu');
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((r) => r.status === 'reversed')).toBe(true);
    await as('sro');
    expect((await b.rpc.syncCredits('p-chco')).code).toBe('forbidden');
    const sy = await b.rpc.syncCredits(null);
    expect(sy.ok && sy.data!.people).toBe(1);
  }, 90000);

  it('every tag displays "indicative until agreed with the NQC and the partner" in EN and AR', () => {
    expect((en as Row).ui.indicative.toLowerCase()).toContain(INDICATIVE_EN.toLowerCase());
    expect((ar as Row).ui.indicative).toContain(INDICATIVE_AR);
    expect((en as Row).detail.creditsNote.toLowerCase()).toContain(INDICATIVE_EN.toLowerCase());
    expect((ar as Row).detail.creditsNote).toContain(INDICATIVE_AR);
    expect((en as Row).ui.notAuthTitle).toMatch(/not a licensing or regulatory authority/);
  });
});

describe('FS29/FS30 rules, seed, routes and i18n', () => {
  it('credits = notional hours / 10, exact to one decimal; tag checks refuse bad levels, hours and stacks', () => {
    expect(creditsOf(37)).toBe(3.7);
    expect(creditsOf(300)).toBe(30);
    const item = { id: 'c-hu', live: true };
    const ok = { item_kind: 'course', item_id: 'c-hu', nqf_level: 4, notional_hours: 30, basis_en: 'x'.repeat(30), basis_ar: 'ق'.repeat(30) };
    const ctx = { item, stacks: ['st-ai-plant'], existing: null };
    expect(checkTag(ok as never, ctx as never)).toBe('ok');
    expect(checkTag({ ...ok, nqf_level: 11 } as never, ctx as never)).toBe('nqf');
    expect(checkTag({ ...ok, notional_hours: 0 } as never, ctx as never)).toBe('hours');
    expect(checkTag({ ...ok, stack_ids: ['st-nope'] } as never, ctx as never)).toBe('stack');
  });

  it('stacks cap RPL credit and count only items at the minimum NQF level', () => {
    const rows = [
      { item_kind: 'rpl', notional_hours: 150, nqf_level: 5, stack_ids: ['s'], status: 'counted' },
      { item_kind: 'course', notional_hours: 100, nqf_level: 4, stack_ids: ['s'], status: 'counted' },
      { item_kind: 'course', notional_hours: 100, nqf_level: 2, stack_ids: ['s'], status: 'counted' },
    ];
    const p = stackProgress({ id: 's', credits_required: 30, rpl_max: 10, min_item_nqf: 3 }, rows as never);
    expect(p.rpl_capped).toBe(true);
    expect(p.credits).toBe(20);
    expect(p.remaining).toBe(10);
  });

  it('the seed covers every RPL state and outcome, with two different assessors on every decision', () => {
    const reqs = T.rpl_requests;
    expect(new Set(reqs.map((r) => r.status))).toEqual(new Set(['draft', 'submitted', 'recommended', 'decided', 'withdrawn']));
    expect(new Set(reqs.filter((r) => r.status === 'decided').map((r) => r.outcome))).toEqual(new Set(['full', 'partial', 'not_yet']));
    for (const r of reqs.filter((x) => x.status === 'decided')) {
      expect(r.recommended_by).not.toBe(r.decided_by);
      expect(r.person_id).not.toBe(r.decided_by);
      expect(r.rpl_statement_en).toBeTruthy();
      expect(r.rpl_statement_ar).toBeTruthy();
    }
    expect(reqs.some((r) => r.opened_role === 'instructor' || r.opened_by !== r.person_id)).toBe(true);
    expect(T.credit_stacks.length).toBe(4);
    expect(T.credit_stacks.every((s) => s.credits_required === 30)).toBe(true);
  });

  it('routes, benchmarks and i18n: 7 routes with titles in EN and AR, FS29/FS30 benchmarks, Arabic is Arabic', () => {
    expect(routes.filter((r) => !['my-learning-balance', 'team-study-time', 'workforce-learning-balances', 'my-external-certs', 'external-certs-queue'].includes(r.id)).length).toBe(7); // FS wave I (fsIe1): FS78/FS79 routes are pinned in fs91-balance-external-certs.test.ts
    for (const r of routes) {
      expect((en as Row).routes[r.id]?.title, r.id).toBeTruthy();
      expect((ar as Row).routes[r.id]?.title, r.id).toBeTruthy();
    }
    const B = FEATURE_BENCHMARKS as unknown as Record<string, string[]>;
    expect(B.FS29).toEqual(expect.arrayContaining(['ILO-RPL', 'UAE-NQF', 'UK-NUC']));
    expect(B.FS30).toEqual(expect.arrayContaining(['UAE-NQF', 'ENTITLE', 'UPKEEP']));
    const fe = new Map(flat(en as Row));
    const fa = flat(ar as Row);
    expect(fa.length).toBe(fe.size);
    for (const [k, v] of fa) {
      expect(fe.has(k), k).toBe(true);
      if (/[A-Za-z]{4,}/.test(fe.get(k)!) && !/^(m34|NQF)$/.test(v)) expect(/[؀-ۿ]/.test(v), k).toBe(true);
    }
  });
});
