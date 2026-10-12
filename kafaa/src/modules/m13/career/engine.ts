/**
 * F37 Dalil career mode: a deterministic answer engine grounded in the signed-in person's own records. It sits behind the same
 * GuardedEngine as every Dalil mode (concern stop, security and decision refusals, injection), and every turn is logged through
 * rpc.dalilCareerTurn (kill switch, rate limit, concern redaction). Intents call the wave-1 engines:
 *   next_roles       F05 careerReadiness over the roles reachable in two steps       (cites /my/career and the role pages)
 *   gap_to_role      F05 gates on my route + top three competency gaps with my evidence (cites FANR-REG-17, the role page, /my/skills)
 *   courses          F07 / F02 coursesForGaps for a skill, a role or my target        (cites each course page and /my/coach)
 *   opportunities    F08 matchOpportunities, eligible first                           (cites each opportunity and /opportunities)
 *   roadmap_date     F06 buildRoadmap on the first published route, default scenario  (cites /my/career/roadmap and FANR-REG-17)
 *   roleplay         offers the scripted interview or career-conversation practice    (cites the role page or /my/career/conversations)
 * Anything else falls back to the governed staff-mode retrieval. Opt-outs (F24) give unranked lists. Nothing is an eligibility decision.
 */
import { translate } from '../../../i18n';
import type { DalilCitation } from '../../../data/types';
import type { Reason } from '../../../domain/engines/types';
import { coursesForGaps } from '../../../domain/engines/rank';
import { careerFacts, careerReadiness, competencyLevelsOf, reachableRoles, type CareerReadiness } from '../../m18/career';
import { buildRoadmap, routeOptions, quarterLabel, DEFAULT_SCENARIO, type RmEdge, type RoadmapInput } from '../../m18/roadmap';
import { matchOpportunities } from '../../m20/match';
import { defaultTargetRole } from '../../../shell/digest/rules';
import { hasAny, normText, tokenize, type Lang } from '../dalil/text';
import type { AnswerCard, AnswerEngine, AskInput, Corpus, DalilAnswer } from '../dalil/types';
import type { CareerCtx } from './context';
import { answerFuture } from './future';
import { conceptReadiness, type ConceptReadiness } from '../../m18/futureRoles';
import { findRole } from './roles';
export { findRole, ROLE_TOKENS } from './roles';

type Row = Record<string, any>;
const say = (lang: Lang, key: string, vars?: Record<string, string | number>) => translate(lang, `m13.career.${key}`, vars);
const bi = (row: Row | undefined, k: string, lang: Lang) => (row ? String((lang === 'ar' ? row[`${k}_ar`] : row[`${k}_en`]) || row[`${k}_en`] || '') : '');
const BAND_RANK: Record<string, number> = { ready_now: 0, ready_in: 1, stretch: 2, current: 3, path_only: 4 };
const REG_ID = 'fanr-reg17';

export const K = {
  roleplay: ['practice', 'practise', 'role play', 'role-play', 'roleplay', 'mock interview', 'rehearse', 'interview practice', 'تدرب', 'تمرين', 'محاكاة', 'لعب الأدوار', 'مقابلة تجريبية', 'أتدرب'],
  when: ['when could', 'when can', 'when will', 'when would', 'how long', 'how soon', 'by when', 'what date', 'roadmap', 'timeline', 'متى', 'كم من الوقت', 'خارطة', 'جدول زمني', 'موعد'],
  opps: ['opportunit', 'gig', 'gigs', 'stretch assignment', 'projects for me', 'project for me', 'shadowing', 'فرص', 'فرصة', 'الفرص', 'الفرصة', 'مشاريع', 'مشروع', 'المشاريع'],
  courses: ['course', 'courses', 'training for', 'train for', 'learn', 'improve', 'get better', 'study', 'دورة', 'دورات', 'الدورة', 'الدورات', 'تدريب على', 'أتعلم', 'تحسين', 'أحسن'],
  next: ['next role', 'next step', 'next move', 'where can i go', 'where could i go', 'where can i move', 'what roles', 'which roles', 'career options', 'my options', 'what can i become', 'الدور التالي', 'الخطوة التالية', 'إلى أين', 'خياراتي', 'أي الأدوار', 'ما الأدوار'],
  gap: ['need', 'gap', 'gaps', 'become', 'requirement', 'require', 'ready for', 'get to', 'missing', 'what does it take', 'what would it take', 'path to', 'أحتاج', 'فجوة', 'فجوات', 'الفجوات', 'فجواتي', 'متطلبات', 'أصبح', 'لأصبح', 'جاهز', 'ينقصني'],
  help: ['what can you do', 'help', 'hello', 'hi', 'career mode', 'ماذا تستطيع', 'مساعدة', 'مرحبا'],
  conversation: ['career conversation', 'conversation with my manager', 'talk to my manager', 'حوار مهني', 'الحوار المهني', 'مع مديري'],
};

