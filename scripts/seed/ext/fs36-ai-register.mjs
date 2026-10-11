// FS36 + FS37 (future-skills wave D · E5, M29) seed: the AI-literacy register and the governed AI sandbox drills.
// build():    the register (8 synthetic systems: 6 published, 1 draft, 1 retired; 12 user groups) and 7 drills (6 published, 1 draft)
//             with their keys. Every entry passes the same checks the RPCs apply (systemProblem, drillProblem).
// finalize(): FINALIZE_LAST and, by file name, after fs09 (fitness evidence) and fs21 (adaptive/task evidence): simulates drill
//             attempts June to early October 2026 for about 60% of active non-persona staff plus five demo personas, scored with the
//             server rule (scoreDrill), writes F01 `assessment` evidence (ref_table ai_drill_attempts, level <= 2; the latest attempt on
//             a drill is the active one), re-derives the states of the people concerned, rebuilds the F36 digests, F23 snapshots and F35
//             outlooks from the final states (as fs09 does), and fails the build if a "fully implemented" label is not carried by
//             coverage, any drill evidence exceeds level 2, or the original 71-skill states change.
// Synthetic people only; procedures are SYN- documents marked SYNTHETIC.
import { decayModelFrom, deriveStates, evidenceId } from '../../../src/domain/skills.ts';
import { aiRung } from '../../../src/modules/m29/fluency.ts';
import { isStaff } from '../../../src/modules/m29/fitness.ts';
import { THRESHOLD, rawSystemPct, systemProblem } from '../../../src/modules/m29/register.ts';
import { ERROR_KINDS, drillProblem, normFlags, scoreDrill } from '../../../src/modules/m29/drills.ts';
import { finalize as rebuildDigests } from './f36-digest.mjs';
import { inputFromTables, outlookFor } from '../../../src/modules/m07/outlook.ts';
import { snapshotFrom } from '../../../src/modules/m20/reserve.ts';
import { AILIT, AS_OF, DRILLS, IAEAAI, ADNOC, SYSTEMS, UAEAI, protocolFor } from './fs36-ai-register.data.mjs';

export const FINALIZE_LAST = true;

/** Drill rows (what the taker sees) and key rows (training staff only) from the data file. */
export function drillRows() {
  const drills = [];
  const keys = [];
  DRILLS.forEach((d, i) => {
    const { protocol, key } = protocolFor(d.doc.code, d.rot);
    drills.push({
      id: d.id, title_en: d.title_en, title_ar: d.title_ar, summary_en: d.summary_en, summary_ar: d.summary_ar, scenario_en: d.scenario_en, scenario_ar: d.scenario_ar,
      difficulty: d.difficulty, level: d.level, skill_id: 'sk-fs-ai-verify',
      doc: { code: d.doc.code, revision: d.doc.revision, title_en: d.doc.title_en, title_ar: d.doc.title_ar, steps: d.doc.steps.map((s, n) => { const [en, ar] = s.split('|'); return { n: n + 1, text_en: en, text_ar: ar }; }) },
      output: { tool_en: 'Procedure assistant (SIMULATED AI output)', tool_ar: 'مساعد الإجراءات (مخرجات ذكاء اصطناعي محاكاة)', segments: d.segments },
      protocol, est_minutes: d.est_minutes, synthetic: true, sources: [IAEAAI, AILIT, ADNOC], status: d.status, listed: d.status === 'published', version: 1, sort: i + 1,
      updated_by: 'p-training-mgr', updated_at: `${AS_OF}T08:00:00Z`,
    });
    keys.push({ id: `adk-${d.id}`, drill_id: d.id, errors: d.errors, protocol: key, pass_pct: d.pass_pct });
  });
  return { drills, keys };
}

