// FS29 Recognition of prior learning (RPL) + FS30 NQF levels and learning credits (FS wave D · E2, module M34) seed.
//  1. credit_stacks: four 30-credit stacks toward an indicative external award with a partner university still to be agreed (none is
//     named), each citing the UAE NQF source; RPL may count for up to 10 credits of a stack.
//  2. credit_tags: an indicative NQF level and notional hours (1 credit = 10 hours) on every course outside the security domain, every
//     published pathway (its practice and project component; courses count separately) and every current micro-credential (its
//     evidence-review component). Levels follow the FS24 published map (Kafa'a level -> NQF lower bound); every tag is indicative.
//  3. rpl_requests + rpl_evidence: 15 synthetic requests in every state (draft, submitted, recommended, decided full / partial /
//     not yet, withdrawn, returned once), on skills and micro-credentials, by staff and one contractor (opened on behalf by the
//     training manager). Evidence comes from the person's own records through rplOptions (the rule the SQL mirrors); every request
//     passes checkOpen / checkAttach / checkSubmit / checkDecide; decisions are made by two different assessors.
//  4. Decided full or partial requests write validated F01 evidence (kind credential, ref_table rpl_requests) on FS02 skills only, so
//     the original 71-skill states are unchanged; states are re-derived for those people (FS03 decay model).
//  5. credit_ledger: creditsFor() for everyone with a completed tagged item or RPL credit.
// Runs as a FINALIZE_LAST finalizer (after f01 derives states, f32 seeds micro-credentials and fs17/fs19 seed pathways and courses).
// Synthetic people only.
import { decayModelFrom, deriveStates } from '../../../src/domain/skills.ts';
import {
  checkAttach, checkDecide, checkOpen, checkSubmit, creditedSkills, evidenceRowId, requestId, rplEvidenceId, rplOptions, rplStatement,
} from '../../../src/modules/m34/rpl.ts';
import { creditsFor, creditsOf, nqfForLevel, tagId, checkTag } from '../../../src/modules/m34/credits.ts';
import { finalize as rebuildDigests } from './f36-digest.mjs';

export const FINALIZE_LAST = true;
const AS_OF = '2026-10-10';
const NQF_URL = 'https://uaelegislation.gov.ae/en/legislations/2615/download';
const WAM_URL = 'https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses';
const TS = (d) => `${d}T09:00:00Z`;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byId = (a, b) => cmp(a.id, b.id);

export const STACKS = [
  { id: 'st-ai-plant', sort: 1, nqf_level: 7, min_item_nqf: 4, areas: ['ai_data', 'digital_plant'],
    title_en: 'AI and data for plant decisions', title_ar: 'الذكاء الاصطناعي والبيانات لقرارات المحطة',
    award_en: 'Indicative: a professional diploma in AI and data for nuclear operations', award_ar: 'إرشادي: دبلوم مهني في الذكاء الاصطناعي والبيانات للعمليات النووية',
    summary_en: 'Thirty credits of AI literacy, plant data, digital twins and electronic work, at NQF level 4 or above, shown toward an award a partner university would still have to agree.',
    summary_ar: 'ثلاثون رصيداً في محو الأمية بالذكاء الاصطناعي وبيانات المحطة والتوائم الرقمية والعمل الإلكتروني، بالمستوى 4 فأعلى، تُعرض نحو مؤهل لم تتفق عليه بعد جامعة شريكة.' },
  { id: 'st-advanced-reactors', sort: 2, nqf_level: 8, min_item_nqf: 5, areas: ['advanced_reactor'],
    title_en: 'Advanced reactor foundations', title_ar: 'أسس المفاعلات المتقدمة',
    award_en: 'Indicative: a graduate certificate in advanced reactor technology (no deployment decision implied)', award_ar: 'إرشادي: شهادة دراسات عليا في تقنيات المفاعلات المتقدمة (دون أي قرار نشر ضمني)',
    summary_en: 'Thirty credits on small modular and advanced reactors, passive safety and the fuel cycle, at NQF level 5 or above. No deployment decision is implied.',
    summary_ar: 'ثلاثون رصيداً عن المفاعلات المعيارية الصغيرة والمتقدمة والسلامة الذاتية ودورة الوقود، بالمستوى 5 فأعلى. لا يُفهم من ذلك أي قرار نشر.' },
  { id: 'st-clean-energy', sort: 3, nqf_level: 6, min_item_nqf: 4, areas: ['green_energy'],
    title_en: 'Clean energy systems', title_ar: 'أنظمة الطاقة النظيفة',
    award_en: 'Indicative: a professional certificate in clean energy systems', award_ar: 'إرشادي: شهادة مهنية في أنظمة الطاقة النظيفة',
    summary_en: 'Thirty credits on life-cycle emissions, grid integration, hydrogen and heat, and circular practice, at NQF level 4 or above.',
    summary_ar: 'ثلاثون رصيداً عن انبعاثات دورة الحياة وتكامل الشبكة والهيدروجين والحرارة والممارسات الدائرية، بالمستوى 4 فأعلى.' },
  { id: 'st-safe-performance', sort: 4, nqf_level: 6, min_item_nqf: 3, areas: ['transversal', 'human_performance', 'leadership', 'safety'],
    title_en: 'Leading safe performance', title_ar: 'قيادة الأداء الآمن',
    award_en: 'Indicative: a professional certificate in leading safe performance', award_ar: 'إرشادي: شهادة مهنية في قيادة الأداء الآمن',
    summary_en: 'Thirty credits of human performance, safety culture, systems thinking and leadership practice, at NQF level 3 or above.',
    summary_ar: 'ثلاثون رصيداً في الأداء البشري وثقافة السلامة والتفكير المنظومي وممارسات القيادة، بالمستوى 3 فأعلى.' },
];
const PARTNER = { en: 'Partner university to be agreed (none named)', ar: 'جامعة شريكة يُتفق عليها لاحقاً (لم تُسمَّ أي جامعة)' };