/** A competency (or one of its skills) named in the question. */
export function findCompetency(q: string, comps: Row[], skills: Row[]): string | null {
  const qt = new Set(tokenize(q));
  let best: string | null = null;
  let bestKey = [0, 0];
  const consider = (id: string, name: string) => {
    const tt = new Set(tokenize(name));
    if (!tt.size) return;
    const overlap = [...tt].filter((x) => qt.has(x) && x.length >= 3).length;
    const ratio = overlap / tt.size;
    if (overlap >= 2 || (overlap >= 1 && ratio >= 0.5)) if (overlap > bestKey[0] || (overlap === bestKey[0] && ratio > bestKey[1])) { best = id; bestKey = [overlap, ratio]; }
  };
  for (const c of comps) { consider(c.id, c.name_en); consider(c.id, c.name_ar); }
  for (const s of skills) { consider(s.competency_id, s.name_en); consider(s.competency_id, s.name_ar); }
  return best;
}

export class CareerEngine implements AnswerEngine {
  readonly id = 'career-v1';
  constructor(private readonly ctx: CareerCtx | null, private readonly fallback: AnswerEngine) {}

  async answer(input: AskInput, corpus: Corpus): Promise<DalilAnswer> {
    const { lang } = input;
    const ctx = this.ctx;
    if (!ctx) return { intent: 'career.no_profile', lang, text: say(lang, 'noProfile'), citations: [{ label: say(lang, 'cite.navigator'), url: '/my/career' }], followUps: [], refused: false, confidence: 1, personal: true };
    const q = input.question.trim();
    // FS76: the future-skills intents (role in 2030, AI rung, skill crosswalk, pathway for my gap), from my own records
    const fut = answerFuture(input, ctx.future ?? null);
    if (fut) return fut;
    const norm = normText(q);
    const role = findRole(q, ctx.roles);
    if (hasAny(norm, K.roleplay)) return this.roleplay(lang, role, hasAny(norm, K.conversation) ? 'career_conversation' : role || hasAny(norm, ['interview', 'مقابلة']) ? 'interview' : 'career_conversation');
    if (hasAny(norm, K.when)) return this.roadmap(lang, role ?? this.target());
    if (hasAny(norm, K.opps)) return this.opportunities(lang);
    const comp = findCompetency(q, ctx.competencies, ctx.skills);
    if (hasAny(norm, K.courses)) return this.courses(lang, comp, role);
    if (role) return this.gap(lang, role);
    if (hasAny(norm, K.next)) return this.nextRoles(lang);
    if (hasAny(norm, K.gap)) { const t = this.target(); if (t) return this.gap(lang, t); }
    if (q.split(/\s+/).length <= 4 && hasAny(norm, K.help)) return this.help(lang);
    const a = await this.fallback.answer({ ...input, mode: 'staff' }, corpus);
    if (a.intent === 'no_answer') return this.help(lang, true);
    return a;
  }

