// [G4] Seed rows for M09 (supplier documents, academy checks, onboarding history and summaries, equivalency mapping)
// and M11 (skills per technology, future-role catalogue, learning tracks, skills-gap plans).
// Called once from scripts/build-seed.mjs after every other builder: applyG4(T) adds rows and patches G4-owned tables only.
// No real names: contractors are synthetic, ENEC people appear only as role labels.
import { createHash } from 'node:crypto';
import { srcs } from './sources.mjs';

const DEMO_TODAY = '2026-10-08';
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const ts = (d, h = 8) => `${d}T${String(h).padStart(2, '0')}:00:00Z`;
const sha = (s) => createHash('sha256').update(s).digest('hex');

// Keep in step with src/domain/partners.ts DOC_CHECKLIST
const DOCS = [
  ['trade_licence', 'orientation', true], ['company_profile', 'orientation', true], ['qa_manual', 'quality', true], ['nqa1_programme', 'quality', true],
  ['cgd_procedure', 'quality', true], ['cfsi_procedure', 'quality', true], ['iso9001', 'quality', false], ['asme_certificate', 'quality', false],
  ['defect_reporting_procedure', 'safety_culture', true], ['safety_culture_statement', 'safety_culture', true], ['icv_certificate', 'icv', true],
  ['business_continuity_plan', 'self_assessment', false],
];
const STEP_ORDER = ['orientation', 'quality', 'safety_culture', 'icv', 'self_assessment', 'handoff'];

function documents(T) {
  // per org: status for each doc (u = uploaded, a = accepted, r = rejected, - = missing)
  const plan = {
    'org-alnoor': 'aaaaaaaaaaaa',
    'org-dhafra': 'aaaaaa-aaaa-',
    'org-tarsus': 'uuuuuuu-uuu-',
    'org-gulfhydro': 'aauuru--u---',
    'org-liwa': '------------',
  };
  const S = { u: 'uploaded', a: 'accepted', r: 'rejected', '-': 'missing' };
  for (const [org, codes] of Object.entries(plan)) {
    DOCS.forEach(([key, step, required], i) => {
      const status = S[codes[i]];
      const has = status !== 'missing';
      const reviewed = status === 'accepted' || status === 'rejected';
      const file = has ? `${org.replace('org-', '')}-${key.replace(/_/g, '-')}.pdf` : null;
      T.supplier_documents.push({
        id: `sd-${org}-${key}`, org_id: org, doc_key: key, required, step_key: step, status,
        file_name: file, size_kb: has ? 180 + ((i * 97) % 900) : null, sha256: has ? sha(`${org}/${key}/v1`) : null,
        uploaded_at: has ? ts(addDays(DEMO_TODAY, -60 + i)) : null, uploaded_by: has ? (org === 'org-alnoor' ? 'p-alnoor-gm' : org === 'org-gulfhydro' ? 'p-gulfhydro-qa' : null) : null,
        reviewed_at: reviewed ? ts(addDays(DEMO_TODAY, -40 + i)) : null, reviewed_by: reviewed ? 'p-k-admin' : null,
        review_note: status === 'rejected' ? 'The CGD procedure does not define critical characteristics or acceptance methods. Please revise and upload again.' : status === 'accepted' ? 'Checked against the checklist.' : null,
      });
    });
  }
}