export default function build() {}

/** Credit tags for every taggable item (exported for the wave QA builder: new FS31 micro-credentials get tagged the same way). */
export function ensureCreditTags(T) {
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const stackOf = (skillIds) => T.credit_stacks.filter((st) => skillIds.some((x) => st.skill_ids.includes(x))).map((st) => st.id).sort(cmp);
  const sec = new Set(T.competencies.filter((c) => c.domain === 'security').map((c) => c.id));
  const have = new Set((T.credit_tags ?? []).map((t) => t.id));
  const out = [...(T.credit_tags ?? [])];
  const add = (row) => {
    if (have.has(row.id)) return;
    const c = checkTag({ ...row, item_kind: row.item_kind }, { item: { id: row.item_id, live: true }, stacks: T.credit_stacks.map((s) => s.id), existing: null });
    if (c !== 'ok') throw new Error(`fs29: tag ${row.id} fails checkTag (${c})`);
    have.add(row.id);
    out.push({ ...row, credits: creditsOf(row.notional_hours), indicative: true, status: 'published', listed: true, source_url: NQF_URL, as_of: AS_OF, version: 1, updated_by: 'p-training-mgr', updated_at: TS(AS_OF) });
  };
  for (const c of T.courses) {
    if ((c.competency_ids ?? []).some((k) => sec.has(k))) continue;
    const links = (T.course_skill_links ?? []).filter((l) => l.course_id === c.id && l.active !== false);
    const lv = Math.max(0, ...links.map((l) => Number(l.level) || 0));
    const nqf = lv ? nqfForLevel(Math.min(4, lv)) : c.qualifying ? 4 : 3;
    const factor = ['classroom', 'elearning', 'blended', 'external'].includes(c.modality) ? 2 : 1.5;
    const hours = Math.max(2, Math.min(1200, Math.round(Number(c.duration_hours ?? 8) * factor)));
    add({
      id: tagId('course', c.id), item_kind: 'course', item_id: c.id, title_en: c.title_en, title_ar: c.title_ar, nqf_level: nqf, notional_hours: hours,
      basis_en: `${c.duration_hours ?? 8} contact hours x ${factor} for study and practice; level from the course's skill objectives (Kafa'a level ${lv || (c.qualifying ? 2 : 1)}).`,
      basis_ar: `${c.duration_hours ?? 8} ساعة تواصل × ${factor} للدراسة والممارسة؛ المستوى مأخوذ من أهداف المهارات في الدورة (مستوى كفاءة ${lv || (c.qualifying ? 2 : 1)}).`,
      stack_ids: stackOf(links.map((l) => l.skill_id)).slice(0, 4),
    });
  }
  for (const p of T.pathways.filter((x) => x.status === 'published')) {
    const hours = Math.max(4, Math.round(Number(p.envelope_months) * Number(p.weekly_hours) * 4 * 0.4));
    add({
      id: tagId('pathway', p.id), item_kind: 'pathway', item_id: p.id, title_en: p.title_en, title_ar: p.title_ar, nqf_level: nqfForLevel(Number(p.level)) ?? 3, notional_hours: hours,
      basis_en: `Practice and project component only (40% of ${p.envelope_months} months at ${p.weekly_hours} h a week); the pathway's courses count separately.`,
      basis_ar: `مكوّن الممارسة والمشروع فقط (40% من ${p.envelope_months} أشهر بمعدل ${p.weekly_hours} ساعة أسبوعياً)؛ تُحتسب دورات المسار بشكل منفصل.`,
      stack_ids: stackOf([p.skill_id]),
    });
  }
  for (const d of T.microcred_defs.filter((x) => x.status === 'current')) {
    const al = (Array.isArray(d.alignment) ? d.alignment : []).map((a) => a.skill_id).filter((x) => skills.has(x));
    const hours = Math.max(5, Math.round(Number(d.hours ?? 20) * 0.5));
    add({
      id: tagId('microcred', d.id), item_kind: 'microcred', item_id: d.id, title_en: d.title_en, title_ar: d.title_ar,
      nqf_level: ({ foundation: 3, practitioner: 4, advanced: 5 })[d.level] ?? 4, notional_hours: hours,
      basis_en: `Evidence review and assessment component (half of the ${d.hours ?? 20} learning hours); courses in the criteria count separately.`,
      basis_ar: `مكوّن مراجعة الأدلة والتقييم (نصف ساعات التعلم البالغة ${d.hours ?? 20})؛ تُحتسب الدورات الواردة في المعايير بشكل منفصل.`,
      stack_ids: stackOf(al),
    });
  }
  T.credit_tags = out.sort(byId);
  return T.credit_tags;
}

/** Credit ledger for everyone (creditsFor). */
export function rebuildLedger(T) {
  const people = new Set([...T.training_records.map((r) => r.person_id), ...T.pathway_enrolments.filter((r) => r.status === 'completed').map((r) => r.person_id),
    ...T.microcred_awards.filter((r) => r.status === 'awarded').map((r) => r.person_id), ...T.rpl_requests.filter((r) => r.status === 'decided').map((r) => r.person_id)]);
  const rows = [];
  for (const p of [...people].sort()) for (const r of creditsFor(p, T)) rows.push({ ...r, status: 'counted', updated_at: TS(AS_OF) });
  T.credit_ledger = rows.sort(byId);
  return rows;
}