  // ───────────── helpers
  private roleRow(id: string | null | undefined) { return this.ctx!.roles.find((r) => r.id === id); }
  private target(): string | null {
    const c = this.ctx!;
    return defaultTargetRole(c.edges, c.person.job_role_id ?? null, c.shortlist);
  }
  private regCite(lang: Lang): DalilCitation | null {
    const s = this.ctx!.sources.find((x) => x.id === REG_ID);
    return s ? { label: say(lang, 'cite.reg17'), url: String(s.url) } : null;
  }
  private roleCite(lang: Lang, id: string): DalilCitation { return { label: bi(this.roleRow(id), 'title', lang) || id, url: `/careers/roles/${id}` }; }
  private compName(id: string, lang: Lang) { return bi(this.ctx!.competencies.find((c) => c.id === id), 'name', lang) || id; }
  private compBi(id: string) { const c = this.ctx!.competencies.find((x) => x.id === id); return { en: c?.name_en ?? id, ar: c?.name_ar ?? c?.name_en ?? id }; }
  private base(lang: Lang, intent: string, text: string, citations: (DalilCitation | null)[], extra: Partial<DalilAnswer> = {}): DalilAnswer {
    const seen = new Set<string>();
    const cites = citations.filter((c): c is DalilCitation => !!c && !seen.has(c.url) && !!seen.add(c.url));
    return { intent, lang, text, citations: cites, followUps: [], refused: false, confidence: 1, personal: true, indicative: true, ...extra };
  }
  /** The strongest evidence row behind a competency in my passport (highest level, then most recent). */
  private evidenceFor(compId: string) {
    const c = this.ctx!;
    const skillIds = new Set(c.skills.filter((s) => s.competency_id === compId).map((s) => s.id));
    return c.evidence.filter((e) => skillIds.has(e.skill_id)).sort((a, b) => Number(b.level) - Number(a.level) || String(b.observed_on).localeCompare(String(a.observed_on)) || String(a.id).localeCompare(String(b.id)))[0] ?? null;
  }

  // ───────────── intents
  private help(lang: Lang, notFound = false): DalilAnswer {
    return this.base(lang, notFound ? 'career.no_answer' : 'career.help', say(lang, notFound ? 'help.notFound' : 'help.intro'), [{ label: say(lang, 'cite.navigator'), url: '/my/career' }, { label: say(lang, 'cite.coach'), url: '/my/coach' }],
      { bullets: [1, 2, 3, 4, 5].map((i) => say(lang, `help.b${i}`)), followUps: this.followUps(lang, null), indicative: false, handoff: notFound });
  }
  private followUps(lang: Lang, roleId: string | null): string[] {
    const t = roleId ?? this.target();
    const r = bi(this.roleRow(t), 'title', lang);
    return r ? [say(lang, 'follow.gap', { role: r }), say(lang, 'follow.when', { role: r }), say(lang, 'follow.opps')] : [say(lang, 'follow.next'), say(lang, 'follow.opps')];
  }

  private nextRoles(lang: Lang): DalilAnswer {
    const c = this.ctx!;
    const mine = c.person.job_role_id ?? null;
    if (!mine) return this.base(lang, 'career.next_roles', say(lang, 'next.noRole'), [{ label: say(lang, 'cite.navigator'), url: '/my/career' }], { followUps: [say(lang, 'follow.opps')] });
    const steps = reachableRoles(c.edges as never, mine, 2);
    const ids = [...steps.keys()];
    const navOff = c.optouts.has('navigator');
    const myTitle = bi(this.roleRow(mine), 'title', lang);
    if (navOff) {
      const list = ids.map((id) => this.roleRow(id)).filter(Boolean).sort((a, b) => bi(a, 'title', lang).localeCompare(bi(b, 'title', lang)));
      return this.base(lang, 'career.next_roles', say(lang, 'next.unranked', { role: myTitle, n: list.length }), [{ label: say(lang, 'cite.navigator'), url: '/my/career' }, ...list.slice(0, 3).map((r) => this.roleCite(lang, r!.id))],
        { unranked: true, cards: list.slice(0, 6).map((r) => ({ id: r!.id, kind: 'role', title: bi(r, 'title', lang), sub: say(lang, steps.get(r!.id) === 1 ? 'next.oneStep' : 'next.twoSteps'), to: `/careers/roles/${r!.id}` })), followUps: this.followUps(lang, null) });
    }
    const rs = careerReadiness(c.data, c.me, ids, c.now).sort((a, b) => BAND_RANK[a.band] - BAND_RANK[b.band] || (b.score ?? -1) - (a.score ?? -1) || (steps.get(a.role_id)! - steps.get(b.role_id)!) || a.role_id.localeCompare(b.role_id));
    const top = rs.slice(0, 3);
    if (!top.length) return this.base(lang, 'career.next_roles', say(lang, 'next.none', { role: myTitle }), [{ label: say(lang, 'cite.navigator'), url: '/my/career' }]);
    const line = (r: CareerReadiness) => `${bi(this.roleRow(r.role_id), 'title', lang)}: ${this.bandText(lang, r)}`;
    return this.base(lang, 'career.next_roles', say(lang, 'next.intro', { role: myTitle, n: top.length }), [{ label: say(lang, 'cite.navigator'), url: '/my/career' }, ...top.map((r) => this.roleCite(lang, r.role_id))], {
      bullets: top.map(line), cards: top.map((r) => this.roleCard(lang, r)), followUps: this.followUps(lang, top[0].role_id),
      links: [{ label: say(lang, 'link.navigator'), to: '/my/career' }],
    });
  }
  private bandText(lang: Lang, r: CareerReadiness) {
    if (r.path_only) return say(lang, 'band.path_only');
    return r.band === 'ready_in' || r.band === 'stretch' ? say(lang, `band.${r.band}`, { pct: r.pct ?? 0, months: r.months ?? 0 }) : say(lang, `band.${r.band}`, { pct: r.pct ?? 0 });
  }
  private roleCard(lang: Lang, r: CareerReadiness): AnswerCard {
    return { id: r.role_id, kind: 'role', title: bi(this.roleRow(r.role_id), 'title', lang), sub: this.bandText(lang, r), pct: r.path_only ? null : r.pct, status: r.band, to: `/my/career?role=${r.role_id}`, reasons: r.reasons as Reason[] };
  }