export default function build(T) {
  const people = new Map(T.people.map((p) => [p.id, p]));
  const staff = T.people.filter((p) => isStaff(p)).map((p) => p.id);
  const families = T.job_families.map((f) => f.id);
  T.ai_systems = [];
  T.ai_system_users = [];
  for (const s of SYSTEMS) {
    const owner = people.get(s.owner);
    if (!owner) throw new Error(`fs36: owner ${s.owner} missing`);
    const input = { ...s, owner_person_id: s.owner };
    const p = systemProblem(input, { families, cells: T.ai_rungs.map((c) => ({ id: c.id, rung: c.rung, dimension: c.dimension })), staff });
    if (p) throw new Error(`fs36: system ${s.id} fails the register check (${p})`);
    const listed = s.status === 'published';
    T.ai_systems.push({
      id: s.id, name_en: s.name_en, name_ar: s.name_ar, purpose_en: s.purpose_en, purpose_ar: s.purpose_ar, ai_role: s.ai_role, use_class: s.use_class, maturity: s.maturity, simulated: s.simulated,
      owner_person_id: s.owner, owner_en: owner.display_name, owner_ar: owner.display_name_ar, oversight_en: s.oversight_en, oversight_ar: s.oversight_ar, measures: s.measures,
      sources: [AILIT, UAEAI], benchmark_ids: ['AI-LIT', 'UAE-AI'], status: s.status, listed, version: 1, review_due: s.review_due, as_of: AS_OF, sort: s.sort,
      updated_by: 'p-ai-governance', updated_at: `${AS_OF}T08:00:00Z`,
    });
    s.groups.forEach((g, i) => T.ai_system_users.push({
      id: `${s.id}-g${i + 1}`, system_id: s.id, label_en: g.label_en, label_ar: g.label_ar, family_ids: g.family_ids, all_staff: g.all_staff, side: g.side, required_rung: g.required_rung,
      required_cells: g.required_cells, rationale_en: g.rationale_en, rationale_ar: g.rationale_ar, active: true, listed, sort: i + 1,
    }));
  }
  const { drills, keys } = drillRows();
  const lit = T.ai_skill_tracks.filter((t) => t.track === 'literacy').map((t) => t.skill_id);
  for (const d of drills) {
    const k = keys.find((x) => x.drill_id === d.id);
    const p = drillProblem({ ...d, key: { errors: k.errors, protocol: k.protocol, pass_pct: k.pass_pct } }, lit);
    if (p) throw new Error(`fs36: drill ${d.id} fails the drill check (${p})`);
  }
  T.ai_drills = drills;
  T.ai_drill_keys = keys;
  T.ai_drill_attempts = [];
}

// ───────────── Simulated drill attempts (finalize)
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }
const rnd = (s) => h32(s) / 4294967296;
const clamp = (x) => Math.max(0.03, Math.min(0.97, x));
const STAFF_ROLES = ['employee', 'licensed_operator', 'manager', 'instructor', 'training_manager', 'licensing_coord', 'hr_analyst', 'hr_director', 'editor', 'ecp_officer', 'admin'];
/** Demo personas with drill history (others start fresh); forced outcomes keep the demo stable: [drill, ability]. */
export const DRILL_PERSONAS = {
  'p-qc-inspector': [['ad-valve-lineup', 0.97], ['ad-mov-pm', 0.2]],
  'p-nse': [['ad-requisition-qa', 0.9]],
  'p-outage-planner': [['ad-valve-lineup', 0.75], ['ad-shift-turnover', 0.6]],
  'p-cap-coord': [['ad-rwp-briefing', 0.85]],
  'p-sq-lead': [['ad-requisition-qa', 0.8], ['ad-feedwater-sample', 0.85]],
};
const day = (iso, add) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + add); return d.toISOString().slice(0, 10); };

/** One simulated submission (flags in segment order, every protocol step answered). */
export function simulateSubmission(drill, key, theta, seed) {
  const errs = new Map(key.errors.map((e) => [e.segment_id, e]));
  const flags = [];
  for (const s of drill.output.segments) {
    const e = errs.get(s.id);
    if (e) {
      if (rnd(`${seed}:f:${s.id}`) < clamp(theta + 0.2 - 0.12 * (drill.difficulty - 1))) {
        const right = rnd(`${seed}:k:${s.id}`) < clamp(theta + 0.05);
        const other = ERROR_KINDS.filter((k) => k !== e.kind);
        flags.push({ segment_id: s.id, kind: right ? e.kind : other[Math.floor(rnd(`${seed}:o:${s.id}`) * other.length)] });
      }
    } else if (rnd(`${seed}:x:${s.id}`) < 0.18 * (1 - theta)) {
      flags.push({ segment_id: s.id, kind: ERROR_KINDS[Math.floor(rnd(`${seed}:xk:${s.id}`) * ERROR_KINDS.length)] });
    }
  }
  const answers = drill.protocol.map((p) => {
    const k = key.protocol.find((x) => x.id === p.id);
    const right = rnd(`${seed}:p:${p.id}`) < clamp(theta + 0.3);
    return { id: p.id, choice: right ? k.correct : (k.correct + 1) % p.options.length };
  });
  return { flags: normFlags(flags), answers };
}

