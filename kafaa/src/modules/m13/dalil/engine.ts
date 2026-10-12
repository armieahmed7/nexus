/**
 * Dalil answer engines.
 *   GuardedEngine  : guardrails (concern stop, injection, out-of-scope refusals, mode gate) in front of any engine.
 *   RetrievalEngine: intent detection + BM25 retrieval over the approved corpus + templated, cited answers.
 *   ModelGatewayEngine: placeholder for a UAE-hosted model; it would receive the same retrieved passages and must cite
 *                       them. Without a configured gateway it falls back to retrieval (no LLM key in the demo).
 * Every answer carries citations to the Kafa'a pages or public sources it used, or says it found nothing approved.
 */
import { translate } from '../../../i18n';
import type { DalilCitation } from '../../../data/types';
import { detectGuard } from './guard';
import { bestSentences, pickLang, SearchIndex, type Hit } from './search';
import { hasAny, normText, tokenize, type Lang } from './text';
import type { AnswerEngine, AskInput, Corpus, CorpusDoc, DalilAnswer, DalilLink } from './types';
import { answerFuture } from '../career/future';

const say = (lang: Lang, key: string, vars?: Record<string, string | number>) => translate(lang, `m13.engine.${key}`, vars);

const ROLE_TOKENS: Record<string, string> = { qsro: 'senior-reactor-operator', qro: 'reactor-operator', qlo: 'local-operator', qshiftsup: 'shift-supervisor' };
const PROGRAMME_TOKENS: Record<string, string> = { qdnt: 'dnt', qgpo: 'gpo', qgdp: 'gdp', qpioneers: 'energy-pioneers', qmustaqbali: 'mustaqbali', qmawaheb: 'mawaheb', qtrainforwork: 'train-for-work', qinternship: 'internships' };
const BECOME = ['become', 'becoming', 'how do i get', 'how can i get', 'join', 'entry', 'route', 'routes', 'path to', 'pathway to', 'eligib', 'requirement', 'qualif', 'أصبح', 'اصبح', 'الالتحاق', 'متطلبات', 'شروط', 'مسار', 'كيف أكون', 'كيف اكون'];
const FACT_WORDS = ['how many', 'how much', 'percentage', 'percent', 'share of', 'number of', 'how big', 'capacity', 'rate', 'total', 'how large', 'كم', 'نسبة', 'عدد', 'حجم'];
const HELLO = ['hello', 'hi', 'hey', 'salam', 'good morning', 'what can you do', 'who are you', 'what are you', 'help', 'مرحبا', 'السلام عليكم', 'من انت', 'من أنت', 'ماذا تستطيع', 'مساعدة'];
const HUMAN = ['speak to a person', 'talk to a person', 'speak to someone', 'talk to someone', 'human', 'real person', 'contact a person', 'speak with', 'talk with a', 'call me', 'تحدث مع شخص', 'التحدث مع شخص', 'موظف', 'شخص حقيقي', 'تواصل معي'];
const MY = ['my ', ' my', 'mine', "i'm due", 'do i have', 'when does my', 'when is my', 'what is my', 'لدي', 'خاصتي', 'رخصتي', 'شهادتي', 'مؤهلاتي', 'تدريبي', 'خطتي', 'طلبي', 'طلباتي', 'دوراتي'];
const MY_TOPICS: [string, string[]][] = [
  ['licence', ['licence', 'license', 'certificate', 'cert', 'رخصتي', 'شهادتي', 'الرخصة', 'الشهادة']],
  ['qual', ['qualification', 'qualifications', 'qual', 'expire', 'expiry', 'expiring', 'due', 'مؤهلاتي', 'تأهيلي', 'تنتهي', 'انتهاء']],
  ['enrolment', ['training', 'course', 'courses', 'learning', 'تدريبي', 'دوراتي', 'تعلمي']],
  ['plan', ['plan', 'development', 'خطتي', 'التطوير']],
  ['application', ['application', 'applications', 'applied', 'طلبي', 'طلباتي', 'تقديمي']],
  ['onboarding', ['onboarding', 'readiness', 'registration', 'الانضمام', 'الجاهزية']],
];

function cite(d: CorpusDoc): DalilCitation {
  return { label: d.cite.label, url: d.cite.url };
}
function uniq(cs: DalilCitation[]): DalilCitation[] {
  const seen = new Set<string>();
  return cs.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}
const conf = (score: number) => Math.max(0, Math.min(1, score / 8));

