/**
 * F03 Skills Passport and F04 Credential Wallet: pure logic shared by the pages, the LocalBackend RPCs and the tests.
 *   - courseAlignment / courseIsSecurity / badgeSourceCheck: which records may become a badge (SQL mirror: kafaa_issue_badge)
 *   - badgeView: effective badge status (active / expired / revoked) from the badge and its source certificate
 *   - radarByDomain / radarByCompetency: current level vs role requirement (and an optional target role)
 *   - expiringQuals / ageingSkills: the "Expiring and decaying" card (qualView notices 90/60/30; evidence ageing)
 *   - transferableStrengths: "Strengths for my next move" (F02 careerMoves + cosine), every item with reasons
 *   - passportJson / passportHtml: the export (Open Badges-style envelope; printable one-page passport, EN/AR)
 * Kafa'a is not an authority: qualification and licence lines are mirrors and are never issued as badges.
 */
import { qualView, daysBetween } from '../../domain/rules';
import { HALF_LIFE_DAYS, type StoredReason } from '../../domain/skills';
import { careerMoves, byCosine, cosine, IMPORTANCE_WEIGHT, type BiText, type Ranked, type Reason, type Weights } from '../../domain/engines';
import { skillVector, roleVector } from '../../domain/engines/skills';
import type { PathEdge, RoleComp } from '../../domain/careerGraph';
import { CONTEXTS, ISSUER_ID, ISSUER_NAME, NOTICE_AR, NOTICE_EN, type Credential } from './issuer';

import { addDays, securityComps, courseIsSecurity, type SkillRow, type CompRow, type CourseRow } from './badgeRules';
export * from './badgeRules';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
export interface StateRow { id: string; person_id: string; skill_id: string; level: number; confidence: number | string; basis: string; reasons: StoredReason[]; evidence_count: number; active?: boolean }

export const LEVEL_MAX = 4;
export const CLAIMS_PER_DAY = 20;
export const NOTE_MAX = 500;
export const AGEING_SOON_DAYS = 180;
export const m17r = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key: `m17.reasons.${code}`, vars, ref });
export const BASIS_TEXT: Record<string, BiText> = {
  verified: { en: 'verified', ar: 'موثّق' }, evidenced: { en: 'evidenced', ar: 'مثبت بالأدلة' }, validated: { en: 'validated', ar: 'معتمد من المدير' }, claimed: { en: 'self-claimed', ar: 'مُدّعى ذاتياً' }, none: { en: 'no evidence', ar: 'بلا أدلة' },
};

// ───────────── radar (F03)
export interface RadarAxis { id: string; label: BiText; current: number; required: number | null; target: number | null }
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0);
/** One axis per competency domain that the role (or target) requires or the person holds. Levels 0-4 (averages). */
export function radarByDomain(have: Map<string, number>, comps: CompRow[], roleComps: RoleComp[], roleId: string | null, targetId: string | null = null): RadarAxis[] {
  const req = (r: string | null) => new Map(roleComps.filter((x) => r && x.role_id === r).map((x) => [x.competency_id, x.required_level]));
  const cur = req(roleId), tgt = req(targetId);
  // security-domain competencies are status only (qualified / not qualified): never on the radar
  comps = comps.filter((c) => c.domain !== 'security');
  const domains = [...new Map(comps.map((c) => [c.domain, c])).values()];
  const out: RadarAxis[] = [];
  for (const d of domains) {
    const inD = comps.filter((c) => c.domain === d.domain);
    const roleIn = inD.filter((c) => cur.has(c.id));
    const tgtIn = inD.filter((c) => tgt.has(c.id));
    const held = inD.filter((c) => (have.get(c.id) ?? 0) > 0);
    if (!roleIn.length && !tgtIn.length && !held.length) continue;
    const basis = roleIn.length ? roleIn : tgtIn.length ? tgtIn : held;
    out.push({
      id: d.domain,
      label: { en: d.domain_en, ar: d.domain_ar },
      current: avg(basis.map((c) => have.get(c.id) ?? 0)),
      required: roleIn.length ? avg(roleIn.map((c) => cur.get(c.id)!)) : null,
      target: tgtIn.length ? avg(tgtIn.map((c) => tgt.get(c.id)!)) : null,
    });
  }
  return out;
}
/** One axis per competency required by the role (and the target role, when chosen). */
export function radarByCompetency(have: Map<string, number>, comps: CompRow[], roleComps: RoleComp[], roleId: string | null, targetId: string | null = null): RadarAxis[] {
  const ids = new Set(roleComps.filter((x) => x.role_id === roleId || (targetId && x.role_id === targetId)).map((x) => x.competency_id));
  const need = (r: string | null, c: string) => roleComps.find((x) => r && x.role_id === r && x.competency_id === c)?.required_level ?? null;
  return comps.filter((c) => ids.has(c.id) && c.domain !== 'security').map((c) => ({ id: c.id, label: { en: `${c.code} ${c.name_en}`, ar: `${c.code} ${c.name_ar}` }, current: have.get(c.id) ?? 0, required: need(roleId, c.id), target: need(targetId, c.id) }));
}
/** Points of a radar polygon (cx, cy centre; radius r; level max 4). RTL mirrors the angle direction. */
export function radarPoints(values: number[], r: number, cx: number, cy: number, rtl = false): [number, number][] {
  const n = values.length;
  return values.map((v, i) => {
    const a = -Math.PI / 2 + ((rtl ? -1 : 1) * 2 * Math.PI * i) / n;
    const k = (Math.max(0, Math.min(LEVEL_MAX, v)) / LEVEL_MAX) * r;
    return [Math.round((cx + Math.cos(a) * k) * 10) / 10, Math.round((cy + Math.sin(a) * k) * 10) / 10];
  });
}