  private gap(lang: Lang, roleId: string): DalilAnswer {
    const c = this.ctx!;
    const role = this.roleRow(roleId);
    const title = bi(role, 'title', lang) || roleId;
    if (role?.security_sensitive) {
      return this.base(lang, 'career.path_only', say(lang, 'gap.pathOnly', { role: title }), [this.roleCite(lang, roleId)], { links: [{ label: say(lang, 'link.role', { role: title }), to: `/careers/roles/${roleId}` }], followUps: [say(lang, 'follow.next')] });
    }
    if (role?.lifecycle === 'concept') return this.conceptAnswer(lang, roleId, 'gap'); // FS76 closes QA_B: concept roles read FS15, not F05
    const [r] = careerReadiness(c.data, c.me, [roleId], c.now);
    const navOff = c.optouts.has('navigator');
    const primary = r.routes[0] ?? null;
    const isReg = !!primary?.rule_ref?.includes('REG-17') || !!role?.regulation_ref?.includes('REG-17');
    const bullets: string[] = [];
    if (primary) {
      bullets.push(say(lang, 'gap.route', { route: lang === 'ar' ? primary.label.ar : primary.label.en, ref: primary.rule_ref ?? '-' }));
      for (const g of primary.conditions) bullets.push(`${lang === 'ar' ? g.ar : g.en}: ${say(lang, `gate.${g.status}`)}${g.status === 'not_met' && g.remaining_months > 0 ? ` (${say(lang, 'gate.months', { n: g.remaining_months })})` : ''}`);
    }
    const gaps = r.gaps.slice(0, 3);
    const cards: AnswerCard[] = [];
    if (!navOff && r.band !== 'current') cards.push(this.roleCard(lang, r));
    for (const g of gaps) {
      const ev = this.evidenceFor(g.competency_id);
      const evText = ev ? say(lang, 'gap.evidence', { kind: say(lang, `ev.${ev.kind}`), level: Number(ev.level), date: String(ev.observed_on).slice(0, 10) }) : say(lang, 'gap.noEvidence');
      bullets.push(say(lang, 'gap.line', { skill: this.compName(g.competency_id, lang), from: g.have, to: g.need }) + ` · ${evText}`);
      const reasons: Reason[] = [{ code: 'gap', key: 'm18.reasons.gap', vars: { skill: this.compBi(g.competency_id), from: g.have, to: g.need }, ref: { table: 'competencies', id: g.competency_id } }];
      reasons.push(ev ? { code: 'evidence', key: 'm13.career.why.evidence', vars: { kind: { en: translate('en', `m13.career.ev.${ev.kind}`), ar: translate('ar', `m13.career.ev.${ev.kind}`) }, level: Number(ev.level), date: String(ev.observed_on).slice(0, 10) }, ref: { table: 'skill_evidence', id: ev.id } }
        : { code: 'no_evidence', key: 'm13.career.why.noEvidence' });
      reasons.push({ code: `importance_${g.importance}`, key: `m13.career.why.importance_${g.importance}` });
      cards.push({ id: `gap-${g.competency_id}`, kind: 'gap', title: this.compName(g.competency_id, lang), sub: say(lang, 'gap.card', { from: g.have, to: g.need }), pct: Math.round((g.have / g.need) * 100), to: '/my/skills', reasons });
    }
    const intro = r.band === 'current' ? say(lang, 'gap.current', { role: title, n: r.gaps.length })
      : navOff ? say(lang, 'gap.introNoPct', { role: title, n: r.gaps.length }) : say(lang, 'gap.intro', { role: title, pct: r.pct ?? 0, n: r.gaps.length });
    const gateText = !primary ? say(lang, 'gap.noGates') : primary.status === 'met' ? say(lang, 'gap.gatesMet') : primary.status === 'not_met' ? say(lang, 'gap.gatesNotMet', { months: primary.remaining_months }) : say(lang, 'gap.gatesPending');
    return this.base(lang, 'career.gap_to_role', `${intro} ${gateText} ${say(lang, 'notDecision')}`, [isReg ? this.regCite(lang) : null, this.roleCite(lang, roleId), { label: say(lang, 'cite.passport'), url: '/my/skills' }, { label: say(lang, 'cite.navigator'), url: '/my/career' }], {
      bullets, cards, unranked: navOff, followUps: [say(lang, 'follow.when', { role: title }), say(lang, 'follow.courses', { role: title }), say(lang, 'follow.practice', { role: title })],
      links: [{ label: say(lang, 'link.roadmap'), to: `/my/career/roadmap?role=${roleId}` }, { label: say(lang, 'link.passport'), to: '/my/skills' }],
    });
  }