export class RetrievalEngine implements AnswerEngine {
  readonly id = 'retrieval-v1';
  private cache = new WeakMap<Corpus, SearchIndex>();
  private index(c: Corpus, mode: AskInput['mode']): SearchIndex {
    // One index per corpus; mode filtering happens on the docs list.
    let ix = this.cache.get(c);
    if (!ix) {
      ix = new SearchIndex(c.docs);
      this.cache.set(c, ix);
    }
    void mode;
    return ix;
  }

  async answer(input: AskInput, corpus: Corpus): Promise<DalilAnswer> {
    const { lang } = input;
    const q = input.question.trim();
    const norm = normText(q);
    const toks = tokenize(q);
    const inMode = (d: CorpusDoc) => d.modes.includes(input.mode);
    const docs = corpus.docs.filter(inMode);
    const byId = new Map(docs.map((d) => [d.id, d]));
    const ix = this.index(corpus, input.mode);
    const search = (query: string, k = 5, kinds?: CorpusDoc['kind'][]) => ix.search(query, k * 3, { boostRoute: input.page, kinds }).filter((h) => inMode(h.doc)).slice(0, k);

    // ── capabilities / greeting
    if (toks.length <= 3 && hasAny(norm, HELLO)) {
      return { intent: 'capabilities', lang, text: say(lang, `hello.${input.mode}`), citations: [{ label: say(lang, 'aboutDalil'), url: '/faq#faq-8' }], followUps: followUpsFor('capabilities', lang, input.mode), refused: false, confidence: 1 };
    }
    // ── human hand-off
    if (hasAny(norm, HUMAN)) {
      return { intent: 'handoff', lang, text: say(lang, corpus.signedIn ? 'handoff.offer' : 'handoff.anon'), citations: [{ label: say(lang, 'contactPage'), url: '/contact' }], followUps: [], links: [{ label: say(lang, 'contactPage'), to: '/contact' }], refused: false, handoff: corpus.signedIn, confidence: 1 };
    }
    // ── FS76 future-skills intents (public content only here: the corpus never carries personal future data)
    const fut = corpus.future ? answerFuture(input, { pub: corpus.future.pub, me: null }, { signedIn: corpus.signedIn }) : null;
    if (fut) return fut;
    // ── personal records (own data only; never anyone else's)
    if (hasAny(norm, MY) && MY_TOPICS.some(([, w]) => hasAny(norm, w))) {
      return this.personal(input, corpus, norm);
    }
    // ── entry requirements / role questions
    const explicitRole = toks.map((t) => ROLE_TOKENS[t]).find(Boolean) ?? null;
    // ── statistics (before fuzzy role matching, so "how many employees" is not read as a role question)
    if (!explicitRole && hasAny(norm, FACT_WORDS)) {
      const hits = search(q, 3, ['fact']);
      if (hits.length && ix.coverage(q, hits[0].doc) >= 0.34) return this.fact(hits, input);
    }
    const roleId = explicitRole ?? this.roleFromSearch(q, search, lang);
    const programmeId = toks.map((t) => PROGRAMME_TOKENS[t]).find(Boolean) ?? (/(khalifa|msc|ماجستير)/i.test(q) ? 'ku-msc' : null);
    if (programmeId && byId.get(`cd-programme-${programmeId}`)) return this.programme(byId.get(`cd-programme-${programmeId}`)!, input);
    if (toks.includes('qscholarship')) {
      const list = ['energy-pioneers', 'ku-msc'].map((id) => byId.get(`cd-programme-${id}`)).filter(Boolean) as CorpusDoc[];
      if (list.length) return this.programmeList(list, input);
    }
    if (roleId && byId.get(`cd-role-${roleId}`)) {
      const role = byId.get(`cd-role-${roleId}`)!;
      const wantsEntry = hasAny(norm, BECOME) || toks.includes('qrequire');
      return wantsEntry ? this.entryRoutes(role, input, docs) : this.role(role, input);
    }
    // ── general retrieval
    return this.retrieve(q, input, search, ix);
  }

  private roleFromSearch(q: string, search: (q: string, k?: number, kinds?: CorpusDoc['kind'][]) => Hit[], lang: Lang): string | null {
    const hits = search(q, 1, ['role']);
    if (!hits.length) return null;
    const h = hits[0];
    // require a solid title match in the question's language: two title words, or most of a short title
    const title = new Set(tokenize(pickLang(h.doc.title, lang)));
    const qt = new Set(tokenize(q));
    const overlap = [...title].filter((t) => qt.has(t)).length;
    return (overlap >= 2 || (title.size > 0 && overlap / title.size >= 0.6)) ? String(h.doc.data?.roleId ?? '') || null : null;
  }