// ───────────── expiring and decaying (F03)
export interface ExpiringQual { id: string; standard_id: string; expires_on: string; days: number; notice: 90 | 60 | 30 | null; view: string }
/** Qualification records due within 90 days (notices 90/60/30) or expired, security-restricted records excluded (status only). */
export function expiringQuals(records: Row[], standards: Row[], today: string): ExpiringQual[] {
  const std = new Map(standards.map((s) => [s.id, s]));
  const now = new Date(`${today}T12:00:00Z`);
  return records
    .filter((r) => r.expires_on && !r.security_mirror_only && !std.get(r.standard_id)?.security_restricted && ['qualified', 'due', 'renewed', 'expired'].includes(r.status))
    .map((r) => { const v = qualView(r, now); return { id: r.id, standard_id: r.standard_id, expires_on: String(r.expires_on).slice(0, 10), days: v.daysToExpiry ?? 0, notice: v.notice, view: v.view as string }; })
    .filter((x) => x.days <= 90)
    .sort((a, b) => a.days - b.days || (a.id < b.id ? -1 : 1));
}
export interface AgeingSkill { skill_id: string; level: number; state: 'ageing' | 'soon' | 'lapsed'; since: string; ages_on: string; days: number; reasons: Reason[] }
/** Skills whose strongest evidence is ageing (older than 36 months, counted one level lower), ageing within 180 days, or a lapsed qualification. */
export function ageingSkills(states: StateRow[], today: string): AgeingSkill[] {
  const out: AgeingSkill[] = [];
  for (const s of states) {
    if (s.active === false || !s.reasons?.length) continue;
    const top = s.reasons[0];
    if (top.code === 'qual') continue; // a current qualification holds while the record is current
    const agesOn = addDays(top.observed_on, HALF_LIFE_DAYS);
    const days = daysBetween(today, agesOn);
    const state: AgeingSkill['state'] | null = top.code === 'qual_lapsed' ? 'lapsed' : top.ageing ? 'ageing' : days <= AGEING_SOON_DAYS ? 'soon' : null;
    if (!state) continue;
    out.push({ skill_id: s.skill_id, level: s.level, state, since: top.observed_on, ages_on: agesOn, days, reasons: [m17r(`ageing_${state}`, { date: state === 'soon' ? agesOn : top.observed_on, level: s.level }, { table: 'skill_evidence', id: top.evidence_id })] });
  }
  const rank = { lapsed: 0, ageing: 1, soon: 2 } as const;
  return out.sort((a, b) => rank[a.state] - rank[b.state] || a.days - b.days || (a.skill_id < b.skill_id ? -1 : 1));
}
/** A refresher course for a skill: a non-security course on the skill's competency, qualifying first, then shortest. */
export function refresherFor(skill: Pick<SkillRow, 'id' | 'competency_id'>, courses: CourseRow[], sec: Set<string>): CourseRow | null {
  const c = courses.filter((x) => (x.competency_ids ?? []).includes(skill.competency_id) && !courseIsSecurity(x, sec))
    .sort((a, b) => Number(!!b.qualifying) - Number(!!a.qualifying) || (a.duration_hours ?? 99) - (b.duration_hours ?? 99) || (a.id < b.id ? -1 : 1));
  return c[0] ?? null;
}

