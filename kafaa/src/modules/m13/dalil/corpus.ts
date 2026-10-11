/**
 * Builds Dalil's approved corpus from Kafa'a content through the repository, so row-level security decides what a
 * caller can reach: anonymous visitors only ever see public rows (no staff-mode content), staff see internal guides,
 * partners see their own organisation's records. corpus_docs rows marked approved=false remove matching documents.
 */
import type { DalilMode, Repository } from '../../../data/types';
import type { Corpus, CorpusDoc, EcpChannel, RefusalPolicy } from './types';

const ALL: DalilMode[] = ['public', 'applicant', 'staff', 'partner'];
const stripBase = (u: string) => (u.startsWith('/kafaa/') ? u.slice(6) : u === '/kafaa' ? '/' : u);
type Src = { label?: string; url?: string };
const firstSource = (s: unknown): Src | null => (Array.isArray(s) && s.length ? (s[0] as Src) : null);

async function safe<T>(p: Promise<T[]>): Promise<T[]> {
  try {
    return await p;
  } catch {
    return [];
  }
}

export async function buildCorpus(repo: Repository, opts: { signedIn: boolean; personId: string | null; orgId?: string | null }): Promise<Corpus> {
  const [docsRaw, roles, talent, trainingProgs, courses, orgs, faqs, facts, sources, traits, hu, ecp, glossary, techs, policiesRaw] = await Promise.all([
    safe(repo.list('corpus_docs')),
    safe(repo.list('job_roles', { filter: { status: 'published' } })),
    safe(repo.list('talent_programmes')),
    safe(repo.list('programmes')),
    safe(repo.list('courses')),
    safe(repo.list('organisations', { filter: { public_listed: true } })),
    safe(repo.list('faqs')),
    safe(repo.list('facts')),
    safe(repo.list('sources')),
    safe(repo.list('sc_traits')),
    safe(repo.list('hu_tools')),
    safe(repo.list('ecp_channels', { order: [['sort', 'asc']] })),
    safe(repo.list('glossary')),
    safe(repo.list('adv_technologies')),
    safe(repo.list('refusal_policies')),
  ]);
  const unapproved = new Set(docsRaw.filter((d) => !d.approved).map((d) => d.id));
  const docs: CorpusDoc[] = [];
  const push = (d: CorpusDoc) => {
    if (!unapproved.has(d.id)) docs.push(d);
  };

  // Free-text approved documents (pages, news, regulations, internal and partner guides). Role copies are skipped
  // because the structured job_roles rows below carry the same text in both languages plus entry routes.
  for (const d of docsRaw) {
    if (!d.approved || d.id.startsWith('cd-role-')) continue;
    const url = d.url ?? '';
    const internal = url.startsWith('/kafaa');
    const kind: CorpusDoc['kind'] = d.kind === 'fanr_page' || d.kind === 'enec_page' ? 'regulation' : d.kind === 'internal' ? 'internal' : d.id.startsWith('cd-news-') ? 'news' : 'page';
    docs.push({
      id: d.id, kind, title: { en: d.title, ar: d.title }, text: { en: d.text_en, ar: d.text_ar || '' },
      cite: { label: d.title, url: internal ? stripBase(url) : url }, route: internal ? stripBase(url) : null,
      modes: (d.modes?.length ? d.modes : ALL) as DalilMode[], keywords: d.id === 'cd-fanr-reg17' ? ['qreg17', 'qro', 'qsro', 'qrequire', 'certificate', 'licence'] : undefined,
    });
  }
  for (const r of roles) {
    const routes = (Array.isArray(r.entry_routes) ? r.entry_routes : []) as { id: string; en: string; ar: string; rule_ref: string; url?: string }[];
    push({
      id: `cd-role-${r.id}`, kind: 'role', title: { en: r.title_en, ar: r.title_ar },
      text: {
        en: `${r.summary_en} Qualifications: ${r.qualifications_en} Training path: ${r.training_path_en} Licensing or authorising body: ${r.licensing_body_en}. ${routes.map((x) => x.en).join(' ')}`,
        ar: `${r.summary_ar} المؤهلات: ${r.qualifications_ar} مسار التدريب: ${r.training_path_ar} جهة الترخيص: ${r.licensing_body_ar}. ${routes.map((x) => x.ar).join(' ')}`,
      },
      cite: { label: r.title_en, url: `/careers/roles/${r.id}` }, route: `/careers/roles/${r.id}`, modes: ALL,
      keywords: [r.function_en, r.function_ar, r.family_id],
      data: { roleId: r.id, routes, regulation_ref: r.regulation_ref, regulation_url: r.regulation_url, security_sensitive: r.security_sensitive, sources: r.sources, title_en: r.title_en, title_ar: r.title_ar, licensing_en: r.licensing_body_en, licensing_ar: r.licensing_body_ar, training_en: r.training_path_en, training_ar: r.training_path_ar, summary_en: r.summary_en, summary_ar: r.summary_ar },
    });
  }
  for (const p of talent) {
    const s = firstSource(p.sources);
    push({
      id: `cd-programme-${p.id}`, kind: 'programme', title: { en: p.name_en, ar: p.name_ar },
      text: { en: `${p.facts_en} For: ${p.education_en}. Duration: ${p.duration_en}. Leads to: ${p.outcome_en}.`, ar: `${p.facts_ar} الفئة: ${p.education_ar}. المدة: ${p.duration_ar}. يقود إلى: ${p.outcome_ar}.` },
      cite: { label: p.name_en, url: `/pathways/${p.id}` }, route: `/pathways/${p.id}`, modes: ALL, keywords: [p.stage, 'programme', 'برنامج'],
      data: { programmeId: p.id, facts_en: p.facts_en, facts_ar: p.facts_ar, nationality: p.nationality, education_en: p.education_en, education_ar: p.education_ar, duration_en: p.duration_en, duration_ar: p.duration_ar, outcome_en: p.outcome_en, outcome_ar: p.outcome_ar, apply_mode: p.apply_mode, link_out_url: p.link_out_url, conflict_note: p.conflict_note, source: s, name_en: p.name_en, name_ar: p.name_ar },
    });
  }
  for (const p of trainingProgs) {
    push({ id: `cd-training-${p.id}`, kind: 'training', title: { en: p.name_en, ar: p.name_ar }, text: { en: `${p.purpose_en} Duration: ${p.duration_en}.`, ar: `${p.purpose_ar} المدة: ${p.duration_ar}.` }, cite: { label: p.name_en, url: '/learn' }, route: '/learn', modes: ALL, keywords: [p.code, 'training', 'تدريب'] });
  }
  for (const c of courses) {
    const staffOnly = !c.public_summary;
    push({ id: `cd-course-${c.id}`, kind: 'course', title: { en: c.title_en, ar: c.title_ar }, text: { en: `${c.code}. ${c.summary_en}`, ar: `${c.code}. ${c.summary_ar}` }, cite: { label: `${c.code} ${c.title_en}`, url: `/learn/course/${c.id}` }, route: `/learn/course/${c.id}`, modes: staffOnly ? ['staff'] : ALL, keywords: ['course', 'دورة'] });
  }
  for (const o of orgs) {
    const s = firstSource(o.sources);
    push({ id: `cd-partner-${o.id}`, kind: 'partner', title: { en: o.name_en, ar: o.name_ar }, text: { en: `${o.name_en}${o.short ? ` (${o.short})` : ''}: ${o.relationship_en} ${o.dates}`, ar: `${o.name_ar}: ${o.relationship_ar}` }, cite: { label: s?.label ?? o.name_en, url: `/partners/${o.id}` }, route: `/partners/${o.id}`, modes: ALL, keywords: [o.kind, o.category, 'partner', 'شريك'] });
  }
  for (const f of faqs) push({ id: `cd-faq-${f.id}`, kind: 'faq', title: { en: f.q_en, ar: f.q_ar }, text: { en: f.a_en, ar: f.a_ar }, cite: { label: 'FAQ', url: `/faq#${f.id}` }, route: '/faq', modes: ALL, keywords: [f.topic] });
  const srcById = new Map(sources.map((s) => [s.id, s]));
  for (const f of facts) {
    const s = f.source_id ? srcById.get(f.source_id) : undefined;
    push({
      id: `cd-fact-${f.id}`, kind: 'fact', title: { en: f.label_en, ar: f.label_ar }, text: { en: `${f.label_en}: ${f.value}. ${f.detail_en}`, ar: `${f.label_ar}: ${f.value_ar || f.value}. ${f.detail_ar}` },
      cite: { label: s?.label ?? 'Source', url: s?.url ?? '/about' }, route: f.topic === 'workforce' ? '/about' : f.topic === 'community' ? '/community' : '/about', modes: ALL, keywords: [f.topic, 'how many', 'how much', 'number', 'كم'],
      data: { value_en: f.value, value_ar: f.value_ar || f.value, as_of: f.as_of, label_en: f.label_en, label_ar: f.label_ar, detail_en: f.detail_en, detail_ar: f.detail_ar, sample: f.sample, conflict: f.conflict_note },
    });
  }
  for (const tr of traits) push({ id: `cd-trait-${tr.id}`, kind: 'trait', title: { en: tr.name_en, ar: tr.name_ar }, text: { en: tr.description_en, ar: tr.description_ar }, cite: { label: 'ENEC Operations · Nuclear safety culture', url: '/safety-culture' }, route: '/safety-culture', modes: ALL, keywords: ['qsafetyculture', 'trait', 'سمة'] });
  for (const h of hu) push({ id: `cd-hu-${h.id}`, kind: 'hu_tool', title: { en: h.name_en, ar: h.name_ar }, text: { en: `${h.description_en} (${h.kind} tool)`, ar: h.description_ar }, cite: { label: 'Human performance tools', url: '/safety-culture#hu' }, route: '/safety-culture', modes: ALL, keywords: ['qhu'] });
  for (const g of glossary) push({ id: `cd-glossary-${g.id}`, kind: 'glossary', title: { en: g.term_en, ar: g.term_ar }, text: { en: g.definition_en, ar: g.definition_ar }, cite: { label: `Glossary · ${g.term_en}`, url: '/faq#glossary' }, route: '/faq', modes: ALL, keywords: ['glossary', 'meaning', 'what is', 'معنى'] });
  for (const t of techs) {
    const s = firstSource(t.sources);
    push({ id: `cd-technology-${t.id}`, kind: 'technology', title: { en: t.family_en, ar: t.family_ar }, text: { en: `${t.family_en}: ${t.partners_en}. Designs: ${t.designs}. Skills: ${t.skill_areas_en}. MoU: ${t.mou_date}. No deployment decision is implied.`, ar: `${t.family_ar}: ${t.partners_ar}. المهارات: ${t.skill_areas_ar}.` }, cite: { label: s?.label ?? t.family_en, url: '/future' }, route: '/future', modes: ALL, keywords: ['advance', 'smr', 'future', 'مستقبل'] });
  }

  const channels: EcpChannel[] = ecp.map((c) => ({ id: c.id, label: { en: c.label_en, ar: c.label_ar }, detail: { en: c.detail_en, ar: c.detail_ar } }));
  const policies: RefusalPolicy[] = policiesRaw.map((p) => ({ category: p.category, patterns: p.patterns ?? [], response: { en: p.response_en, ar: p.response_ar }, enabled: p.enabled, stop: p.stop_conversation }));
  const personal = opts.signedIn && opts.personId ? await buildPersonal(repo, opts.personId, opts.orgId ?? null) : [];
  return { docs, channels, policies, personal, signedIn: opts.signedIn, builtAt: new Date().toISOString() };
}