  private courses(lang: Lang, comp: string | null, roleId: string | null): DalilAnswer {
    const c = this.ctx!;
    const have = competencyLevelsOf(c.data, c.me);
    const target = roleId ?? this.target();
    const mine = c.person.job_role_id ?? null;
    let cands = c.courses.filter((x) => x.audience === 'staff' && !c.done.has(x.id) && Array.isArray(x.competency_ids) && x.competency_ids.length);
    if (comp) cands = cands.filter((x) => x.competency_ids.includes(comp));
    const subject = comp ? this.compName(comp, lang) : target ? bi(this.roleRow(target), 'title', lang) : '';
    const coachOff = c.optouts.has('coach');
    const cite = [{ label: say(lang, 'cite.coach'), url: '/my/coach' }];
    const courseCard = (x: Row, reasons?: Reason[]): AnswerCard => ({ id: x.id, kind: 'course', title: `${x.code} · ${bi(x, 'title', lang)}`, sub: x.duration_hours ? say(lang, 'courses.hours', { n: Number(x.duration_hours) }) : undefined, to: `/learn/course/${x.id}`, reasons });
    if (!cands.length) return this.base(lang, 'career.courses', say(lang, 'courses.none', { subject: subject || '-' }), cite, { followUps: this.followUps(lang, target) });
    if (coachOff) {
      const list = [...cands].sort((a, b) => String(a.code).localeCompare(String(b.code))).slice(0, 5);
      return this.base(lang, 'career.courses', say(lang, 'courses.unranked', { subject, n: list.length }), [...list.slice(0, 3).map((x) => ({ label: `${x.code} · ${bi(x, 'title', lang)}`, url: `/learn/course/${x.id}` })), ...cite],
        { unranked: true, cards: list.map((x) => courseCard(x)), followUps: this.followUps(lang, target) });
    }
    const labels = Object.fromEntries(c.competencies.map((x) => [x.id, { en: x.name_en, ar: x.name_ar }]));
    const roleLabels = Object.fromEntries(c.roles.map((x) => [x.id, { en: x.title_en, ar: x.title_ar }]));
    const ranked = coursesForGaps({ have, currentRole: comp ? mine : null, targets: target && target !== mine ? [target] : [], roleComps: c.roleComps as never, courses: cands as never, labels, roleLabels, weights: c.weights.recommend });
    if (!ranked.length) {
      const list = [...cands].sort((a, b) => String(a.code).localeCompare(String(b.code))).slice(0, 3);
      return this.base(lang, 'career.courses', say(lang, 'courses.noGap', { subject }), [...list.map((x) => ({ label: `${x.code} · ${bi(x, 'title', lang)}`, url: `/learn/course/${x.id}` })), ...cite],
        { cards: list.map((x) => courseCard(x)), followUps: this.followUps(lang, target) });
    }
    const top = ranked.slice(0, 3);
    return this.base(lang, 'career.courses', say(lang, comp ? 'courses.introSkill' : 'courses.introRole', { subject, n: top.length }), [...top.map((r) => ({ label: `${(r.item as Row).code} · ${bi(r.item as Row, 'title', lang)}`, url: `/learn/course/${r.id}` })), ...cite], {
      cards: top.map((r) => courseCard(r.item as Row, r.reasons)), bullets: top.map((r) => `${(r.item as Row).code} · ${bi(r.item as Row, 'title', lang)}`), followUps: this.followUps(lang, target),
      links: [{ label: say(lang, 'link.coach'), to: '/my/coach' }],
    });
  }