// ───────────── strengths for my next move (F03, F02 engines)
export interface Strength { skill_id: string; competency_id: string; level: number; basis: string; roles: { id: string; need: number; sim: number }[] }
/**
 * Top transferable skills: reachable roles (careerMoves, two steps, security roles path-only and skipped) weighted by the
 * cosine similarity of the person's skill vector to each role vector; a held core skill scores
 * Σ similarity × min(level, need)/need × importance weight over the roles that need it.
 */
export function transferableStrengths(input: {
  states: StateRow[]; skills: SkillRow[]; comps: CompRow[]; have: Map<string, number>; roleComps: RoleComp[]; edges: PathEdge[]; currentRole: string | null;
  pathOnly: string[]; roleLabels: Record<string, BiText>; weights?: Weights; limit?: number;
}): { strengths: Ranked<Strength>[]; roles: Ranked[] } {
  if (!input.currentRole) return { strengths: [], roles: [] };
  const sec = securityComps(input.comps);
  const moves = careerMoves({ from: input.currentRole, edges: input.edges, roleComps: input.roleComps, have: input.have, maxSteps: 2, pathOnly: input.pathOnly, labels: input.roleLabels, weights: input.weights })
    .filter((m) => !input.pathOnly.includes(m.id));
  const me = skillVector(input.states.filter((s) => input.skills.find((k) => k.id === s.skill_id)?.core));
  const skillLabel = Object.fromEntries(input.skills.map((s) => [s.id, { en: s.name_en, ar: s.name_ar }]));
  const roles = byCosine(me, moves.map((m) => ({ id: m.id, vec: roleVector(input.roleComps, m.id) })), { labels: skillLabel });
  const sim = new Map(roles.map((r) => [r.id, cosine(me, roleVector(input.roleComps, r.id))]));
  const out: Ranked<Strength>[] = [];
  for (const st of input.states) {
    const sk = input.skills.find((k) => k.id === st.skill_id);
    if (!sk || !sk.core || st.level <= 0 || st.active === false || sec.has(sk.competency_id)) continue;
    const roleHits: Strength['roles'] = [];
    let score = 0;
    for (const r of roles) {
      const need = input.roleComps.find((x) => x.role_id === r.id && x.competency_id === sk.competency_id);
      if (!need) continue;
      const s = sim.get(r.id) ?? 0;
      score += s * (Math.min(st.level, need.required_level) / need.required_level) * IMPORTANCE_WEIGHT(need.importance, input.weights);
      roleHits.push({ id: r.id, need: need.required_level, sim: s });
    }
    if (!roleHits.length) continue;
    roleHits.sort((a, b) => b.sim - a.sim || (a.id < b.id ? -1 : 1));
    const names = (l: 'en' | 'ar') => roleHits.slice(0, 3).map((h) => input.roleLabels[h.id]?.[l] ?? h.id).join(l === 'ar' ? '، ' : ', ');
    const best = roleHits[0];
    out.push({
      id: sk.id,
      score: Math.round(score * 10000) / 10000,
      item: { skill_id: sk.id, competency_id: sk.competency_id, level: st.level, basis: st.basis, roles: roleHits },
      reasons: [
        m17r('transfer', { n: roleHits.length, roles: { en: names('en'), ar: names('ar') } }),
        m17r('held', { level: st.level, basis: BASIS_TEXT[st.basis] ?? BASIS_TEXT.none }, { table: 'person_skills', id: st.id }),
        m17r('best_role', { role: input.roleLabels[best.id] ?? { en: best.id, ar: best.id }, need: best.need, pct: Math.round(best.sim * 100) }),
      ],
    });
  }
  out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return { strengths: out.slice(0, input.limit ?? 3), roles };
}