  private entryRoutes(role: CorpusDoc, input: AskInput, docs: CorpusDoc[]): DalilAnswer {
    const { lang } = input;
    const d = role.data as { routes: { id: string; en: string; ar: string; rule_ref: string; url?: string }[]; regulation_ref?: string; regulation_url?: string; title_en: string; title_ar: string; security_sensitive?: boolean };
    const routes = d.routes ?? [];
    const title = lang === 'ar' ? d.title_ar : d.title_en;
    const reg = docs.find((x) => x.id === 'cd-fanr-reg17');
    const citations: DalilCitation[] = [];
    if (routes.length) {
      const ref = routes[0].rule_ref;
      const url = routes[0].url ?? d.regulation_url ?? reg?.cite.url;
      if (url) citations.push({ label: ref.includes('REG-17') ? 'FANR-REG-17 Art. 4' : ref, url });
    }
    citations.push(cite(role));
    if (reg && routes.some((r) => r.rule_ref.includes('REG-17'))) citations.push(cite(reg));
    const main = routes.filter((r) => r.id !== 'clearance');
    const extra = routes.filter((r) => r.id === 'clearance');
    const bullets = main.map((r) => `${lang === 'ar' ? r.ar : r.en} (${r.rule_ref})`);
    const text = routes.length
      ? say(lang, 'entry.intro', { role: title, n: main.length, ref: routes[0].rule_ref }) + (extra.length ? ` ${lang === 'ar' ? extra[0].ar : extra[0].en}` : '')
      : say(lang, 'entry.noRoutes', { role: title });
    return {
      intent: 'entry_requirements', lang, text: `${text} ${say(lang, 'notDecision')}`, bullets, citations: uniq(citations), followUps: followUpsFor('entry', lang, input.mode, String(role.data?.roleId)),
      links: [{ label: say(lang, 'openRole', { role: title }), to: role.route! }, { label: say(lang, 'checkRoutes'), to: '/licensing' }], refused: false, confidence: 1,
    };
  }

  private role(role: CorpusDoc, input: AskInput): DalilAnswer {
    const { lang } = input;
    const d = role.data as Record<string, string | boolean>;
    const L = (k: string) => String(d[`${k}_${lang}`] || d[`${k}_en`] || '');
    const parts = [L('summary')];
    if (d.security_sensitive) parts.push(say(lang, 'role.securityCareerOnly'));
    const bullets = [`${say(lang, 'role.training')}: ${L('training')}`, `${say(lang, 'role.authority')}: ${L('licensing')}`];
    const srcs = (Array.isArray(d.sources) ? d.sources : []) as { label: string; url: string }[];
    return {
      intent: 'role', lang, text: `${L('title')}: ${parts.join(' ')}`, bullets, citations: uniq([cite(role), ...srcs.slice(0, 1).map((s) => ({ label: s.label, url: s.url }))]),
      followUps: followUpsFor('role', lang, input.mode, String(d.roleId)), links: [{ label: say(lang, 'openRole', { role: L('title') }), to: role.route! }], refused: false, confidence: 1,
    };
  }

  private programme(p: CorpusDoc, input: AskInput): DalilAnswer {
    const { lang } = input;
    const d = p.data as Record<string, string | null | { label?: string; url?: string }>;
    const L = (k: string) => String((d[`${k}_${lang}`] as string) || (d[`${k}_en`] as string) || '');
    const nat = say(lang, `nationality.${d.nationality}`);
    const bullets = [`${say(lang, 'prog.who')}: ${L('education')} · ${nat}`, `${say(lang, 'prog.duration')}: ${L('duration')}`, `${say(lang, 'prog.outcome')}: ${L('outcome')}`, say(lang, `prog.apply.${d.apply_mode}`)];
    if (d.conflict_note) bullets.push(`${say(lang, 'prog.sourcesDiffer')}: ${d.conflict_note}`);
    const src = d.source as { label?: string; url?: string } | null;
    const citations = [cite(p)];
    if (src?.url) citations.push({ label: src.label ?? 'Source', url: src.url });
    return {
      intent: 'programme', lang, text: `${L('name')}: ${L('facts').replace(/\.?$/, '.')} ${say(lang, 'notDecision')}`, bullets, citations: uniq(citations),
      followUps: followUpsFor('programme', lang, input.mode, String(d.programmeId)), links: [{ label: say(lang, 'openProgramme', { name: L('name') }), to: p.route! }], refused: false, confidence: 1, handoff: false,
    };
  }

