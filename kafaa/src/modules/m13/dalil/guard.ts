/**
 * Dalil guardrails, applied before any answer engine (so a future model can never bypass them):
 *   1. concerns: stop and show the ECP channels, and withhold the user's words from the log (M08);
 *   2. prompt injection;
 *   3. out-of-scope categories: plant operations and procedures, security and physical protection, safeguards,
 *      cyber details, emergency actions, medical matters, exam items, other people's personal data, eligibility decisions.
 * Built-in patterns are a floor that the admin console cannot weaken; refusal_policies rows add patterns and wording.
 */
import { hasAny, normText } from './text';
import type { RefusalPolicy } from './types';

export interface GuardHit {
  category: string;
  pattern: string;
  stop: boolean;
}

/** Words that make a security, safeguards, cyber or emergency question a careers question instead. */
export const CAREER_WORDS = [
  'career', 'careers', 'job', 'jobs', 'role', 'become', 'becoming', 'work as', 'training to', 'training for', 'qualification', 'qualifications', 'qualify', 'requirements', 'study', 'degree', 'vacanc', 'hiring', 'officer', 'specialist', 'engineer', 'coordinator', 'path', 'apply', 'clearance', 'operator',
  'مهنة', 'مهن', 'وظيفة', 'وظائف', 'اصبح', 'أصبح', 'العمل ك', 'مؤهلات', 'متطلبات', 'دراسة', 'مسار', 'ضابط', 'أخصائي', 'مهندس', 'منسق', 'تصريح', 'مشغل',
];

const FLOOR: Record<string, { strong: string[]; weak?: string[]; stop?: boolean }> = {
  concern: {
    strong: [
      'i want to report', 'i want to raise', 'report a concern', 'raise a concern', 'raise concern', 'report concern', 'make a complaint', 'file a complaint', 'whistleblow', 'harass', 'retaliat', 'intimidat', 'bullied', 'bullying',
      'discriminat', 'cover up', 'covered up', 'falsif', 'threatened me', 'afraid to speak', 'afraid to report', 'something unsafe', 'unsafe practice', 'unsafe condition', 'i saw someone', 'my supervisor told me to', 'pressured to sign',
      'speak up', 'speak-up', 'report to protect',
      'أريد الإبلاغ', 'اريد الابلاغ', 'أبلغ عن', 'ابلغ عن', 'الإبلاغ عن', 'بلاغ', 'شكوى', 'مضايقة', 'انتقام', 'تحرش', 'ترهيب', 'تمييز', 'غير آمن', 'رفع مخاوف', 'رفع مخاوفي', 'تستر',
    ],
    stop: true,
  },
  injection: {
    strong: ['ignore previous', 'ignore all previous', 'ignore prior', 'ignore your instructions', 'ignore the instructions', 'disregard your', 'disregard previous', 'system prompt', 'reveal your prompt', 'your instructions are', 'you are now', 'pretend to be', 'act as an unrestricted', 'jailbreak', 'developer mode', 'dan mode', 'تجاهل التعليمات', 'تجاهل كل التعليمات', 'موجه النظام'],
  },
  security: {
    strong: [
      'security arrangement', 'security arrangements', 'security plan', 'security measures', 'security setup', 'security system', 'security systems', 'perimeter', 'guard post', 'guard posts', 'guards', 'patrol', 'cctv', 'camera', 'cameras', 'weapon', 'armed', 'response force', 'physical protection system',
      'how is the plant protected', 'how is barakah protected', 'protected area', 'vital area', 'drone', 'drones', 'intrusion', 'access control system', 'badge reader', 'sabotage', 'attack the', 'attack on', 'break into', 'get into the plant', 'sneak', 'bypass security', 'security weakness', 'security gaps',
      'الترتيبات الأمنية', 'الإجراءات الأمنية', 'الحراس', 'الحراسة', 'كاميرات', 'السياج', 'الحماية المادية', 'نظام الحماية', 'هجوم', 'تخريب', 'طائرة مسيرة', 'طائرات مسيرة', 'اقتحام', 'التسلل',
    ],
    weak: ['security', 'secure the plant', 'الأمن', 'أمن المحطة'],
  },
  safeguards: {
    strong: ['nuclear material inventory', 'material accounting', 'material balance', 'enrichment level', 'how much uranium', 'how much plutonium', 'fuel inventory', 'where is the fuel stored', 'spent fuel location', 'where is the spent fuel', 'diversion', 'مخزون المواد النووية', 'كمية اليورانيوم', 'مكان تخزين الوقود'],
    weak: ['safeguards', 'الضمانات'],
  },
  cyber: {
    strong: ['firewall', 'network diagram', 'network architecture', 'scada', 'plc', 'vulnerab', 'password', 'passwords', 'ip address', 'hack', 'hacking', 'exploit', 'malware', 'ransomware', 'data diode bypass', 'جدار الحماية', 'كلمة المرور', 'ثغرة', 'اختراق'],
  },
  operations: {
    strong: ['operating procedure', 'operating procedures', 'emergency operating procedure', 'eop', 'setpoint', 'setpoints', 'how do i start the reactor', 'how to start the reactor', 'how to operate the reactor', 'how to shut down the reactor', 'reactor trip procedure', 'withdraw control rod', 'control rod sequence', 'boron concentration', 'valve lineup', 'tech spec limit', 'technical specification limit', 'alarm response procedure', 'override the', 'disable the alarm', 'إجراء تشغيل', 'إجراءات التشغيل', 'نقطة الضبط', 'تشغيل المفاعل خطوة', 'قضبان التحكم'],
  },
  emergency: {
    strong: ['evacuat', 'iodine', 'potassium iodide', 'emergency zone', 'emergency planning zone', 'what should i do in an emergency', 'what to do in an emergency', 'shelter in place', 'radiation leak', 'siren', 'sirens', 'how far should i', 'إخلاء', 'يود', 'منطقة الطوارئ', 'ماذا أفعل في حالة الطوارئ', 'صفارات', 'تسرب إشعاعي'],
    weak: ['emergency', 'طوارئ', 'الطوارئ'],
  },
  medical: {
    strong: ['medical condition', 'diagnos', 'my health', 'medication', 'disease', 'fitness for duty test result', 'drug test result', 'blood test', 'pregnan', 'my medical', 'مرض', 'حالتي الصحية', 'تشخيص', 'دواء', 'نتيجة الفحص الطبي'],
  },
  exam: {
    strong: ['exam question', 'exam questions', 'exam answer', 'exam answers', 'answer key', 'what is on the exam', 'what is on the fanr exam', 'past paper', 'past papers', 'test questions', 'leaked exam', 'أسئلة الاختبار', 'أسئلة الامتحان', 'إجابات الاختبار', 'نموذج الإجابة'],
  },
  personal: {
    strong: ['who is the ceo', 'who is the manager', 'who is the operator', 'who is the supervisor', 'who is the head of', 'who is the director', 'who is my evaluator', 'name of the operator', 'names of the operators', 'phone number of', 'phone number for', 'email of', 'email address of', 'contact details of', 'home address', 'salary of', 'من هو مدير', 'اسم المشغل', 'رقم هاتف', 'البريد الإلكتروني لـ', 'عنوان منزل'],
  },
  decision: {
    strong: ['am i eligible', 'will i be accepted', 'will i be selected', 'will i pass', 'will i get the job', 'will i get in', 'predict my', 'my chances', 'do i qualify', 'can i get in', 'will fanr approve', 'هل أنا مؤهل', 'هل سيتم قبولي', 'هل سأنجح', 'فرصتي', 'هل سأقبل'],
  },
};