function onboardingPatches(T) {
  const org = (id) => T.organisations.find((o) => o.id === id);
  const hist = (rows) => rows.map(([d, action, status, by_role, note]) => ({ at: ts(d), action, status, by_role, note: note ?? null }));
  for (const c of T.partner_onboarding) {
    const h = [[c.started_at.slice(0, 10), 'invited', 'invited', 'admin', 'Invitation sent to the partner admin']];
    if (c.status !== 'invited') h.push([addDays(c.started_at.slice(0, 10), 3), 'start', 'in_progress', 'partner_admin', null]);
    if (c.submitted_at) h.push([c.submitted_at.slice(0, 10), 'submit', 'submitted', 'partner_admin', 'Readiness summary generated']);
    if (['approved', 'handed_off'].includes(c.status)) h.push([c.decided_at.slice(0, 10), 'approved', 'approved', 'admin', 'Evidence checked; ready for ENEC supplier registration']);
    if (c.status === 'handed_off') h.push([addDays(c.decided_at.slice(0, 10), 2), 'handed_off', 'handed_off', 'admin', 'Handed to the NEXUS partner lens (/partner/readiness)']);
    c.history = hist(h);
    if (['approved', 'handed_off'].includes(c.status)) c.decision_note = 'Evidence checked; ready for ENEC supplier registration';
    // Only a handed-off case has the hand-off step done
    for (const s of T.supplier_readiness.filter((r) => r.org_id === c.org_id && r.step_key === 'handoff')) {
      s.status = c.status === 'handed_off' ? 'done' : 'not_started';
      s.evidence = c.status === 'handed_off' ? 'NEXUS /partner/readiness' : null;
    }
    // Self-assessment scores for every org that completed that step
    for (const s of T.supplier_readiness.filter((r) => r.org_id === c.org_id && r.step_key === 'self_assessment' && r.status === 'done')) {
      s.self_assessment = { nqa1: 3, cgd: c.org_id === 'org-tarsus' ? 2 : 3, cfsi: 3, defect_reporting: 3, safety_culture: 3, business_continuity: c.org_id === 'org-alnoor' ? 4 : 2 };
    }
    if (c.kind === 'supplier' && c.submitted_at) {
      const o = org(c.org_id);
      const steps = T.supplier_readiness.filter((r) => r.org_id === c.org_id).sort((a, b) => STEP_ORDER.indexOf(a.step_key) - STEP_ORDER.indexOf(b.step_key));
      const docs = T.supplier_documents.filter((d) => d.org_id === c.org_id);
      const icv = T.icv_plans.find((p) => p.org_id === c.org_id);
      const certs = T.certificates.filter((x) => x.org_id === c.org_id).sort((a, b) => a.course_id.localeCompare(b.course_id));
      const date = c.submitted_at.slice(0, 10);
      c.summary = {
        ref: `KFA-RS-${c.org_id.replace(/^org-/, '').toUpperCase().slice(0, 10)}-${date.replace(/-/g, '')}`,
        generated_at: c.submitted_at, org_id: o.id, org_name_en: o.name_en, org_name_ar: o.name_ar,
        steps: steps.map((s) => ({ key: s.step_key, status: s.step_key === 'handoff' ? 'not_started' : s.status, updated_at: s.updated_at })),
        self_assessment: steps.find((s) => s.step_key === 'self_assessment')?.self_assessment ?? {},
        documents: docs.map((d) => ({ key: d.doc_key, status: d.status === 'accepted' ? 'uploaded' : d.status, file_name: d.file_name, sha256: d.sha256 })),
        icv: icv ? { baseline: icv.baseline, target: icv.target, target_year: icv.target_year, status: icv.status === 'draft' ? 'submitted' : icv.status, certificate_valid_to: icv.certificate_valid_to } : null,
        academy: certs.map((x) => ({ course_id: x.course_id, certificate_no: x.id, issued_on: x.issued_on })),
        disclaimer: "Prepared by Kafa'a for ENEC supplier registration. Kafa'a prepares suppliers; ENEC's procurement and quality functions qualify them. This summary is not a registration, a qualification or an award.",
      };
    }
  }
}

function equivalencyPatches(T) {
  const tasks = (std) => T.task_items.filter((t) => t.standard_id === std);
  for (const r of T.equivalency_requests) {
    const by = r.org_id === 'org-alnoor' ? 'p-alnoor-gm' : r.org_id === 'org-gulfhydro' ? 'p-gulfhydro-qa' : 'p-k-contractor';
    r.submitted_by = by;
    const sub = r.submitted_at.slice(0, 10);
    const h = [{ at: r.submitted_at, action: 'submit', status: 'submitted', by_role: 'partner_admin', note: `${r.evidence.length} evidence items` }];
    if (r.status !== 'submitted') h.push({ at: ts(addDays(sub, 4)), action: 'map', status: 'under_review', by_role: 'instructor', note: 'Evidence mapped to the task list' });
    if (['equivalent', 'training_required', 'rejected'].includes(r.status)) h.push({ at: r.decided_at, action: 'decide', status: r.status, by_role: 'instructor', note: r.decision_note });
    r.history = h;
    if (r.status === 'equivalent') r.mapping = tasks(r.standard_id).map((t) => ({ task_id: t.id, covered: true, evidence: [0, 1], note: 'Observed or evidenced' }));
    else if (r.status === 'training_required') r.mapping = tasks(r.standard_id).map((t, i) => ({ task_id: t.id, covered: i !== 1, evidence: i !== 1 ? [0] : [], note: i === 1 ? 'No evidence of the zero-energy verification JPM' : 'Evidenced' }));
    else if (r.status === 'under_review') r.mapping = tasks(r.standard_id).map((t, i) => ({ task_id: t.id, covered: i === 0, evidence: i === 0 ? [0] : [], note: '' }));
  }
}

function icvPatches(T) {
  for (const p of T.icv_plans) {
    if (p.status !== 'draft') { p.submitted_at = ts(addDays(DEMO_TODAY, -30)); p.certificate_sha256 = sha(`${p.org_id}/icv-certificate`); }
    if (p.status === 'reviewed') { p.reviewed_by = 'p-k-admin'; p.review_note = 'Plan levers cover the gap; certificate on file.'; }
    if (p.org_id === 'org-tarsus') { p.levers = [{ lever: 'Local sourcing', en: 'Source castings sand and alloys locally', ar: 'توريد رمل الصب والسبائك محلياً', delta: 4 }]; }
  }
}