  private programmeList(list: CorpusDoc[], input: AskInput): DalilAnswer {
    const { lang } = input;
    return {
      intent: 'programme', lang, text: say(lang, 'prog.scholarships'),
      bullets: list.map((p) => `${pickLang(p.title, lang)}: ${pickLang(p.text, lang).split('. ').slice(0, 2).join('. ')}`),
      citations: uniq(list.flatMap((p) => [cite(p), ...((p.data?.source as { label?: string; url?: string } | null)?.url ? [{ label: String((p.data!.source as { label?: string }).label ?? 'Source'), url: String((p.data!.source as { url: string }).url) }] : [])])),
      followUps: followUpsFor('programme', lang, input.mode, 'energy-pioneers'), links: list.map((p) => ({ label: pickLang(p.title, lang), to: p.route! })), refused: false, confidence: 0.9,
    };
  }

  private fact(hits: Hit[], input: AskInput): DalilAnswer {
    const { lang } = input;
    const top = hits[0].doc;
    const d = top.data as Record<string, string | boolean | null>;
    const value = String((lang === 'ar' ? d.value_ar : d.value_en) ?? '');
    const label = String((lang === 'ar' ? d.label_ar : d.label_en) ?? '');
    const detail = String((lang === 'ar' ? d.detail_ar : d.detail_en) ?? '');
    const bullets = hits.slice(1).filter((h) => h.score > hits[0].score * 0.6).map((h) => `${pickLang(h.doc.title, lang)}: ${String((lang === 'ar' ? h.doc.data?.value_ar : h.doc.data?.value_en) ?? '')}`);
    let text = say(lang, 'fact.answer', { label, value, date: String(d.as_of ?? '') });
    if (detail) text += ` ${detail}.`;
    if (d.conflict) text += ` ${say(lang, 'fact.conflict')} ${d.conflict}`;
    if (d.sample) text += ` ${say(lang, 'fact.sample')}`;
    const extra = hits.slice(1).filter((h) => h.score > hits[0].score * 0.6);
    return { intent: 'fact', lang, text, bullets: bullets.length ? bullets : undefined, citations: uniq([cite(top), ...extra.map((h) => cite(h.doc))]), followUps: followUpsFor('fact', lang, input.mode), refused: false, confidence: conf(hits[0].score) };
  }

  private retrieve(q: string, input: AskInput, search: (q: string, k?: number, kinds?: CorpusDoc['kind'][]) => Hit[], ix: SearchIndex): DalilAnswer {
    const { lang } = input;
    const hits = search(q, 4);
    const top = hits[0];
    if (!top || top.score < 2.2 || ix.coverage(q, top.doc) < 0.3) {
      return { intent: 'no_answer', lang, text: say(lang, 'noAnswer'), citations: [], followUps: followUpsFor('capabilities', lang, input.mode), links: [{ label: say(lang, 'faqLink'), to: '/faq' }, { label: say(lang, 'contactPage'), to: '/contact' }], refused: false, handoff: true, confidence: top ? conf(top.score) * 0.5 : 0 };
    }
    const used = hits.filter((h, i) => i === 0 || (h.score > top.score * 0.55 && ix.coverage(q, h.doc) >= 0.3)).slice(0, 3);
    const paras: string[] = [];
    for (const [i, h] of used.entries()) {
      const body = pickLang(h.doc.text, lang);
      const ss = bestSentences(body, q, i === 0 ? 2 : 1);
      if (h.doc.kind === 'faq') paras.push(body);
      else if (ss.length) {
        const title = pickLang(h.doc.title, lang);
        const body2 = ss.join(' ');
        paras.push(i === 0 || body2.startsWith(title) ? body2 : `${title}: ${body2}`);
      }
    }
    const links: DalilLink[] = used.filter((h) => h.doc.route).slice(0, 2).map((h) => ({ label: pickLang(h.doc.title, lang), to: h.doc.route! }));
    return {
      intent: used[0].doc.kind === 'faq' ? 'faq' : 'search', lang, text: paras[0] ?? '', bullets: paras.slice(1), citations: uniq(used.map((h) => cite(h.doc))), followUps: followUpsFor(used[0].doc.kind, lang, input.mode, undefined, true),
      links, refused: false, confidence: conf(top.score),
    };
  }