/** The caller's own records, read through RLS (Own grants only). Never anyone else's. */
async function buildPersonal(repo: Repository, personId: string, orgId: string | null): Promise<CorpusDoc[]> {
  const [quals, standards, licences, enrol, courses, plans, acts, apps, progs, onboarding] = await Promise.all([
    safe(repo.list('qual_records', { filter: { person_id: personId } })),
    safe(repo.list('qual_standards')),
    safe(repo.list('licences', { filter: { person_id: personId } })),
    safe(repo.list('enrolments', { filter: { person_id: personId } })),
    safe(repo.list('courses')),
    safe(repo.list('dev_plans', { filter: { person_id: personId } })),
    safe(repo.list('plan_activities', { filter: { person_id: personId } })),
    safe(repo.list('applications', { filter: { person_id: personId } })),
    safe(repo.list('talent_programmes')),
    safe(repo.list('partner_onboarding')),
  ]);
  const out: CorpusDoc[] = [];
  const std = new Map(standards.map((s) => [s.id, s]));
  const crs = new Map(courses.map((c) => [c.id, c]));
  const prog = new Map(progs.map((p) => [p.id, p]));
  for (const q of quals) {
    const s = std.get(q.standard_id);
    out.push({ id: `me-qual-${q.id}`, kind: 'personal', title: { en: s?.title_en ?? q.standard_id, ar: s?.title_ar ?? q.standard_id }, text: { en: q.status, ar: q.status }, cite: { label: 'My qualifications (mirror of the training records system)', url: '/my/quals' }, route: '/my/quals', modes: ['staff'], data: { type: 'qual', status: q.status, expires_on: q.expires_on, security: q.security_mirror_only } });
  }
  for (const l of licences) out.push({ id: `me-lic-${l.id}`, kind: 'personal', title: { en: `${l.type} certificate`, ar: `شهادة ${l.type}` }, text: { en: l.status, ar: l.status }, cite: { label: 'My licence (mirror of the licensee certification records)', url: '/my/licence' }, route: '/my/licence', modes: ['staff'], data: { type: 'licence', status: l.status, expires_on: l.expires_on, last_synced: l.last_synced, licType: l.type } });
  for (const e of enrol) {
    const c = crs.get(e.course_id);
    out.push({ id: `me-enrol-${e.id}`, kind: 'personal', title: { en: c?.title_en ?? e.course_id, ar: c?.title_ar ?? e.course_id }, text: { en: e.status, ar: e.status }, cite: { label: 'My learning', url: '/my/learning' }, route: '/my/learning', modes: ['staff', 'partner'], data: { type: 'enrolment', status: e.status, due_on: e.due_on } });
  }
  for (const p of plans) {
    const a = acts.filter((x) => x.plan_id === p.id);
    out.push({ id: `me-plan-${p.id}`, kind: 'personal', title: { en: `Development plan (${p.target_role_id})`, ar: `خطة التطوير (${p.target_role_id})` }, text: { en: p.status, ar: p.status }, cite: { label: 'My development plan', url: '/my/plan' }, route: '/my/plan', modes: ['staff'], data: { type: 'plan', status: p.status, target: p.target_role_id, done: a.filter((x) => x.status === 'done').length, total: a.length } });
  }
  for (const a of apps) {
    const p = prog.get(a.programme_id);
    out.push({ id: `me-app-${a.id}`, kind: 'personal', title: { en: p?.name_en ?? a.programme_id, ar: p?.name_ar ?? a.programme_id }, text: { en: a.stage, ar: a.stage }, cite: { label: 'My applications', url: '/my/applications' }, route: '/my/applications', modes: ['applicant', 'staff'], data: { type: 'application', stage: a.stage, updated_at: a.updated_at } });
  }
  for (const o of onboarding.filter((x) => orgId && x.org_id === orgId)) out.push({ id: `me-onb-${o.id}`, kind: 'personal', title: { en: 'Partner onboarding', ar: 'انضمام الشريك' }, text: { en: o.status, ar: o.status }, cite: { label: 'Partner onboarding', url: '/partner/onboarding' }, route: '/partner/onboarding', modes: ['partner'], data: { type: 'onboarding', status: o.status } });
  return out;
}