  private opportunities(lang: Lang): DalilAnswer {
    const c = this.ctx!;
    const opps = c.opps.filter((o) => !c.applied.has(o.id));
    const cite = { label: say(lang, 'cite.marketplace'), url: '/opportunities' };
    if (!opps.length) return this.base(lang, 'career.opportunities', say(lang, 'opps.none'), [cite], { followUps: this.followUps(lang, null) });
    if (c.optouts.has('marketplace')) {
      const list = [...opps].sort((a, b) => String(a.start_on).localeCompare(String(b.start_on)) || String(a.id).localeCompare(String(b.id))).slice(0, 3);
      return this.base(lang, 'career.opportunities', say(lang, 'opps.unranked', { n: list.length }), [...list.map((o) => ({ label: bi(o, 'title', lang), url: `/opportunities/${o.id}` })), cite],
        { unranked: true, cards: list.map((o) => ({ id: o.id, kind: 'opportunity', title: bi(o, 'title', lang), sub: say(lang, 'opps.starts', { date: String(o.start_on).slice(0, 10) }), to: `/opportunities/${o.id}` })) });
    }
    const roleLabels = Object.fromEntries(c.roles.map((x) => [x.id, { en: x.title_en, ar: x.title_ar }]));
    const ranked = matchOpportunities({ opps: opps as never, states: c.states as never, skills: c.skills as never, roleComps: c.roleComps as never, currentRole: c.person.job_role_id ?? null, targetRole: this.target(), family: c.person.job_family_id ?? null, roleLabels, weights: c.weights.match });
    const top = ranked.filter((r) => r.item!.eligible).slice(0, 3);
    if (!top.length) return this.base(lang, 'career.opportunities', say(lang, 'opps.noneEligible'), [cite], { followUps: this.followUps(lang, null) });
    return this.base(lang, 'career.opportunities', say(lang, 'opps.intro', { n: top.length }), [...top.map((r) => ({ label: bi(r.item!.opp as Row, 'title', lang), url: `/opportunities/${r.id}` })), cite], {
      bullets: top.map((r) => `${bi(r.item!.opp as Row, 'title', lang)}: ${say(lang, 'opps.match', { pct: Math.round(r.score * 100) })}`),
      cards: top.map((r) => ({ id: r.id, kind: 'opportunity', title: bi(r.item!.opp as Row, 'title', lang), sub: say(lang, 'opps.starts', { date: String((r.item!.opp as Row).start_on).slice(0, 10) }), pct: Math.round(r.score * 100), to: `/opportunities/${r.id}`, reasons: r.reasons })),
      followUps: this.followUps(lang, null), links: [{ label: say(lang, 'link.marketplace'), to: '/opportunities' }],
    });
  }