  private personal(input: AskInput, corpus: Corpus, norm: string): DalilAnswer {
    const { lang } = input;
    if (!corpus.signedIn) return { intent: 'personal', lang, text: say(lang, 'personal.signIn'), citations: [{ label: say(lang, 'signInPage'), url: '/sign-in' }], followUps: [], links: [{ label: say(lang, 'signInPage'), to: '/sign-in' }], refused: false, confidence: 1, personal: true };
    if (input.mode === 'public') return { intent: 'personal', lang, text: say(lang, 'personal.publicMode'), citations: [{ label: say(lang, 'aboutDalil'), url: '/faq#faq-8' }], followUps: [], refused: false, confidence: 1, personal: true };
    const topic = MY_TOPICS.find(([, w]) => hasAny(norm, w))?.[0] ?? 'qual';
    const recs = corpus.personal.filter((d) => d.modes.includes(input.mode) && d.data?.type === topic);
    const route = { licence: '/my/licence', qual: '/my/quals', enrolment: '/my/learning', plan: '/my/plan', application: '/my/applications', onboarding: '/partner/onboarding' }[topic] ?? '/my';
    if (!recs.length) return { intent: 'personal', lang, text: say(lang, `personal.none.${topic}`), citations: [{ label: say(lang, `personal.page.${topic}`), url: route }], followUps: followUpsFor('personal', lang, input.mode), links: [{ label: say(lang, `personal.page.${topic}`), to: route }], refused: false, confidence: 1, personal: true };
    const fmtDate = (v: unknown) => (v ? String(v).slice(0, 10) : say(lang, 'personal.noDate'));
    const bullets = recs.slice(0, 8).map((r) => {
      const d = r.data as Record<string, unknown>;
      const st = say(lang, `st.${String(d.status ?? d.stage)}`);
      if (topic === 'qual') return d.security ? `${pickLang(r.title, lang)}: ${say(lang, 'personal.securityMirror', { status: st })}` : `${pickLang(r.title, lang)}: ${st} · ${say(lang, 'personal.expires', { date: fmtDate(d.expires_on) })}`;
      if (topic === 'licence') return `${pickLang(r.title, lang)}: ${st} · ${say(lang, 'personal.expires', { date: fmtDate(d.expires_on) })} · ${say(lang, 'personal.synced', { date: fmtDate(d.last_synced) })}`;
      if (topic === 'enrolment') return `${pickLang(r.title, lang)}: ${st}${d.due_on ? ` · ${say(lang, 'personal.due', { date: fmtDate(d.due_on) })}` : ''}`;
      if (topic === 'plan') return `${pickLang(r.title, lang)}: ${st} · ${say(lang, 'personal.progress', { done: Number(d.done), total: Number(d.total) })}`;
      return `${pickLang(r.title, lang)}: ${st}`;
    });
    return { intent: 'personal', lang, text: say(lang, `personal.intro.${topic}`), bullets, citations: [cite(recs[0])], followUps: followUpsFor('personal', lang, input.mode), links: [{ label: say(lang, `personal.page.${topic}`), to: route }], refused: false, confidence: 1, personal: true };
  }
}

export function followUpsFor(kind: string, lang: Lang, mode: string, id?: string, fallback = false): string[] {
  const k = (n: number) => say(lang, `follow.${kind === 'entry' && id === 'senior-reactor-operator' ? 'entrySro' : kind}.${n}`);
  const list = [1, 2, 3].map(k).filter((x) => !x.startsWith('m13.'));
  if (!list.length && fallback) return followUpsFor('capabilities', lang, mode);
  if (kind === 'capabilities' && mode === 'staff') return [say(lang, 'follow.staff.1'), say(lang, 'follow.staff.2'), ...list.slice(0, 1)];
  if (kind === 'capabilities' && mode === 'partner') return [say(lang, 'follow.partner.1'), say(lang, 'follow.partner.2'), ...list.slice(0, 1)];
  return list;
}

/** Placeholder for a model gateway (UAE-hosted model option). Retrieval stays the grounding step; the model may only rephrase. */
export class ModelGatewayEngine implements AnswerEngine {
  readonly id = 'model-gateway';
  constructor(private readonly fallback: AnswerEngine, private readonly endpoint: string | null) {}
  async answer(input: AskInput, corpus: Corpus): Promise<DalilAnswer> {
    // No endpoint is configured in the demo, so the grounded retrieval answer is returned unchanged.
    return this.fallback.answer(input, corpus);
  }
  get configured() {
    return !!this.endpoint;
  }
}