/** Categories that run before others: a concern always wins. */
const ORDER = ['concern', 'injection', 'security', 'safeguards', 'cyber', 'operations', 'emergency', 'medical', 'exam', 'personal', 'decision'];

export function detectGuard(question: string, policies: RefusalPolicy[]): GuardHit | null {
  const norm = normText(question);
  const careerish = !!hasAny(norm, CAREER_WORDS);
  for (const cat of ORDER) {
    const floor = FLOOR[cat];
    const pol = policies.find((p) => p.category === cat);
    // Policies can add patterns; they can be disabled in the console except where the floor is mandatory.
    const extra = pol && pol.enabled ? pol.patterns : [];
    const strong = hasAny(norm, [...(floor?.strong ?? []), ...extra]);
    if (strong) {
      // A career question that merely mentions a word like "camera" in a role title is still a careers question for
      // the weaker categories; plant security, cyber and operations details are refused regardless.
      return { category: cat, pattern: strong, stop: cat === 'concern' || !!pol?.stop };
    }
    if (floor?.weak && !careerish) {
      const weak = hasAny(norm, floor.weak);
      if (weak) return { category: cat, pattern: weak, stop: false };
    }
  }
  return null;
}

/** Categories whose built-in floor cannot be switched off in the admin console. */
export const LOCKED_CATEGORIES = ['concern', 'security', 'safeguards', 'cyber', 'operations', 'injection'];
export const FLOOR_PATTERN_COUNT = Object.fromEntries(Object.entries(FLOOR).map(([k, v]) => [k, v.strong.length + (v.weak?.length ?? 0)]));