// ───────────── Supplier academy knowledge checks (concept content; 4 questions per course)
const Q = (en, ar, opts, answer) => ({ en, ar, opts, answer });
const O = (en, ar) => ({ en, ar });
const CHECKS = {
  'c-sa-nqa1-101': [
    Q('What does ASME NQA-1 set out?', 'ماذا يحدد معيار ASME NQA-1؟', [O('Quality assurance requirements for nuclear facility applications', 'متطلبات ضمان الجودة لتطبيقات المنشآت النووية'), O('Reactor physics design limits', 'حدود تصميم فيزياء المفاعل'), O('Nuclear fuel pricing rules', 'قواعد تسعير الوقود النووي')], 0),
    Q('How many basic requirements does NQA-1 Part I contain?', 'كم عدد المتطلبات الأساسية في الجزء الأول من NQA-1؟', [O('12', '12'), O('18', '18'), O('25', '25')], 1),
    Q('An activity does not meet a specified requirement. What must the supplier do?', 'نشاط لا يستوفي متطلباً محدداً. ماذا يجب على المورد أن يفعل؟', [O('Record a nonconformance and control the affected item', 'تسجيل حالة عدم مطابقة وضبط المادة المتأثرة'), O('Ship it and tell the customer later', 'شحنها وإبلاغ العميل لاحقاً'), O('Rework it without keeping records', 'إعادة العمل عليها دون الاحتفاظ بسجلات')], 0),
    Q('Which record shows an item was inspected and accepted?', 'أي سجل يثبت أن المادة فُحصت وقُبلت؟', [O('A signed inspection record kept under the QA programme', 'سجل فحص موقّع محفوظ ضمن برنامج ضمان الجودة'), O('A verbal confirmation from the shop floor', 'تأكيد شفهي من الورشة'), O('A product brochure', 'كتيّب المنتج')], 0),
  ],
  'c-sa-cfsi-102': [
    Q('What does CFSI stand for?', 'إلامَ يشير الاختصار CFSI؟', [O('Counterfeit, fraudulent and suspect items', 'المواد المقلدة والاحتيالية والمشبوهة'), O('Certified, fabricated and standard items', 'المواد المعتمدة والمصنّعة والقياسية'), O('Commercial fuel supply inventory', 'مخزون توريد الوقود التجاري')], 0),
    Q('A certificate shows a heat number that does not match the part marking. What do you do?', 'تُظهر الشهادة رقم صهر لا يطابق علامة القطعة. ماذا تفعل؟', [O('Quarantine the item and report it as suspect', 'عزل المادة والإبلاغ عنها كمادة مشبوهة'), O('Correct the certificate by hand', 'تصحيح الشهادة يدوياً'), O('Use the item if it looks fine', 'استخدام المادة إن بدت سليمة')], 0),
    Q('Which is a warning sign of a counterfeit item?', 'أي مما يلي علامة تحذيرية على مادة مقلدة؟', [O('A traceable purchase order', 'أمر شراء قابل للتتبع'), O('Altered or inconsistent markings', 'علامات معدّلة أو غير متسقة'), O('Sealed manufacturer packaging', 'تغليف مختوم من المصنّع')], 1),
    Q('You find a suspect item that was already shipped. Whom do you tell?', 'وجدت مادة مشبوهة سبق شحنها. من تُبلغ؟', [O('Nobody, if it passed inspection', 'لا أحد إن اجتازت الفحص'), O('Only your sales team', 'فريق المبيعات فقط'), O('The purchaser, promptly and in writing', 'المشتري، فوراً وكتابياً')], 2),
  ],
  'c-sa-cgd-103': [
    Q('What is commercial-grade dedication?', 'ما المقصود باعتماد المواد التجارية؟', [O('A process that gives reasonable assurance a commercial-grade item will perform its safety function', 'عملية توفر ضماناً معقولاً بأن المادة التجارية ستؤدي وظيفتها المتعلقة بالسلامة'), O('A discount for bulk orders', 'خصم على الطلبات الكبيرة'), O('A course for plant operators', 'دورة لمشغّلي المحطة')], 0),
    Q('What are critical characteristics?', 'ما الخصائص الحرجة؟', [O('The item\'s colour and packaging', 'لون المادة وتغليفها'), O('Measurable attributes that, once verified, show the item will perform its safety function', 'سمات قابلة للقياس تُثبت بعد التحقق منها أن المادة ستؤدي وظيفتها المتعلقة بالسلامة'), O('The delivery schedule', 'جدول التسليم')], 1),
    Q('Which is an accepted way to verify critical characteristics?', 'أي مما يلي طريقة مقبولة للتحقق من الخصائص الحرجة؟', [O('Special tests and inspections', 'اختبارات وفحوص خاصة'), O('The catalogue description alone', 'وصف الكتالوج وحده'), O('A phone call to the manufacturer', 'مكالمة هاتفية مع المصنّع')], 0),
    Q('Who is responsible for a dedication?', 'من المسؤول عن عملية الاعتماد؟', [O('Nobody, once the item is installed', 'لا أحد بعد تركيب المادة'), O('The end user only', 'المستخدم النهائي فقط'), O('The dedicating entity, under its QA programme', 'الجهة التي تُجري الاعتماد، ضمن برنامج ضمان الجودة لديها')], 2),
  ],
  'c-sa-sc-104': [
    Q('How many traits of a healthy nuclear safety culture does the industry framework describe?', 'كم عدد سمات ثقافة السلامة النووية السليمة في الإطار المعتمد في القطاع؟', [O('5', '5'), O('10', '10'), O('20', '20')], 1),
    Q('What does a questioning attitude mean?', 'ماذا يعني الموقف التساؤلي؟', [O('Challenging assumptions and stopping when unsure', 'مساءلة الافتراضات والتوقف عند الشك'), O('Avoiding questions to save time', 'تجنّب الأسئلة لتوفير الوقت'), O('Asking only your supervisor', 'سؤال المشرف فقط')], 0),
    Q('Who can raise a safety concern?', 'من يحق له إثارة مخاوف تتعلق بالسلامة؟', [O('Only managers', 'المديرون فقط'), O('Only ENEC employees', 'موظفو ENEC فقط'), O('Anyone, without fear of retaliation', 'أي شخص، دون خوف من الانتقام')], 2),
    Q('Which human-performance tool checks your own action before you take it?', 'أي أداة من أدوات الأداء البشري تتحقق من تصرفك قبل القيام به؟', [O('Self-checking (STAR)', 'التحقق الذاتي (STAR)'), O('Skipping steps', 'تخطي الخطوات'), O('Peer pressure', 'ضغط الأقران')], 0),
  ],
  'c-sa-icv-105': [
    Q('Who runs the National In-Country Value Programme?', 'من يدير البرنامج الوطني للقيمة المحلية المضافة؟', [O('The Ministry of Industry and Advanced Technology (MoIAT)', 'وزارة الصناعة والتكنولوجيا المتقدمة'), O('FANR', 'الهيئة الاتحادية للرقابة النووية'), O('The IAEA', 'الوكالة الدولية للطاقة الذرية')], 0),
    Q('How does ENEC use the ICV score?', 'كيف تستخدم ENEC درجة القيمة المحلية المضافة؟', [O('To issue operator licences', 'لإصدار رخص المشغّلين'), O('In tender evaluation: a higher score earns more points', 'في تقييم المناقصات: الدرجة الأعلى تحصل على نقاط أكثر'), O('It does not use it', 'لا تستخدمها')], 1),
    Q('What is an ICV improvement plan?', 'ما خطة تحسين القيمة المحلية المضافة؟', [O('A plant maintenance schedule', 'جدول صيانة المحطة'), O('A safety analysis report', 'تقرير تحليل السلامة'), O('The supplier\'s planned actions to raise its ICV score', 'الإجراءات التي يخطط لها المورد لرفع درجته')], 2),
    Q('Which action typically raises a supplier\'s ICV score?', 'أي إجراء يرفع عادةً درجة القيمة المحلية المضافة للمورد؟', [O('Hiring and training UAE nationals', 'توظيف المواطنين وتدريبهم'), O('Moving production abroad', 'نقل الإنتاج إلى الخارج'), O('Importing more finished goods', 'استيراد المزيد من السلع الجاهزة')], 0),
  ],
  'c-sa-brk-106': [
    Q('What do safety-related items for Barakah need?', 'ماذا تتطلب المواد المتعلقة بالسلامة لبراكة؟', [O('A nuclear quality assurance programme and traceable records', 'برنامج ضمان جودة نووي وسجلات قابلة للتتبع'), O('Only the lowest price', 'أدنى سعر فقط'), O('No documentation', 'لا وثائق')], 0),
    Q('Who qualifies suppliers for Barakah?', 'من يؤهّل الموردين لبراكة؟', [O('Kafa\'a', 'كفاءة'), O('ENEC\'s procurement and quality functions', 'إدارتا المشتريات والجودة في ENEC'), O('The supplier itself', 'المورد نفسه')], 1),
    Q('How many UAE companies hold Barakah contracts, according to ENEC?', 'كم عدد الشركات الإماراتية الحاصلة على عقود في براكة وفق ENEC؟', [O('About 50', 'نحو 50'), O('About 200', 'نحو 200'), O('More than 2,000', 'أكثر من 2,000')], 2),
    Q('Where does a supplier start registration?', 'من أين يبدأ المورد التسجيل؟', [O('ENEC\'s supplier registration process', 'إجراءات تسجيل الموردين لدى ENEC'), O('FANR\'s licensing portal', 'بوابة الترخيص لدى الهيئة'), O('Kafa\'a issues the registration', 'كفاءة تصدر التسجيل')], 0),
  ],
  'c-sa-def-107': [
    Q('A supplier finds a defect in a delivered safety-related item. What must it do?', 'اكتشف مورد عيباً في مادة متعلقة بالسلامة سبق تسليمها. ماذا يجب عليه؟', [O('Wait for the next audit', 'انتظار التدقيق التالي'), O('Evaluate it and notify the purchaser promptly', 'تقييمه وإبلاغ المشتري فوراً'), O('Fix it quietly in the next delivery', 'إصلاحه بهدوء في التسليم التالي')], 1),
    Q('What is a noncompliance?', 'ما عدم الامتثال؟', [O('A departure from a technical requirement in the purchase order', 'انحراف عن متطلب فني في أمر الشراء'), O('A late invoice', 'فاتورة متأخرة'), O('A change of company name', 'تغيير اسم الشركة')], 0),
    Q('Why report defects early?', 'لماذا يجب الإبلاغ عن العيوب مبكراً؟', [O('To avoid paperwork', 'لتجنّب الأعمال الورقية'), O('It is optional', 'لأنه اختياري'), O('So the operator can assess plant safety in time', 'ليتمكن المشغّل من تقييم سلامة المحطة في الوقت المناسب')], 2),
    Q('What should a defect report include?', 'ماذا يجب أن يتضمن تقرير العيب؟', [O('Item identity, the defect, affected deliveries and actions taken', 'هوية المادة والعيب والتسليمات المتأثرة والإجراءات المتخذة'), O('Only the price', 'السعر فقط'), O('Only the sales contact', 'جهة اتصال المبيعات فقط')], 0),
  ],
  'c-sa-bcm-108': [
    Q('What does business continuity planning help a supplier do?', 'بماذا يساعد التخطيط لاستمرارية الأعمال المورد؟', [O('Keep delivering critical items through a disruption', 'مواصلة تسليم المواد الحرجة أثناء أي انقطاع'), O('Avoid audits', 'تجنّب عمليات التدقيق'), O('Lower its ICV score', 'خفض درجة القيمة المحلية المضافة')], 0),
    Q('What does a business impact analysis identify?', 'ماذا يحدد تحليل تأثير الأعمال؟', [O('The company colour scheme', 'ألوان الشركة'), O('Critical activities and how long they can be interrupted', 'الأنشطة الحرجة والمدة التي يمكن أن تتوقف خلالها'), O('Staff birthdays', 'أعياد ميلاد الموظفين')], 1),
    Q('How often should a continuity plan be exercised?', 'كم مرة يجب اختبار خطة الاستمرارية؟', [O('Never', 'أبداً'), O('Only after a disruption', 'بعد الانقطاع فقط'), O('Regularly, at least once a year', 'بانتظام، مرة واحدة على الأقل سنوياً')], 2),
    Q('A disruption may delay a safety-related delivery. Whom do you inform?', 'قد يؤخر انقطاعٌ تسليم مادة متعلقة بالسلامة. من تُبلغ؟', [O('The purchaser, as early as possible', 'المشتري، في أقرب وقت ممكن'), O('No one', 'لا أحد'), O('Only your insurer', 'شركة التأمين فقط')], 0),
  ],
};
function academy(T) {
  for (const [course_id, qs] of Object.entries(CHECKS)) {
    qs.forEach((q, i) => {
      const id = `ac-${course_id.replace('c-sa-', '')}-${i + 1}`;
      T.academy_checks.push({ id, course_id, n: i + 1, q_en: q.en, q_ar: q.ar, options: q.opts });
      T.academy_check_keys.push({ id: `ak-${id.slice(3)}`, check_id: id, answer: q.answer });
    });
  }
}