export function simulate(T, now) {
  const drills = T.ai_drills.filter((d) => d.status === 'published');
  const keyOf = new Map(T.ai_drill_keys.map((k) => [k.drill_id, k]));
  const personaIds = new Set(T.people.filter((x) => x.persona_id).map((x) => x.id));
  const roles = new Map();
  for (const r of T.role_assignments ?? []) if (r.status === 'active') (roles.get(r.person_id) ?? roles.set(r.person_id, new Set()).get(r.person_id)).add(r.role);
  const staff = T.people.filter((p) => isStaff(p) && [...(roles.get(p.id) ?? [])].some((r) => STAFF_ROLES.includes(r))).sort((a, b) => (a.id < b.id ? -1 : 1));
  const attempts = [];
  const evidence = [];
  for (const p of staff) {
    const forced = DRILL_PERSONAS[p.id];
    if (!forced && (personaIds.has(p.id) || rnd(`dr:take:${p.id}`) >= 0.6)) continue;
    const base = 0.3 + 0.55 * rnd(`dr:theta:${p.id}`);
    const plan = forced ?? [...drills].sort((a, b) => rnd(`dr:pick:${p.id}:${a.id}`) - rnd(`dr:pick:${p.id}:${b.id}`)).slice(0, 1 + Math.floor(rnd(`dr:n:${p.id}`) * 3)).map((d) => [d.id, base]);
    let date = day('2026-06-01', Math.floor(rnd(`dr:start:${p.id}`) * 90));
    for (const [did, theta] of plan) {
      const d = drills.find((x) => x.id === did);
      const key = keyOf.get(did);
      const k = { errors: key.errors, protocol: key.protocol, pass_pct: key.pass_pct };
      let no = 0;
      let th = theta;
      for (;;) {
        no++;
        if (date > now) break;
        const sub = simulateSubmission(d, key, th, `${p.id}:${did}:${no}`);
        const sc = scoreDrill(k, sub.flags, sub.answers, d.level);
        const mm = 10 + Math.floor(rnd(`dr:m:${p.id}:${did}:${no}`) * 45);
        const id = `da-${p.id.replace(/^[pw]-/, '')}-${did.replace(/^ad-/, '')}-${no}`;
        const ev = sc.passed ? [{ skill_id: d.skill_id, level: sc.level }] : [];
        const { reasons, feedback } = sc;
        attempts.push({
          id, person_id: p.id, drill_id: did, drill_version: d.version, attempt_no: no, flags: sub.flags, answers: sub.answers, points: sc.points, max_points: sc.max, pct: sc.pct,
          found: sc.found, errors: sc.errors, false_flags: sc.false_flags, critical_ok: sc.critical_ok, passed: sc.passed, level: sc.level, feedback, reasons, evidence: ev,
          submitted_at: `${date}T10:${String(mm).padStart(2, '0')}:00Z`,
        });
        for (const e of ev) evidence.push({
          id: evidenceId('assessment', id, e.skill_id), person_id: p.id, skill_id: e.skill_id, kind: 'assessment', ref_table: 'ai_drill_attempts', ref_id: id, level: e.level, basis: 'evidenced',
          status: 'current', observed_on: date, note: `AI sandbox drill ${did}`, recorded_by: p.id, active: true, created_at: `${date}T10:${String(mm).padStart(2, '0')}:00Z`,
        });
        date = day(date, 3 + Math.floor(rnd(`dr:gap:${p.id}:${did}:${no}`) * 14));
        // forced personas never retake (their demo outcome is fixed); others retake a failed drill half of the time, a little better
        if (sc.passed || forced || no >= 2 || rnd(`dr:retake:${p.id}:${did}`) >= 0.5) break;
        th = Math.min(0.95, th + 0.2);
      }
    }
  }
  // The latest attempt on a drill is the active evidence (kept, inactive otherwise), exactly as kafaa_submit_drill / submitDrill do.
  const latest = new Map();
  for (const a of attempts) { const k = `${a.person_id}|${a.drill_id}`; const c = latest.get(k); if (!c || a.submitted_at > c.submitted_at) latest.set(k, a); }
  const active = new Set([...latest.values()].map((a) => a.id));
  for (const e of evidence) e.active = active.has(e.ref_id);
  return { attempts, evidence };
}