// ───────────── export (F03)
export interface PassportModel {
  generated_on: string;
  holder: { name: string; initials: string };
  role: string;
  family: string;
  years: number | null;
  skills: { id: string; code: string; name: string; area: string; level: number; basis: string; confidence: number; required: number | null; evidence: { kind: string; ref: string; observed_on: string; source: string }[] }[];
  quals: { code: string; title: string; status: string; expires_on: string | null }[];
  licence: { type: string; status: string } | null;
  badges: { name: string; status: string; slug: string; issued_on: string }[];
  credentials: Credential[];
}
/** JSON export in the Open Badges-style envelope (a presentation holding the signed badges; the skills list is unsigned). */
export function passportJson(m: PassportModel) {
  return {
    '@context': CONTEXTS,
    type: ['VerifiablePresentation', 'KafaaSkillsPassport'],
    issuer: { id: ISSUER_ID, name: ISSUER_NAME },
    generated: `${m.generated_on}T00:00:00Z`,
    holder: { holderInitials: m.holder.initials, role: m.role, family: m.family },
    kafaaNotice: `${NOTICE_EN} Kafa'a is not an authority: qualification and licence lines mirror the licensee's systems.`,
    kafaaNoticeAr: `${NOTICE_AR} كفاءة ليست جهة اعتماد: بنود المؤهلات والتراخيص نسخة مطابقة لأنظمة المرخَّص له.`,
    skills: m.skills.map((s) => ({
      type: ['Alignment'], targetType: 'ceterms:Skill', targetFramework: "Kafa'a skills catalogue", targetCode: s.code, targetName: s.name, targetUrl: `urn:kafaa:skill:${s.id}`,
      level: s.level, basis: s.basis, confidence: s.confidence, requiredForRole: s.required, evidence: s.evidence,
    })),
    qualifications: m.quals.map((q) => ({ ...q, mirror: true })),
    licence: m.licence ? { ...m.licence, mirror: true } : null,
    verifiableCredential: m.credentials,
  };
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Printable one-page passport (A4), standalone HTML in English or Arabic (RTL). No email, no photo, no task detail. */
export function passportHtml(m: PassportModel, lang: 'en' | 'ar', L: Record<string, string>, fmt: { date: (d: string) => string; num: (n: number) => string }): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const bar = (n: number) => `<span class="lv">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const rows = m.skills.slice(0, 26).map((s) => `<tr><td>${esc(s.code)}</td><td>${esc(s.name)}</td><td>${bar(s.level)} ${fmt.num(s.level)}</td><td>${esc(L[`basis_${s.basis}`] ?? s.basis)}</td><td>${s.required == null ? '—' : fmt.num(s.required)}</td></tr>`).join('');
  const quals = m.quals.map((q) => `<tr><td>${esc(q.code)}</td><td>${esc(q.title)}</td><td>${esc(q.status)}</td><td>${q.expires_on ? esc(fmt.date(q.expires_on)) : '—'}</td></tr>`).join('');
  const badges = m.badges.map((b) => `<li>${esc(b.name)} · ${esc(b.status)} · ${esc(fmt.date(b.issued_on))} · <code>${esc(b.slug)}</code></li>`).join('');
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(L.title)}</title><style>
@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:10.5px/1.4 system-ui,"Segoe UI","IBM Plex Sans Arabic",sans-serif;color:#111;margin:0}
h1{font-size:18px;margin:0}h2{font-size:12px;margin:10px 0 4px;border-bottom:1px solid #999;padding-bottom:2px}
.head{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid #111;padding-bottom:6px}.muted{color:#555}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:2px 4px;text-align:start;vertical-align:top}th{font-size:9.5px;text-transform:uppercase;color:#444}
.lv{display:inline-flex;gap:1px;vertical-align:middle}.lv i{width:7px;height:7px;border:1px solid #333;display:inline-block}.lv i.on{background:#333}
ul{margin:0;padding-inline-start:16px}footer{margin-top:10px;border-top:1px solid #999;padding-top:6px;font-size:9px;color:#333}code{font-size:9px}
</style></head><body><div class="head"><div><h1>${esc(L.title)}</h1><div class="muted">${esc(L.subtitle)}</div></div><div style="text-align:end"><div><b>${esc(m.holder.name)}</b></div><div>${esc(m.role)} · ${esc(m.family)}</div><div class="muted">${esc(L.years)}: ${m.years == null ? '—' : fmt.num(m.years)} · ${esc(L.generated)}: ${esc(fmt.date(m.generated_on))}</div></div></div>
<h2>${esc(L.skills)}</h2><table><thead><tr><th>${esc(L.code)}</th><th>${esc(L.skill)}</th><th>${esc(L.level)}</th><th>${esc(L.basis)}</th><th>${esc(L.required)}</th></tr></thead><tbody>${rows}</tbody></table>
${m.skills.length > 26 ? `<div class="muted">${esc(L.more)}</div>` : ''}
<h2>${esc(L.quals)}</h2>${quals ? `<table><tbody>${quals}</tbody></table>` : `<div class="muted">—</div>`}
${m.licence ? `<div style="margin-top:4px">${esc(L.licence)}: ${esc(m.licence.type)} · ${esc(m.licence.status)} (${esc(L.mirror)})</div>` : ''}
<h2>${esc(L.badges)}</h2>${badges ? `<ul>${badges}</ul>` : `<div class="muted">—</div>`}
<footer>${esc(L.footer)}</footer></body></html>`;
}