export function finalize(T, ctx) {
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  T.credit_stacks = STACKS.map(({ areas, ...s }) => ({
    ...s, partner_en: PARTNER.en, partner_ar: PARTNER.ar, credits_required: 30, rpl_max: 10, status: 'indicative', source_url: WAM_URL, as_of: AS_OF, benchmark_ids: ['UAE-NQF', 'ENTITLE'],
    skill_ids: T.skills.filter((k) => areas.includes(k.fs_area ?? '') || (!k.fs_area && areas.includes(k.area))).filter((k) => k.area !== 'security' && k.lifecycle !== 'obsolete').map((k) => k.id).sort(cmp),
  }));
  ensureCreditTags(T);
  T.rpl_requests = [];
  T.rpl_evidence = [];
  const people = new Map(T.people.map((p) => [p.id, p]));
  const notes = [];
  const notify = (id, pid, en, ar, link, severity, on) => notes.push({ id, person_id: pid, kind: 'recognition', title_en: en, title_ar: ar, body_en: null, body_ar: null, link, severity, created_at: TS(on), read_at: null });
  const opened = (pid) => T.rpl_requests.filter((r) => r.person_id === pid).length;
  const roleOf = (pid) => people.get(pid)?.job_role_id ? T.job_roles.find((j) => j.id === people.get(pid).job_role_id) : null;
  const ASSESSOR_ROLE = { 'p-training-mgr': 'instructor', 'p-sq-lead': 'instructor', 'p-head-sq': 'instructor', 'p-k-instructor': 'instructor', 'p-chco': 'hr_director', 'p-rp-lead': 'instructor' };
  const BEHALF_ROLE = { 'p-training-mgr': 'instructor' };

  function open(spec) {
    const pid = spec.person;
    const p = people.get(pid);
    const by = spec.by ?? pid;
    const tk = spec.skill ? 'skill' : 'credential';
    const sk = spec.skill ? skills.get(spec.skill) : null;
    const def = spec.def ? T.microcred_defs.find((d) => d.id === spec.def) : null;
    const al = def ? def.alignment : [];
    const range = sk ? T.skill_level_ranges.find((r) => r.skill_id === sk.id) : null;
    const held = tk === 'skill' ? T.person_skills.some((x) => x.person_id === pid && x.skill_id === sk.id && x.active !== false && x.level >= spec.level && ['verified', 'evidenced'].includes(x.basis))
      : T.microcred_awards.some((a) => a.person_id === pid && a.def_id === def.id && a.status === 'awarded');
    const input = { person_id: by === pid ? undefined : pid, target_kind: tk, skill_id: spec.skill, microcred_def_id: spec.def, level: spec.level, narrative_en: spec.en, narrative_ar: spec.ar };
    const c = checkOpen(input, {
      me: by, assessor: by !== pid, own: by === pid, person: { id: p.id, kind: p.kind, status: p.status }, skill: sk ? { id: sk.id, area: sk.area, fs_area: sk.fs_area, lifecycle: sk.lifecycle } : null,
      range: range ? { min_level: range.min_level, max_level: range.max_level } : null, def: def ? { id: def.id, status: def.status, restricted: false } : null, held, open: false,
    });
    if (c !== 'ok') throw new Error(`fs29: open ${pid} ${spec.skill ?? spec.def} fails checkOpen (${c})`);
    const id = requestId(pid, opened(pid) + 1);
    const row = {
      id, person_id: pid, person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, person_kind: p.kind, org_id: p.org_id ?? null, target_kind: tk,
      skill_id: sk?.id ?? null, microcred_def_id: def?.id ?? null, level: tk === 'skill' ? spec.level : null,
      target_title_en: sk ? sk.name_en : def.title_en, target_title_ar: sk ? sk.name_ar : def.title_ar, target_skill_ids: sk ? [sk.id] : [...new Set(al.map((a) => a.skill_id))].sort(cmp),
      narrative_en: spec.en, narrative_ar: spec.ar ?? '', status: 'draft', opened_by: by, opened_role: by === pid ? 'employee' : BEHALF_ROLE[by], submitted_on: null,
      outcome: null, credited_level: null, hours: 0, nqf_level: null, rationale_en: null, rationale_ar: null, recommended_by: null, recommended_role: null, recommended_on: null,
      return_note: null, return_count: 0, decided_by: null, decided_role: null, decided_on: null, rpl_statement_en: null, rpl_statement_ar: null, evidence_ids: [],
      export_count: 0, exported_at: null, withdrawn_on: null, created_at: TS(spec.on), updated_at: TS(spec.on),
    };
    T.rpl_requests.push(row);
    const opts = rplOptions(pid, T);
    const ev = () => T.rpl_evidence.filter((e) => e.request_id === id);
    // records: pick by kind in option order (most relevant first: options naming the target skill)
    const target = new Set(row.target_skill_ids);
    for (const [kind, n] of Object.entries(spec.records ?? {})) {
      const pool = opts.filter((o) => o.kind === kind && !o.restricted && (kind !== 'qualification' || o.mirror_status === 'qualified'))
        .sort((a, b) => Number(b.skill_ids.some((x) => target.has(x))) - Number(a.skill_ids.some((x) => target.has(x))));
      for (const o of pool.slice(0, n)) {
        const act = ev().filter((e) => e.active);
        const ca = checkAttach({ kind, ref_table: o.ref_table, ref_id: o.ref_id }, { count: act.length, option: o, duplicate: act.some((e) => e.ref_id === o.ref_id), attester: null, person: pid, opener: by });
        if (ca !== 'ok') throw new Error(`fs29: attach ${o.ref_id} fails (${ca})`);
        T.rpl_evidence.push({
          id: evidenceRowId(id, ev().length + 1), request_id: id, person_id: pid, kind, ref_table: o.ref_table, ref_id: o.ref_id, title_en: o.title_en, title_ar: o.title_ar,
          detail_en: o.detail_en, detail_ar: o.detail_ar, observed_on: o.observed_on, mirror: o.mirror, mirror_status: o.mirror_status, skill_ids: o.skill_ids,
          attester_id: null, attester_role_en: null, attester_role_ar: null, request_note: null, attestation_status: null, attestation_en: null, attestation_ar: null, attested_on: null,
          target_title_en: row.target_title_en, target_title_ar: row.target_title_ar, requester_name: row.person_name, requester_name_ar: row.person_name_ar, active: true, added_by: by,
          created_at: TS(spec.on), updated_at: TS(spec.on),
        });
      }
      if (pool.length < n) throw new Error(`fs29: ${pid} has ${pool.length} ${kind} records, ${n} wanted`);
    }
    if (spec.attest) {
      const a = people.get(spec.attest.by);
      const act = ev().filter((e) => e.active);
      const ca = checkAttach({ kind: 'attestation', attester_id: a.id, note: spec.attest.note }, { count: act.length, option: null, duplicate: false, attester: { id: a.id, kind: a.kind, status: a.status }, person: pid, opener: by });
      if (ca !== 'ok') throw new Error(`fs29: attestation for ${id} fails (${ca})`);
      const jr = roleOf(a.id);
      const eid = evidenceRowId(id, ev().length + 1);
      const st = spec.attest.status ?? 'confirmed';
      T.rpl_evidence.push({
        id: eid, request_id: id, person_id: pid, kind: 'attestation', ref_table: null, ref_id: null, title_en: 'Supervisor attestation', title_ar: 'إفادة المشرف',
        detail_en: jr ? jr.title_en : '', detail_ar: jr ? jr.title_ar : '', observed_on: null, mirror: false, mirror_status: null, skill_ids: [...row.target_skill_ids],
        attester_id: a.id, attester_role_en: jr ? jr.title_en : 'Supervisor', attester_role_ar: jr ? jr.title_ar : 'المشرف', request_note: spec.attest.note, attestation_status: st,
        attestation_en: st === 'confirmed' ? spec.attest.en : null, attestation_ar: st === 'confirmed' ? spec.attest.ar : null, attested_on: st === 'confirmed' ? spec.attest.on : null,
        target_title_en: row.target_title_en, target_title_ar: row.target_title_ar, requester_name: row.person_name, requester_name_ar: row.person_name_ar, active: true, added_by: by,
        created_at: TS(spec.on), updated_at: TS(spec.attest.on ?? spec.on),
      });
      if (st === 'requested') notify(`nt-rpl-${eid}-attest`, a.id, `Attestation requested for an RPL pack: ${row.target_title_en}`, `طُلبت إفادتك لحزمة اعتراف بالتعلم السابق: ${row.target_title_ar}`, '/my/recognition?tab=attest', 'info', spec.on);
    }
    if (spec.detach) { const e = ev().find((x) => x.kind === spec.detach); if (e) e.active = false; }
    if (!spec.submit) {
      if (spec.withdraw) Object.assign(row, { status: 'withdrawn', withdrawn_on: spec.withdraw, updated_at: TS(spec.withdraw) });
      return row;
    }
    const cs = checkSubmit(ev());
    if (cs !== 'ok') throw new Error(`fs29: submit ${id} fails (${cs})`);
    Object.assign(row, { status: 'submitted', submitted_on: spec.submit, updated_at: TS(spec.submit) });
    notify(`nt-rpl-${id}-submitted-p-training-mgr`, 'p-training-mgr', `RPL request to assess: ${row.target_title_en}`, `طلب اعتراف بالتعلم السابق للتقييم: ${row.target_title_ar}`, `/recognition/review/${id}`, 'info', spec.submit);
    if (spec.returned) {
      Object.assign(row, { return_note: spec.returned.note, return_count: 1 });
    }
    if (!spec.recommend) return row;
    const r = spec.recommend;
    const maxAl = (al ?? []).reduce((m, a) => Math.max(m, a.level), 0);
    const cd = checkDecide({ action: 'recommend', outcome: r.outcome, credited_level: r.level ?? null, hours: r.hours, rationale_en: r.en, rationale_ar: r.ar }, row, r.by, maxAl);
    if (cd !== 'ok') throw new Error(`fs29: recommend ${id} fails (${cd})`);
    const nqf = r.outcome === 'not_yet' ? null : tk === 'skill' ? nqfForLevel(r.level) : (T.credit_tags.find((t) => t.id === tagId('microcred', def.id))?.nqf_level ?? nqfForLevel(maxAl));
    Object.assign(row, { status: 'recommended', outcome: r.outcome, credited_level: tk === 'skill' && r.outcome !== 'not_yet' ? r.level : null, hours: r.hours, nqf_level: nqf,
      rationale_en: r.en, rationale_ar: r.ar, recommended_by: r.by, recommended_role: ASSESSOR_ROLE[r.by], recommended_on: r.on, updated_at: TS(r.on) });
    if (r.by !== 'p-training-mgr') notify(`nt-rpl-${id}-recommended-${row.return_count}-p-training-mgr`, 'p-training-mgr', `RPL recommendation awaiting a second assessor: ${row.target_title_en}`, `توصية اعتراف بالتعلم السابق بانتظار مقيّم ثانٍ: ${row.target_title_ar}`, `/recognition/review/${id}`, 'info', r.on);
    if (!spec.confirm) return row;
    const k = spec.confirm;
    const cc = checkDecide({ action: 'confirm' }, row, k.by);
    if (cc !== 'ok') throw new Error(`fs29: confirm ${id} fails (${cc})`);
    const st = rplStatement({ ...row, decided_on: k.on }, ev());
    const credited = creditedSkills(row, al ?? []);
    if (credited.some((x) => !skills.get(x.skill_id)?.fs_area)) throw new Error(`fs29: seeded RPL credit must name FS02 skills only (${id})`);
    const ids = credited.map((x) => rplEvidenceId(id, x.skill_id));
    for (const x of credited) T.skill_evidence.push({
      id: rplEvidenceId(id, x.skill_id), person_id: pid, skill_id: x.skill_id, kind: 'credential', ref_table: 'rpl_requests', ref_id: id, level: x.level, basis: 'validated', status: 'current',
      observed_on: k.on, note: `RPL ${row.outcome}`, recorded_by: k.by, active: true, created_at: TS(k.on), org_id: null, contractor: false,
    });
    Object.assign(row, { status: 'decided', decided_by: k.by, decided_role: ASSESSOR_ROLE[k.by], decided_on: k.on, rpl_statement_en: st.en, rpl_statement_ar: st.ar, evidence_ids: ids, updated_at: TS(k.on),
      export_count: k.exported ? 1 : 0, exported_at: k.exported ? TS(k.exported) : null });
    const outEn = row.outcome === 'full' ? 'full credit' : row.outcome === 'partial' ? 'partial credit' : 'not yet';
    const outAr = row.outcome === 'full' ? 'اعتراف كامل' : row.outcome === 'partial' ? 'اعتراف جزئي' : 'ليس بعد';
    notify(`nt-rpl-${id}-decided-${pid}`, pid, `RPL decision: ${outEn} (${row.target_title_en})`, `قرار الاعتراف بالتعلم السابق: ${outAr} (${row.target_title_ar})`, `/my/recognition/rpl/${id}`, row.outcome === 'not_yet' ? 'info' : 'ok', k.on);
    return row;
  }

  const ATT_SRO = { by: 'p-ops-ceo', on: '2026-09-15', note: 'Please confirm the systems view I bring to shift turnovers and event reviews.',
    en: 'Over six years as shift manager they led crew briefings that trace plant effects across systems, and their event reviews consistently connect operator actions, equipment and procedures.',
    ar: 'على مدى ست سنوات بصفته مدير وردية قاد إحاطات الطاقم التي تتتبع آثار المحطة عبر الأنظمة، وتربط مراجعاته للأحداث باستمرار بين إجراءات المشغلين والمعدات والإجراءات المكتوبة.' };
  // 1-7: decided (full / partial / not yet), FS02 skills only for credit
  open({ person: 'p-sro', skill: 'sk-fs-tr-systems', level: 3, on: '2026-09-02', submit: '2026-09-16', records: { simulator: 3, qualification: 1 }, attest: ATT_SRO,
    en: 'Ten years in the control room and six as shift manager: I trace how one plant change ripples through systems, crews and procedures, and I lead the debriefs where we do that together.',
    ar: 'عشر سنوات في غرفة التحكم وست سنوات مديراً للوردية: أتتبع كيف ينعكس تغيير واحد في المحطة على الأنظمة والأطقم والإجراءات، وأقود جلسات الاستخلاص التي نقوم فيها بذلك معاً.',
    recommend: { by: 'p-sq-lead', on: '2026-09-22', outcome: 'full', level: 3, hours: 60,
      en: 'Three recent simulator debriefs as shift supervisor, a current SRO qualification mirror and a confirmed attestation show independent systems thinking under pressure.',
      ar: 'ثلاث جلسات استخلاص حديثة على المحاكي بصفة مشرف وردية، ومرآة تأهيل حالية لمشغّل أول، وإفادة مؤكدة تُظهر تفكيراً منظومياً مستقلاً تحت الضغط.' },
    confirm: { by: 'p-training-mgr', on: '2026-09-24', exported: '2026-09-25' } });
  open({ person: 'w-ro-02', skill: 'sk-fs-ai-anomaly', level: 2, on: '2026-08-20', submit: '2026-08-28', records: { simulator: 3 },
    attest: { by: 'w-ss-01', on: '2026-08-26', note: 'Confirm my work spotting abnormal trends early on the plant computer.', en: 'They regularly flag drifting indications before alarms and explain why; they have not yet worked with automated anomaly tools.', ar: 'ينبّه بانتظام إلى المؤشرات المنحرفة قبل الإنذارات ويشرح السبب؛ ولم يعمل بعد بأدوات الكشف الآلي عن الشذوذ.' },
    en: 'I watch trends on the plant computer and catch drifting indications early in simulator scenarios; I want this recognised as a step toward anomaly triage.',
    ar: 'أراقب الاتجاهات على حاسوب المحطة وألتقط المؤشرات المنحرفة مبكراً في سيناريوهات المحاكي؛ وأريد الاعتراف بذلك خطوةً نحو فرز الحالات الشاذة.',
    recommend: { by: 'p-head-sq', on: '2026-09-03', outcome: 'partial', level: 1, hours: 20,
      en: 'Strong manual trend recognition, but no evidence yet of working with automated anomaly detection; level 1 now, level 2 after the FS19 course.',
      ar: 'تمييز يدوي قوي للاتجاهات، لكن لا دليل بعد على العمل مع الكشف الآلي عن الشذوذ؛ المستوى 1 الآن والمستوى 2 بعد دورة FS19.' },
    confirm: { by: 'p-training-mgr', on: '2026-09-05' } });
  open({ person: 'w-lo-01', skill: 'sk-fs-dp-rounds', level: 2, on: '2026-08-05', submit: '2026-08-12', records: { simulator: 1, engagement: 2 },
    attest: { by: 'w-ss-02', on: '2026-08-10', note: 'Confirm my electronic rounds during the tablet pilot.', en: 'They completed electronic operator rounds on the turbine building route throughout the tablet pilot and raised two data-quality issues.', ar: 'أكمل جولات المشغّل الإلكترونية على مسار مبنى التوربين طوال تجربة الأجهزة اللوحية وأثار مسألتين تتعلقان بجودة البيانات.' },
    en: 'I ran electronic rounds on my watch station during the tablet pilot and helped fix the route data.',
    ar: 'نفّذت الجولات الإلكترونية في محطة مراقبتي خلال تجربة الأجهزة اللوحية وساعدت في تصحيح بيانات المسار.',
    recommend: { by: 'p-k-instructor', on: '2026-08-19', outcome: 'full', level: 2, hours: 30,
      en: 'A confirmed attestation and two signed-off engagements show electronic rounds practised at level 2.', ar: 'إفادة مؤكدة ومهمتان معتمدتان تُظهر ممارسة الجولات الإلكترونية بالمستوى 2.' },
    confirm: { by: 'p-chco', on: '2026-08-21' } });
  open({ person: 'w-sro-04', skill: 'sk-fs-tr-leadership', level: 3, on: '2026-07-14', submit: '2026-07-20', records: { simulator: 2, engagement: 1 },
    en: 'I lead my crew in simulator scenarios and have coordinated outage support; I would like leadership at level 3 recognised.',
    ar: 'أقود طاقمي في سيناريوهات المحاكي ونسّقت دعم الانقطاع؛ وأرغب في الاعتراف بمهارة القيادة بالمستوى 3.',
    recommend: { by: 'p-sq-lead', on: '2026-07-30', outcome: 'not_yet', hours: 0,
      en: 'The records show crew coordination but not leading change or developing others; add a supervisor attestation and a coaching record, then re-apply.',
      ar: 'تُظهر السجلات تنسيق الطاقم لكن لا تُظهر قيادة التغيير أو تطوير الآخرين؛ أضف إفادة مشرف وسجل توجيه ثم أعد التقديم.' },
    confirm: { by: 'p-training-mgr', on: '2026-08-02' } });
  open({ person: 'w-chem-03', skill: 'sk-fs-gr-circular', level: 2, on: '2026-08-11', submit: '2026-08-18', records: { ojt: 2, engagement: 1, qualification: 1 },
    en: 'I run resin and chemical waste minimisation in the chemistry lab and joined the waste-reduction gig.',
    ar: 'أدير تقليل نفايات الراتنج والمواد الكيميائية في مختبر الكيمياء وشاركت في مهمة خفض النفايات.',
    recommend: { by: 'p-rp-lead', on: '2026-08-27', outcome: 'full', level: 2, hours: 24,
      en: 'OJT on waste handling, a completed gig and a current chemistry qualification mirror support circular practice at level 2.', ar: 'الممارسة أثناء العمل في التعامل مع النفايات ومهمة مكتملة ومرآة تأهيل كيميائي حالية تدعم الممارسة الدائرية بالمستوى 2.' },
    confirm: { by: 'p-training-mgr', on: '2026-08-29' } });
  open({ person: 'w-eng-02', skill: 'sk-fs-adv-passive', level: 2, on: '2026-07-01', submit: '2026-07-08', records: { engagement: 2, qualification: 1 },
    en: 'My rotations in design engineering covered passive cooling features of the APR-1400 and a review of SMR passive safety papers.',
    ar: 'شملت فترات تدويري في الهندسة التصميمية خصائص التبريد الذاتي في APR-1400 ومراجعة أوراق السلامة الذاتية للمفاعلات المعيارية الصغيرة.',
    recommend: { by: 'p-head-sq', on: '2026-07-15', outcome: 'partial', level: 1, hours: 15,
      en: 'Rotations show awareness of passive features; level 2 needs an applied analysis, for example the FS19 passive safety course project.', ar: 'تُظهر فترات التدوير إلماماً بالخصائص الذاتية؛ ويتطلب المستوى 2 تحليلاً تطبيقياً مثل مشروع دورة السلامة الذاتية ضمن FS19.' },
    confirm: { by: 'p-chco', on: '2026-07-18' } });
  const credDef = (pid, want) => {
    const d = T.microcred_defs.find((x) => x.id === want && x.status === 'current');
    if (!d || T.microcred_awards.some((a) => a.person_id === pid && a.def_id === want && a.status === 'awarded')) throw new Error(`fs29: ${pid} cannot request ${want}`);
    return d;
  };
  open({ person: 'w-qa-01', def: credDef('w-qa-01', 'mcd-mc-oe-review-v1').id, on: '2026-06-10', submit: '2026-06-15', records: { engagement: 2, qualification: 1 },
    en: 'My QA audits follow up operating experience reports and their corrective actions, which this micro-credential asks for.', ar: 'تتابع عمليات التدقيق التي أجريها تقارير الخبرة التشغيلية وإجراءاتها التصحيحية، وهو ما تتطلبه هذه الشهادة المصغرة.',
    recommend: { by: 'p-sq-lead', on: '2026-06-24', outcome: 'not_yet', hours: 0,
      en: 'The audits are relevant but none records an operating experience review you led; add a reviewed OE report and re-apply.', ar: 'عمليات التدقيق ذات صلة لكن لا يسجل أي منها مراجعة للخبرة التشغيلية قدتها بنفسك؛ أضف تقريراً مراجَعاً للخبرة التشغيلية ثم أعد التقديم.' },
    confirm: { by: 'p-training-mgr', on: '2026-06-26' } });
  // 8-15: open states for the demo
  const loSkill = (() => {
    const counts = new Map();
    for (const o of rplOptions('p-k-lo-trainee', T)) if (o.kind === 'ojt') for (const s of o.skill_ids) counts.set(s, (counts.get(s) ?? 0) + 1);
    const ok = [...counts.entries()].filter(([s]) => !skills.get(s).fs_area && !T.person_skills.some((x) => x.person_id === 'p-k-lo-trainee' && x.skill_id === s && x.level >= 2 && ['verified', 'evidenced'].includes(x.basis)));
    return ok.sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))[0][0];
  })();
  open({ person: 'p-k-lo-trainee', skill: loSkill, level: 2, on: '2026-09-20', submit: '2026-09-26', records: { ojt: 3, simulator: 1 },
    en: 'Sixteen acknowledged OJT entries on my watch stations and simulator practice: I perform these tasks with the preceptor watching, not just walk through them.',
    ar: 'ست عشرة ممارسة أثناء العمل أقرّها الموجّه في محطات مراقبتي وتمرين على المحاكي: أؤدي هذه المهام والموجّه يراقب، لا أكتفي بشرحها.',
    recommend: { by: 'p-k-instructor', on: '2026-10-02', outcome: 'full', level: 2, hours: 40,
      en: 'Three performed OJT tasks acknowledged by preceptors and a simulator session support level 2 on this skill.', ar: 'ثلاث مهام منفّذة أثناء العمل أقرّها الموجّهون وجلسة على المحاكي تدعم المستوى 2 في هذه المهارة.' } });
  open({ person: 'p-k-ro', def: credDef('p-k-ro', 'mcd-mc-coach-v1').id, on: '2026-09-18', submit: '2026-09-23', records: { simulator: 2, qualification: 1 },
    en: 'Two years coaching newer crew members on shift and in the simulator, with structured briefs and debriefs; I would like this micro-credential recognised from that practice.',
    ar: 'عامان من توجيه أعضاء الطاقم الأحدث أثناء الوردية وعلى المحاكي بإحاطات وجلسات استخلاص منظمة؛ وأرغب في الاعتراف بهذه الشهادة المصغرة استناداً إلى تلك الممارسة.',
    recommend: { by: 'p-sq-lead', on: '2026-10-01', outcome: 'full', hours: 8,
      en: 'Simulator debriefs repeatedly record coaching of less experienced crew members through briefs and peer checks; the mirror shows a current qualification.', ar: 'تسجل جلسات استخلاص المحاكي مراراً توجيه أعضاء الطاقم الأقل خبرة عبر الإحاطات وتحقق الزملاء؛ وتُظهر المرآة تأهيلاً حالياً.' } });
  open({ person: 'p-nse', skill: 'sk-fs-dp-procurement', level: 2, on: '2026-09-25', submit: '2026-10-01', records: { engagement: 2, qualification: 1 },
    attest: { by: 'p-cpo', on: '2026-09-30', note: 'Confirm my work on the e-procurement and digital supplier records pilot.', en: 'They ran supplier qualification on the new digital procurement records for two quarters and trained two colleagues on it.', ar: 'أدار تأهيل الموردين على سجلات المشتريات الرقمية الجديدة لربعين ودرّب زميلين على ذلك.' },
    en: 'I moved our supplier qualification files to the digital procurement records and use them daily.', ar: 'نقلت ملفات تأهيل الموردين لدينا إلى سجلات المشتريات الرقمية وأستخدمها يومياً.' });
  open({ person: 'p-qc-inspector', skill: 'sk-fs-dp-ework', level: 2, on: '2026-10-06', records: { ojt: 2 },
    attest: { by: 'p-outage-manager', status: 'requested', note: 'Please confirm my use of electronic work packages during the last outage.' },
    en: 'I inspected against electronic work packages through the last outage and logged hold points on the tablet.', ar: 'أجريت الفحوصات وفق حزم العمل الإلكترونية طوال الانقطاع الأخير وسجّلت نقاط التوقف على الجهاز اللوحي.' });
  const ceSkill = (() => {
    const o = rplOptions('p-k-contractor', T).find((x) => x.kind === 'engagement' && x.skill_ids.length);
    return o.skill_ids.find((s) => !skills.get(s).fs_area && !T.person_skills.some((x) => x.person_id === 'p-k-contractor' && x.skill_id === s && x.level >= 3 && ['verified', 'evidenced'].includes(x.basis)));
  })();
  open({ person: 'p-k-contractor', by: 'p-training-mgr', skill: ceSkill, level: 3, on: '2026-09-29', submit: '2026-10-03', records: { engagement: 2 },
    en: 'Opened on behalf of the contractor: three signed-off outage engagements at Barakah, mirrored from the supplier passport.',
    ar: 'فُتح نيابةً عن المقاول: ثلاث مهام انقطاع معتمدة في براكة، منقولة من جواز المورد.' });
  open({ person: 'w-ss-01', skill: 'sk-fs-tr-resilience', level: 3, on: '2026-09-01', submit: '2026-09-08', records: { simulator: 3 },
    attest: { by: 'p-ops-ceo', on: '2026-09-07', note: 'Confirm how I led the crew through the extended outage shifts.', en: 'They kept the crew steady through extended outage shifts and two emergent issues, and rebuilt the rota so fatigue stayed managed.', ar: 'حافظ على ثبات الطاقم خلال نوبات الانقطاع الممتدة ومسألتين طارئتين، وأعاد بناء جدول المناوبات بحيث بقي الإرهاق تحت السيطرة.' },
    returned: { note: 'The first recommendation credited level 3 without linking the debriefs to resilience; please review the evidence again.' },
    en: 'I have led my crew through demanding emergency scenarios and long outage shifts.', ar: 'قدت طاقمي خلال سيناريوهات طوارئ صعبة ونوبات انقطاع طويلة.' });
  open({ person: 'p-sro', skill: 'sk-fs-ai-verify', level: 3, on: '2026-10-03', submit: '2026-10-07', records: { simulator: 2 },
    attest: { by: 'p-ops-ceo', on: '2026-10-06', note: 'Confirm I challenge computer-generated advice in the control room before acting.', en: 'They insist on independent verification of computed plant advice before crews act and coach operators to question it.', ar: 'يصرّ على التحقق المستقل من النصائح المحسوبة للمحطة قبل تصرّف الأطقم ويوجّه المشغلين إلى مساءلتها.' },
    en: 'In the control room I verify computed advice against independent indications before we act, and I coach my crew to do the same.',
    ar: 'في غرفة التحكم أتحقق من النصائح المحسوبة مقابل مؤشرات مستقلة قبل أن نتصرف، وأوجّه طاقمي إلى فعل الشيء نفسه.' });
  open({ person: 'w-ro-05', skill: 'sk-fs-ai-use', level: 3, on: '2026-08-01', records: { simulator: 1 }, withdraw: '2026-08-09',
    en: 'I use the approved AI assistant for procedure lookups and would like this recognised.', ar: 'أستخدم المساعد المعتمد للذكاء الاصطناعي للبحث في الإجراءات وأرغب في الاعتراف بذلك.' });
  T.rpl_requests.sort(byId);
  T.rpl_evidence.sort(byId);
  T.notifications = [...T.notifications.filter((n) => !n.id.startsWith('nt-rpl-')), ...notes].sort(byId);
  T.skill_evidence.sort(byId);

  // F01 states for people who received RPL credit (FS03 decay model); the original catalogue stays unchanged
  const who = new Set(T.rpl_requests.filter((r) => r.evidence_ids.length).map((r) => r.person_id));
  const now = '2026-10-08';
  const before = new Map(T.person_skills.map((s) => [s.id, `${s.level}|${s.confidence}|${s.basis}|${s.active}`]));
  const states = deriveStates(T.skill_evidence.filter((e) => who.has(e.person_id)), now, decayModelFrom(T.engine_settings, T.skills));
  const cur = new Map(T.person_skills.map((p) => [p.id, p]));
  let added = 0;
  for (const s of states) {
    const patch = { level: s.level, confidence: s.confidence, basis: s.basis, reasons: s.reasons, evidence_count: s.evidence_count, confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high, active: true };
    const c = cur.get(s.id);
    if (!c) { T.person_skills.push({ id: s.id, person_id: s.person_id, skill_id: s.skill_id, ...patch, org_id: null, contractor: false, updated_at: `${now}T00:00:00Z` }); added++; continue; }
    Object.assign(c, patch);
  }
  T.person_skills.sort(byId);
  const changed = T.person_skills.filter((s) => !skills.get(s.skill_id)?.fs_area && before.has(s.id) && before.get(s.id) !== `${s.level}|${s.confidence}|${s.basis}|${s.active}`);
  if (changed.length) throw new Error(`fs29: ${changed.length} states of the original catalogue changed (${changed[0].id})`);

  // F36 digests read the final states: rebuild them the same way fs19 does
  const oldNotices = new Set((T.digest_runs ?? []).map((r) => r.notification_id).filter(Boolean));
  const beforeDigests = JSON.stringify(T.digest_runs ?? []);
  if (T.digest_runs && T.digest_prefs) {
    T.notifications = T.notifications.filter((n) => !oldNotices.has(n.id));
    rebuildDigests(T, ctx);
  }
  const digestsChanged = beforeDigests !== JSON.stringify(T.digest_runs ?? []);
  rebuildLedger(T);
  const decided = T.rpl_requests.filter((r) => r.status === 'decided');
  console.log(`fs29/30: ${T.credit_stacks.length} stacks, ${T.credit_tags.length} credit tags, ${T.rpl_requests.length} RPL requests (${decided.length} decided), ${T.rpl_evidence.length} evidence items, ${who.size} people credited (${added} new skill states), ${T.credit_ledger.length} ledger rows; digests ${digestsChanged ? 'rebuilt (changed)' : 'unchanged'}`);
}
