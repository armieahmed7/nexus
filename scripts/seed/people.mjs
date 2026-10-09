// Demo tenant: personas (NEXUS role cards + Kafa'a-only), ~60 synthetic workforce members, contractors, applicants,
// and every person-linked record. All people are SYNTHETIC. No real ENEC staff names are used.
// Edge cases required by the spec acceptance criteria are marked with "AC:".

export const DEMO_TODAY = '2026-10-08'; // a Thursday

const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const addMonths = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const ts = (d, h = 8) => `${d}T${String(h).padStart(2, '0')}:00:00Z`;

// ───────────── Personas
// lens: where the sign-in card lands (my | partner | admin | public)
const NX = (id, title_en, title_ar, roles, attrs = {}) => ({ persona: id, nexus: true, title_en, title_ar, roles, ...attrs });
const KO = (id, title_en, title_ar, roles, attrs = {}) => ({ persona: id, nexus: false, title_en, title_ar, roles, ...attrs });
const r = (role, scope_type = 'self', scope_value = null) => ({ role, scope_type, scope_value });
const STAFF = { kind: 'staff', entity_id: 'enec', org_id: 'enec' };
const OPS = { kind: 'staff', entity_id: 'enec-ops', org_id: 'enec-ops' };

export const PERSONAS = [
  NX('group-ceo', 'Group CEO (role card)', 'الرئيس التنفيذي للمجموعة (بطاقة دور)', [r('employee'), r('manager', 'all')], { ...STAFF, job_family_id: 'corporate', level: 'leadership' }),
  NX('board-secretary', 'Board Secretary (role card)', 'أمين سر المجلس (بطاقة دور)', [r('employee'), r('auditor', 'all')], { ...STAFF, job_family_id: 'corporate', level: 'senior' }),
  NX('group-cfo', 'Group CFO (role card)', 'الرئيس التنفيذي للشؤون المالية (بطاقة دور)', [r('employee'), r('manager', 'entity', 'enec')], { ...STAFF, job_family_id: 'corporate', level: 'leadership' }),
  NX('chco', 'Chief Human Capital Officer (role card)', 'الرئيس التنفيذي لرأس المال البشري (بطاقة دور)', [r('employee'), r('hr_director', 'all'), r('hr_analyst', 'all')], { ...STAFF, job_family_id: 'corporate', level: 'leadership', job_role_id: 'corporate-professional' }),
  NX('training-mgr', 'Training Manager (role card)', 'مدير التدريب (بطاقة دور)', [r('employee'), r('training_manager', 'entity', 'enec-ops'), r('instructor', 'entity', 'enec-ops')], { ...OPS, job_family_id: 'training', job_role_id: 'nuclear-training-instructor', level: 'senior', team_id: 'training' }),
  NX('cpo', 'Chief Procurement Officer (role card)', 'الرئيس التنفيذي للمشتريات (بطاقة دور)', [r('employee'), r('manager', 'family', 'supply-chain')], { ...STAFF, job_family_id: 'supply-chain', level: 'leadership' }),
  NX('buyer', 'Buyer (role card)', 'مشترٍ (بطاقة دور)', [r('employee')], { ...STAFF, job_family_id: 'supply-chain', job_role_id: 'procurement-engineer', level: 'professional' }),
  NX('doa-signatory', 'DOA signatory (role card)', 'مفوض بالتوقيع (بطاقة دور)', [r('employee')], { ...STAFF, job_family_id: 'supply-chain', level: 'senior' }),
  NX('head-sq', 'Head of Supplier Quality (role card)', 'رئيس جودة الموردين (بطاقة دور)', [r('employee'), r('manager', 'family', 'quality'), r('instructor', 'family', 'quality')], { ...STAFF, job_family_id: 'quality', job_role_id: 'quality-assurance-qc', level: 'senior' }),
  NX('sq-lead', 'Supplier Quality Lead (role card)', 'قائد جودة الموردين (بطاقة دور)', [r('employee'), r('instructor', 'family', 'quality')], { ...STAFF, job_family_id: 'quality', job_role_id: 'quality-assurance-qc', level: 'professional' }),
  NX('nse', 'Nuclear Specification Engineer (role card)', 'مهندس المواصفات النووية (بطاقة دور)', [r('employee')], { ...STAFF, job_family_id: 'supply-chain', job_role_id: 'procurement-engineer', level: 'professional' }),
  NX('sme-reviewer', 'SME reviewer (role card)', 'مراجع خبير (بطاقة دور)', [r('employee')], { ...OPS, job_family_id: 'engineering', job_role_id: 'systems-design-plant-engineer', level: 'senior' }),
  NX('fuel-pm', 'Fuel Procurement Manager (role card)', 'مدير مشتريات الوقود (بطاقة دور)', [r('employee')], { ...STAFF, job_family_id: 'nuclear-fuel', job_role_id: 'nuclear-fuel-specialist', level: 'senior' }),
  NX('head-sustainability', 'Head of Sustainability (role card)', 'رئيس الاستدامة (بطاقة دور)', [r('employee'), r('editor', 'all')], { ...STAFF, job_family_id: 'corporate', level: 'senior' }),
  NX('sustainability-lead', 'Sustainability Reporting Lead (role card)', 'قائد تقارير الاستدامة (بطاقة دور)', [r('employee'), r('editor', 'all')], { ...STAFF, job_family_id: 'corporate', level: 'professional' }),
  NX('compliance', 'Compliance & Ethics Officer (role card)', 'مسؤول الامتثال والأخلاقيات (بطاقة دور)', [r('employee'), r('auditor', 'all')], { ...STAFF, job_family_id: 'corporate', level: 'senior' }),
  NX('ai-governance', 'AI Governance Lead (role card)', 'قائد حوكمة الذكاء الاصطناعي (بطاقة دور)', [r('employee'), r('admin', 'all')], { ...STAFF, job_family_id: 'cyber', level: 'senior' }),
  NX('ciso', 'Chief Information Security Officer (role card)', 'الرئيس التنفيذي لأمن المعلومات (بطاقة دور)', [r('employee'), r('manager', 'family', 'cyber')], { ...STAFF, job_family_id: 'cyber', job_role_id: 'cyber-security-engineer', level: 'leadership' }),
  NX('incident-commander', 'Incident Commander (role card)', 'قائد الحوادث (بطاقة دور)', [r('employee'), r('manager', 'entity', 'enec')], { ...STAFF, job_family_id: 'cyber', level: 'senior' }),
  NX('independent-approver', 'Independent approver (role card)', 'معتمد مستقل (بطاقة دور)', [r('employee'), r('auditor', 'all')], { ...STAFF, job_family_id: 'corporate', level: 'senior' }),
  NX('ops-ceo', 'CEO, ENEC Operations (role card)', 'الرئيس التنفيذي لـENEC للعمليات (بطاقة دور)', [r('employee'), r('manager', 'entity', 'enec-ops')], { ...OPS, job_family_id: 'operations', level: 'leadership' }),
  NX('sro', 'Shift Manager · licensed SRO, Crew B (role card)', 'مدير الوردية · مشغّل أول مرخّص، الطاقم ب (بطاقة دور)', [r('employee'), r('licensed_operator'), r('manager', 'crew', 'B')], { ...OPS, job_family_id: 'operations', job_role_id: 'shift-supervisor', level: 'leadership', crew: 'B', team_id: 'ops-crew-b', unit: 'Units 1&2' }),
  NX('outage-manager', 'Outage Manager (role card)', 'مدير فترات الإيقاف (بطاقة دور)', [r('employee'), r('manager', 'family', 'outage')], { ...OPS, job_family_id: 'outage', job_role_id: 'outage-manager-planner', level: 'senior' }),
  NX('outage-planner', 'Outage Planner (role card)', 'مخطط فترات الإيقاف (بطاقة دور)', [r('employee')], { ...OPS, job_family_id: 'outage', job_role_id: 'outage-manager-planner', level: 'professional' }),
  NX('work-control', 'Execution Supervisor · Work Control (role card)', 'مشرف التنفيذ · التحكم في الأعمال (بطاقة دور)', [r('employee'), r('manager', 'team', 'ops-wc')], { ...OPS, job_family_id: 'operations', job_role_id: 'operations-support-work-control', level: 'senior', team_id: 'ops-wc' }),
  NX('cap-chair', 'CAP Screening Committee chair (role card)', 'رئيس لجنة فرز الإجراءات التصحيحية (بطاقة دور)', [r('employee'), r('manager', 'family', 'oversight')], { ...OPS, job_family_id: 'oversight', job_role_id: 'nuclear-oversight-npi', level: 'senior' }),
  NX('cap-coord', 'CAP Coordinator (role card)', 'منسق الإجراءات التصحيحية (بطاقة دور)', [r('employee')], { ...OPS, job_family_id: 'oversight', job_role_id: 'nuclear-oversight-npi', level: 'professional' }),
  NX('dra', 'Director Regulatory Affairs (role card)', 'مدير الشؤون التنظيمية (بطاقة دور)', [r('employee'), r('manager', 'family', 'licensing'), r('licensing_coord', 'all')], { ...OPS, job_family_id: 'licensing', job_role_id: 'regulatory-affairs-licensing-engineer', level: 'leadership' }),
  NX('rao', 'Regulatory Affairs Officer · licensing coordinator (role card)', 'مسؤول الشؤون التنظيمية · منسق الترخيص (بطاقة دور)', [r('employee'), r('licensing_coord', 'all')], { ...OPS, job_family_id: 'licensing', job_role_id: 'regulatory-affairs-licensing-engineer', level: 'professional' }),
  NX('emergency-director', 'Emergency Director (role card)', 'مدير الطوارئ (بطاقة دور)', [r('employee'), r('manager', 'family', 'emergency-preparedness')], { ...OPS, job_family_id: 'emergency-preparedness', level: 'leadership' }),
  NX('ep-manager', 'Emergency Preparedness Manager (role card)', 'مدير التأهب للطوارئ (بطاقة دور)', [r('employee'), r('manager', 'family', 'emergency-preparedness'), r('instructor', 'family', 'emergency-preparedness')], { ...OPS, job_family_id: 'emergency-preparedness', job_role_id: 'emergency-preparedness-coordinator', level: 'senior' }),
  NX('nuc-security', 'Nuclear Security Manager (role card)', 'مدير الأمن النووي (بطاقة دور)', [r('employee'), r('manager', 'family', 'security')], { ...OPS, job_family_id: 'security', job_role_id: 'security-officer', level: 'senior' }),
  NX('sec-compliance', 'Security Compliance Officer (role card)', 'مسؤول الامتثال الأمني (بطاقة دور)', [r('employee')], { ...OPS, job_family_id: 'security', level: 'professional' }),
  NX('qc-inspector', 'QC Receiving Inspector (role card)', 'مفتش جودة الاستلام (بطاقة دور)', [r('employee')], { ...OPS, job_family_id: 'quality', job_role_id: 'quality-assurance-qc', level: 'professional' }),
  NX('rp-lead', 'Radiation Protection Team Leader (role card)', 'قائد فريق الوقاية من الإشعاع (بطاقة دور)', [r('employee'), r('manager', 'family', 'radiation-protection'), r('instructor', 'family', 'radiation-protection')], { ...OPS, job_family_id: 'radiation-protection', job_role_id: 'radiation-protection-technician', level: 'senior' }),
  NX('chem-sup', 'Chemistry Supervisor (role card)', 'مشرف الكيمياء (بطاقة دور)', [r('employee'), r('manager', 'family', 'chemistry')], { ...OPS, job_family_id: 'chemistry', job_role_id: 'chemistry-technician', level: 'senior' }),
  NX('consulting-director', 'Engagement Director · ENEC Consulting (role card)', 'مدير المشاريع · ENEC للاستشارات (بطاقة دور)', [r('employee'), r('manager', 'entity', 'enec-con')], { kind: 'staff', entity_id: 'enec-con', org_id: 'enec-con', job_family_id: 'corporate', level: 'senior' }),
  NX('alnoor-gm', 'Al Noor General Manager · partner admin (synthetic)', 'المدير العام للنور · مسؤول الشريك (اصطناعي)', [r('partner_admin', 'org', 'org-alnoor')], { kind: 'partner', org_id: 'org-alnoor' }),
  NX('alnoor-qaqc', 'Al Noor QA/QC Manager (synthetic)', 'مدير الجودة في النور (اصطناعي)', [r('partner_user', 'org', 'org-alnoor')], { kind: 'partner', org_id: 'org-alnoor' }),
  NX('alnoor-sales', 'Al Noor Sales Engineer (synthetic)', 'مهندس المبيعات في النور (اصطناعي)', [r('partner_user', 'org', 'org-alnoor')], { kind: 'partner', org_id: 'org-alnoor' }),
  NX('gulfhydro-qa', 'Gulf Hydro-Valve QA Manager · partner admin (synthetic)', 'مدير الجودة في الخليج للصمامات · مسؤول الشريك (اصطناعي)', [r('partner_admin', 'org', 'org-gulfhydro')], { kind: 'partner', org_id: 'org-gulfhydro' }),
  NX('meridia-pd', 'Meridia Programme Director · international partner (synthetic)', 'مدير برنامج ميريديا · شريك دولي (اصطناعي)', [r('partner_user', 'org', 'org-meridia')], { kind: 'partner', org_id: 'org-meridia' }),
  NX('presenter', 'Presenter (read-only walkthrough)', 'مقدّم العرض (قراءة فقط)', [r('auditor', 'all')], { ...STAFF }),
  // Kafa'a-only personas (no NEXUS login; local mode only until auth users and profiles exist)
  KO('k-student', 'Grade 12 student (applicant)', 'طالب في الصف الثاني عشر (متقدّم)', [r('applicant')], { kind: 'applicant' }),
  KO('k-graduate', 'Engineering graduate (applicant, Energy Pioneer)', 'خريج هندسة (متقدّم، من رواد الطاقة)', [r('applicant')], { kind: 'applicant' }),
  KO('k-lo-trainee', 'Local Operator trainee, Crew C (DNT graduate)', 'متدرب مشغّل محلي، الطاقم ج (خريج الدبلوم)', [r('employee')], { ...OPS, job_family_id: 'operations', job_role_id: 'local-operator', level: 'entry', crew: 'C', team_id: 'ops-crew-c', unit: 'Units 3&4' }),
  KO('k-ro', 'Reactor Operator, Crew B', 'مشغّل مفاعل، الطاقم ب', [r('employee'), r('licensed_operator')], { ...OPS, job_family_id: 'operations', job_role_id: 'reactor-operator', level: 'professional', crew: 'B', team_id: 'ops-crew-b', unit: 'Units 1&2' }),
  KO('k-instructor', 'Simulator instructor (SRO-qualified)', 'مدرب المحاكي (مؤهل كمشغّل أول)', [r('employee'), r('licensed_operator'), r('instructor', 'entity', 'enec-ops')], { ...OPS, job_family_id: 'training', job_role_id: 'nuclear-training-instructor', level: 'senior', team_id: 'training' }),
  KO('k-licensing-coord', 'Licensing coordinator', 'منسق الترخيص', [r('employee'), r('licensing_coord', 'all')], { ...OPS, job_family_id: 'licensing', level: 'professional' }),
  KO('k-hr-analyst', 'HR and Emiratization analyst', 'محلل الموارد البشرية والتوطين', [r('employee'), r('hr_analyst', 'all')], { ...STAFF, job_family_id: 'corporate', job_role_id: 'corporate-professional', level: 'professional' }),
  KO('k-university', 'Khalifa University partner liaison', 'منسق الشراكة في جامعة خليفة', [r('university', 'org', 'ku')], { kind: 'partner', org_id: 'ku' }),
  KO('k-observer', 'Government observer (read-only, synthetic office)', 'مراقب حكومي (قراءة فقط، مكتب اصطناعي)', [r('observer', 'org', 'org-observer')], { kind: 'observer', org_id: 'org-observer' }),
  KO('k-editor', 'Content editor', 'محرر المحتوى', [r('employee'), r('editor', 'all')], { ...STAFF, job_family_id: 'corporate', level: 'professional' }),
  KO('k-admin', 'Platform admin', 'مسؤول المنصة', [r('employee'), r('admin', 'all')], { ...STAFF, job_family_id: 'cyber', level: 'senior' }),
  KO('k-auditor', 'Auditor', 'مدقّق', [r('auditor', 'all')], { ...STAFF }),
  KO('k-ecp', 'ECP officer', 'مسؤول برنامج مخاوف الموظفين', [r('employee'), r('ecp_officer', 'all')], { ...OPS, job_family_id: 'oversight', job_role_id: 'ecp-officer', level: 'professional' }),
  KO('k-contractor', 'Contractor technician, Dhafra Industrial Services (synthetic)', 'فني مقاول، الظفرة للخدمات الصناعية (اصطناعي)', [r('partner_user', 'org', 'org-dhafra')], { kind: 'contractor', org_id: 'org-dhafra' }),
];
export const personPid = (persona) => `p-${persona}`;