// ───────────── M11
// [tech, key, skill_en, skill_ar, area, relation]
const SK = [
  ['bwr', 'bwr-systems', 'BWR plant systems (direct cycle, recirculation)', 'أنظمة مفاعلات الماء المغلي (الدورة المباشرة وإعادة التدوير)', 'operations', 'adapts'],
  ['bwr', 'bwr-chemistry', 'BWR water chemistry', 'كيمياء المياه في مفاعلات الماء المغلي', 'chemistry', 'adapts'],
  ['bwr', 'passive-safety', 'Passive safety and natural circulation', 'السلامة الخاملة والدوران الطبيعي', 'safety', 'new'],
  ['bwr', 'new-licensing-basis', 'A new licensing basis', 'أساس ترخيص جديد', 'licensing', 'new'],
  ['bwr', 'conduct-of-ops', 'Conduct of operations and procedure use', 'إدارة العمليات واستخدام الإجراءات', 'operations', 'transfers'],
  ['htgr', 'gas-coolant', 'Helium coolant systems', 'أنظمة التبريد بالهيليوم', 'operations', 'new'],
  ['htgr', 'triso-fuel', 'Coated-particle (TRISO) fuel forms', 'أشكال الوقود ذي الجسيمات المغلفة (TRISO)', 'materials', 'new'],
  ['htgr', 'graphite', 'Graphite components and ageing', 'مكونات الغرافيت وتقادمها', 'materials', 'new'],
  ['htgr', 'process-heat', 'High-temperature process heat integration', 'دمج حرارة العمليات عالية الحرارة', 'project', 'new'],
  ['htgr', 'reactivity', 'Reactivity and core physics fundamentals', 'أساسيات التفاعلية وفيزياء القلب', 'physics', 'transfers'],
  ['fast', 'liquid-metal', 'Liquid-metal coolant handling', 'مناولة مبرّد المعادن السائلة', 'operations', 'new'],
  ['fast', 'lm-chemistry', 'Sodium or lead coolant chemistry', 'كيمياء مبرّد الصوديوم أو الرصاص', 'chemistry', 'new'],
  ['fast', 'fast-physics', 'Fast-spectrum reactor physics', 'فيزياء مفاعلات الطيف السريع', 'physics', 'new'],
  ['fast', 'opaque-inspection', 'Inspection in opaque coolants', 'الفحص في المبرّدات غير الشفافة', 'maintenance', 'new'],
  ['fast', 'radiological-work', 'Radiological work practices (ALARA)', 'ممارسات العمل الإشعاعي (ALARA)', 'safety', 'transfers'],
  ['micro', 'remote-ops', 'Remote monitoring and operation concepts', 'مفاهيم المراقبة والتشغيل عن بعد', 'digital', 'new'],
  ['micro', 'autonomous-control', 'Autonomous control and its oversight', 'التحكم الذاتي والإشراف عليه', 'digital', 'new'],
  ['micro', 'transportable-units', 'Transport and installation of factory-built units', 'نقل الوحدات المصنّعة في المصنع وتركيبها', 'project', 'new'],
  ['micro', 'ic-maintenance', 'Instrumentation and control maintenance', 'صيانة أنظمة القياس والتحكم', 'maintenance', 'adapts'],
  ['msr', 'salt-chemistry', 'Molten salt chemistry', 'كيمياء الأملاح المنصهرة', 'chemistry', 'new'],
  ['msr', 'salt-materials', 'Corrosion and high-temperature materials', 'التآكل والمواد عالية الحرارة', 'materials', 'new'],
  ['msr', 'lab-qa', 'Sampling discipline and laboratory QA', 'انضباط أخذ العينات وضمان جودة المختبر', 'chemistry', 'transfers'],
  ['intl', 'owners-engineer', 'Owner\'s-engineer skills', 'مهارات مهندس المالك', 'project', 'adapts'],
  ['intl', 'project-abroad', 'Project delivery abroad', 'تنفيذ المشاريع في الخارج', 'project', 'adapts'],
  ['intl', 'other-regulators', 'Other regulators\' frameworks', 'أطر الجهات الرقابية الأخرى', 'licensing', 'new'],
  ['intl', 'investment-appraisal', 'Investment appraisal for nuclear projects', 'تقييم الاستثمار في المشاريع النووية', 'project', 'new'],
  ['intl', 'digital-twins', 'Digital twins and AI governance', 'التوائم الرقمية وحوكمة الذكاء الاصطناعي', 'digital', 'new'],
];
// [id, tech_ids, title_en, title_ar, summary_en, summary_ar, from_role_ids, skill keys, horizon, family]
const FR = [
  ['fr-bwr-operator', ['bwr'], 'Small BWR operator (concept)', 'مشغّل مفاعل ماء مغلي صغير (مفهوم)', 'A licensed-operator path for a small boiling water reactor, building on APR-1400 conduct of operations.', 'مسار مشغّل مرخّص لمفاعل ماء مغلي صغير يبني على إدارة العمليات في APR-1400.', ['reactor-operator', 'senior-reactor-operator'], ['conduct-of-ops', 'bwr-systems', 'passive-safety'], 'explore', 'operations'],
  ['fr-remote-ops', ['micro'], 'Microreactor remote operations specialist (concept)', 'أخصائي التشغيل عن بعد للمفاعلات المتناهية الصغر (مفهوم)', 'Monitors factory-built units from a central room and oversees autonomous control functions.', 'يراقب الوحدات المصنّعة في المصنع من غرفة مركزية ويشرف على وظائف التحكم الذاتي.', ['reactor-operator', 'cyber-security-engineer'], ['remote-ops', 'autonomous-control'], 'watch', 'operations'],
  ['fr-liquid-metal', ['fast'], 'Liquid-metal systems engineer (concept)', 'مهندس أنظمة المعادن السائلة (مفهوم)', 'Designs and supports systems that handle sodium or lead coolants.', 'يصمم الأنظمة التي تتعامل مع مبرّدات الصوديوم أو الرصاص ويدعمها.', ['systems-design-plant-engineer', 'maintenance-technician-engineer'], ['liquid-metal', 'opaque-inspection'], 'watch', 'engineering'],
  ['fr-salt-chemist', ['msr'], 'Molten salt chemistry specialist (concept)', 'أخصائي كيمياء الأملاح المنصهرة (مفهوم)', 'Controls salt chemistry and corrosion in molten salt systems.', 'يضبط كيمياء الأملاح والتآكل في أنظمة الأملاح المنصهرة.', ['chemistry-technician'], ['salt-chemistry', 'salt-materials', 'lab-qa'], 'watch', 'chemistry'],
  ['fr-ht-materials', ['htgr', 'msr'], 'High-temperature materials engineer (concept)', 'مهندس المواد عالية الحرارة (مفهوم)', 'Qualifies graphite, alloys and coatings for high-temperature service.', 'يؤهل الغرافيت والسبائك والطلاءات للخدمة في درجات حرارة عالية.', ['systems-design-plant-engineer', 'quality-assurance-qc'], ['graphite', 'salt-materials'], 'watch', 'engineering'],
  ['fr-adv-fuel', ['htgr', 'fast'], 'Advanced fuel specialist (concept)', 'أخصائي الوقود المتقدم (مفهوم)', 'Works on coated-particle and fast-reactor fuel forms and their supply chains.', 'يعمل على أشكال الوقود ذي الجسيمات المغلفة ووقود المفاعلات السريعة وسلاسل إمدادها.', ['nuclear-fuel-specialist', 'reactor-engineer-core-physicist'], ['triso-fuel', 'fast-physics'], 'explore', 'nuclear-fuel'],
  ['fr-adv-licensing', ['bwr', 'htgr', 'fast', 'micro', 'msr'], 'Advanced reactor licensing specialist (concept)', 'أخصائي ترخيص المفاعلات المتقدمة (مفهوم)', 'Builds a licensing basis for a new design with the regulator; no proposal has been made to FANR.', 'يبني أساس الترخيص لتصميم جديد مع الجهة الرقابية؛ ولم يُقدَّم أي مقترح إلى الهيئة.', ['regulatory-affairs-licensing-engineer'], ['new-licensing-basis', 'other-regulators'], 'explore', 'licensing'],
  ['fr-owners-engineer', ['intl'], 'Owner\'s engineer, international projects (concept)', 'مهندس المالك للمشاريع الدولية (مفهوم)', 'Represents the owner on projects abroad, in line with ENEC Consulting\'s advisory work.', 'يمثل المالك في المشاريع الخارجية بما يتماشى مع العمل الاستشاري لـENEC للاستشارات.', ['systems-design-plant-engineer', 'procurement-engineer', 'outage-manager-planner'], ['owners-engineer', 'project-abroad', 'investment-appraisal'], 'prepare', 'engineering'],
  ['fr-digital-twin', ['intl', 'micro'], 'Digital twin engineer (concept)', 'مهندس التوائم الرقمية (مفهوم)', 'Builds and governs digital twins, separate from reactor control systems.', 'يبني التوائم الرقمية ويحوكمها بمعزل عن أنظمة التحكم في المفاعل.', ['systems-design-plant-engineer', 'cyber-security-engineer'], ['digital-twins', 'remote-ops'], 'prepare', 'engineering'],
  ['fr-process-heat', ['htgr'], 'Process-heat integration engineer (concept)', 'مهندس دمج حرارة العمليات (مفهوم)', 'Studies how high-temperature heat could serve industrial users; exploratory only.', 'يدرس كيف يمكن لحرارة العمليات العالية أن تخدم المستخدمين الصناعيين؛ استكشافي فقط.', ['systems-design-plant-engineer'], ['process-heat'], 'watch', 'engineering'],
  ['fr-adv-instructor', ['bwr', 'htgr', 'fast', 'micro', 'msr'], 'Advanced reactor instructor (concept)', 'مدرّب المفاعلات المتقدمة (مفهوم)', 'Teaches advanced reactor fundamentals to staff and students using the systematic approach to training.', 'يدرّس أساسيات المفاعلات المتقدمة للموظفين والطلاب وفق النهج المنهجي للتدريب.', ['nuclear-training-instructor'], ['reactivity', 'passive-safety'], 'prepare', 'training'],
];
const TR = [
  ['trk-orientation', 'Advanced reactor families: an orientation', 'عائلات المفاعلات المتقدمة: مدخل تعريفي', 'What the ADVANCE programme evaluates, the six technology families and what changes from APR-1400.', 'ما يقيّمه برنامج ADVANCE، والعائلات التقنية الست، وما الذي يتغير عن APR-1400.', 'all', 'intro', ['bwr', 'htgr', 'fast', 'micro', 'msr', 'intl'], [['What ADVANCE evaluates', 'ما يقيّمه برنامج ADVANCE', 40], ['Six technology families compared', 'مقارنة بين العائلات التقنية الست', 60], ['What transfers from APR-1400', 'ما الذي ينتقل من APR-1400', 40], ['Knowledge check', 'اختبار المعرفة', 20]], 'c-adv-intro', 3, ['wnn-advance', 'wnn-smr-mous']],
  ['trk-smr-ops', 'SMRs and microreactors: what changes for operators', 'المفاعلات الصغيرة والمتناهية الصغر: ما الذي يتغير للمشغّلين', 'Passive safety, remote and autonomous operation concepts and new licensing questions.', 'السلامة الخاملة ومفاهيم التشغيل عن بعد وأسئلة الترخيص الجديدة.', 'staff', 'intermediate', ['bwr', 'micro'], [['Passive safety and natural circulation', 'السلامة الخاملة والدوران الطبيعي', 60], ['Remote and autonomous operation concepts', 'مفاهيم التشغيل عن بعد والتشغيل الذاتي', 60], ['Licensing a new design', 'ترخيص تصميم جديد', 60], ['Case discussion', 'مناقشة حالة', 60]], 'c-adv-smr', 4, ['wnn-smr-mous', 'wnn-gevh']],
  ['trk-students', 'Advanced reactors for students', 'المفاعلات المتقدمة للطلاب', 'A short introduction for school and university students: coolants, fuels and the careers that grow from today\'s roles.', 'مقدمة قصيرة لطلاب المدارس والجامعات: المبرّدات والوقود والمهن التي تنمو من الأدوار الحالية.', 'students', 'intro', ['htgr', 'fast', 'msr'], [['How a reactor makes heat', 'كيف يولّد المفاعل الحرارة', 30], ['Water, gas, metal and salt: coolants compared', 'الماء والغاز والمعادن والأملاح: مقارنة المبرّدات', 40], ['Careers that transfer', 'مهن قابلة للانتقال', 30]], null, 1.7, ['wnn-advance']],
  ['trk-materials', 'Coolants, fuels and materials compared', 'المبرّدات والوقود والمواد: مقارنة', 'Chemistry and materials questions that differ from pressurised water reactors.', 'أسئلة الكيمياء والمواد التي تختلف عن مفاعلات الماء المضغوط.', 'all', 'intermediate', ['htgr', 'fast', 'msr'], [['Gas coolants and TRISO fuel', 'المبرّدات الغازية ووقود TRISO', 45], ['Liquid metals', 'المعادن السائلة', 45], ['Molten salts', 'الأملاح المنصهرة', 45], ['Materials at high temperature', 'المواد في درجات الحرارة العالية', 45]], null, 3, ['wnn-smr-mous', 'wnn-newcleo']],
  ['trk-digital', 'AI and digital twins in nuclear operations', 'الذكاء الاصطناعي والتوائم الرقمية في العمليات النووية', 'Themes ENEC has named: the ENEC-KEPCO AI Innovation Lab and the ENECIQ platform, which runs separately from reactor systems.', 'محاور أعلنتها ENEC: مختبر ابتكار الذكاء الاصطناعي مع كيبكو ومنصة ENECIQ التي تعمل بمعزل عن أنظمة المفاعل.', 'staff', 'intro', ['intl', 'micro'], [['Digital twins: what they are and are not', 'التوائم الرقمية: ما هي وما ليست', 40], ['Governed AI at work', 'الذكاء الاصطناعي المحوكم في العمل', 40], ['Keeping AI away from reactor control', 'إبقاء الذكاء الاصطناعي بعيداً عن التحكم في المفاعل', 30]], null, 1.8, ['enec-presight', 'wnn-kepco-2025']],
];
const READY = { 'liquid-metal': 12, 'salt-chemistry': 15, 'gas-coolant': 22, 'remote-ops': 30, 'bwr-ops': 55, 'owners-engineer': 40, 'digital-twins': 28, 'ai-governance': 35 };
const SKEY = ['liquid-metal', 'salt-chemistry', 'gas-coolant', 'remote-ops', 'bwr-ops', 'owners-engineer', 'digital-twins', 'ai-governance'];