  private roadmap(lang: Lang, target: string | null): DalilAnswer {
    const c = this.ctx!;
    const mine = c.person.job_role_id ?? null;
    const cite = { label: say(lang, 'cite.roadmap'), url: '/my/career/roadmap' };
    if (!target || !mine) return this.base(lang, 'career.roadmap_date', say(lang, 'roadmap.noTarget'), [cite], { followUps: [say(lang, 'follow.next')] });
    const role = this.roleRow(target);
    const title = bi(role, 'title', lang) || target;
    if (role?.security_sensitive) return this.base(lang, 'career.path_only', say(lang, 'gap.pathOnly', { role: title }), [this.roleCite(lang, target), cite]);
    if (target === mine) return this.base(lang, 'career.roadmap_date', say(lang, 'roadmap.already', { role: title }), [cite, this.roleCite(lang, target)]);
    if (role?.lifecycle === 'concept') return this.conceptAnswer(lang, target, 'roadmap'); // FS76 (QA_B): FS15 months, never an F05 route
    const routes = routeOptions(c.edges as unknown as RmEdge[], mine, target);
    if (!routes.length) return this.base(lang, 'career.roadmap_date', say(lang, 'roadmap.noRoute', { role: title }), [cite, this.roleCite(lang, target)], { followUps: [say(lang, 'follow.next')] });
    const fx = careerFacts(c.data, c.me, c.now);
    const have = competencyLevelsOf(c.data, c.me);
    const gapCourses = coursesForGaps({ have, currentRole: null, targets: [target], roleComps: c.roleComps as never, courses: c.courses.filter((x) => x.audience === 'staff' && !c.done.has(x.id) && !String(x.programme_id ?? '').match(/^(coit|loit)$/)) as never })
      .slice(0, 3).map((x) => x.item as never);
    const input: RoadmapInput = { now: c.now, roleId: mine, monthsInRole: fx.months_in_role, qualifiedInRole: fx.qualified_in_role, edges: c.edges as never, roles: c.roles as never, programmes: c.programmes as never,
      sources: c.sources.map((s) => ({ id: s.id, label: s.label, url: s.url })), gapCourses, leadershipCourse: (c.courses.find((x) => x.id === 'c-intilaqa') as never) ?? null };
    const path = routes[0];
    const rm = buildRoadmap(input, { path: path.map((e) => e.id), ...DEFAULT_SCENARIO });
    const label = (e: RmEdge) => (lang === 'ar' ? e.label_ar : e.label_en);
    const ms = rm.blocks.filter((b) => b.lane === 'milestone' || b.lane === 'programme').sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6);
    const isReg = path.some((e) => String(e.rule_ref ?? '').includes('REG-17'));
    return this.base(lang, 'career.roadmap_date', `${say(lang, 'roadmap.intro', { role: title, quarter: quarterLabel(rm.end), months: rm.months, route: path.map(label).join(' → ') })} ${say(lang, 'roadmap.indicative')}`,
      [cite, isReg ? this.regCite(lang) : null, this.roleCite(lang, target)], {
        bullets: ms.map((b) => `${quarterLabel(b.start)} · ${lang === 'ar' ? b.title.ar : b.title.en}${b.indicative ? ` (${say(lang, 'roadmap.sample')})` : ''}`),
        cards: ms.slice(0, 4).map((b) => ({ id: b.id, kind: 'milestone', title: lang === 'ar' ? b.title.ar : b.title.en, sub: `${quarterLabel(b.start)}${b.rule_ref ? ` · ${b.rule_ref}` : ''}`, to: `/my/career/roadmap?role=${target}` })),
        followUps: [say(lang, 'follow.gap', { role: title }), say(lang, 'follow.courses', { role: title })], links: [{ label: say(lang, 'link.roadmap'), to: `/my/career/roadmap?role=${target}` }],
      });
  }

  /** FS76 (closes QA_B): a concept role asked about directly reads FS15 conceptReadiness against its FS05 profile, the same rule as the
   *  Navigator, the roadmap and the career-conversation agenda. Never "ready now", never a vacancy or a deployment decision. */
  private conceptAnswer(lang: Lang, roleId: string, view: 'gap' | 'roadmap'): DalilAnswer {
    const c = this.ctx!;
    const title = bi(this.roleRow(roleId), 'title', lang) || roleId;
    const w = c.data.weights as Record<string, unknown> | undefined;
    const weights = w && typeof w === 'object' ? Object.fromEntries(Object.entries(w).filter(([, v]) => typeof v === 'number')) as Record<string, number> : undefined;
    const [r]: (ConceptReadiness | undefined)[] = conceptReadiness({ roles: c.roles as never, versions: c.versions as never, edges: c.edges as never, skills: c.skills as never, competencies: c.competencies as never,
      states: c.states.map((s) => ({ ...s, person_id: c.me })) as never, weights }, careerFacts(c.data, c.me, c.now), c.me, [roleId]);
    const roadmapCite = { label: say(lang, 'cite.roadmap'), url: `/my/career/roadmap?role=${roleId}` };
    const roleCite = { label: say(lang, 'concept.cite', { role: title }), url: `/careers/roles/${roleId}` };
    const intent = view === 'gap' ? 'career.concept_gap' : 'career.concept_roadmap';
    if (!r) return this.base(lang, intent, `${say(lang, 'concept.noProfile', { role: title })} ${say(lang, 'concept.assumption')}`, [roleCite, roadmapCite]);
    const band = r.band === 'profile_met' ? say(lang, 'concept.band.profile_met') : say(lang, `concept.band.${r.band}`, { months: r.months });
    const name = (g: { kind: string; ref_id: string }) => (g.kind === 'skill' ? bi(c.skills.find((s) => s.id === g.ref_id), 'name', lang) : this.compName(g.ref_id, lang)) || g.ref_id;
    const bullets = r.gaps.slice(0, 3).map((g) => `${say(lang, 'gap.line', { skill: name(g), from: g.have, to: g.need })}${(lang === 'ar' ? g.why.ar : g.why.en) ? ` · ${lang === 'ar' ? g.why.ar : g.why.en}` : ''}`);
    if (r.bridge) bullets.unshift(r.bridge.mine ? (r.bridge.remaining_months > 0 ? say(lang, 'concept.bridgeWait', { months: r.bridge.remaining_months }) : say(lang, 'concept.bridgeMet')) : say(lang, 'concept.bridgeOther', { role: bi(this.roleRow(r.bridge.from_role_id), 'title', lang) || '-', months: r.bridge.need_months }));
    const navOff = c.optouts.has('navigator');
    const card: AnswerCard = { id: r.role_id, kind: 'role', title, sub: band, pct: navOff ? null : r.pct, status: r.band === 'profile_met' ? 'ready_now' : r.band === 'within' ? 'ready_in' : 'stretch', to: `/my/career/roadmap?role=${roleId}`, reasons: r.reasons as Reason[] };
    const lead = view === 'gap' ? (navOff ? say(lang, 'concept.introNoPct', { role: title, horizon: r.horizon, n: r.gaps.length }) : say(lang, 'concept.intro', { role: title, horizon: r.horizon, pct: r.pct, band, n: r.gaps.length }))
      : say(lang, 'concept.roadmap', { role: title, band, horizon: r.horizon });
    return this.base(lang, intent, `${lead} ${say(lang, 'concept.assumption')} ${say(lang, 'notDecision')}`, [roleCite, roadmapCite, { label: say(lang, 'cite.passport'), url: '/my/skills' }], {
      bullets, cards: [card], unranked: navOff, links: [{ label: say(lang, 'link.roadmap'), to: `/my/career/roadmap?role=${roleId}` }, { label: title, to: `/careers/roles/${roleId}` }],
      followUps: [say(lang, 'follow.courses', { role: title }), say(lang, 'follow.next')],
    });
  }

  private roleplay(lang: Lang, roleId: string | null, scenario: 'interview' | 'career_conversation'): DalilAnswer {
    const target = scenario === 'interview' ? roleId ?? this.target() : roleId;
    const title = bi(this.roleRow(target), 'title', lang);
    const cites = scenario === 'interview' && target ? [this.roleCite(lang, target), { label: say(lang, 'cite.passport'), url: '/my/skills' }] : [{ label: say(lang, 'cite.conversations'), url: '/my/career/conversations' }];
    return this.base(lang, `career.roleplay_${scenario}`, say(lang, scenario === 'interview' ? 'roleplay.offerInterview' : 'roleplay.offerConversation', { role: title || say(lang, 'roleplay.yourTarget') }), cites,
      { roleplay: { scenario, role_id: target ?? null }, indicative: false, followUps: [] });
  }
}