// ───────────── Synthetic names (generic; not ENEC staff)
const FIRST_M = ['Hamad', 'Saeed', 'Khalid', 'Rashed', 'Sultan', 'Majid', 'Obaid', 'Hamdan', 'Mansour', 'Faisal', 'Yousef', 'Omar', 'Ali', 'Ahmed', 'Jasim', 'Nasser', 'Salem', 'Humaid', 'Tariq', 'Waleed'];
const FIRST_F = ['Mariam', 'Shamma', 'Noura', 'Aisha', 'Hessa', 'Latifa', 'Maitha', 'Reem', 'Fatima', 'Alya', 'Moza', 'Sara'];
const LAST_UAE = ['Al Mansoori', 'Al Ketbi', 'Al Nuaimi', 'Al Shamsi', 'Al Dhaheri', 'Al Mazrouei', 'Al Romaithi', 'Al Qubaisi', 'Al Hosani', 'Al Marzooqi', 'Al Falasi', 'Al Kaabi', 'Al Mheiri', 'Al Suwaidi', 'Al Junaibi', 'Al Blooshi'];
const OTHER = [['Min-jun', 'Park'], ['Ji-ho', 'Lee'], ['Seo-yeon', 'Kim'], ['Arjun', 'Menon'], ['Priya', 'Sharma'], ['Thomas', 'Dubois'], ['Claire', 'Martin'], ['Chinedu', 'Okafor'], ['Rafael', 'Fernandes'], ['Maria', 'Reyes'], ['Pavel', 'Novak'], ['Daniel', 'Hughes'], ['Ravi', 'Iyer'], ['Hyun-woo', 'Choi'], ['Emma', 'Clarke'], ['Karim', 'Haddad']];
const AR = { Hamad: 'حمد', Saeed: 'سعيد', Khalid: 'خالد', Rashed: 'راشد', Sultan: 'سلطان', Majid: 'ماجد', Obaid: 'عبيد', Hamdan: 'حمدان', Mansour: 'منصور', Faisal: 'فيصل', Yousef: 'يوسف', Omar: 'عمر', Ali: 'علي', Ahmed: 'أحمد', Jasim: 'جاسم', Nasser: 'ناصر', Salem: 'سالم', Humaid: 'حميد', Tariq: 'طارق', Waleed: 'وليد', Mariam: 'مريم', Shamma: 'شمة', Noura: 'نورة', Aisha: 'عائشة', Hessa: 'حصة', Latifa: 'لطيفة', Maitha: 'ميثاء', Reem: 'ريم', Fatima: 'فاطمة', Alya: 'علياء', Moza: 'موزة', Sara: 'سارة', 'Al Mansoori': 'المنصوري', 'Al Ketbi': 'الكتبي', 'Al Nuaimi': 'النعيمي', 'Al Shamsi': 'الشامسي', 'Al Dhaheri': 'الظاهري', 'Al Mazrouei': 'المزروعي', 'Al Romaithi': 'الرميثي', 'Al Qubaisi': 'القبيسي', 'Al Hosani': 'الحوسني', 'Al Marzooqi': 'المرزوقي', 'Al Falasi': 'الفلاسي', 'Al Kaabi': 'الكعبي', 'Al Mheiri': 'المهيري', 'Al Suwaidi': 'السويدي', 'Al Junaibi': 'الجنيبي', 'Al Blooshi': 'البلوشي' };
let nameSeq = 0;
function synthName(i, uae, female) {
  nameSeq++;
  if (uae) {
    const f = female ? FIRST_F[(i * 5 + 3) % FIRST_F.length] : FIRST_M[(i * 7 + 1) % FIRST_M.length];
    const l = LAST_UAE[(i * 3 + nameSeq) % LAST_UAE.length];
    return { en: `${f} ${l}`, ar: `${AR[f]} ${AR[l]}`, initials: `${f[0]}${l.replace('Al ', '')[0]}` };
  }
  const [f, l] = OTHER[(i * 5 + nameSeq) % OTHER.length];
  return { en: `${f} ${l}`, ar: `${f} ${l}`, initials: `${f[0]}${l[0]}` };
}

// ───────────── Workforce definition [id, job_role, family, crew, team, level, uae, female, hire, status]
const W = [];
const w = (id, job_role_id, job_family_id, crew, team_id, level, uae, female, hire_date, extra = {}) => W.push({ id, job_role_id, job_family_id, crew, team_id, level, uae, female, hire_date, entity_id: extra.entity_id || 'enec-ops', ...extra });
w('w-ss-01', 'shift-supervisor', 'operations', 'A', 'ops-crew-a', 'leadership', true, false, '2012-03-01');
w('w-ss-02', 'shift-supervisor', 'operations', 'D', 'ops-crew-d', 'leadership', false, false, '2014-06-01');
w('w-sro-01', 'senior-reactor-operator', 'operations', 'B', 'ops-crew-b', 'senior', true, false, '2015-09-01'); // AC: SRO-role minimum at risk
w('w-sro-02', 'senior-reactor-operator', 'operations', 'A', 'ops-crew-a', 'senior', true, true, '2014-01-15'); // renewal within 12 months
w('w-sro-03', 'senior-reactor-operator', 'operations', 'C', 'ops-crew-c', 'senior', false, false, '2016-02-01');
w('w-sro-04', 'senior-reactor-operator', 'operations', 'B', 'ops-crew-b', 'senior', true, false, '2016-08-01');
w('w-sro-05', 'senior-reactor-operator', 'operations', 'E', 'ops-crew-e', 'senior', true, false, '2017-01-10'); // AC: stale sync
for (let i = 1; i <= 8; i++) w(`w-ro-0${i}`, 'reactor-operator', 'operations', 'ABBACDEE'[i - 1] === 'A' && i === 1 ? 'B' : ['B', 'B', 'A', 'C', 'C', 'D', 'E', 'E'][i - 1], `ops-crew-${['b', 'b', 'a', 'c', 'c', 'd', 'e', 'e'][i - 1]}`, 'professional', i % 3 !== 0, i === 5, `201${7 + (i % 3)}-0${(i % 9) + 1}-01`);
for (let i = 1; i <= 10; i++) w(`w-lo-${String(i).padStart(2, '0')}`, 'local-operator', 'operations', 'ABCDE'[(i - 1) % 5], `ops-crew-${'abcde'[(i - 1) % 5]}`, 'entry', i !== 6, i === 2 || i === 9, i === 10 ? '2026-07-01' : `202${i % 4}-0${(i % 8) + 1}-15`);
w('w-wc-01', 'operations-support-work-control', 'operations', null, 'ops-wc', 'professional', true, false, '2018-04-01');
w('w-instr-01', 'nuclear-training-instructor', 'training', null, 'training', 'senior', true, false, '2013-05-01');
w('w-instr-02', 'nuclear-training-instructor', 'training', null, 'training', 'senior', false, false, '2015-11-01');
for (let i = 1; i <= 8; i++) w(`w-mnt-0${i}`, 'maintenance-technician-engineer', 'maintenance', null, `mnt-${['mech', 'elec', 'ic'][i % 3]}`, i < 3 ? 'senior' : 'professional', i % 4 !== 0, i === 6, `20${15 + i}-0${(i % 9) + 1}-01`, i === 8 ? { status: 'leaver' } : {});
for (let i = 1; i <= 4; i++) w(`w-rp-0${i}`, 'radiation-protection-technician', 'radiation-protection', null, 'rp', 'professional', i !== 3, i === 2, `201${8 + (i % 2)}-03-01`);
for (let i = 1; i <= 3; i++) w(`w-chem-0${i}`, 'chemistry-technician', 'chemistry', null, 'chem', 'professional', true, i === 1, `2019-0${i + 2}-01`);
for (let i = 1; i <= 5; i++) w(`w-eng-0${i}`, i === 5 ? 'reactor-engineer-core-physicist' : 'systems-design-plant-engineer', 'engineering', null, 'eng', i === 1 ? 'senior' : 'professional', i !== 4, i === 3, `${2015 + i}-09-01`);
for (let i = 1; i <= 2; i++) w(`w-ep-0${i}`, 'emergency-preparedness-coordinator', 'emergency-preparedness', null, 'ep', 'professional', true, i === 2, '2019-01-01');
for (let i = 1; i <= 2; i++) w(`w-fire-0${i}`, 'fire-protection', 'fire-protection', null, 'fire', 'professional', true, false, '2018-01-01');
for (let i = 1; i <= 2; i++) w(`w-qa-0${i}`, 'quality-assurance-qc', 'quality', null, 'qa', 'professional', i === 1, i === 2, '2017-01-01');
for (let i = 1; i <= 2; i++) w(`w-sec-0${i}`, 'security-officer', 'security', null, 'sec', 'professional', true, false, '2018-06-01');
for (let i = 1; i <= 2; i++) w(`w-corp-0${i}`, 'corporate-professional', 'corporate', null, 'hr', 'professional', true, true, '2020-02-01', { entity_id: 'enec' });
w('w-sc-01', 'procurement-engineer', 'supply-chain', null, 'sc', 'professional', true, false, '2019-07-01', { entity_id: 'enec' });
w('w-cyb-01', 'cyber-security-engineer', 'cyber', null, 'cyber', 'professional', true, false, '2020-10-01', { entity_id: 'enec' });