function future(T) {
  SK.forEach(([tech, key, skill_en, skill_ar, area, relation], i) => T.adv_skills.push({ id: `as-${key}`, tech_id: `tech-${tech}`, skill_en, skill_ar, area, relation, note_en: '', note_ar: '', sort: i + 1 }));
  FR.forEach(([id, techs, title_en, title_ar, summary_en, summary_ar, from_role_ids, skills, horizon, family_id], i) => T.future_roles.push({ id, tech_ids: techs.map((t) => `tech-${t}`), title_en, title_ar, summary_en, summary_ar, from_role_ids, skill_ids: skills.map((k) => `as-${k}`), horizon, family_id, sort: i + 1 }));
  TR.forEach(([id, title_en, title_ar, summary_en, summary_ar, audience, level, techs, mods, course_id, hours, sids], i) => T.adv_tracks.push({ id, title_en, title_ar, summary_en, summary_ar, audience, level, tech_ids: techs.map((t) => `tech-${t}`), modules: mods.map(([en, ar, minutes]) => ({ en, ar, minutes })), course_id, hours, sources: srcs(...sids), sort: i + 1 }));
  for (const f of T.future_skills) {
    const i = Number(f.id.split('-').pop()) - 1;
    f.skill_key = SKEY[i];
    f.readiness = READY[SKEY[i]];
  }
  T.skill_gap_plans.push(
    { id: 'gp-1', skill_key: 'liquid-metal', scenario: 'Scenario B (SIMULATED)', action: 'partner', owner_role: 'Nuclear Training (role)', target_quarter: '2027-Q2', status: 'active', note: 'Explore a short course with a research partner; no deployment decision implied.', created_by: 'p-k-hr-analyst', created_at: ts(addDays(DEMO_TODAY, -12)), updated_at: null },
    { id: 'gp-2', skill_key: 'remote-ops', scenario: 'Scenario A (SIMULATED)', action: 'reskill', owner_role: 'Operations Training (role)', target_quarter: '2027-Q4', status: 'draft', note: 'Pilot a remote-monitoring module inside continuing training.', created_by: 'p-k-hr-analyst', created_at: ts(addDays(DEMO_TODAY, -5)), updated_at: null },
    { id: 'gp-3', skill_key: 'owners-engineer', scenario: 'Scenario A (SIMULATED)', action: 'train', owner_role: 'ENEC Consulting (role)', target_quarter: '2027-Q1', status: 'active', note: 'Owner\'s-engineer short course for engineers supporting international work.', created_by: 'p-chco', created_at: ts(addDays(DEMO_TODAY, -20)), updated_at: null },
  );
}

export function applyG4(T) {
  for (const t of ['supplier_documents', 'academy_checks', 'academy_check_keys', 'adv_skills', 'future_roles', 'adv_tracks', 'skill_gap_plans']) T[t] ||= [];
  documents(T);
  icvPatches(T);
  onboardingPatches(T);
  equivalencyPatches(T);
  academy(T);
  future(T);
}