export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const { attempts, evidence } = simulate(T, now);
  if (evidence.some((e) => e.level > 2)) throw new Error('fs36: drill evidence above level 2');
  T.ai_drill_attempts = attempts;
  const before71 = new Map(T.person_skills.map((s) => [s.id, `${s.level}|${s.confidence}|${s.basis}|${s.active}`]));
  T.skill_evidence = [...T.skill_evidence, ...evidence].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const people = new Set(evidence.map((e) => e.person_id));
  const states = deriveStates(T.skill_evidence.filter((e) => people.has(e.person_id)), now, decayModelFrom(T.engine_settings, T.skills));
  const byId = new Map(T.person_skills.map((p) => [p.id, p]));
  let added = 0;
  for (const s of states) {
    const patch = { level: s.level, confidence: s.confidence, basis: s.basis, reasons: s.reasons, evidence_count: s.evidence_count, confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high, active: true };
    const cur = byId.get(s.id);
    if (!cur) { T.person_skills.push({ id: s.id, person_id: s.person_id, skill_id: s.skill_id, ...patch, updated_at: `${now}T00:00:00Z` }); added++; continue; }
    Object.assign(cur, patch);
  }
  T.person_skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const fsSkills = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id));
  const changed = T.person_skills.filter((s) => !fsSkills.has(s.skill_id) && before71.has(s.id) && before71.get(s.id) !== `${s.level}|${s.confidence}|${s.basis}|${s.active}`);
  if (changed.length) throw new Error(`fs36: ${changed.length} states of the original catalogue changed (${changed[0].id})`);
  // F36 digests, F23 snapshots and F35 outlooks read the final states: rebuild them the way fs09 does.
  const oldNotices = new Set((T.digest_runs ?? []).map((r) => r.notification_id).filter(Boolean));
  const beforeDigests = JSON.stringify(T.digest_runs ?? []);
  if (T.digest_runs && T.digest_prefs) {
    T.notifications = T.notifications.filter((n) => !oldNotices.has(n.id));
    rebuildDigests(T, ctx);
  }
  const digestsChanged = beforeDigests !== JSON.stringify(T.digest_runs ?? []);
  let snapshots = 0;
  for (const m of T.alumni ?? []) {
    if (!people.has(m.person_id)) continue;
    const snap = snapshotFrom(T.person_skills.filter((s) => s.person_id === m.person_id), T.skills);
    if (JSON.stringify(snap) !== JSON.stringify(m.skill_snapshot)) { m.skill_snapshot = snap; snapshots++; }
  }
  let outlooksChanged = 0;
  if (T.skill_outlooks?.length) {
    const inp = inputFromTables((t) => T[t] ?? []);
    for (const o of T.skill_outlooks) {
      const r = outlookFor(inp, o.params);
      if (r.code !== 'ok') throw new Error(`fs36: outlook ${o.id} ${r.code}`);
      if (JSON.stringify(r.result) !== JSON.stringify(o.results)) outlooksChanged++;
      o.params = r.result.params; o.results = r.result;
    }
  }
  // Acceptance (FS36): a "fully implemented" label must be carried by computed coverage (THRESHOLD %).
  const by = new Map();
  for (const s of T.person_skills) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)).push(s);
  const rungs = T.people.filter((p) => isStaff(p)).map((p) => { const r = aiRung(p.id, T.ai_rungs, T.ai_skill_tracks, by.get(p.id) ?? []); return { person_id: p.id, family_id: p.job_family_id ?? null, rung: r.rung, met: r.cells.filter((c) => c.met).map((c) => c.id) }; });
  const report = [];
  for (const s of T.ai_systems) {
    const pct = rawSystemPct(T.ai_system_users.filter((g) => g.system_id === s.id), rungs);
    report.push(`${s.id.replace(/^ais-/, '')} ${pct}%`);
    if (s.maturity === 'full' && pct < THRESHOLD) throw new Error(`fs36: ${s.id} is labelled fully implemented but only ${pct}% of its users are covered`);
  }
  const passed = attempts.filter((a) => a.passed).length;
  console.log(`fs36: ${T.ai_systems.length} register entries (${report.join(', ')}), ${T.ai_drills.length} drills, ${attempts.length} drill attempts by ${new Set(attempts.map((a) => a.person_id)).size} staff (${passed} passed), ${evidence.length} evidence rows (level <= 2), ${added} new skill states; digests ${digestsChanged ? 'rebuilt (changed)' : 'unchanged'}; F35 outlooks recomputed (${outlooksChanged} changed); ${snapshots} F23 snapshots refreshed`);
}