// Standards each job role must hold
const STD = {
  'local-operator': ['qs-get', 'qs-lo-turbine', 'qs-lo-aux'], 'reactor-operator': ['qs-get', 'qs-ro'], 'senior-reactor-operator': ['qs-get', 'qs-ro', 'qs-sro'], 'shift-supervisor': ['qs-get', 'qs-sro'],
  'operations-support-work-control': ['qs-get', 'qs-wc'], 'nuclear-training-instructor': ['qs-get', 'qs-instr'], 'maintenance-technician-engineer': ['qs-get'], 'radiation-protection-technician': ['qs-get', 'qs-rp'],
  'chemistry-technician': ['qs-get', 'qs-chem'], 'systems-design-plant-engineer': ['qs-get', 'qs-eng'], 'reactor-engineer-core-physicist': ['qs-get', 'qs-eng'], 'emergency-preparedness-coordinator': ['qs-get', 'qs-ero'],
  'fire-protection': ['qs-get', 'qs-fire'], 'quality-assurance-qc': ['qs-get', 'qs-qa'], 'security-officer': ['qs-get', 'qs-sec'], 'corporate-professional': ['qs-get'], 'procurement-engineer': ['qs-get'], 'cyber-security-engineer': ['qs-get'],
};

export function buildPeople({ standards, tasks, curriculum, courses }) {
  const out = {
    people: [], role_assignments: [], qual_records: [], evaluations: [], evaluator_quals: [], licences: [], medical_due: [], shift_proficiency: [], requal_cycles: [],
    licence_programmes: [], licence_candidates: [], exam_milestones: [], reporting_obligations: [], licensing_tasks: [], enrolments: [], training_records: [], certificates: [],
    sessions: [], simulator_slots: [], attempts: [], jpm_results: [], appeals: [], dev_plans: [], plan_activities: [], mentors: [], mentoring_requests: [], applications: [],
    application_events: [], scholar_cohorts: [], scholars: [], internships: [], partner_onboarding: [], supplier_readiness: [], equivalency_requests: [], icv_plans: [],
    research_challenges: [], research_proposals: [], notifications: [], observer_reports: [], scenarios: [], consents: [], user_settings: [], advisor_sessions: [], advisor_turns: [],
    data_requests: [], contact_requests: [], external_requests: [],
  };
  const stdById = Object.fromEntries(standards.map((s) => [s.id, s]));
  const tasksByStd = {};
  for (const t of tasks) (tasksByStd[t.standard_id] ||= []).push(t);
  let raSeq = 0;
  const ra = (person_id, role, scope_type = 'self', scope_value = null, org_id = null, status = 'active') => out.role_assignments.push({ id: `ra-${++raSeq}`, person_id, role, org_id, scope_type, scope_value, granted_by: 'p-k-admin', granted_at: '2026-01-05T08:00:00Z', expires_at: ['admin', 'auditor', 'hr_director'].includes(role) ? '2026-12-31' : null, status, second_approver: ['admin', 'hr_director'].includes(role) ? 'p-ai-governance' : null });

  // People: personas
  for (const p of PERSONAS) {
    const id = personPid(p.persona);
    out.people.push({ id, persona_id: p.persona, display_name: p.title_en, display_name_ar: p.title_ar, initials: p.persona.replace(/^k-/, '').slice(0, 2).toUpperCase(), kind: p.kind, entity_id: p.entity_id ?? null, org_id: p.org_id ?? null, job_role_id: p.job_role_id ?? null, job_family_id: p.job_family_id ?? null, team_id: p.team_id ?? null, crew: p.crew ?? null, unit: p.unit ?? null, level: p.level ?? null, nationality_flag: 'unknown', gender: null, language: 'en', digits: 'latn', hire_date: p.kind === 'staff' ? '2018-01-01' : null, status: p.kind === 'applicant' ? 'candidate' : 'active', manager_id: null, synthetic: true, notes: p.nexus ? 'NEXUS role card' : "Kafa'a-only demo persona" });
    for (const x of p.roles) ra(id, x.role, x.scope_type, x.scope_value, p.org_id ?? null);
    out.user_settings.push({ id: `us-${id}`, person_id: id, language: 'en', digits: 'latn', calendar: 'gregorian', notify_inapp: true, notify_email: false, theme: 'light' });
  }
  // People: workforce
  W.forEach((x, i) => {
    const n = synthName(i, x.uae, x.female);
    const mgr = x.crew === 'B' ? 'p-sro' : x.job_family_id === 'radiation-protection' ? 'p-rp-lead' : x.job_family_id === 'chemistry' ? 'p-chem-sup' : null;
    out.people.push({ id: x.id, persona_id: null, display_name: n.en, display_name_ar: n.ar, initials: n.initials, kind: 'staff', entity_id: x.entity_id, org_id: x.entity_id, job_role_id: x.job_role_id, job_family_id: x.job_family_id, team_id: x.team_id, crew: x.crew, unit: x.crew ? ('ABC'.includes(x.crew) ? 'Units 1&2' : 'Units 3&4') : null, level: x.level, nationality_flag: x.uae ? 'uae' : 'other', gender: x.female ? 'f' : 'm', language: x.uae ? 'ar' : 'en', digits: 'latn', hire_date: x.hire_date, status: x.status || 'active', manager_id: mgr, synthetic: true, notes: null });
    ra(x.id, 'employee', 'self', null, x.entity_id, x.status === 'leaver' ? 'revoked' : 'active');
  });
  // Contractors and applicants
  const CONTRACTORS = [['c-alnoor-01', 'org-alnoor', 'maintenance'], ['c-alnoor-02', 'org-alnoor', 'maintenance'], ['c-alnoor-03', 'org-alnoor', 'quality'], ['c-gulf-01', 'org-gulfhydro', 'maintenance'], ['c-gulf-02', 'org-gulfhydro', 'maintenance'], ['c-dhafra-01', 'org-dhafra', 'outage'], ['c-dhafra-02', 'org-dhafra', 'outage'], ['c-dhafra-03', 'org-dhafra', 'outage']];
  CONTRACTORS.forEach(([id, org, fam], i) => { const n = synthName(100 + i, i % 2 === 0, false); out.people.push({ id, persona_id: null, display_name: n.en, display_name_ar: n.ar, initials: n.initials, kind: 'contractor', entity_id: null, org_id: org, job_role_id: fam === 'maintenance' ? 'maintenance-technician-engineer' : null, job_family_id: fam, team_id: null, crew: null, unit: null, level: 'professional', nationality_flag: 'unknown', gender: null, language: 'en', digits: 'latn', hire_date: null, status: 'active', manager_id: null, synthetic: true, notes: 'Contractor staff (synthetic)' }); });
  const APPL = [];
  for (let i = 1; i <= 12; i++) { const id = `a-${String(i).padStart(2, '0')}`; const n = synthName(200 + i, i !== 7, i % 2 === 0); APPL.push(id); out.people.push({ id, persona_id: null, display_name: n.en.split(' ')[0], display_name_ar: n.ar.split(' ')[0], initials: n.initials, kind: 'applicant', entity_id: null, org_id: null, job_role_id: null, job_family_id: null, team_id: null, crew: null, unit: null, level: null, nationality_flag: i !== 7 ? 'uae' : 'other', gender: i % 2 === 0 ? 'f' : 'm', language: 'ar', digits: 'latn', hire_date: null, status: 'candidate', manager_id: null, synthetic: true, notes: 'First name only by default' }); ra(id, 'applicant'); }

  // ───────────── Qualification records + evaluations
  let evSeq = 0;
  const evaluatorFor = (std) => (['qs-mech', 'qs-elec', 'qs-ic'].includes(std) ? 'w-instr-02' : std === 'qs-rp' ? 'p-rp-lead' : std === 'qs-ero' ? 'p-ep-manager' : std === 'qs-qa' ? 'p-sq-lead' : std === 'qs-instr' || std === 'qs-get' ? 'p-training-mgr' : 'w-instr-01');
  const qual = (person_id, standard_id, status, qualified_on, expires_on, extra = {}) => {
    const s = stdById[standard_id];
    const id = `qr-${person_id}-${standard_id}`;
    out.qual_records.push({ id, person_id, standard_id, standard_version: 1, status, qualified_on, expires_on, source_system: 'Training records system', last_synced: ts(DEMO_TODAY, 3), mirror: true, needs_review: false, review_reason: null, security_mirror_only: !!s.security_restricted, ...extra });
    for (const t of tasksByStd[standard_id] || []) {
      const done = status !== 'in_progress' && status !== 'planned' ? true : t.sort <= 2;
      out.evaluations.push({ id: `ev-${++evSeq}`, record_id: id, task_id: t.id, person_id, method: t.method, evaluator_person_id: done ? evaluatorFor(standard_id) : null, evaluator_role: t.evaluator_role, result: done ? 'pass' : 'pending', date: qualified_on || addDays(DEMO_TODAY, -30 + t.sort), critical_failed: false, supervisor_ack_by: done ? 'Supervisor' : null, supervisor_ack_at: done ? ts(qualified_on || DEMO_TODAY) : null, correction_of: null, correction_reason: null, created_at: ts(qualified_on || DEMO_TODAY) });
    }
  };
  const holder = (pid, jr, i) => {
    const stds = [...(STD[jr] || ['qs-get'])];
    if (jr === 'maintenance-technician-engineer') stds.push(['qs-mech', 'qs-elec', 'qs-ic'][i % 3]);
    for (const s of stds) {
      const months = stdById[s].requal_months || 24;
      let q = addMonths(DEMO_TODAY, -(4 + ((i * 5) % (months - 4 > 0 ? months - 4 : 1))));
      let e = addMonths(q, months);
      let status = 'qualified';
      if (pid === 'w-lo-07' && s === 'qs-lo-turbine') { e = addDays(DEMO_TODAY, 25); q = addMonths(e, -months); status = 'due'; } // AC: due within 30 days
      if (pid === 'w-lo-08' && s === 'qs-lo-aux') { e = '2026-09-20'; q = addMonths(e, -months); status = 'expired'; } // AC: expired
      if (pid === 'w-mnt-03' && s !== 'qs-get') { e = addDays(DEMO_TODAY, 58); q = addMonths(e, -months); } // 60-day notice
      if (pid === 'w-rp-02' && s === 'qs-rp') { e = addDays(DEMO_TODAY, 85); q = addMonths(e, -months); } // 90-day notice
      if ((pid === 'w-lo-10' || pid === 'p-k-lo-trainee') && s !== 'qs-get') { status = 'in_progress'; q = null; e = null; }
      if (pid === 'w-mnt-08') status = 'suspended';
      qual(pid, s, status, q, e);
    }
  };
  W.forEach((x, i) => holder(x.id, x.job_role_id, i));
  PERSONAS.filter((p) => p.kind === 'staff' && p.job_role_id).forEach((p, i) => holder(personPid(p.persona), p.job_role_id, i + 3));
  qual('p-k-instructor', 'qs-sro', 'qualified', '2025-06-01', '2027-06-01');
  qual('p-sro', 'qs-ro', 'qualified', '2025-03-01', '2027-03-01');
  // Evaluator qualifications
  const EQ = [['w-instr-01', ['qs-lo-turbine', 'qs-lo-aux', 'qs-ro', 'qs-sro', 'qs-wc']], ['w-instr-02', ['qs-mech', 'qs-elec', 'qs-ic']], ['p-k-instructor', ['qs-lo-turbine', 'qs-lo-aux', 'qs-ro', 'qs-sro']], ['p-training-mgr', ['qs-instr', 'qs-get', 'qs-ro']], ['p-ep-manager', ['qs-ero']], ['p-rp-lead', ['qs-rp']], ['p-sq-lead', ['qs-qa', 'qs-mech']], ['p-head-sq', ['qs-qa', 'qs-mech', 'qs-elec']]];
  for (const [pid, stds] of EQ) for (const s of stds) out.evaluator_quals.push({ id: `eq-${pid}-${s}`, person_id: pid, standard_id: s, valid_to: '2027-12-31' });

  // ───────────── Licences (M03 mirror)
  const LIC = [
    ['w-ss-01', 'SRO', '2023-02-01'], ['w-ss-02', 'SRO', '2022-11-15'], ['w-sro-01', 'SRO', '2023-05-10'], ['w-sro-02', 'SRO', '2021-09-01'], ['w-sro-03', 'SRO', '2024-01-20'], ['w-sro-04', 'SRO', '2023-08-01'], ['w-sro-05', 'SRO', '2022-04-01'],
    ['w-ro-01', 'RO', '2022-06-01'], ['w-ro-02', 'RO', '2021-10-06'], ['w-ro-03', 'RO', '2023-03-15'], ['w-ro-04', 'RO', '2022-01-10'], ['w-ro-05', 'RO', '2021-11-20'], ['w-ro-06', 'RO', '2024-02-01'], ['w-ro-07', 'RO', '2024-06-01'], ['w-ro-08', 'RO', '2023-09-01'],
    ['w-instr-01', 'SRO_QI', '2023-01-15'], ['p-sro', 'SRO', '2022-12-01'], ['p-k-ro', 'RO', '2024-08-01'], ['p-k-instructor', 'SRO_QI', '2024-03-01'],
  ];
  LIC.forEach(([pid, type, issued], i) => {
    let expires = addMonths(issued, 60);
    let status = 'valid';
    let last_synced = ts(DEMO_TODAY, 4);
    let lapsed_on = null;
    if (pid === 'w-ro-02') { status = 'lapsed'; lapsed_on = DEMO_TODAY; } // AC: lapse detected on a Thursday
    if (pid === 'w-sro-05') last_synced = ts('2026-10-02', 4); // AC: stale sync -> never shows "valid"
    if (pid === 'w-sro-02') expires = addMonths(DEMO_TODAY, 10); // renewal tasks from 12 months
    if (pid === 'w-ro-05') expires = addDays(DEMO_TODAY, 50);
    out.licences.push({ id: `lic-${pid}`, person_id: pid, type, facility: 'Barakah Units 1-4', cert_no: `SYN-${type}-${String(1000 + i * 37)}`, issued_on: issued, expires_on: expires, status, route: type === 'RO' ? 'ro_lo36' : type === 'SRO' ? 'sro_ro24' : 'sro_ro24', lapsed_on, source_system: 'Licensee certification records (OCTS mirror)', last_synced });
    const medDue = pid === 'w-ro-01' ? '2026-09-15' : addMonths(DEMO_TODAY, 2 + (i % 9)); // AC: medical overdue
    out.medical_due.push({ id: `med-${pid}`, person_id: pid, due_on: medDue, flag: pid === 'w-ro-01' ? 'not_confirmed' : 'fit', source_system: 'Occupational health system (flag only)', last_synced: ts('2026-10-03', 5) });
    // Shift proficiency: current quarter (Q4 2026) and last (Q3 2026)
    const isSro = type !== 'RO';
    let q4 = { s8: 3 + (i % 3), s12: 0, sro: isSro ? 1 : 0, r8: 6, r12: 0, rsro: isSro ? 2 : 0 };
    if (pid === 'w-sro-01') q4 = { s8: 6, s12: 0, sro: 1, r8: 2, r12: 0, rsro: 0 }; // AC: 6 x 8h, 1 in SRO role, 2 scheduled left -> SRO-role minimum at risk
    if (pid === 'w-ro-03') q4 = { s8: 2, s12: 0, sro: 0, r8: 3, r12: 0, rsro: 0 }; // 8h minimum at risk
    if (pid === 'p-k-ro') q4 = { s8: 0, s12: 3, sro: 0, r8: 0, r12: 3, rsro: 0 }; // on track with 12h shifts
    out.shift_proficiency.push({ id: `sp-${pid}-2026q4`, person_id: pid, quarter: '2026-Q4', shifts_8h: q4.s8, shifts_12h: q4.s12, sro_role_shifts: q4.sro, scheduled_remaining_8h: q4.r8, scheduled_remaining_12h: q4.r12, scheduled_remaining_sro: q4.rsro, source_system: 'Shift roster feed (counts only)', last_synced: ts('2026-10-07', 22) });
    out.shift_proficiency.push({ id: `sp-${pid}-2026q3`, person_id: pid, quarter: '2026-Q3', shifts_8h: 9, shifts_12h: 0, sro_role_shifts: isSro ? 3 : 0, scheduled_remaining_8h: 0, scheduled_remaining_12h: 0, scheduled_remaining_sro: 0, source_system: 'Shift roster feed (counts only)', last_synced: ts('2026-10-01', 22) });
    out.requal_cycles.push({ id: `rq-${pid}`, person_id: pid, window_start: '2026-01-01', window_end: '2027-12-31', coct_hours_done: pid === 'w-ro-08' ? 80 : 160 + (i % 4) * 20, coct_hours_required: 240, exam_status: i % 5 === 0 ? 'scheduled' : 'not_scheduled' });
  });
  // Licensing programmes, candidates, milestones, obligations and tasks
  out.licence_programmes.push(
    { id: 'lp-coit-2027', name_en: 'COIT class 2027 (RO)', name_ar: 'دفعة التدريب الأولي للمعتمدين 2027 (مشغّل مفاعل)', kind: 'coit_ro', start_on: '2027-01-10', candidate_list_due: addDays('2027-01-10', -60), status: 'planning' },
    { id: 'lp-sro-2027a', name_en: 'SRO upgrade 2027-A', name_ar: 'ترقية المشغّل الأول 2027-أ', kind: 'sro_upgrade', start_on: '2027-03-01', candidate_list_due: addDays('2027-03-01', -60), status: 'planning' },
    { id: 'lp-coit-2025', name_en: 'COIT class 2025 (RO): exams', name_ar: 'دفعة التدريب الأولي 2025: الاختبارات', kind: 'coit_ro', start_on: '2025-03-01', candidate_list_due: '2024-12-31', status: 'exams' },
  );
  const cand = (id, programme_id, person_id, route, evidence, clearance, status) => out.licence_candidates.push({ id, programme_id, person_id, route, evidence, clearance, status });
  cand('lc-1', 'lp-coit-2027', 'w-lo-03', 'ro_lo36', [{ item: 'High-school diploma', item_ar: 'شهادة الثانوية العامة', status: 'verified' }, { item: '36 months as fully qualified LO (38 recorded)', item_ar: '36 شهراً كمشغّل محلي مؤهل (38 مسجلة)', status: 'verified' }, { item: 'UAE security clearance', item_ar: 'تصريح أمني إماراتي', status: 'pending' }], 'pending', 'evidence_open');
  cand('lc-2', 'lp-coit-2027', 'w-lo-04', 'ro_lo36', [{ item: 'High-school diploma', item_ar: 'شهادة الثانوية العامة', status: 'verified' }, { item: '36 months as fully qualified LO (31 recorded)', item_ar: '36 شهراً كمشغّل محلي مؤهل (31 مسجلة)', status: 'open' }, { item: 'UAE security clearance', item_ar: 'تصريح أمني إماراتي', status: 'confirmed' }], 'confirmed', 'evidence_open');
  cand('lc-3', 'lp-coit-2027', 'w-lo-01', 'ro_lo36', [{ item: 'High-school diploma', item_ar: 'شهادة الثانوية العامة', status: 'verified' }, { item: '36 months as fully qualified LO (44 recorded)', item_ar: '36 شهراً كمشغّل محلي مؤهل (44 مسجلة)', status: 'verified' }, { item: 'UAE security clearance', item_ar: 'تصريح أمني إماراتي', status: 'confirmed' }], 'confirmed', 'eligible');
  cand('lc-4', 'lp-sro-2027a', 'w-ro-04', 'sro_ro24', [{ item: '24 months as RO at Barakah (57 recorded)', item_ar: '24 شهراً كمشغّل مفاعل في براكة (57 مسجلة)', status: 'verified' }, { item: 'UAE security clearance', item_ar: 'تصريح أمني إماراتي', status: 'confirmed' }], 'confirmed', 'eligible');
  cand('lc-5', 'lp-sro-2027a', 'p-k-ro', 'sro_ro24', [{ item: '24 months as RO at Barakah (26 recorded)', item_ar: '24 شهراً كمشغّل مفاعل في براكة (26 مسجلة)', status: 'verified' }, { item: 'UAE security clearance', item_ar: 'تصريح أمني إماراتي', status: 'confirmed' }], 'confirmed', 'proposed');
  cand('lc-6', 'lp-sro-2027a', 'w-eng-02', 'sro_bsc', [{ item: 'BSc in engineering', item_ar: 'بكالوريوس في الهندسة', status: 'verified' }, { item: '24 months nuclear work at Barakah incl. 12 as LO (9 as LO recorded)', item_ar: '24 شهراً من العمل النووي منها 12 كمشغّل محلي (9 مسجلة)', status: 'open' }, { item: 'UAE security clearance', item_ar: 'تصريح أمني إماراتي', status: 'pending' }], 'pending', 'evidence_open');
  const ms = (id, programme_id, person_id, kind, due_on, status, note_en, note_ar) => out.exam_milestones.push({ id, programme_id, person_id, kind, due_on, status, note_en, note_ar });
  ms('em-1', 'lp-coit-2025', 'w-ro-07', 'internal_written', '2026-08-20', 'done', 'Internal comprehensive written exam', 'الاختبار الكتابي الداخلي الشامل');
  ms('em-2', 'lp-coit-2025', 'w-ro-07', 'internal_operating', '2026-09-10', 'done', 'Internal simulator and JPMs', 'المحاكي ومقاييس الأداء الداخلية');
  ms('em-3', 'lp-coit-2025', null, 'fanr_notice', addDays('2026-12-14', -60), 'planned', 'Notify FANR 60 days before the exam (reminder at 75 days)', 'إخطار الهيئة قبل الاختبار بـ60 يوماً (تذكير عند 75 يوماً)');
  ms('em-4', 'lp-coit-2025', null, 'fanr_written', '2026-12-14', 'planned', 'FANR written exam (generic fundamentals and plant-specific)', 'اختبار الهيئة الكتابي');
  ms('em-5', 'lp-coit-2025', null, 'fanr_operating', '2026-12-16', 'planned', 'FANR operating test (simulator and in-plant JPMs)', 'اختبار الهيئة التشغيلي');
  const ob = (id, kind, title_en, title_ar, due_on, status, owner_role, person_id, rule_ref) => out.reporting_obligations.push({ id, kind, title_en, title_ar, due_on, status, owner_role, person_id, rule_ref });
  ob('ro-1', 'candidate_list', 'Candidate list for COIT class 2027 (draft)', 'قائمة المرشحين لدفعة 2027 (مسودة)', addDays('2027-01-10', -60), 'open', 'Licensing coordinator', null, 'FANR-REG-17 Art. 13 (60 days before programme start)');
  ob('ro-2', 'training_plan_report', 'Comprehensive training plan report (H2 2026)', 'تقرير خطة التدريب الشاملة (النصف الثاني 2026)', '2026-12-31', 'open', 'Licensing coordinator', null, 'FANR-REG-17 Art. 13 (every 6 months)');
  ob('ro-3', 'lapse_report', 'Validity lapse report: RO certificate (draft for the named role to send)', 'تقرير انقضاء الصلاحية: شهادة مشغّل مفاعل (مسودة يرسلها الدور المسؤول)', '2026-10-13', 'open', 'Licensing coordinator', 'w-ro-02', 'FANR-REG-17 Art. 13 (within 3 working days)');
  ob('ro-4', 'exam_notice', 'FANR exam notification for COIT class 2025', 'إخطار الهيئة باختبار دفعة 2025', addDays('2026-12-14', -60), 'open', 'Licensing coordinator', null, 'FANR-REG-17 Art. 7 (60 days ahead)');
  ob('ro-5', 'training_plan_report', 'Comprehensive training plan report (H1 2026)', 'تقرير خطة التدريب الشاملة (النصف الأول 2026)', '2026-06-30', 'sent_by_owner', 'Licensing coordinator', null, 'FANR-REG-17 Art. 13');
  const task = (id, kind, person_id, due_at, title_en, title_ar, rule_ref, status = 'open', created = DEMO_TODAY) => out.licensing_tasks.push({ id, kind, person_id, created_at: ts(created, 9), due_at, status, title_en, title_ar, rule_ref });
  task('lt-1', 'lapse_report', 'w-ro-02', '2026-10-13', 'Report validity lapse within 3 working days', 'الإبلاغ عن انقضاء الصلاحية خلال 3 أيام عمل', 'FANR-REG-17 Art. 13');
  task('lt-2', 'medical_overdue', 'w-ro-01', addDays(DEMO_TODAY, 5), 'Medical overdue: confirm new date', 'فحص طبي متأخر: تأكيد موعد جديد', 'FANR-REG-17 Art. 10', 'open', '2026-09-16');
  task('lt-3', 'renewal', 'w-sro-02', addMonths(DEMO_TODAY, 6), 'Certificate renewal: start renewal tasks (12 months out)', 'تجديد الشهادة: بدء مهام التجديد (قبل 12 شهراً)', 'FANR-REG-17 Art. 8');
  task('lt-4', 'proficiency_risk', 'w-sro-01', '2026-12-31', 'SRO-role shift minimum at risk this quarter', 'الحد الأدنى لنوبات دور المشغّل الأول معرّض للخطر هذا الربع', 'FANR-REG-17 Art. 11');
  task('lt-5', 'renewal', 'w-ro-05', addDays(DEMO_TODAY, 20), 'Certificate expires in 50 days', 'تنتهي الشهادة خلال 50 يوماً', 'FANR-REG-17 Art. 8');

  // ───────────── Sessions, simulator slots, enrolments, records, certificates
  const sess = (id, course_id, day, hours, location, kind, crew, priority, instructor, audience = 'staff', pub = false) => out.sessions.push({ id, course_id, starts_at: ts(day, 8), ends_at: ts(day, 8 + hours), location, instructor_person_id: instructor, capacity: kind === 'simulator' ? 6 : 16, kind, crew, priority, audience, public_summary: pub });
  sess('s-coct-b', 'c-coct', addDays(DEMO_TODAY, 6), 8, 'Simulator Training Center', 'simulator', 'B', 'licence_critical', 'p-k-instructor');
  sess('s-coct-c', 'c-coct', addDays(DEMO_TODAY, 13), 8, 'Simulator Training Center', 'simulator', 'C', 'licence_critical', 'w-instr-01');
  sess('s-loct-c', 'c-loct', addDays(DEMO_TODAY, 8), 8, 'Operator Training Center', 'simulator', 'C', 'mandatory', 'w-instr-01');
  sess('s-hu-ref', 'c-hu-ref', addDays(DEMO_TODAY, 4), 2, 'E-learning', 'elearning', null, 'mandatory', null);
  sess('s-ero', 'c-ero-drill', addDays(DEMO_TODAY, 15), 4, 'Barakah', 'drill', null, 'mandatory', 'p-ep-manager');
  sess('s-intilaqa', 'c-intilaqa', addDays(DEMO_TODAY, 21), 8, 'Abu Dhabi', 'class', null, 'elective', 'p-training-mgr');
  sess('s-sa101', 'c-sa-nqa1-101', addDays(DEMO_TODAY, 12), 4, 'Abu Dhabi (supplier academy)', 'class', null, 'elective', 'p-sq-lead', 'supplier', true);
  sess('s-sa103', 'c-sa-cgd-103', addDays(DEMO_TODAY, 19), 3, 'Abu Dhabi (supplier academy)', 'class', null, 'elective', 'p-sq-lead', 'supplier', true);
  sess('s-get', 'c-get', addDays(DEMO_TODAY, 3), 8, 'Barakah training centre', 'class', null, 'mandatory', 'w-instr-02');
  // G2 additions: a session that already ran (attendance and completion), and a full simulator session with a waitlist
  sess('s-hu-past', 'c-hu', addDays(DEMO_TODAY, -1), 8, 'Barakah training centre', 'class', null, 'mandatory', 'p-k-instructor');
  sess('s-sam', 'c-sam', addDays(DEMO_TODAY, 11), 8, 'Simulator Training Center', 'simulator', 'A', 'mandatory', 'p-k-instructor');
  sess('s-coit-gf', 'c-coit-gf', addDays(DEMO_TODAY, 25), 8, 'Barakah training centre', 'class', null, 'mandatory', 'w-instr-02');
  sess('s-apr', 'c-apr', addDays(DEMO_TODAY, 18), 8, 'Abu Dhabi', 'class', null, 'elective', 'w-instr-01');
  let slot = 0;
  const sim = (sim, day, crew, kind, priority, status = 'booked', session_id = null) => out.simulator_slots.push({ id: `sim-${++slot}`, simulator: sim, starts_at: ts(day, 7), ends_at: ts(day, 15), crew, session_id, booking_kind: kind, priority, status, booked_by: 'p-k-instructor' });
  for (let d = 1; d <= 20; d++) {
    const day = addDays(DEMO_TODAY, d);
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    sim('FSS-1', day, 'BCDEA'[d % 5], d % 4 === 0 ? 'requal' : 'coct', 1, 'booked', d === 6 ? 's-coct-b' : null);
    sim('FSS-2', day, d % 3 === 0 ? null : 'ABCDE'[(d + 2) % 5], d % 3 === 0 ? 'elective' : d % 5 === 0 ? 'initial' : 'free', d % 3 === 0 ? 4 : 3, d % 3 === 0 ? 'tentative' : 'free');
  }
  let enSeq = 0;
  const enrol = (person_id, course_id, status, source, extra = {}) => out.enrolments.push({ id: `en-${++enSeq}`, person_id, course_id, session_id: null, org_id: null, status, source, assigned_by: source === 'role_rule' ? 'Curriculum rule' : null, due_on: addDays(DEMO_TODAY, 30 + (enSeq % 60)), enrolled_at: ts(addDays(DEMO_TODAY, -(enSeq % 40))), progress_pct: status === 'completed' ? 100 : status === 'in_progress' ? 40 + (enSeq % 50) : 0, completed_at: status === 'completed' ? ts(addDays(DEMO_TODAY, -(enSeq % 200) - 5)) : null, score: status === 'completed' ? 82 + (enSeq % 15) : null, certificate_no: null, evaluation_id: null, ...extra });
  // Persona staff: role curriculum
  const curByRole = {};
  for (const c of curriculum) (curByRole[c.role_id] ||= []).push(c.course_id);
  for (const p of PERSONAS.filter((x) => x.kind === 'staff')) {
    const pid = personPid(p.persona);
    const list = curByRole[p.job_role_id] || ['c-get', 'c-hu', 'c-sec-aw'];
    list.forEach((c, i) => enrol(pid, c, i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'assigned', 'role_rule'));
  }
  enrol('p-k-ro', 'c-coct', 'enrolled', 'coordinator', { session_id: 's-coct-b' });
  enrol('p-k-ro', 'c-intilaqa', 'requested', 'self', { session_id: 's-intilaqa' });
  enrol('p-k-lo-trainee', 'c-loct', 'enrolled', 'coordinator', { session_id: 's-loct-c' });
  enrol('p-k-lo-trainee', 'c-adv-smr', 'in_progress', 'self');
  W.slice(0, 30).forEach((x, i) => enrol(x.id, i % 2 ? 'c-coct' : 'c-hu-ref', i % 3 === 0 ? 'completed' : 'assigned', 'role_rule'));
  for (const [pid, org] of [['p-alnoor-qaqc', 'org-alnoor'], ['p-alnoor-gm', 'org-alnoor'], ['p-alnoor-sales', 'org-alnoor'], ['c-alnoor-01', 'org-alnoor'], ['p-gulfhydro-qa', 'org-gulfhydro'], ['c-gulf-01', 'org-gulfhydro'], ['p-k-contractor', 'org-dhafra'], ['c-dhafra-01', 'org-dhafra']]) {
    ['c-sa-nqa1-101', 'c-sa-cfsi-102', 'c-sa-sc-104', 'c-sa-brk-106'].forEach((c, i) => {
      const status = (pid.includes('alnoor') && i < 3) || (pid === 'p-gulfhydro-qa' && i === 0) ? 'completed' : i === 3 ? 'in_progress' : 'assigned';
      const cert = status === 'completed' ? `SA-CERT-${String(101 + out.certificates.length).padStart(5, '0')}` : null;
      enrol(pid, c, status, pid.startsWith('p-') && pid.includes('gm') ? 'self' : 'partner_admin', { org_id: org, certificate_no: cert });
      if (cert) out.certificates.push({ id: cert, person_id: pid, org_id: org, holder_initials: pid.slice(2, 4).toUpperCase(), course_id: c, issued_on: addDays(DEMO_TODAY, -40 - i * 10), valid_to: addMonths(addDays(DEMO_TODAY, -40 - i * 10), 24), status: 'valid' });
    });
  }
  // Internal course certificates for /verify
  out.certificates.push({ id: 'KAF-2026-000417', person_id: 'p-k-ro', org_id: 'enec-ops', holder_initials: 'RO', course_id: 'c-hu', issued_on: '2026-03-12', valid_to: '2028-03-12', status: 'valid' });
  out.certificates.push({ id: 'KAF-2025-000233', person_id: 'w-lo-08', org_id: 'enec-ops', holder_initials: 'LO', course_id: 'c-get', issued_on: '2024-08-01', valid_to: '2026-08-01', status: 'expired' });
  out.certificates.push({ id: 'KAF-2025-000301', person_id: 'w-mnt-08', org_id: 'enec-ops', holder_initials: 'MT', course_id: 'c-hu', issued_on: '2025-01-15', valid_to: '2027-01-15', status: 'revoked' });
  // Transcript (training records)
  let trSeq = 0;
  for (const p of [...W.map((x) => x.id), 'p-k-ro', 'p-k-lo-trainee', 'p-sro', 'p-k-instructor', 'p-training-mgr']) {
    for (const [c, h, d] of [['c-get', 16, -400], ['c-hu', 8, -300], ['c-sec-aw', 1, -200], ['c-scwe', 4, -150]]) out.training_records.push({ id: `tr-${++trSeq}`, person_id: p, course_id: c, completed_on: addDays(DEMO_TODAY, d + (trSeq % 30)), hours: h, result: 'passed', source_system: 'Training records system', evaluation_id: null });
  }
  // G2 additions: enrolments on the past and full sessions, an elective awaiting a crew B manager, external requests
  const hu = out.enrolments.find((e) => e.person_id === 'p-k-lo-trainee' && e.course_id === 'c-hu');
  if (hu) Object.assign(hu, { session_id: 's-hu-past', status: 'enrolled', progress_pct: 0 });
  for (const pid of ['w-fire-01', 'w-fire-02', 'w-ep-01', 'w-qa-01']) enrol(pid, 'c-hu', 'enrolled', 'coordinator', { session_id: 's-hu-past', due_on: addDays(DEMO_TODAY, 20) });
  ['w-ro-01', 'w-ro-02', 'w-ro-03', 'w-ro-04', 'w-sro-02', 'w-sro-03'].forEach((pid) => enrol(pid, 'c-sam', 'enrolled', 'coordinator', { session_id: 's-sam' }));
  ['w-ro-05', 'w-ro-06'].forEach((pid, i) => enrol(pid, 'c-sam', 'waitlisted', 'coordinator', { session_id: 's-sam', waitlisted_at: ts(addDays(DEMO_TODAY, -3 + i)) }));
  ['w-ro-02', 'w-sro-01', 'w-sro-04'].forEach((pid) => enrol(pid, 'c-coct', 'enrolled', 'coordinator', { session_id: 's-coct-b' }));
  enrol('w-ro-01', 'c-apr', 'requested', 'self', { session_id: 's-apr' });
  out.external_requests.push({ id: 'xr-2', person_id: 'w-ro-01', title: 'Leadership webinar series (external)', provider: 'External provider', cost_aed: 1500, justification: 'SRO preparation', status: 'approved', approver_person_id: 'p-sro', decided_at: ts(addDays(DEMO_TODAY, -20)), created_at: ts(addDays(DEMO_TODAY, -25)), start_on: addDays(DEMO_TODAY, 14), hours: 12, decision_note: 'Approved within the crew training budget' });
  out.external_requests.push({ id: 'xr-3', person_id: 'p-k-instructor', title: 'Instructional design workshop (external)', provider: 'External provider', cost_aed: 6800, justification: 'Simulator scenario design (SAT)', status: 'requested', approver_person_id: null, decided_at: null, created_at: ts(addDays(DEMO_TODAY, -1)), start_on: addDays(DEMO_TODAY, 40), hours: 24 });
  out.external_requests.push({ id: 'xr-1', person_id: 'p-k-ro', title: 'Crucial Conversations (external)', provider: 'External provider', cost_aed: 4200, justification: 'Preparing for SRO leadership', status: 'requested', approver_person_id: null, decided_at: null, created_at: ts(addDays(DEMO_TODAY, -3)) });

  // ───────────── Assessments (attempts, JPM results, appeals)
  out.attempts.push({ id: 'at-1', form_id: 'form-reactor-theory', person_id: 'p-k-ro', scheduled_for: ts(addDays(DEMO_TODAY, -20)), started_at: ts(addDays(DEMO_TODAY, -20)), submitted_at: ts(addDays(DEMO_TODAY, -20), 9), score: 90, passed: true, status: 'released', proctor_person_id: 'p-k-instructor', released: true });
  out.attempts.push({ id: 'at-2', form_id: 'form-thermo', person_id: 'w-lo-03', scheduled_for: ts(addDays(DEMO_TODAY, 9)), started_at: null, submitted_at: null, score: null, passed: null, status: 'scheduled', proctor_person_id: 'w-instr-01', released: false });
  out.attempts.push({ id: 'at-3', form_id: 'form-thermo', person_id: 'p-k-lo-trainee', scheduled_for: ts(addDays(DEMO_TODAY, 9)), started_at: null, submitted_at: null, score: null, passed: null, status: 'scheduled', proctor_person_id: 'w-instr-01', released: false });
  out.attempts.push({ id: 'at-4', form_id: 'form-reactor-theory', person_id: 'w-lo-04', scheduled_for: ts(addDays(DEMO_TODAY, -12)), started_at: ts(addDays(DEMO_TODAY, -12)), submitted_at: ts(addDays(DEMO_TODAY, -12), 9), score: 70, passed: false, status: 'released', proctor_person_id: 'w-instr-01', released: true });
  // G2 additions: exams open today (timed delivery), a retake, a graded result waiting for release
  out.attempts.push({ id: 'at-5', form_id: 'form-c-hu', person_id: 'p-k-lo-trainee', scheduled_for: ts(DEMO_TODAY, 6), started_at: null, submitted_at: null, score: null, passed: null, status: 'scheduled', proctor_person_id: 'p-k-instructor', released: false });
  out.attempts.push({ id: 'at-6', form_id: 'form-thermo', person_id: 'p-k-ro', scheduled_for: ts(DEMO_TODAY, 6), started_at: null, submitted_at: null, score: null, passed: null, status: 'scheduled', proctor_person_id: 'w-instr-01', released: false });
  out.appeals.push({ id: 'ap-1', attempt_id: 'at-4', person_id: 'w-lo-04', reason: 'Question 7 wording was ambiguous in Arabic', item_id: 'it-reactor-theory-07', status: 'open', decided_by: null, created_at: ts(addDays(DEMO_TODAY, -10)) });
  const steps = (fails) => [1, 2, 3, 4, 5].map((n) => ({ n, result: fails.includes(n) ? 'fail' : 'pass' }));
  out.jpm_results.push({ id: 'jr-1', jpm_id: 'jpm-qs-lo-turbine-t2', person_id: 'p-k-lo-trainee', evaluator_person_id: 'p-k-instructor', date: addDays(DEMO_TODAY, -6), steps: steps([]), critical_failed: false, score_pct: 100, result: 'pass', signed: false, evaluation_id: null });
  out.jpm_results.push({ id: 'jr-2', jpm_id: 'jpm-qs-lo-turbine-t3', person_id: 'p-k-lo-trainee', evaluator_person_id: 'p-k-instructor', date: addDays(DEMO_TODAY, -4), steps: steps([4]), critical_failed: true, score_pct: 80, result: 'fail', signed: true, evaluation_id: null }); // AC: failed critical step fails the JPM
  out.jpm_results.push({ id: 'jr-3', jpm_id: 'jpm-qs-lo-aux-t2', person_id: 'w-lo-10', evaluator_person_id: 'w-instr-01', date: addDays(DEMO_TODAY, -2), steps: steps([]), critical_failed: false, score_pct: 100, result: 'pass', signed: false, evaluation_id: null });

  // ───────────── Development plans and mentoring
  const plan = (id, person_id, target, status, acts) => {
    out.dev_plans.push({ id, person_id, target_role_id: target, status, approved_by: status === 'active' ? 'p-sro' : null, created_at: ts('2026-05-01'), review_on: '2026-12-15', note: null });
    acts.forEach(([kind, en, ar, due, st, course], i) => out.plan_activities.push({ id: `${id}-a${i + 1}`, plan_id: id, person_id, kind, title_en: en, title_ar: ar, due_on: due, status: st, course_id: course }));
  };
  plan('dp-k-ro', 'p-k-ro', 'senior-reactor-operator', 'active', [['course', 'INTILAQA: Leading Effective Teams', 'انطلاقة: قيادة فرق فعّالة', '2026-11-30', 'planned', 'c-intilaqa'], ['ojt', 'Shadow the SRO on 6 shifts', 'مرافقة المشغّل الأول في 6 نوبات', '2026-12-31', 'in_progress', null], ['assessment', 'Internal SRO practice exam', 'اختبار تدريبي داخلي للمشغّل الأول', '2027-01-31', 'planned', null], ['mentoring', 'Monthly mentoring with an SRO-qualified instructor', 'توجيه شهري مع مدرب مؤهل', '2027-02-28', 'in_progress', null]]);
  plan('dp-k-lo', 'p-k-lo-trainee', 'reactor-operator', 'submitted', [['course', 'Complete LO watch-station qualifications', 'إكمال تأهيلات محطات المراقبة', '2027-06-30', 'in_progress', null], ['course', 'APR1400 Course', 'دورة APR1400', '2027-03-31', 'planned', 'c-apr'], ['reading', 'REG-17 entry routes explainer', 'شرح مسارات الالتحاق وفق اللائحة 17', '2026-11-15', 'done', null]]);
  plan('dp-w-eng-01', 'w-eng-01', 'shift-technical-advisor', 'draft', [['course', 'Transient and accident analysis', 'تحليل الحالات العابرة والحوادث', '2027-04-30', 'planned', null]]);
  [['p-k-instructor', 'nuclear-training-instructor', ['simulator', 'sro career'], 'SRO-qualified instructor; happy to talk about the SRO route.', 'مدرب مؤهل كمشغّل أول؛ يسعدني الحديث عن مسار المشغّل الأول.'], ['w-ss-01', 'shift-supervisor', ['leadership', 'operations'], 'Shift supervisor mentoring new SROs.', 'مشرف وردية يوجّه المشغّلين الأوائل الجدد.'], ['w-eng-01', 'systems-design-plant-engineer', ['engineering', 'digital'], 'Systems engineer interested in digital twins.', 'مهندس أنظمة مهتم بالتوائم الرقمية.'], ['w-rp-01', 'radiation-protection-technician', ['rp', 'alara'], 'RP technician; ALARA planning.', 'فني وقاية من الإشعاع؛ تخطيط ALARA.'], ['w-corp-01', 'corporate-professional', ['women in nuclear', 'hr'], 'Women in Nuclear UAE mentor.', 'موجّهة في برنامج المرأة في المجال النووي.']].forEach(([pid, role, interests, bio_en, bio_ar], i) => out.mentors.push({ id: `mt-${i + 1}`, person_id: pid, role_id: role, interests, capacity: 2, opt_in: true, bio_en, bio_ar }));
  out.mentoring_requests.push({ id: 'mr-1', person_id: 'p-k-lo-trainee', mentor_id: 'mt-1', mentor_person_id: 'p-k-instructor', interest: 'sro career', message: 'I would like to understand the route from Local Operator to SRO.', status: 'requested', created_at: ts(addDays(DEMO_TODAY, -2)) });
  out.mentoring_requests.push({ id: 'mr-2', person_id: 'w-lo-03', mentor_id: 'mt-1', mentor_person_id: 'p-k-instructor', interest: 'simulator', message: '', status: 'matched', created_at: ts(addDays(DEMO_TODAY, -30)), responded_at: ts(addDays(DEMO_TODAY, -28)) });

  // ───────────── Applications (M06)
  let apSeq = 0;
  const STAGES = ['interest', 'submitted', 'screening', 'assessment', 'interview', 'offer'];
  const NOTES = { interest: ['Interest registered', 'تم تسجيل الاهتمام'], submitted: ['Application received', 'تم استلام الطلب'], screening: ['HR is checking eligibility', 'تتحقق الموارد البشرية من الأهلية'], assessment: ['Screening exam scheduled', 'تم تحديد موعد اختبار الفرز'], interview: ['Interview stage', 'مرحلة المقابلة'], offer: ['Offer made (mirrored from HR)', 'تم تقديم عرض (من الموارد البشرية)'], accepted: ['Offer accepted', 'تم قبول العرض'], unsuccessful: ['Not successful this time (decided by ENEC HR)', 'لم يُقبل هذه المرة (قرار الموارد البشرية)'], withdrawn: ['Withdrawn by applicant', 'سحبه المتقدم'] };
  const apply = (person_id, programme_id, stage, nat = 'uae', gender = null) => {
    const id = `app-${++apSeq}`;
    const decision = stage === 'offer' || stage === 'accepted' ? 'offer' : stage === 'unsuccessful' ? 'unsuccessful' : stage === 'withdrawn' ? 'withdrawn' : 'none';
    out.applications.push({ id, person_id, programme_id, stage, submitted_at: ts(addDays(DEMO_TODAY, -60 + apSeq)), updated_at: ts(addDays(DEMO_TODAY, -5 + (apSeq % 4))), decision, decision_source: decision === 'none' ? null : 'ENEC HR (mirrored)', consent_version: '1', delete_after: stage === 'unsuccessful' ? addMonths(DEMO_TODAY, 6) : null, answers: { stage_finder: programme_id === 'dnt' ? 'finishing_school' : 'graduate' }, nationality_flag: nat, gender });
    const path = stage === 'unsuccessful' || stage === 'withdrawn' ? ['submitted', 'screening', stage] : stage === 'accepted' ? ['submitted', 'screening', 'interview', 'offer', 'accepted'] /* [G3] accepted had no history */ : STAGES.slice(1, STAGES.indexOf(stage) + 1).concat(stage === 'interest' ? ['interest'] : []);
    path.forEach((s, k) => out.application_events.push({ id: `${id}-e${k + 1}`, application_id: id, person_id, ts: ts(addDays(DEMO_TODAY, -55 + apSeq + k * 7)), stage: s, note_en: NOTES[s][0], note_ar: NOTES[s][1], by_role: s === 'submitted' || s === 'interest' ? 'Applicant' : 'ENEC HR' }));
    out.consents.push({ id: `cn-${id}`, person_id, type: 'application', purpose: `Process my application to ${programme_id}; delete if unsuccessful on the published schedule`, version: '1', granted_at: ts(addDays(DEMO_TODAY, -60 + apSeq)), withdrawn_at: null });
  };
  apply('p-k-student', 'mustaqbali', 'screening', 'uae', 'm');
  apply('p-k-graduate', 'gpo', 'interview', 'uae', 'f');
  ['dnt', 'dnt', 'dnt', 'gdp', 'gdp', 'gpo', 'internships', 'internships', 'energy-pioneers', 'dnt', 'mustaqbali', 'gpo'].forEach((prog, i) => apply(APPL[i], prog, ['submitted', 'screening', 'assessment', 'interview', 'offer', 'unsuccessful', 'accepted', 'screening', 'withdrawn', 'interview', 'submitted', 'screening'][i], i === 6 ? 'other' : 'uae', i % 2 === 0 ? 'm' : 'f'));

  // ───────────── [G3] Applicant pool for the HR funnel (M06). Synthetic applicants, first names only, no personas.
  // Sized so some programme x stage cells reach the minimum group size (10) and others stay suppressed (AC M06).
  const POOL = {
    dnt: { submitted: 22, screening: 14, assessment: 11, interview: 6, offer: 4, unsuccessful: 12, withdrawn: 2 },
    gpo: { submitted: 12, screening: 10, assessment: 4, interview: 3, unsuccessful: 6 },
    gdp: { submitted: 11, screening: 5, interview: 4, offer: 2, unsuccessful: 3 },
    internships: { submitted: 10, screening: 4, accepted: 6, unsuccessful: 3 },
    'energy-pioneers': { submitted: 13, screening: 6, assessment: 3, unsuccessful: 4 },
    mustaqbali: { interest: 6, submitted: 12, accepted: 10 },
  };
  const PATHS = { interest: ['interest'], submitted: ['submitted'], screening: ['submitted', 'screening'], assessment: ['submitted', 'screening', 'assessment'], interview: ['submitted', 'screening', 'assessment', 'interview'], offer: ['submitted', 'screening', 'assessment', 'interview', 'offer'], accepted: ['submitted', 'screening', 'interview', 'offer', 'accepted'], unsuccessful: ['submitted', 'screening', 'unsuccessful'], withdrawn: ['submitted', 'withdrawn'] };
  let poolSeq = 0;
  for (const [programme_id, stages] of Object.entries(POOL)) {
    for (const [stage, n] of Object.entries(stages)) {
      for (let k = 0; k < n; k++) {
        const i = ++poolSeq;
        const pid = `ap-${String(i).padStart(3, '0')}`;
        const female = (i * 7) % 10 < 3 || (programme_id === 'mustaqbali' && i % 2 === 0);
        const uae = programme_id === 'internships' ? i % 5 !== 0 : true;
        const nm = synthName(400 + i, uae, female);
        out.people.push({ id: pid, persona_id: null, display_name: nm.en.split(' ')[0], display_name_ar: nm.ar.split(' ')[0], initials: nm.initials, kind: 'applicant', entity_id: null, org_id: null, job_role_id: null, job_family_id: null, team_id: null, crew: null, unit: null, level: null, nationality_flag: uae ? 'uae' : 'other', gender: female ? 'f' : 'm', language: i % 3 === 0 ? 'en' : 'ar', digits: 'latn', hire_date: null, status: 'candidate', manager_id: null, synthetic: true, notes: 'First name only by default' });
        ra(pid, 'applicant');
        const id = `app-p${String(i).padStart(3, '0')}`;
        const start = -120 + (i % 90);
        const decision = stage === 'offer' || stage === 'accepted' ? 'offer' : stage === 'unsuccessful' ? 'unsuccessful' : stage === 'withdrawn' ? 'withdrawn' : 'none';
        const path = PATHS[stage];
        out.applications.push({ id, person_id: pid, programme_id, stage, submitted_at: ts(addDays(DEMO_TODAY, start)), updated_at: ts(addDays(DEMO_TODAY, start + (path.length - 1) * 6)), decision, decision_source: decision === 'none' || decision === 'withdrawn' ? null : 'ENEC HR (mirrored)', consent_version: '1', delete_after: stage === 'unsuccessful' ? addMonths(addDays(DEMO_TODAY, start + (path.length - 1) * 6), 6) : null, answers: { stage_finder: programme_id === 'dnt' ? 'finishing_school' : programme_id === 'mustaqbali' ? 'school' : 'graduate' }, nationality_flag: uae ? 'uae' : 'other', gender: female ? 'f' : 'm' });
        path.forEach((s, j) => out.application_events.push({ id: `${id}-e${j + 1}`, application_id: id, person_id: pid, ts: ts(addDays(DEMO_TODAY, start + j * 6)), stage: s, note_en: NOTES[s][0], note_ar: NOTES[s][1], by_role: s === 'submitted' || s === 'interest' || s === 'withdrawn' ? 'Applicant' : 'ENEC HR' }));
        out.consents.push({ id: `cn-${id}`, person_id: pid, type: 'application', purpose: `Process my application to ${programme_id}; delete if unsuccessful on the published schedule`, version: '1', granted_at: ts(addDays(DEMO_TODAY, start)), withdrawn_at: null });
      }
    }
  }

  // ───────────── Cohorts, scholars, internships (M10)
  const coh = (id, programme_id, intake_year, university_org_id, destination, pathway, size, in_study, graduated, placed, women_pct) => out.scholar_cohorts.push({ id, programme_id, intake_year, university_org_id, destination, pathway, size, in_study, graduated, placed, women_pct, sample: true });
  coh('co-ep-ku-2024', 'energy-pioneers', 2024, 'ku', 'Khalifa University', 'BSc engineering', 24, 22, 0, 0, 38);
  coh('co-ep-ku-2022', 'energy-pioneers', 2022, 'ku', 'Khalifa University', 'BSc engineering', 21, 6, 14, 12, 33);
  coh('co-ep-us-2023', 'energy-pioneers', 2023, 'penn-state', 'Penn State', 'BSc nuclear engineering', 8, 8, 0, 0, 25);
  coh('co-ep-kr-2024', 'energy-pioneers', 2024, 'kaist', 'KAIST', 'BSc / MSc', 6, 6, 0, 0, 33);
  coh('co-kumsc-2025', 'ku-msc', 2025, 'ku', 'Khalifa University', 'MSc Nuclear Engineering', 12, 12, 0, 0, 42);
  const sch = (id, person_id, cohort_id, uni, status, consent_university, year) => out.scholars.push({ id, person_id, cohort_id, university_org_id: uni, status, progress_note: status === 'in_study' ? 'On track (sponsor view)' : 'Graduated', year_of_study: year, consent_university, consent_sponsor: true });
  sch('sc-1', 'p-k-graduate', 'co-ep-ku-2022', 'ku', 'graduated', true, null);
  sch('sc-2', 'a-04', 'co-ep-ku-2024', 'ku', 'in_study', true, 2);
  sch('sc-3', 'a-05', 'co-ep-ku-2024', 'ku', 'in_study', false, 2); // AC: university must not see non-consenting student
  sch('sc-4', 'a-06', 'co-kumsc-2025', 'ku', 'in_study', true, 1);
  sch('sc-5', 'a-07', 'co-ep-us-2023', 'penn-state', 'in_study', true, 3);
  sch('sc-6', 'a-08', 'co-ep-ku-2024', 'ku', 'in_study', false, 2);
  sch('sc-7', 'a-09', 'co-ep-kr-2024', 'kaist', 'in_study', true, 2);
  [['Operations summer internship', 'تدريب صيفي في العمليات', 'operations', 6], ['Engineering internship', 'تدريب في الهندسة', 'engineering', 8], ['Radiation protection internship', 'تدريب في الوقاية من الإشعاع', 'radiation-protection', 4], ['Corporate (HR and communications) internship', 'تدريب في الخدمات المؤسسية', 'corporate', 4]].forEach(([en, ar, fam, seats], i) => out.internships.push({ id: `int-${i + 1}`, host_entity_id: i === 3 ? 'enec' : 'enec-ops', university_org_id: i < 2 ? 'ku' : null, title_en: en, title_ar: ar, family_id: fam, seats, starts_on: '2027-06-15', status: 'open', intake_year: 2027 }));

  // ───────────── Partner ecosystem (M09, M10)
  const STEPS = ['orientation', 'quality', 'safety_culture', 'icv', 'self_assessment', 'handoff'];
  const onb = (id, org_id, kind, status, done, extra = {}) => {
    out.partner_onboarding.push({ id, org_id, kind, status, started_at: ts('2026-05-01'), submitted_at: ['submitted', 'approved', 'handed_off'].includes(status) ? ts('2026-08-20') : null, decided_at: ['approved', 'handed_off'].includes(status) ? ts('2026-09-01') : null, decided_by: ['approved', 'handed_off'].includes(status) ? 'p-k-admin' : null, decision_note: null, summary: {}, nexus_handoff_ref: status === 'handed_off' ? '/partner/readiness' : null, ...extra });
    if (kind === 'supplier') STEPS.forEach((s, i) => out.supplier_readiness.push({ id: `sr-${org_id}-${s}`, org_id, step_key: s, status: i < done ? 'done' : i === done ? 'in_progress' : 'not_started', evidence: i < done ? 'Uploaded (demo)' : null, self_assessment: s === 'self_assessment' && i < done ? { nqa1: 3, cgd: 2, cfsi: 3, defect_reporting: 3 } : {}, updated_at: ts(addDays(DEMO_TODAY, -i * 3)) }));
  };
  onb('po-alnoor', 'org-alnoor', 'supplier', 'handed_off', 6);
  onb('po-gulfhydro', 'org-gulfhydro', 'supplier', 'in_progress', 3);
  onb('po-tarsus', 'org-tarsus', 'supplier', 'submitted', 5);
  onb('po-liwa', 'org-liwa', 'supplier', 'invited', 0);
  onb('po-dhafra', 'org-dhafra', 'supplier', 'approved', 6);
  onb('po-ku', 'ku', 'university', 'approved', 0);
  onb('po-meridia', 'org-meridia', 'international', 'approved', 0);
  const eqr = (id, org_id, person_id, person_label, standard_id, status, extra = {}) => out.equivalency_requests.push({ id, org_id, person_id, person_label, standard_id, evidence: [{ name: 'Training certificate (redacted)', kind: 'certificate' }, { name: 'Employer reference', kind: 'reference' }], status, decision_note: null, decider_role: null, decided_by: null, decided_at: null, submitted_at: ts(addDays(DEMO_TODAY, -20)), ...extra });
  eqr('eq-1', 'org-alnoor', 'c-alnoor-01', 'Contractor technician A-01', 'qs-mech', 'equivalent', { decision_note: 'Evidence maps to all critical tasks; JPM T1 observed.', decider_role: 'Instructor / evaluator', decided_by: 'p-sq-lead', decided_at: ts(addDays(DEMO_TODAY, -6)) });
  eqr('eq-2', 'org-alnoor', 'c-alnoor-02', 'Contractor technician A-02', 'qs-mech', 'under_review');
  eqr('eq-3', 'org-alnoor', 'c-alnoor-03', 'Contractor inspector A-03', 'qs-qa', 'submitted');
  eqr('eq-4', 'org-gulfhydro', 'c-gulf-01', 'Contractor technician G-01', 'qs-elec', 'training_required', { decision_note: 'No evidence of zero-energy verification JPM; enrol in MNT-120.', decider_role: 'Instructor / evaluator', decided_by: 'p-head-sq', decided_at: ts(addDays(DEMO_TODAY, -2)) });
  eqr('eq-5', 'org-gulfhydro', 'c-gulf-02', 'Contractor technician G-02', 'qs-mech', 'submitted');
  eqr('eq-6', 'org-dhafra', 'c-dhafra-01', 'Outage contractor D-01', 'qs-get', 'under_review');
  eqr('eq-7', 'org-dhafra', 'p-k-contractor', 'Outage contractor (persona)', 'qs-get', 'submitted');
  [['org-alnoor', 41, 50, 2028, 'reviewed'], ['org-gulfhydro', 34, 42, 2028, 'submitted'], ['org-tarsus', 29, 36, 2027, 'draft'], ['org-liwa', 44.5, 50, 2027, 'draft'], ['org-dhafra', 47.3, 52, 2027, 'reviewed']].forEach(([org_id, baseline, target, target_year, status], i) => out.icv_plans.push({ id: `icv-${org_id}`, org_id, baseline, target, target_year, certificate_valid_to: addMonths(DEMO_TODAY, 4 + i * 2), levers: [{ lever: 'Emirati hiring', en: 'Hire and train UAE nationals', ar: 'توظيف المواطنين وتدريبهم', delta: 3 }, { lever: 'Local sourcing', en: 'Source raw material locally', ar: 'توريد المواد الخام محلياً', delta: 4 }, { lever: 'Local investment', en: 'Invest in UAE facilities', ar: 'الاستثمار في منشآت داخل الدولة', delta: 2 }], status, reviewed_at: status === 'reviewed' ? ts(addDays(DEMO_TODAY, -15)) : null, certificate_file: status !== 'draft' ? 'icv-certificate.pdf (demo)' : null }));
  const ch = (id, en, ar, theme, sen, sar, status, signed) => out.research_challenges.push({ id, title_en: en, title_ar: ar, theme, summary_en: sen, summary_ar: sar, status, is_published: status === 'published', screening_signed_by: signed ? 'p-k-admin' : null, screening_signed_at: signed ? ts('2026-08-01') : null, security_ok: signed, export_control_ok: signed, closes_on: '2027-01-31' });
  ch('rc-1', 'Arabic-first technical learning content', 'محتوى تعليمي تقني يبدأ بالعربية', 'Learning', 'How might we produce reviewed Arabic-first learning content for nuclear fundamentals at scale?', 'كيف يمكننا إنتاج محتوى تعليمي مراجَع يبدأ بالعربية لأساسيات الطاقة النووية على نطاق واسع؟', 'published', true);
  ch('rc-2', 'Heat-stress management for outdoor work', 'إدارة الإجهاد الحراري للعمل في الهواء الطلق', 'Health & safety', 'Practical, evidence-based approaches to heat-stress controls in summer outages.', 'مناهج عملية قائمة على الأدلة لضوابط الإجهاد الحراري في فترات الإيقاف الصيفية.', 'published', true);
  ch('rc-3', 'Coral restoration monitoring', 'رصد استعادة الشعاب المرجانية', 'Environment', 'Low-cost monitoring methods for coral cultivation programmes.', 'طرق رصد منخفضة التكلفة لبرامج استزراع المرجان.', 'published', true);
  ch('rc-4', 'Simulator scenario authoring tools', 'أدوات تأليف سيناريوهات المحاكي', 'Training', 'Tools that help instructors author and version simulator scenarios.', 'أدوات تساعد المدربين على تأليف سيناريوهات المحاكي وإدارة إصداراتها.', 'screening', false); // AC: cannot publish without screening sign-off
  ch('rc-5', 'Advanced reactor workforce models', 'نماذج القوى العاملة للمفاعلات المتقدمة', 'Future workforce', 'Draft problem statement.', 'بيان مشكلة (مسودة).', 'draft', false);
  [['rp-1', 'rc-1', 'ku', 'Arabic nuclear glossary with spaced repetition', 'Builds on the Nuclear Training glossary; KU linguistics + nuclear engineering.', 'submitted'], ['rp-2', 'rc-2', 'ku', 'Wearable heat-stress sensing pilot', 'Pilot with consenting volunteers; no plant data.', 'screening'], ['rp-3', 'rc-3', 'src', 'Remote coral monitoring with low-cost sensors', 'SRC/GIEMS capacity-building track.', 'draft'], ['rp-4', null, 'org-alnoor', 'Localised manufacture of pump wear rings', 'Supplier-led proposal; IP routed via the MoET patents route.', 'submitted']].forEach(([id, challenge_id, org_id, title, summary, status]) => out.research_proposals.push({ id, challenge_id, org_id, title, summary, status, ip_route: 'MoET patents route (May 2026 MoU)', screened: status === 'screening', submitted_at: status === 'draft' ? null : ts(addDays(DEMO_TODAY, -14)) }));

  // ───────────── Observer reports, scenarios
  out.observer_reports.push({ id: 'or-1', title_en: 'Workforce and training indicators, H1 2026 (aggregate)', title_ar: 'مؤشرات القوى العاملة والتدريب، النصف الأول 2026 (إجمالية)', period: '2026-H1', body: { tiles: [{ k: 'emiratization', v: '54.7%', src: 'SR2024' }, { k: 'training_hours_per_employee', v: '218.45', src: 'SR2024' }, { k: 'sro_ro', v: '190', src: 'ENEC GPO release' }], note: 'Aggregate only; groups under 10 suppressed.' }, status: 'released', prepared_by: 'p-k-hr-analyst', approved_by: 'p-chco', approved_at: ts('2026-07-20'), released_to_org_ids: ['org-observer'] });
  out.observer_reports.push({ id: 'or-2', title_en: 'Licensed operator bench depth, Q3 2026 (aggregate)', title_ar: 'عمق احتياطي المشغّلين المرخّصين، الربع الثالث 2026', period: '2026-Q3', body: { tiles: [{ k: 'bench_sro', v: '84 / 90 target (SAMPLE)' }] }, status: 'pending_approval', prepared_by: 'p-k-hr-analyst', approved_by: null, approved_at: null, released_to_org_ids: [] });
  out.observer_reports.push({ id: 'or-3', title_en: 'Emiratization by job family, Q3 2026 (draft)', title_ar: 'التوطين حسب العائلة الوظيفية، الربع الثالث 2026 (مسودة)', period: '2026-Q3', body: {}, status: 'draft', prepared_by: 'p-k-hr-analyst', approved_by: null, approved_at: null, released_to_org_ids: [] });
  out.scenarios.push({ id: 'scn-1', name: 'Two more APR-1400 units (SIMULATED)', kind: 'headcount', params: { units: 2, start: 2032 }, results: { operators_needed: 120, instructors_needed: 14 }, simulated: true, owner_person_id: 'p-k-hr-analyst', created_at: ts('2026-09-01') });
  out.scenarios.push({ id: 'scn-2', name: 'SMR pilot workforce (SIMULATED)', kind: 'technology', params: { technology: 'tech-bwr', units: 1 }, results: { new_skills: ['BWR operations', 'BWR chemistry'] }, simulated: true, owner_person_id: 'p-k-hr-analyst', created_at: ts('2026-09-15') });

  // ───────────── Notifications
  let nSeq = 0;
  const note = (person_id, kind, severity, title_en, title_ar, link) => out.notifications.push({ id: `nt-${++nSeq}`, person_id, kind, title_en, title_ar, body_en: null, body_ar: null, link, severity, created_at: ts(addDays(DEMO_TODAY, -(nSeq % 5))), read_at: null });
  note('p-k-ro', 'session', 'info', 'COCT session booked for Crew B', 'تم حجز جلسة التدريب المستمر للطاقم ب', '/my/learning');
  note('p-k-ro', 'plan', 'ok', 'Your development plan was approved', 'تم اعتماد خطة تطويرك', '/my/plan');
  note('p-k-ro', 'assessment', 'info', 'Reactor theory practice exam result released', 'تم إصدار نتيجة الاختبار التدريبي', '/my/assessments');
  note('p-sro', 'expiry', 'warn', 'Crew B: SRO-role shift minimum at risk for one SRO', 'الطاقم ب: الحد الأدنى لنوبات المشغّل الأول معرّض للخطر', '/team/quals');
  note('p-sro', 'expiry', 'bad', 'Crew B: one RO certificate lapsed', 'الطاقم ب: انقضاء صلاحية شهادة مشغّل مفاعل', '/team');
  note('p-rao', 'task', 'bad', 'Lapse report due 13 Oct (3 working days)', 'تقرير الانقضاء مستحق في 13 أكتوبر (3 أيام عمل)', '/licensing/validity');
  note('p-k-licensing-coord', 'task', 'bad', 'Lapse report due 13 Oct (3 working days)', 'تقرير الانقضاء مستحق في 13 أكتوبر', '/licensing/validity');
  note('p-k-licensing-coord', 'task', 'warn', 'Medical overdue for one RO', 'فحص طبي متأخر لمشغّل مفاعل', '/licensing/validity');
  note('p-training-mgr', 'approval', 'info', '1 external course request awaiting approval', 'طلب دورة خارجية بانتظار الاعتماد', '/training');
  note('p-k-lo-trainee', 'assessment', 'bad', 'JPM failed on a critical step: retake required', 'رسوب في مقياس الأداء بسبب خطوة حرجة: يلزم إعادة', '/my/quals');
  note('p-k-lo-trainee', 'session', 'info', 'LOCT session booked', 'تم حجز جلسة التدريب المستمر', '/my/learning');
  note('p-alnoor-gm', 'partner', 'ok', 'Equivalency decision recorded for 1 contractor', 'تم تسجيل قرار معادلة لمقاول', '/partner/workforce');
  note('p-gulfhydro-qa', 'partner', 'warn', 'Equivalency: training required for 1 contractor', 'المعادلة: يلزم تدريب لمقاول واحد', '/partner/workforce');
  note('p-k-student', 'application', 'info', 'Your Mustaqbali application is in screening', 'طلبك لبرنامج مستقبلي قيد الفرز', '/my/applications');
  note('p-k-graduate', 'application', 'info', 'GPO: interview stage', 'برنامج مشغّل المحطة: مرحلة المقابلة', '/my/applications');
  note('p-chco', 'approval', 'warn', 'Observer report awaiting your approval', 'تقرير المراقب بانتظار اعتمادك', '/workforce');
  note('p-k-admin', 'approval', 'info', 'Partner onboarding submitted: Tarsus Precision Casting', 'تم تقديم طلب انضمام شريك: طرسوس', '/admin/access');
  note('p-k-ecp', 'case', 'info', '2 referrals received, awaiting triage', 'إحالتان بانتظار الفرز', '/admin/ecp');

  // ───────────── Dalil sample sessions, data requests, contact requests
  out.advisor_sessions.push({ id: 'as-1', person_id: 'p-k-ro', mode: 'staff', started_at: ts(addDays(DEMO_TODAY, -1)), retention_until: addDays(DEMO_TODAY, 29), handoff: 'none', handoff_consent: false, turns: 2 });
  out.advisor_turns.push({ id: 'at-1-1', session_id: 'as-1', person_id: 'p-k-ro', speaker: 'user', text: 'What are the SRO entry requirements?', citations: [], refused: false, refusal_category: null, ts: ts(addDays(DEMO_TODAY, -1)) });
  out.advisor_turns.push({ id: 'at-1-2', session_id: 'as-1', person_id: 'p-k-ro', speaker: 'dalil', text: 'FANR-REG-17 Art. 4 gives three SRO routes: 24 months as RO at Barakah; a BSc plus 24 months at Barakah including 12 as LO; or 24 months as RO/SRO/SRO-QI elsewhere plus 12 at Barakah including 6 on crew. Every route needs UAE security clearance. ENEC and FANR determine eligibility.', citations: [{ label: 'FANR-REG-17', url: 'https://www.fanr.gov.ae/en/Documents/FANR-REG17%20V.1%20EN%20-%20BOM%20Version%20Certified.PDF' }], refused: false, refusal_category: null, ts: ts(addDays(DEMO_TODAY, -1)) });
  out.data_requests.push({ id: 'dr-1', person_id: 'p-k-graduate', kind: 'export', status: 'open', note: 'Export my application data', created_at: ts(addDays(DEMO_TODAY, -2)) });
  out.contact_requests.push({ id: 'ct-1', topic: 'suppliers', route_to: 'Supplier development (role mailbox)', name: null, email: null, message: 'How do we start the readiness path?', created_at: ts(addDays(DEMO_TODAY, -3)), status: 'routed' });
  return out;
}
