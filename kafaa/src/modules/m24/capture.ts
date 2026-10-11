/**
 * M24 · F21 Knowledge capture studio and knowledge base. Pure rules, import-free apart from types (seed and PGlite validator
 * load it in node). SQL mirror: supabase/migrations/20261009132001_kafaa_w3e2_knowledge.sql. Change both together.
 * Workflow: plan a structured interview from a template -> hold it -> upload the transcript text (no audio processing) ->
 * draft a knowledge asset (deterministic enrichment suggests skills, OE lessons and courses) -> two-person review (a technical
 * review and a security and content check, two different people, never the author or the SME) -> the KM owner publishes.
 */

export const TEMPLATE_IDS = ['critical_decisions', 'rules_of_thumb', 'war_stories', 'who_to_ask', 'documents'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
/** Structured-interview templates (IAEA structured-interview capture): the prompts the interviewer works through. */
export const TEMPLATES: Record<TemplateId, { prompts: { en: string; ar: string }[] }> = {
  critical_decisions: { prompts: [
    { en: 'Which decisions in this job carry the most consequence, and what tells you a decision point is coming?', ar: 'ما القرارات الأكثر أثراً في هذه الوظيفة، وما الذي ينبهك إلى اقتراب لحظة القرار؟' },
    { en: 'What information do you check before you commit, and in what order?', ar: 'ما المعلومات التي تتحقق منها قبل الالتزام، وبأي ترتيب؟' },
    { en: 'When have you stopped or slowed down, and what made you do it?', ar: 'متى توقفت أو أبطأت، وما الذي دفعك إلى ذلك؟' },
    { en: 'What would a newcomer most likely get wrong here?', ar: 'ما الخطأ الأكثر احتمالاً من شخص جديد هنا؟' },
  ] },
  rules_of_thumb: { prompts: [
    { en: 'What rules of thumb do you use that are not written in the procedure?', ar: 'ما القواعد العملية التي تستخدمها ولا تذكرها الإجراءات المكتوبة؟' },
    { en: 'Why does the plant behave this way? What is the physics or chemistry behind it?', ar: 'لماذا تتصرف المحطة بهذه الطريقة؟ ما الفيزياء أو الكيمياء وراء ذلك؟' },
    { en: 'Which early signs tell you something is drifting?', ar: 'ما العلامات المبكرة التي تخبرك بأن شيئاً ما ينحرف؟' },
    { en: 'Which quirks of this system should everyone know?', ar: 'ما خصائص هذا النظام التي ينبغي أن يعرفها الجميع؟' },
  ] },
  war_stories: { prompts: [
    { en: 'Tell us about an event or near miss you learned the most from (de-identified).', ar: 'حدثنا عن حدث أو حادث وشيك تعلمت منه أكثر من غيره (دون بيانات تعريفية).' },
    { en: 'What happened, what did you notice first, and what did the team do?', ar: 'ماذا حدث، وما الذي لاحظته أولاً، وماذا فعل الفريق؟' },
    { en: 'What would you do differently, and what changed afterwards?', ar: 'ما الذي كنت ستفعله بشكل مختلف، وما الذي تغيّر بعد ذلك؟' },
  ] },
  who_to_ask: { prompts: [
    { en: 'For which questions do people come to you, and who else could answer them?', ar: 'في أي أسئلة يلجأ إليك الناس، ومن غيرك يستطيع الإجابة عنها؟' },
    { en: 'Which teams, roles or vendor contacts (by role, never by name) do you rely on?', ar: 'ما الفرق أو الأدوار أو جهات المورّدين (بالدور لا بالاسم) التي تعتمد عليها؟' },
    { en: 'What would break if you were away for three months?', ar: 'ما الذي سيتعطل لو غبت ثلاثة أشهر؟' },
  ] },
  documents: { prompts: [
    { en: 'Which documents, procedures or standards do you rely on most, and why?', ar: 'ما الوثائق أو الإجراءات أو المعايير التي تعتمد عليها أكثر، ولماذا؟' },
    { en: 'Where is the official text incomplete or hard to apply?', ar: 'أين يكون النص الرسمي ناقصاً أو صعب التطبيق؟' },
    { en: 'What would you add for your successor?', ar: 'ما الذي ستضيفه لمن يخلفك؟' },
  ] },
};

export const SYSTEM_FAMILIES = ['reactor_core', 'primary', 'secondary', 'electrical', 'i_and_c', 'chemistry', 'radiation_protection', 'maintenance', 'outage', 'human_performance', 'emergency_preparedness', 'training'] as const;
export const SME_KINDS = ['staff', 'retiring', 'rotating', 'visiting_khnp', 'partner'] as const;
export const SME_AVAILABILITY = ['available', 'limited', 'unavailable'] as const;
export const DEPARTING_BANDS = ['within_2', '2_5', '5_plus', 'visiting', 'unspecified'] as const;
export const REVIEW_KINDS = ['technical', 'security'] as const;

export const LIMITS = {
  TITLE: [5, 140], SUMMARY: [20, 600], BODY: [50, 20000], KEY_POINTS: [1, 8], KEY_POINT_MAX: 300, SKILLS: 8, STANDARDS: 6,
  TRANSCRIPT: [200, 60000], NOTE_MAX: 500, HEADLINE_MAX: 140, PLAN_DAYS: 180, SUGGESTIONS: 24, REQUAL: 6, REASON: [5, 300],
} as const;
export const USED_BY_MIN = 10;

export interface KeyPoint { en: string; ar: string }
export interface ReviewLite { id?: string; asset_id: string; reviewer_id: string; kind: string; outcome: string; superseded: boolean; created_at?: string }
export interface ReviewState { technical: ReviewLite | null; security: ReviewLite | null; ready: boolean; missing: ('technical' | 'security' | 'second_person')[] }
/**
 * Publish gate: a current (not superseded) technical pass and a current security-and-content pass, by two different people,
 * neither of them the author or the SME. Returns the pair it found (or what is missing).
 */
export function reviewState(reviews: ReviewLite[], authorId: string, smeId: string): ReviewState {
  const cur = reviews.filter((r) => !r.superseded && r.outcome === 'pass' && r.reviewer_id !== authorId && r.reviewer_id !== smeId)
    .sort((a, b) => (String(a.created_at ?? '') < String(b.created_at ?? '') ? -1 : String(a.created_at ?? '') > String(b.created_at ?? '') ? 1 : a.reviewer_id < b.reviewer_id ? -1 : 1));
  const tech = cur.filter((r) => r.kind === 'technical');
  const sec = cur.filter((r) => r.kind === 'security');
  for (const t of tech) for (const s of sec) if (t.reviewer_id !== s.reviewer_id) return { technical: t, security: s, ready: true, missing: [] };
  const missing: ReviewState['missing'] = [];
  if (!tech.length) missing.push('technical');
  if (!sec.length) missing.push('security');
  if (tech.length && sec.length) missing.push('second_person');
  return { technical: tech[0] ?? null, security: sec[0] ?? null, ready: false, missing };
}

/** All free text of an asset in one string (screened against the security patterns and contact details). */
export function assetText(a: { title_en?: string; title_ar?: string; summary_en?: string; summary_ar?: string; body?: string; key_points?: KeyPoint[] }): string {
  return [a.title_en, a.title_ar, a.summary_en, a.summary_ar, a.body, ...(a.key_points ?? []).flatMap((k) => [k?.en, k?.ar])].filter(Boolean).join('\n');
}
export const wordCount = (s: string) => (String(s ?? '').trim().match(/\S+/g) ?? []).length;
export const between = (s: unknown, [lo, hi]: readonly [number, number]) => typeof s === 'string' && s.trim().length >= lo && s.trim().length <= hi;
export const showUsedBy = (n: number) => n >= USED_BY_MIN;

/** Search document for the knowledge base (F02 BM25 SearchEngine): assets, OE lessons and courses side by side. */
export interface KbDoc { id: string; kind: 'asset' | 'oe' | 'course'; title: { en: string; ar: string }; text: { en: string; ar: string }; keywords?: string[]; route?: string | null }

export const KC_MSG = {
  not_signed_in: 'Sign in to use the knowledge capture studio',
  forbidden: 'Knowledge capture is open to staff',
  forbidden_plan: 'Only interviewers (instructors and the knowledge-management owner) or the SME\'s department head plan capture sessions',
  forbidden_author: 'Only subject-matter experts and interviewers draft knowledge assets',
  forbidden_review: 'Only interviewers and the knowledge-management owner review knowledge assets',
  forbidden_publish: 'Only the knowledge-management owner publishes knowledge assets',
  forbidden_withdraw: 'Only the knowledge-management owner or the author withdraws an asset',
  not_participant: 'Only the SME, the interviewer or the knowledge-management owner can update this session',
  sme_not_found: 'Subject-matter expert not found',
  interviewer: 'Choose an interviewer who is an instructor, a department head or the knowledge-management owner, other than the SME',
  template: 'Choose one of the five interview templates',
  planned_on: 'Plan the session between today and six months from today',
  title: 'Give a title of 5 to 140 characters',
  skills: 'Choose up to eight skills from the catalogue (never security, safeguards or cyber skills)',
  standards: 'Choose up to six qualification standards (never security-restricted ones)',
  session_not_found: 'Capture session not found',
  transition: 'This step is not possible from the session\'s current status',
  held_on: 'Give the date the session was held (not in the future)',
  transcript: 'Upload a transcript of 200 to 60,000 characters (text only; no audio is processed)',
  notes: 'Keep notes under 500 characters',
  action_not_found: 'Mitigation action not found or already closed',
  asset_not_found: 'Knowledge asset not found',
  not_author: 'Only the author can change this draft',
  not_editable: 'Only drafts (or assets sent back with changes) can be edited',
  session_state: 'Draft from a session once its transcript is uploaded',
  summary: 'Write a summary of 20 to 600 characters in English and in Arabic',
  body: 'Write a body of 50 to 20,000 characters',
  key_points: 'Give one to eight key points, each under 300 characters, in English and in Arabic',
  family: 'Choose a system family',
  contact: 'Not submitted: remove email addresses and phone numbers. Name roles, never people',
  not_in_review: 'This asset is not waiting for review',
  own_asset: 'You cannot review or publish an asset you wrote or that captures your own knowledge',
  review_kind: 'Choose a technical review or a security and content check',
  review_outcome: 'Choose pass or changes',
  review_note: 'Explain the changes you need in at least 10 characters',
  security_checks: 'A security and content pass needs both checks: de-identified and free of security, safeguards and cyber details',
  technical_checks: 'A technical pass needs the accuracy check and a decision on every suggestion',
  already_reviewed: 'You have already reviewed this version',
  reviews_missing: 'Publishing needs a technical review pass and a security and content pass by two different people other than the author',
  not_published: 'Only published assets can be used, withdrawn or attached to standards',
  withdraw_reason: 'Give a reason of 5 to 300 characters',
  requal: 'Choose up to six qualification standards (never security-restricted ones)',
  headline: 'Keep your headline under 140 characters',
  sme_kind: 'Choose how you are leaving or visiting',
  availability: 'Choose your availability',
  band: 'Choose a capture window band',
} as const;
/** The refusal names the category so the audit row records it, never the text. */
export const restrictedGuidance = (category: string) =>
  `Not submitted: ${category} content is not allowed in knowledge assets. Capture the reasoning, lessons and rules of thumb; leave out plant security arrangements, safeguards figures and cyber or network details`;