/** Guardrails in front of any engine. */
export class GuardedEngine implements AnswerEngine {
  readonly id: string;
  constructor(private readonly inner: AnswerEngine) {
    this.id = `guarded:${inner.id}`;
  }
  async answer(input: AskInput, corpus: Corpus): Promise<DalilAnswer> {
    const { lang } = input;
    const g = detectGuard(input.question, corpus.policies);
    const lastStop = [...(input.history ?? [])].reverse().find((h) => h.role === 'dalil')?.stop;
    if (g?.category === 'concern') return concernAnswer(lang, corpus);
    if (g) {
      const pol = corpus.policies.find((p) => p.category === g.category);
      const text = pol ? pickLang(pol.response, lang) : say(lang, `refuse.${g.category}`);
      return { intent: 'refusal', lang, text, citations: refusalCitations(g.category, lang), followUps: refusalFollowUps(g.category, lang), links: refusalLinks(g.category, lang), refused: true, refusalCategory: g.category, confidence: 1 };
    }
    const a = await this.inner.answer(input, corpus);
    // After a concern stop, anything that is not a clear in-scope answer gets the channels again (no further conversation on the topic).
    if (lastStop && (a.intent === 'no_answer' || a.confidence < 0.35)) return concernAnswer(lang, corpus);
    return a;
  }
}

export function concernAnswer(lang: Lang, corpus: Corpus): DalilAnswer {
  const pol = corpus.policies.find((p) => p.category === 'concern');
  return {
    intent: 'concern', lang, text: pol ? pickLang(pol.response, lang) : say(lang, 'refuse.concern'), citations: [{ label: say(lang, 'speakUpPage'), url: '/speak-up' }],
    followUps: [], links: [{ label: say(lang, 'speakUpPage'), to: '/speak-up' }], refused: true, refusalCategory: 'concern', stop: true, channels: corpus.channels, confidence: 1, redact: true,
  };
}
function refusalCitations(cat: string, lang: Lang): DalilCitation[] {
  if (cat === 'security') return [{ label: say(lang, 'careers.security'), url: '/careers/roles/security-officer' }, { label: say(lang, 'careers.safeguards'), url: '/careers/roles/safeguards-specialist' }, { label: 'FANR', url: 'https://www.fanr.gov.ae/en' }];
  if (cat === 'safeguards') return [{ label: say(lang, 'careers.safeguards'), url: '/careers/roles/safeguards-specialist' }, { label: 'IAEA', url: 'https://www.iaea.org/topics/safeguards-explained' }];
  if (cat === 'cyber') return [{ label: say(lang, 'careers.cyber'), url: '/careers/roles/cyber-security-engineer' }];
  if (cat === 'emergency') return [{ label: say(lang, 'emergencyPage'), url: '/emergency' }, { label: 'NCEMA', url: 'https://www.ncema.gov.ae/' }, { label: 'ENEC · Emergency preparedness FAQs', url: 'https://www.enec.ae/our-subsidiaries/enec-operations/emergency-preparedness-faqs/' }];
  if (cat === 'operations') return [{ label: say(lang, 'careers.operations'), url: '/careers' }];
  if (cat === 'exam') return [{ label: say(lang, 'practicePage'), url: '/learn/practice' }];
  if (cat === 'decision') return [{ label: say(lang, 'licensingPage'), url: '/licensing' }, { label: say(lang, 'pathwaysPage'), url: '/pathways' }];
  return [];
}
function refusalLinks(cat: string, lang: Lang): DalilLink[] {
  return refusalCitations(cat, lang).filter((c) => c.url.startsWith('/')).map((c) => ({ label: c.label, to: c.url }));
}
function refusalFollowUps(cat: string, lang: Lang): string[] {
  if (['security', 'safeguards', 'cyber'].includes(cat)) return [say(lang, 'follow.security.1'), say(lang, 'follow.security.2')];
  if (cat === 'decision') return [say(lang, 'follow.entry.1'), say(lang, 'follow.programme.1')];
  return [say(lang, 'follow.capabilities.1')];
}

export function createEngine(engineId: string | null | undefined): AnswerEngine {
  const retrieval = new RetrievalEngine();
  const inner = engineId === 'model-gateway' ? new ModelGatewayEngine(retrieval, null) : retrieval;
  return new GuardedEngine(inner);
}
