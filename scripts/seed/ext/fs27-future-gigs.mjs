// FS27 + FS28 (future-skills wave D · E1, M20) seed.
// FS27: 15 open future-skills gigs, three in each of the five channels (ADVANCE study support, digital innovation, governed AI pilots,
//       data clean-up, knowledge capture), each growing FS02 future skills; time envelopes in every state (requested, approved, declined,
//       withdrawn) for synthetic workers and demo role cards; applications made inside an approved envelope are released at once by the
//       same rule both backends use (envelopeFit), the others wait for the ordinary F08 release. All application events are dated after
//       2026-10-08 (the last F24 fairness snapshot), so earlier snapshots are unchanged. No future gig is completed in the seed: completion
//       writes evidence through the unchanged F08 path at demo time.
// FS28: three published future-role rotation templates (digital twin, data office, ADVANCE study team: career-level only) and one draft,
//       normalised by the F15 validator; 16 synthetic external secondments in every phase; the returned ones carry their knowledge-capture
//       session (M24 kafaa_capture_sessions, due within 60 days of return).
// Synthetic people only (w-* workers and role cards). No security, cyber or safeguards placement, host, skill or role.
import { lineManagerOf, releaserFor } from '../../../src/modules/m20/domain.ts';
import { validateTemplate } from '../../../src/modules/m20/rotation.ts';
import { CHANNELS, capHours, channelProblem, envelopeFit, quarterBounds, sortChannels, validateEnvelope } from '../../../src/modules/m20/futureGigs.ts';
import { captureTitle, capturePlannedOn, endOf, objectivesOf, transferDue, validateSecondment, validateTag } from '../../../src/modules/m20/secondment.ts';

const AS_OF = '2026-10-10';
const ts = (d, h = 9) => `${d}T${String(h).padStart(2, '0')}:00:00Z`;

// ───────────── FS27 future gigs
// [id, poster, channel, kind, location, hours, start, end, seats, needed, gained, flags, title_en, title_ar, summary_en, summary_ar]
const GIGS = [
  ['fg-adv-passive-safety-digest', 'p-dra', 'advance_study', 'research', 'office', 3, '2026-11-02', '2027-01-29', 3, [], ['sk-fs-adv-passive', 'sk-fs-adv-regulation'], ['knowledge_transfer'],
    'ADVANCE study support: passive-safety literature digest', 'دعم دراسات ADVANCE: ملخص المراجع حول السلامة السلبية',
    'Read published papers and regulator summaries on passive safety features of small modular reactors and write a two-page digest for the study team. Public documents only; study work with no deployment decision implied.',
    'اقرأ الأوراق المنشورة وملخصات الجهات الرقابية حول خصائص السلامة السلبية في المفاعلات المعيارية الصغيرة، واكتب ملخصاً من صفحتين لفريق الدراسة. وثائق عامة فقط؛ عمل دراسي لا يعني أي قرار بالنشر.'],
  ['fg-adv-licensing-compare', 'p-dra', 'advance_study', 'project', 'office', 4, '2026-11-16', '2027-02-26', 2, ['sk-ns-02'], ['sk-fs-adv-regulation', 'sk-fs-adv-smr'], [],
    'ADVANCE study support: compare published licensing approaches for new designs', 'دعم دراسات ADVANCE: مقارنة مناهج الترخيص المنشورة للتصاميم الجديدة',
    'Build a comparison table of how regulators describe their licensing approach for new reactor designs, from public documents only. Kafa\'a records the development; no regulatory position or deployment decision is implied.',
    'أعدّ جدول مقارنة لكيفية وصف الجهات الرقابية لنهجها في ترخيص تصاميم المفاعلات الجديدة، اعتماداً على الوثائق العامة فقط. تسجّل كفاءة التطوير، ولا يعني ذلك أي موقف تنظيمي أو قرار بالنشر.'],
  ['fg-adv-factory-qa-review', 'p-head-sq', 'advance_study', 'oe_review', 'office', 3, '2027-01-04', '2027-03-26', 2, ['sk-qa-01'], ['sk-fs-adv-factoryqa', 'sk-qa-02'], [],
    'ADVANCE study support: factory quality lessons from other industries', 'دعم دراسات ADVANCE: دروس جودة التصنيع من قطاعات أخرى',
    'Review published lessons on factory-built modules and supplier quality from shipbuilding, aerospace and other nuclear programmes, and list what a future supplier oversight plan would need to check.',
    'راجع الدروس المنشورة حول الوحدات المصنّعة في المصانع وجودة الموردين من بناء السفن والطيران وبرامج نووية أخرى، وضع قائمة بما يجب أن تتحقق منه خطة الرقابة على الموردين مستقبلاً.'],
  ['fg-dig-twin-validation', 'p-ops-ceo', 'digital_innovation', 'research', 'office', 4, '2026-11-02', '2027-02-26', 2, ['sk-da-01'], ['sk-fs-ai-twin', 'sk-fs-ai-anomaly'], ['emirati_development'],
    'Digital twin validation notebook (historical data only)', 'دفتر التحقق من التوأم الرقمي (بيانات تاريخية فقط)',
    'Compare a digital-twin model of the condensate system with exported historical performance data, record where they diverge and why. No connection to plant systems; the notebook is reviewed by plant engineering.',
    'قارن نموذج التوأم الرقمي لنظام المكثّفات ببيانات الأداء التاريخية المصدّرة، وسجّل مواضع الاختلاف وأسبابها. لا يوجد أي اتصال بأنظمة المحطة، وتراجع هندسة المحطة الدفتر.'],
  ['fg-dig-erounds-pilot', 'p-work-control', 'digital_innovation', 'project', 'site_non_protected', 3, '2026-11-09', '2027-01-29', 3, [], ['sk-fs-dp-rounds', 'sk-fs-dp-ework'], ['new_joiner_friendly'],
    'Electronic rounds pilot: checklist usability on tablets', 'تجربة الجولات الإلكترونية: سهولة استخدام القوائم على الأجهزة اللوحية',
    'Test draft electronic rounds checklists on tablets in non-protected areas and log usability issues for the work-control team. The paper procedure stays the record during the pilot.',
    'اختبر مسودات قوائم الجولات الإلكترونية على الأجهزة اللوحية في المناطق غير المحمية، وسجّل مشكلات سهولة الاستخدام لفريق التحكم في الأعمال. يبقى الإجراء الورقي هو السجل المعتمد خلال التجربة.'],
  ['fg-dig-xr-storyboard', 'p-training-mgr', 'digital_innovation', 'project', 'office', 2, '2026-12-01', '2027-03-31', 2, [], ['sk-fs-ai-xr', 'sk-fs-tr-creative'], [],
    'XR walkthrough storyboard for non-operators', 'لوحة قصة لجولة بالواقع الممتد لغير المشغّلين',
    'Storyboard a short extended-reality walkthrough that explains the plant to non-operators, using public and training material only. The training team decides whether it is built.',
    'أعدّ لوحة قصة لجولة قصيرة بالواقع الممتد تشرح المحطة لغير المشغّلين، باستخدام المواد العامة والتدريبية فقط. يقرر فريق التدريب ما إذا كانت ستُنفَّذ.'],
  ['fg-ai-cap-triage-review', 'p-cap-chair', 'ai_pilot', 'project', 'office', 2, '2026-11-02', '2027-01-29', 4, [], ['sk-fs-ai-verify', 'sk-fs-ai-use'], ['knowledge_transfer'],
    'Governed AI pilot: check AI-suggested condition-report categories', 'تجربة ذكاء اصطناعي محوكمة: مراجعة تصنيفات تقارير الحالة المقترحة آلياً',
    'Compare categories an approved AI tool suggests for closed condition reports with the categories the screening team chose, and log every disagreement. Human screening stays the decision; nothing is used for live reports.',
    'قارن التصنيفات التي تقترحها أداة ذكاء اصطناعي معتمدة لتقارير الحالة المغلقة بالتصنيفات التي اختارها فريق الفرز، وسجّل كل اختلاف. يبقى القرار لفرز البشر، ولا يُستخدم أي شيء للتقارير الجارية.'],
  ['fg-ai-training-search', 'p-training-mgr', 'ai_pilot', 'project', 'office', 3, '2026-11-16', '2027-02-12', 3, [], ['sk-fs-ai-prompt', 'sk-fs-ai-verify'], [],
    'Governed AI pilot: test a search assistant over training material', 'تجربة ذكاء اصطناعي محوكمة: اختبار مساعد بحث في المواد التدريبية',
    'Ask a retrieval-based search assistant questions about published training material, check every answer against the source and log wrong or unsupported answers. No exam content is used.',
    'اطرح أسئلة على مساعد بحث قائم على الاسترجاع حول المواد التدريبية المنشورة، وتحقق من كل إجابة مقابل المصدر، وسجّل الإجابات الخاطئة أو غير المدعومة. لا يُستخدم أي محتوى امتحاني.'],
  ['fg-ai-chem-trend-flags', 'p-chem-sup', 'ai_pilot', 'research', 'office', 2, '2026-12-01', '2027-03-12', 2, ['sk-ch-02'], ['sk-fs-ai-anomaly', 'sk-fs-ai-use'], [],
    'Governed AI pilot: compare trend flags with analyst judgement', 'تجربة ذكاء اصطناعي محوكمة: مقارنة إشارات الاتجاه بحكم المحلل',
    'Run an approved anomaly-flagging tool over historical chemistry trends and compare its flags with the analyst\'s own review. The result feeds the AI governance review; live chemistry decisions are not affected.',
    'شغّل أداة معتمدة لرصد الحالات الشاذة على اتجاهات كيميائية تاريخية، وقارن إشاراتها بمراجعة المحلل نفسه. تُستخدم النتيجة في مراجعة حوكمة الذكاء الاصطناعي، ولا تتأثر قرارات الكيمياء الجارية.'],
  ['fg-data-training-records', 'p-training-mgr', 'data_cleanup', 'project', 'office', 2, '2026-10-26', '2026-12-18', 4, [], ['sk-fs-ai-data-care', 'sk-fs-ai-dataeng'], ['new_joiner_friendly'],
    'Data clean-up sprint: training record metadata', 'دفعة تنظيف بيانات: البيانات الوصفية لسجلات التدريب',
    'Find and fix inconsistent course codes, durations and skill tags in exported training record metadata, and write down each rule you apply so the clean-up can be repeated.',
    'اعثر على رموز الدورات والمدد ووسوم المهارات غير المتسقة في البيانات الوصفية المصدّرة لسجلات التدريب وصحّحها، ودوّن كل قاعدة تطبقها ليمكن تكرار التنظيف.'],
  ['fg-data-equipment-tags', 'p-outage-manager', 'data_cleanup', 'project', 'office', 3, '2026-11-02', '2027-01-15', 2, [], ['sk-fs-ai-data-care', 'sk-fs-ai-plantdata'], [],
    'Data clean-up: equipment tags in outage work-package lists', 'تنظيف البيانات: وسوم المعدات في قوائم حزم أعمال الانقطاع',
    'Check equipment tags in exported outage work-package lists against the equipment list, flag mismatches and propose corrections for the planners.',
    'طابق وسوم المعدات في قوائم حزم أعمال الانقطاع المصدّرة مع قائمة المعدات، وحدّد حالات عدم التطابق، واقترح تصحيحات للمخططين.'],
  ['fg-data-dose-history', 'p-rp-lead', 'data_cleanup', 'project', 'office', 2, '2026-11-16', '2027-01-29', 2, ['sk-rp-01'], ['sk-fs-ai-dataeng', 'sk-fs-ai-plantdata'], [],
    'Data clean-up: anonymised dose history tables', 'تنظيف البيانات: جداول تاريخ الجرعات مجهّلة الهوية',
    'Tidy anonymised historical dose tables into one consistent format so planned and actual dose can be compared across outages.',
    'رتّب جداول الجرعات التاريخية مجهّلة الهوية في صيغة موحدة لتسهل مقارنة الجرعة المخططة بالفعلية عبر الانقطاعات.'],
  ['fg-kc-digital-indications', 'p-ops-ceo', 'knowledge_capture', 'knowledge_capture', 'office', 2, '2026-11-02', '2027-02-26', 3, [], ['sk-fs-tr-empathy', 'sk-fs-ai-verify'], ['knowledge_transfer', 'emirati_development'],
    'Knowledge capture: how experienced operators cross-check digital indications', 'التقاط المعرفة: كيف يتحقق المشغّلون ذوو الخبرة من المؤشرات الرقمية',
    'Interview experienced operators and instructors about how they cross-check digital indications before acting, and turn the interviews into short searchable notes.',
    'أجرِ مقابلات مع مشغّلين ومدربين ذوي خبرة حول كيفية تحققهم من المؤشرات الرقمية قبل التصرف، وحوّل المقابلات إلى ملاحظات قصيرة قابلة للبحث.'],
  ['fg-kc-outage-handover', 'p-outage-manager', 'knowledge_capture', 'knowledge_capture', 'office', 3, '2026-11-16', '2027-03-31', 2, [], ['sk-fs-tr-crosscultural', 'sk-fs-tr-curiosity'], ['knowledge_transfer'],
    'Knowledge capture: outage know-how from partner experts before handover', 'التقاط المعرفة: خبرة الانقطاعات من خبراء الشركاء قبل التسليم',
    'Prepare and run structured interviews with partner outage experts before their assignments end, working across languages and cultures, and publish the notes through the knowledge studio.',
    'حضّر وأجرِ مقابلات منظمة مع خبراء الانقطاع من الشركاء قبل انتهاء مهامهم، بالعمل عبر اللغات والثقافات، وانشر الملاحظات عبر استوديو المعرفة.'],
  ['fg-kc-waste-minimisation', 'p-chem-sup', 'knowledge_capture', 'knowledge_capture', 'office', 2, '2026-12-01', '2027-03-26', 2, [], ['sk-fs-gr-circular', 'sk-fs-tr-curiosity'], [],
    'Knowledge capture: waste-minimisation good practice', 'التقاط المعرفة: الممارسات الجيدة لتقليل النفايات',
    'Collect good practice on reducing chemical and low-level waste from the chemistry and radiation protection teams, and write it up as short notes with the reasons behind each practice.',
    'اجمع الممارسات الجيدة لتقليل النفايات الكيميائية والمنخفضة الإشعاع من فريقي الكيمياء والوقاية من الإشعاع، ودوّنها في ملاحظات قصيرة مع أسباب كل ممارسة.'],
];

// [person, pct, period, channels|null (all), status, decided_on, note, reason_en]
const ENVELOPES = [
  ['p-sme-reviewer', 15, '2026-Q4', null, 'approved', '2026-10-06', null, 'I want to build digital-twin and AI verification skills for the engineering work ahead.'],
  ['p-k-ro', 10, '2026-Q4', ['digital_innovation', 'ai_pilot', 'data_cleanup'], 'approved', '2026-10-07', null, 'Digital rounds and AI checks are coming to the control room; I want hands-on practice first.'],
  ['p-fuel-pm', 10, '2026-Q4', ['advance_study', 'knowledge_capture'], 'approved', '2026-10-05', null, 'To follow advanced fuel and SMR study work alongside my role.'],
  ['p-cap-coord', 5, '2026-Q4', ['ai_pilot', 'knowledge_capture'], 'approved', '2026-10-02', null, 'Small, steady time for AI pilots that touch the corrective action programme.'],
  ['p-outage-planner', 10, '2026-Q4', ['digital_innovation', 'data_cleanup', 'knowledge_capture'], 'requested', null, null, 'Electronic work packages will change planning; I want to help shape them.'],
  ['p-k-lo-trainee', 10, '2026-Q4', ['digital_innovation', 'ai_pilot'], 'requested', null, null, 'I am new and want to learn the digital tools the plant is introducing.'],
  ['p-nse', 5, '2027-Q1', ['ai_pilot', 'data_cleanup'], 'requested', null, null, 'Supplier data quality matters for digital procurement; I can help clean it.'],
  ['p-qc-inspector', 10, '2026-Q4', null, 'declined', '2026-10-06', 'Inspection backlog until the Unit 2 outage ends; please ask again for the first quarter.', 'I would like to join the factory quality study.'],
  ['p-buyer', 5, '2026-Q4', ['data_cleanup'], 'withdrawn', null, null, 'Data clean-up for supplier records.'],
  // synthetic workers (all approved by their line manager of record)
  ['w-eng-01', 10, '2026-Q4', null, 'approved', '2026-10-01', null, 'Digital twin and anomaly triage for system engineering.'],
  ['w-eng-02', 10, '2026-Q4', null, 'approved', '2026-10-01', null, 'Data skills for plant performance trending.'],
  ['w-eng-03', 15, '2026-Q4', null, 'approved', '2026-10-02', null, 'Advanced reactor study and digital tools.'],
  ['w-mnt-01', 10, '2026-Q4', null, 'approved', '2026-10-02', null, 'Electronic work packages and rounds.'],
  ['w-mnt-02', 5, '2026-Q4', null, 'approved', '2026-10-03', null, 'Data clean-up in maintenance records.'],
  ['w-ro-03', 10, '2026-Q4', null, 'approved', '2026-10-03', null, 'AI checks and digital indications.'],
  ['w-ro-04', 10, '2026-Q4', null, 'approved', '2026-10-03', null, 'Knowledge capture with senior operators.'],
  ['w-rp-01', 10, '2026-Q4', null, 'approved', '2026-10-05', null, 'Data and AI pilots for radiation protection.'],
  ['w-chem-01', 10, '2026-Q4', null, 'approved', '2026-10-05', null, 'Training data and AI search pilots.'],
  ['w-qa-01', 10, '2026-Q4', null, 'approved', '2026-10-06', null, 'AI pilots and data clean-up for quality records.'],
  ['w-instr-01', 10, '2026-Q4', null, 'approved', '2026-10-06', null, 'XR and AI search for training material.'],
  ['w-corp-01', 10, '2026-Q4', null, 'approved', '2026-10-06', null, 'Data office and ESG knowledge capture.'],
  ['w-lo-03', 10, '2026-Q4', null, 'approved', '2026-10-07', null, 'Electronic rounds pilot.'],
  ['w-eng-04', 10, '2027-Q1', null, 'requested', null, null, 'Advanced reactor study in the first quarter.'],
];
// [person, gig, note, poster decision ('selected' | null)]
const APPS = [
  ['p-sme-reviewer', 'fg-adv-licensing-compare', 'I review design changes and would like to see how new designs are licensed.', null],
  ['p-fuel-pm', 'fg-adv-passive-safety-digest', 'Fuel and passive safety interest me for future designs.', 'selected'],
  ['p-cap-coord', 'fg-kc-digital-indications', 'I can help structure interview notes.', null],
  ['p-cap-coord', 'fg-ai-cap-triage-review', 'I screen condition reports every day.', null],
  ['w-eng-01', 'fg-ai-chem-trend-flags', '', null],
  ['w-eng-01', 'fg-adv-passive-safety-digest', 'Over my envelope, so this one goes to my manager.', null],
  ['w-eng-02', 'fg-data-equipment-tags', '', 'selected'],
  ['w-eng-03', 'fg-adv-licensing-compare', '', 'selected'],
  ['w-eng-03', 'fg-ai-training-search', '', null],
  ['w-mnt-01', 'fg-dig-erounds-pilot', '', 'selected'],
  ['w-mnt-02', 'fg-data-training-records', '', null],
  ['w-ro-03', 'fg-ai-cap-triage-review', '', 'selected'],
  ['w-ro-04', 'fg-kc-outage-handover', '', null],
  ['w-rp-01', 'fg-ai-chem-trend-flags', '', null],
  ['w-chem-01', 'fg-ai-training-search', '', 'selected'],
  ['w-qa-01', 'fg-data-training-records', '', null],
  ['w-instr-01', 'fg-dig-erounds-pilot', '', null],
  ['w-corp-01', 'fg-kc-waste-minimisation', '', null],
  ['w-lo-03', 'fg-dig-erounds-pilot', '', null],
  ['w-mnt-03', 'fg-data-equipment-tags', 'No envelope yet; my manager will decide.', null],
  ['w-eng-05', 'fg-dig-twin-validation', '', 'released'], // no envelope: released per gig by the skip-level manager (the poster is the line manager)
];

// ───────────── FS28 future-role rotation templates (F15 shape) and secondments
const O = (skill_id, level, text_en, text_ar) => ({ skill_id, level, text_en, text_ar });
const SOURCES = {
  'nea-plan-2035': { label: 'OECD-NEA · Plan 2035 vision paper (NEST fellowships inside real projects)', url: 'https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf' },
  'nea-nest': { label: 'OECD-NEA · NEST Framework: five years of international co-operation', url: 'https://oecd-nea.org/jcms/pl_98798/nest-framework-five-years-of-international-co-operation-on-nuclear-education-and-skills-development' },
  'smr-wf': { label: 'ANS · Education and training to support the Canadian nuclear workforce (SMR workforce models)', url: 'https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/' },
  'enen2plus': { label: 'CORDIS · ENEN2plus: nuclear education and training mobility', url: 'https://cordis.europa.eu/project/id/101061677' },
};
const FUTURE_TEMPLATES = [
  {
    id: 'rt-fs-digital-twin', owner: 'p-training-mgr', track: 'digital_twin', roles: ['fr-digital-twin'], min: 9, max: 12, status: 'active', sources: ['nea-plan-2035', 'smr-wf'], eligible: ['engineering', 'operations', 'maintenance', 'training'],
    title_en: 'Future-role rotation: digital twin engineer', title_ar: 'تناوب نحو دور المستقبل: مهندس التوأم الرقمي',
    summary_en: 'Ten months across plant engineering, the simulator and digital training team, and work control, aimed at the digital twin engineer concept role. Every placement uses historical or exported data only; twins stay separate from plant control systems.',
    summary_ar: 'عشرة أشهر بين هندسة المحطة وفريق المحاكي والتدريب الرقمي والتحكم في الأعمال، موجّهة إلى الدور المفاهيمي لمهندس التوأم الرقمي. تستخدم كل مرحلة بيانات تاريخية أو مصدّرة فقط، وتبقى التوائم منفصلة عن أنظمة التحكم في المحطة.',
    steps: [
      { family_id: 'engineering', host_team_en: 'Plant engineering: performance monitoring', host_team_ar: 'هندسة المحطة: مراقبة الأداء', host_manager_id: 'p-ops-ceo', months: 4, site_induction: false, objectives: [
        O('sk-fs-ai-twin', 1, 'Explain what the condensate twin models and what it leaves out', 'شرح ما يمثّله توأم نظام المكثّفات وما يستثنيه'),
        O('sk-da-01-analysis', 2, 'Trend two performance indicators against the twin', 'متابعة مؤشرين للأداء مقارنة بالتوأم')] },
      { family_id: 'training', host_team_en: 'Simulator and digital training team', host_team_ar: 'فريق المحاكي والتدريب الرقمي', host_manager_id: 'p-training-mgr', months: 3, site_induction: false, objectives: [
        O('sk-fs-ai-twin', 2, 'Validate one twin scenario against simulator results', 'التحقق من سيناريو واحد للتوأم مقابل نتائج المحاكي'),
        O('sk-fs-ai-xr', 1, 'Storyboard one XR view of the twin for trainees', 'إعداد لوحة قصة لعرض واحد بالواقع الممتد للمتدربين')] },
      { family_id: 'operations', host_team_en: 'Work control: digital work packages', host_team_ar: 'التحكم في الأعمال: حزم الأعمال الرقمية', host_manager_id: 'p-work-control', months: 3, site_induction: false, objectives: [
        O('sk-fs-dp-ework', 2, 'Trace one digital work package from screening to close-out', 'تتبع حزمة عمل رقمية واحدة من الفرز حتى الإغلاق'),
        O('sk-fs-ai-anomaly', 1, 'Triage three twin divergence flags with an engineer', 'فرز ثلاث إشارات اختلاف للتوأم مع مهندس')] },
    ],
  },
  {
    id: 'rt-fs-data-office', owner: 'p-chco', track: 'data_office', roles: ['fr-remote-ops', 'fr-digital-twin'], min: 6, max: 9, status: 'active', sources: ['nea-plan-2035'], eligible: [],
    title_en: 'Future-role rotation: data office', title_ar: 'تناوب نحو دور المستقبل: مكتب البيانات',
    summary_en: 'Eight months in the data office, corrective action programme analytics and supply-chain digital records: data quality, governance and AI output checking for roles that will rely on plant data.',
    summary_ar: 'ثمانية أشهر في مكتب البيانات وتحليلات برنامج الإجراءات التصحيحية والسجلات الرقمية لسلسلة الإمداد: جودة البيانات وحوكمتها والتحقق من مخرجات الذكاء الاصطناعي للأدوار التي ستعتمد على بيانات المحطة.',
    steps: [
      { family_id: 'corporate', host_team_en: 'Data office: data quality and governance', host_team_ar: 'مكتب البيانات: جودة البيانات وحوكمتها', host_manager_id: 'p-group-cfo', months: 3, site_induction: false, objectives: [
        O('sk-fs-ai-data-care', 2, 'Write the quality rules for one shared dataset', 'كتابة قواعد الجودة لمجموعة بيانات مشتركة واحدة'),
        O('sk-fs-ai-dataeng', 1, 'Build a repeatable clean-up script with a reviewer', 'إعداد برنامج تنظيف قابل للتكرار مع مراجِع')] },
      { family_id: 'oversight', host_team_en: 'Corrective action programme analytics', host_team_ar: 'تحليلات برنامج الإجراءات التصحيحية', host_manager_id: 'p-cap-chair', months: 3, site_induction: false, objectives: [
        O('sk-fs-ai-verify', 2, 'Check a month of AI-suggested categories and report errors', 'مراجعة تصنيفات شهر كامل مقترحة آلياً والإبلاغ عن الأخطاء'),
        O('sk-fs-ai-plantdata', 1, 'Trend one corrective-action indicator', 'متابعة اتجاه مؤشر واحد للإجراءات التصحيحية')] },
      { family_id: 'quality', host_team_en: 'Supply-chain digital records', host_team_ar: 'السجلات الرقمية لسلسلة الإمداد', host_manager_id: 'p-head-sq', months: 2, site_induction: false, objectives: [
        O('sk-fs-dp-procurement', 2, 'Map one supplier record from order to receipt inspection', 'تتبع سجل مورد واحد من الطلب حتى فحص الاستلام')] },
    ],
  },
  {
    id: 'rt-fs-advance-study', owner: 'p-chco', track: 'advance_study', roles: ['fr-adv-licensing', 'fr-owners-engineer', 'fr-bwr-operator'], min: 6, max: 12, status: 'active', sources: ['smr-wf', 'nea-nest'], eligible: ['engineering', 'licensing', 'operations', 'training', 'nuclear-fuel'],
    title_en: 'Future-role rotation: ADVANCE study team (career level only)', title_ar: 'تناوب نحو أدوار المستقبل: فريق دراسات ADVANCE (على مستوى المسار المهني فقط)',
    summary_en: 'Ten months of study work on new reactor technologies across regulatory affairs, engineering and the instructor team. This is career-level study only: no deployment decision is implied, and nothing here plans a location or staffing numbers.',
    summary_ar: 'عشرة أشهر من العمل الدراسي حول تقنيات المفاعلات الجديدة بين الشؤون التنظيمية والهندسة وفريق المدربين. هذه دراسة على مستوى المسار المهني فقط: لا يعني ذلك أي قرار بالنشر، ولا يُخطط لأي موقع أو أعداد موظفين.',
    steps: [
      { family_id: 'licensing', host_team_en: 'Regulatory affairs: new-design study desk', host_team_ar: 'الشؤون التنظيمية: مكتب دراسة التصاميم الجديدة', host_manager_id: 'p-dra', months: 4, site_induction: false, objectives: [
        O('sk-fs-adv-regulation', 1, 'Summarise how three regulators describe new-design licensing', 'تلخيص كيفية وصف ثلاث جهات رقابية لترخيص التصاميم الجديدة'),
        O('sk-fs-adv-smr', 1, 'Explain the main SMR design families in plain language', 'شرح العائلات الرئيسية لتصاميم المفاعلات المعيارية الصغيرة بلغة واضحة')] },
      { family_id: 'engineering', host_team_en: 'Engineering: reactor technology watch', host_team_ar: 'الهندسة: رصد تقنيات المفاعلات', host_manager_id: 'p-ops-ceo', months: 4, site_induction: false, objectives: [
        O('sk-fs-adv-passive', 1, 'Write a digest on passive safety features', 'كتابة ملخص عن خصائص السلامة السلبية'),
        O('sk-fs-adv-fuelcycle', 1, 'Compare two published fuel-cycle options', 'مقارنة خيارين منشورين لدورة الوقود')] },
      { family_id: 'training', host_team_en: 'Instructor team: plant literacy for new designs', host_team_ar: 'فريق المدربين: الإلمام بالمحطات للتصاميم الجديدة', host_manager_id: 'p-training-mgr', months: 2, site_induction: false, objectives: [
        O('sk-fs-adv-micro', 1, 'Draft a one-page explainer on microreactors', 'إعداد شرح من صفحة واحدة عن المفاعلات الصغرية')] },
    ],
  },
  {
    id: 'rt-fs-energy-transition', owner: 'p-training-mgr', track: 'energy_transition', roles: ['fr-process-heat'], min: 6, max: 9, status: 'draft', sources: ['nea-plan-2035'], eligible: [],
    title_en: 'Future-role rotation: energy transition and process heat (draft)', title_ar: 'تناوب نحو دور المستقبل: تحول الطاقة والحرارة الصناعية (مسودة)',
    summary_en: 'Draft: six months across chemistry and the sustainability office, aimed at the process-heat integration engineer concept role. Study work only; no deployment decision implied.',
    summary_ar: 'مسودة: ستة أشهر بين الكيمياء ومكتب الاستدامة، موجّهة إلى الدور المفاهيمي لمهندس تكامل الحرارة الصناعية. عمل دراسي فقط؛ لا يعني أي قرار بالنشر.',
    steps: [
      { family_id: 'chemistry', host_team_en: 'Chemistry: hydrogen and process-heat study', host_team_ar: 'الكيمياء: دراسة الهيدروجين والحرارة الصناعية', host_manager_id: 'p-chem-sup', months: 3, site_induction: false, objectives: [
        O('sk-fs-gr-h2heat', 1, 'Summarise published hydrogen production routes using heat', 'تلخيص طرق إنتاج الهيدروجين المنشورة باستخدام الحرارة'),
        O('sk-fs-gr-ghg', 1, 'Explain the plant greenhouse-gas inventory boundaries', 'شرح حدود حصر انبعاثات غازات الدفيئة للمحطة')] },
      { family_id: 'corporate', host_team_en: 'Sustainability office', host_team_ar: 'مكتب الاستدامة', host_manager_id: 'p-group-cfo', months: 3, site_induction: false, objectives: [
        O('sk-fs-gr-esg', 1, 'Map one ESG disclosure to its data source', 'ربط إفصاح واحد للحوكمة البيئية والاجتماعية بمصدر بياناته'),
        O('sk-fs-gr-lifecycle', 1, 'Read a life-cycle assessment and list its assumptions', 'قراءة تقييم دورة حياة وسرد افتراضاته')] },
    ],
  },
];

// [id, person, host_kind, org, host_en, host_ar, country, sup_en, sup_ar, track, future_role, start, months, status, returned_on, capture_status, objectives]
const SO = (skill_id, level, text_en, text_ar) => ({ skill_id, level, text_en, text_ar });
const SECONDMENTS = [
  ['sec-iaea-ne-01', 'w-eng-01', 'iaea', 'iaea', 'IAEA Department of Nuclear Energy (Vienna)', 'قسم الطاقة النووية في الوكالة الدولية للطاقة الذرية (فيينا)', 'AT', 'Section head, nuclear power engineering (host role)', 'رئيس قسم هندسة القوى النووية (دور مضيف)', 'advance_study', 'fr-owners-engineer', '2026-03-01', 6, 'returned', '2026-08-31', 'held',
    [SO('sk-fs-adv-smr', 2, 'Contribute to a technical meeting report on SMR deployment readiness', 'المساهمة في تقرير اجتماع فني حول جاهزية المفاعلات المعيارية الصغيرة'), SO('sk-fs-tr-crosscultural', 2, 'Work in a multinational project team', 'العمل ضمن فريق مشروع متعدد الجنسيات')]],
  ['sec-khnp-ops-01', 'w-ro-05', 'partner_utility', 'khnp', 'Partner utility operations training centre (Korea)', 'مركز تدريب العمليات لدى المرفق الشريك (كوريا)', 'KR', 'Lead simulator instructor (host role)', 'كبير مدربي المحاكي (دور مضيف)', null, null, '2026-04-01', 4, 'returned', '2026-07-31', 'planned',
    [SO('sk-ld-01-instruct', 2, 'Co-deliver two simulator scenarios with host instructors', 'المشاركة في تقديم سيناريوهين على المحاكي مع مدربي الجهة المضيفة'), SO('sk-fs-tr-crosscultural', 1, 'Compare crew briefing practice across utilities', 'مقارنة ممارسات إحاطة الأطقم بين المرافق')]],
  ['sec-ku-twin-01', 'w-eng-02', 'university', 'ku', 'Khalifa University research group (Abu Dhabi)', 'مجموعة بحثية في جامعة خليفة (أبوظبي)', 'AE', 'Principal investigator, energy systems (host role)', 'الباحث الرئيسي، أنظمة الطاقة (دور مضيف)', 'digital_twin', 'fr-digital-twin', '2026-05-03', 3, 'returned', '2026-08-02', 'held',
    [SO('sk-fs-ai-twin', 2, 'Validate a reduced-order twin against published data', 'التحقق من توأم مبسّط مقابل بيانات منشورة'), SO('sk-fs-ai-dataeng', 1, 'Prepare a clean dataset for the research group', 'إعداد مجموعة بيانات نظيفة للمجموعة البحثية')]],
  ['sec-epri-data-01', 'w-mnt-04', 'research_centre', 'epri', 'Industry research institute, equipment reliability programme (US)', 'معهد أبحاث القطاع، برنامج موثوقية المعدات (الولايات المتحدة)', 'US', 'Program manager, equipment reliability (host role)', 'مدير برنامج موثوقية المعدات (دور مضيف)', 'data_office', null, '2026-04-06', 5, 'returned', '2026-09-04', 'planned',
    [SO('sk-fs-ai-plantdata', 2, 'Analyse a shared failure-data set with the host team', 'تحليل مجموعة بيانات أعطال مشتركة مع فريق الجهة المضيفة'), SO('sk-fs-dp-robotics', 1, 'Review robotics inspection case studies', 'مراجعة دراسات حالة الفحص بالروبوتات')]],
  ['sec-fuel-vendor-01', 'p-fuel-pm', 'vendor', 'kepco-nf', 'Fuel vendor engineering office (Korea)', 'مكتب هندسة مورد الوقود (كوريا)', 'KR', 'Fuel design engineering lead (host role)', 'قائد هندسة تصميم الوقود (دور مضيف)', 'advance_study', 'fr-adv-fuel', '2026-07-05', 3, 'planned', null, null,
    [SO('sk-fs-adv-fuelcycle', 2, 'Join a fuel-design review as an observer and summarise it', 'حضور مراجعة تصميم وقود بصفة مراقب وتلخيصها'), SO('sk-fs-adv-factoryqa', 1, 'Walk through the vendor quality plan for fuel assemblies', 'استعراض خطة جودة المورد لمجمّعات الوقود')]],
  ['sec-inl-micro-01', 'w-eng-03', 'research_centre', 'inl', 'National laboratory advanced reactor programme (US)', 'برنامج المفاعلات المتقدمة في مختبر وطني (الولايات المتحدة)', 'US', 'Advanced reactor programme lead (host role)', 'قائد برنامج المفاعلات المتقدمة (دور مضيف)', 'advance_study', 'fr-liquid-metal', '2026-08-03', 6, 'planned', null, null,
    [SO('sk-fs-adv-micro', 2, 'Contribute to a microreactor test-plan review', 'المساهمة في مراجعة خطة اختبار لمفاعل صغري'), SO('sk-fs-adv-passive', 1, 'Summarise passive heat-removal test results', 'تلخيص نتائج اختبارات إزالة الحرارة السلبية')]],
  ['sec-kaist-ai-01', 'w-eng-04', 'university', 'kaist', 'University nuclear engineering department (Korea)', 'قسم الهندسة النووية في جامعة (كوريا)', 'KR', 'Professor, AI for nuclear systems (host role)', 'أستاذ الذكاء الاصطناعي للأنظمة النووية (دور مضيف)', 'digital_twin', 'fr-digital-twin', '2026-09-01', 4, 'planned', null, null,
    [SO('sk-fs-ai-anomaly', 2, 'Test an anomaly-detection method on a public benchmark', 'اختبار طريقة لرصد الحالات الشاذة على مجموعة بيانات مرجعية عامة'), SO('sk-fs-ai-verify', 2, 'Document how model outputs are checked before use', 'توثيق كيفية التحقق من مخرجات النموذج قبل استخدامها')]],
  ['sec-iaea-km-01', 'w-instr-02', 'iaea', 'iaea', 'IAEA nuclear knowledge management section (Vienna)', 'قسم إدارة المعرفة النووية في الوكالة الدولية للطاقة الذرية (فيينا)', 'AT', 'Knowledge management officer (host role)', 'مسؤول إدارة المعرفة (دور مضيف)', null, null, '2026-09-07', 6, 'planned', null, null,
    [SO('sk-fs-tr-curiosity', 2, 'Help run a knowledge-capture workshop for member states', 'المساعدة في تنظيم ورشة لالتقاط المعرفة للدول الأعضاء'), SO('sk-ld-01-coach', 2, 'Coach two workshop facilitators', 'توجيه اثنين من ميسّري الورشة')]],
  ['sec-vendor-ic-01', 'w-mnt-05', 'vendor', 'doosan', 'Component vendor digital I&C workshop (Korea)', 'ورشة الأجهزة والتحكم الرقمية لدى مورد المكونات (كوريا)', 'KR', 'Digital I&C test lead (host role)', 'قائد اختبارات الأجهزة والتحكم الرقمية (دور مضيف)', 'digital_twin', null, '2026-06-01', 5, 'planned', null, null,
    [SO('sk-fs-dp-dic', 2, 'Take part in factory acceptance tests of digital cabinets', 'المشاركة في اختبارات القبول في المصنع للخزائن الرقمية')]],
  ['sec-wna-esg-01', 'w-corp-02', 'research_centre', 'wna', 'International industry association, sustainability working group (London)', 'رابطة صناعية دولية، فريق عمل الاستدامة (لندن)', 'GB', 'Working group secretary (host role)', 'أمين فريق العمل (دور مضيف)', 'energy_transition', 'fr-process-heat', '2026-09-14', 3, 'planned', null, null,
    [SO('sk-fs-gr-esg', 2, 'Draft a section of a sustainability reporting guide', 'إعداد قسم من دليل لإعداد تقارير الاستدامة'), SO('sk-fs-gr-climaterisk', 1, 'Summarise published climate-risk practice for nuclear plants', 'تلخيص الممارسات المنشورة لمخاطر المناخ في المحطات النووية')]],
  ['sec-sme-khnp-01', 'p-sme-reviewer', 'partner_utility', 'khnp', 'Partner utility design engineering office (Korea)', 'مكتب هندسة التصميم لدى المرفق الشريك (كوريا)', 'KR', 'Design engineering manager (host role)', 'مدير هندسة التصميم (دور مضيف)', 'digital_twin', 'fr-digital-twin', '2026-11-08', 3, 'planned', null, null,
    [SO('sk-en-01-mods', 3, 'Review two design changes with the host design team', 'مراجعة تعديلين تصميميين مع فريق التصميم المضيف'), SO('sk-fs-ai-twin', 1, 'See how the host uses design models in change reviews', 'التعرف على استخدام الجهة المضيفة لنماذج التصميم في مراجعات التعديلات')]],
  ['sec-kro-khnp-01', 'p-k-ro', 'partner_utility', 'khnp', 'Partner utility operations training centre (Korea)', 'مركز تدريب العمليات لدى المرفق الشريك (كوريا)', 'KR', 'Operations training manager (host role)', 'مدير تدريب العمليات (دور مضيف)', null, null, '2027-01-10', 2, 'planned', null, null,
    [SO('sk-ld-01-instruct', 1, 'Observe continuing-training sessions for licensed operators', 'حضور جلسات التدريب المستمر للمشغّلين المرخّصين'), SO('sk-fs-tr-crosscultural', 1, 'Compare shift turnover practice across utilities', 'مقارنة ممارسات تسليم الوردية بين المرافق')]],
  ['sec-kings-01', 'w-rp-02', 'university', 'kings', 'Nuclear graduate school, short course and research project (Korea)', 'كلية الدراسات العليا النووية، دورة قصيرة ومشروع بحثي (كوريا)', 'KR', 'Programme director (host role)', 'مدير البرنامج (دور مضيف)', null, null, '2027-02-07', 4, 'planned', null, null,
    [SO('sk-rp-01-dose', 2, 'Complete a research project on dose-reduction planning', 'إنجاز مشروع بحثي حول تخطيط خفض الجرعات'), SO('sk-fs-ai-dataeng', 1, 'Prepare the project data set', 'إعداد مجموعة بيانات المشروع')]],
  ['sec-gevh-01', 'w-eng-05', 'vendor', 'ge-vernova-hitachi', 'Reactor vendor small BWR training team (US)', 'فريق التدريب على المفاعلات الصغيرة بالماء المغلي لدى مورد المفاعلات (الولايات المتحدة)', 'US', 'Training programme lead (host role)', 'قائد برنامج التدريب (دور مضيف)', 'advance_study', 'fr-bwr-operator', '2027-03-07', 3, 'planned', null, null,
    [SO('sk-fs-adv-smr', 2, 'Follow the vendor plant-literacy course for a small BWR design', 'متابعة دورة الإلمام بالمحطة لدى المورد لتصميم مفاعل صغير بالماء المغلي')]],
  ['sec-iaea-cancel-01', 'w-qa-02', 'iaea', 'iaea', 'IAEA quality management review mission support (Vienna)', 'دعم بعثة مراجعة إدارة الجودة في الوكالة الدولية للطاقة الذرية (فيينا)', 'AT', 'Mission coordinator (host role)', 'منسق البعثة (دور مضيف)', null, null, '2026-11-15', 2, 'cancelled', null, null,
    [SO('sk-qa-02', 2, 'Support the preparation of a review mission', 'دعم التحضير لبعثة مراجعة')]],
  ['sec-ku-green-01', 'w-chem-02', 'university', 'ku', 'Khalifa University hydrogen research group (Abu Dhabi)', 'مجموعة أبحاث الهيدروجين في جامعة خليفة (أبوظبي)', 'AE', 'Research group lead (host role)', 'قائد المجموعة البحثية (دور مضيف)', 'energy_transition', 'fr-process-heat', '2026-07-12', 3, 'returned', '2026-10-08', 'planned',
    [SO('sk-fs-gr-h2heat', 2, 'Run a literature review on high-temperature electrolysis', 'إجراء مراجعة أدبيات حول التحليل الكهربائي عالي الحرارة'), SO('sk-fs-tr-environment', 1, 'Present the review to the chemistry team', 'عرض المراجعة على فريق الكيمياء')]],
];

// FINALIZE_LAST: the FS02 future skills are added by fs02-catalogue finalize(), so everything here runs in finalize(), after fs02 and
// before the wave-QA builders. No skill evidence is written, so the F01 states are unchanged.
export const FINALIZE_LAST = true;
export function finalize(T) {
  T.time_envelopes ??= [];
  T.secondments ??= [];
  const people = new Map(T.people.map((p) => [p.id, p]));
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const notify = (id, person, en, ar, link, severity, created) => {
    if (!people.get(person)?.persona_id) return; // notices only for demo role cards
    if (T.notifications.some((n) => n.id === id)) return;
    T.notifications.push({ id, person_id: person, kind: 'opportunity', title_en: en, title_ar: ar, body_en: null, body_ar: null, link, severity, created_at: created, read_at: null });
  };

  // ── FS27 gigs
  GIGS.forEach(([id, poster, channel, kind, location_type, hours_week, start_on, end_on, seats, needed, gained, flags, title_en, title_ar, summary_en, summary_ar], i) => {
    const p = people.get(poster);
    if (!p) throw new Error(`fs27: unknown poster ${poster}`);
    for (const s of [...needed, ...gained]) if (!skills.has(s)) throw new Error(`fs27: unknown skill ${s} on ${id}`);
    const bad = channelProblem(channel, gained, T.skills);
    if (bad) throw new Error(`fs27: ${id}: ${bad.message}`);
    const created = '2026-10-09'; // the FS27 channel opens the day after the demo digest date (2026-10-08), so seeded digests stay as they are
    T.opportunities.push({
      id, posted_by: poster, org_id: p.org_id ?? null, family_id: p.job_family_id ?? null, host_role_id: p.job_role_id ?? null, host_team: p.team_id ?? null,
      kind, title_en, title_ar, summary_en, summary_ar, skills_needed: needed, skills_gained: gained, hours_week, start_on, end_on, seats, seats_taken: 0, location_type,
      eligible_families: [], priority_flags: flags, status: 'open', listed: true, created_at: ts(created, 7), updated_at: ts(created, 7), channel,
    });
  });
  const gigs = new Map(T.opportunities.map((o) => [o.id, o]));
  if (CHANNELS.some((c) => T.opportunities.filter((o) => o.channel === c && o.status === 'open').length < 2)) throw new Error('fs27: a channel has fewer than two open gigs');

  // ── FS27 envelopes
  ENVELOPES.forEach(([pid, pct, period, channels, status, decided, note, reason], i) => {
    const p = people.get(pid);
    if (!p) throw new Error(`fs27: unknown person ${pid}`);
    const ch = sortChannels(channels ?? [...CHANNELS]);
    const bad = validateEnvelope({ pct, period, channels: ch, reason }, '2026-10-01');
    if (bad) throw new Error(`fs27: envelope ${pid}: ${bad.message}`);
    const lm = lineManagerOf(pid, T.people, T.role_assignments, AS_OF);
    if (!lm) throw new Error(`fs27: no line manager for ${pid}`);
    const b = quarterBounds(period);
    const id = `env-${pid}-${period.toLowerCase()}`;
    const created = `2026-09-${String(22 + (i % 8)).padStart(2, '0')}`;
    const history = [{ at: ts(created, 10), status: 'requested', by: pid, note: reason }];
    if (status === 'approved' || status === 'declined') history.push({ at: ts(decided, 14), status, by: lm, note });
    if (status === 'withdrawn') history.push({ at: ts('2026-09-30', 11), status: 'withdrawn', by: pid, note: null });
    T.time_envelopes.push({
      id, person_id: pid, line_manager_id: lm, approver_id: status === 'approved' ? lm : null, pct, cap_hours: capHours(pct), period, starts_on: b.start, ends_on: b.end,
      channels: ch, reason, status, decision_note: note, decided_at: decided ? ts(decided, 14) : null,
      person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, person_role_id: p.job_role_id ?? null, person_family_id: p.job_family_id ?? null,
      history, open_read: false, created_at: ts(created, 10), updated_at: history[history.length - 1].at,
    });
    if (status === 'requested') notify(`nt-${id}-requested`, lm, `Time envelope request: ${p.display_name} (${pct}% in ${period})`, `طلب وقت مخصص: ${p.display_name_ar || p.display_name} (${pct}% في ${period})`, '/opportunities/envelopes', 'info', ts(created, 10));
    if (status === 'approved') notify(`nt-${id}-approved`, pid, `Time envelope approved: ${pct}% in ${period}`, `تمت الموافقة على الوقت المخصص: ${pct}% في ${period}`, '/opportunities/envelope', 'ok', ts(decided, 14));
    if (status === 'declined') notify(`nt-${id}-declined`, pid, `Time envelope declined: ${period}`, `رُفض الوقت المخصص: ${period}`, '/opportunities/envelope', 'warn', ts(decided, 14));
  });

  // ── FS27 applications (same rule as both backends: inside an approved envelope = released at once)
  APPS.forEach(([pid, gid, note, decision], i) => {
    const o = gigs.get(gid);
    const p = people.get(pid);
    if (!o || !p) throw new Error(`fs27: bad application ${pid} ${gid}`);
    const r = releaserFor(pid, o.posted_by, T.people, T.role_assignments, AS_OF);
    if (!r.releaser) throw new Error(`fs27: no releaser for ${pid}`);
    const fit = envelopeFit(pid, o, T.time_envelopes, T.opportunity_applications, gigs, AS_OF);
    const env = fit.fits ? T.time_envelopes.find((e) => e.id === fit.envelope_id) : null;
    const day = i < 11 ? '2026-10-09' : '2026-10-10';
    const at = ts(day, 9 + (i % 6));
    const id = `oa-${gid.replace(/^fg-/, 'fg-')}-${pid}`;
    const history = [{ at, status: 'applied', by: pid, note: note || null }];
    const row = {
      id, opportunity_id: gid, person_id: pid, note, status: 'applied', history,
      applicant_name: p.display_name, applicant_name_ar: p.display_name_ar || p.display_name, applicant_role_id: p.job_role_id ?? null, applicant_family_id: p.job_family_id ?? null,
      poster_id: o.posted_by, line_manager_id: r.lineManager, releaser_id: r.releaser, skip_level: r.skipLevel,
      released_by: null, released_at: null, decided_by: null, decided_at: null, completed_at: null, outcome_note: null, outcome_levels: {}, evidence_ids: [],
      open_read: false, created_at: at, updated_at: at, envelope_id: null,
    };
    if (process.env.FS27_DEBUG && env) console.log('fs27 debug', id, fit.code, fit.used, fit.cap);
    if (env) {
      history.push({ at, status: 'released', by: env.approver_id, note: `Within the approved time envelope ${env.period} (${env.pct}%)` });
      Object.assign(row, { status: 'released', released_by: env.approver_id, released_at: at, envelope_id: env.id });
      if (decision === 'selected') {
        const dec = ts('2026-10-10', 16);
        history.push({ at: dec, status: 'selected', by: o.posted_by, note: null });
        Object.assign(row, { status: 'selected', decided_by: o.posted_by, decided_at: dec });
      }
      notify(`nt-${id}-released`, o.posted_by, `Applicant released (time envelope): ${o.title_en}`, `تم الإفراج عن متقدّم (وقت مخصص): ${o.title_ar}`, '/opportunities/manage', 'info', at);
    } else {
      if (process.env.FS27_DEBUG) console.log('fs27 debug', id, fit.code, fit.used, fit.cap);
      notify(`nt-${id}-applied`, r.releaser, `Release request: ${o.title_en}`, `طلب إفراج: ${o.title_ar}`, '/opportunities/manage', 'info', at);
      if (decision === 'released') {
        // the ordinary F08 path: one release decision for this one gig
        const rel = ts('2026-10-10', 11);
        history.push({ at: rel, status: 'released', by: r.releaser, note: null });
        Object.assign(row, { status: 'released', released_by: r.releaser, released_at: rel });
      }
    }
    row.updated_at = history[history.length - 1].at;
    T.opportunity_applications.push(row);
  });
  for (const o of T.opportunities.filter((x) => x.channel)) o.seats_taken = T.opportunity_applications.filter((a) => a.opportunity_id === o.id && (a.status === 'selected' || a.status === 'completed')).length;

  // ── FS28 future-role rotation templates (normalised by the F15 validator; tagged by the FS28 rule)
  const hosts = { people: T.people, assignments: T.role_assignments, today: AS_OF };
  const ref = { skills: T.skills, families: T.job_families.map((f) => f.id), roles: T.job_roles.map((r) => r.id), sources: Object.keys(SOURCES) };
  for (const t of FUTURE_TEMPLATES) {
    const v = validateTemplate({ programme: 'cross_functional', title_en: t.title_en, title_ar: t.title_ar, summary_en: t.summary_en, summary_ar: t.summary_ar, duration_min_months: t.min, duration_max_months: t.max, steps: t.steps, eligible_families: t.eligible, source_ids: t.sources, status: t.status }, ref, hosts);
    if ('code' in v) throw new Error(`fs28: template ${t.id}: ${v.message}`);
    const bad = validateTag({ template_id: t.id, track: t.track, future_role_ids: t.roles }, T.job_roles);
    if (bad) throw new Error(`fs28: tag ${t.id}: ${bad.message}`);
    T.rotation_templates.push({
      id: t.id, programme: 'cross_functional', owner_id: t.owner, title_en: t.title_en, title_ar: t.title_ar, summary_en: t.summary_en, summary_ar: t.summary_ar,
      duration_min_months: t.min, duration_max_months: t.max, steps: v.steps, eligible_families: t.eligible, sources: t.sources.map((s) => ({ id: s, ...SOURCES[s] })),
      status: t.status, listed: t.status !== 'draft', created_at: ts('2026-10-03', 9), updated_at: ts('2026-10-06', 9),
      future_track: t.track, future_role_ids: t.roles, career_level_only: t.track === 'advance_study',
    });
  }

  // ── FS28 secondments (+ the knowledge-capture session of each returned secondment)
  const orgs = T.organisations.map((o) => o.id);
  for (const [id, pid, host_kind, org, host_en, host_ar, country, sup_en, sup_ar, track, role, start_on, months, status, returned, capture, objectives] of SECONDMENTS) {
    const p = people.get(pid);
    const input = { person_id: pid, host_kind, host_org_id: org, host_name_en: host_en, host_name_ar: host_ar, host_country: country, supervisor_en: sup_en, supervisor_ar: sup_ar, objectives, future_role_id: role, track, start_on, months };
    const bad = validateSecondment(input, { people: T.people, skills: T.skills, roles: T.job_roles, orgs }, start_on);
    if (bad) throw new Error(`fs28: secondment ${id}: ${bad.message}`);
    const lm = lineManagerOf(pid, T.people, T.role_assignments, AS_OF);
    if (!lm) throw new Error(`fs28: no line manager for ${pid}`);
    const planned = start_on < '2026-08-01' ? '2026-02-15' : '2026-08-20';
    const objs = objectivesOf(objectives);
    const history = [{ at: ts(planned, 10), status: 'planned', by: 'p-chco', note: null }];
    const row = {
      id, person_id: pid, host_kind, host_org_id: org, host_name_en: host_en, host_name_ar: host_ar, host_country: country, supervisor_en: sup_en, supervisor_ar: sup_ar, objectives: objs,
      future_role_id: role, track, start_on, end_on: endOf(start_on, months), months, line_manager_id: lm, planned_by: 'p-chco', status, returned_on: null, closed_by: null, closed_at: null,
      outcome_note: null, objectives_met: {}, transfer_due_on: null, capture_session_id: null,
      person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, person_role_id: p.job_role_id ?? null, person_family_id: p.job_family_id ?? null,
      history, open_read: false, created_at: ts(planned, 10), updated_at: ts(planned, 10),
    };
    if (status === 'cancelled') {
      const note = 'Host mission postponed by the host organisation; to be re-planned next year.';
      history.push({ at: ts('2026-10-02', 12), status: 'cancelled', by: 'p-chco', note });
      Object.assign(row, { outcome_note: note, closed_by: 'p-chco', closed_at: ts('2026-10-02', 12) });
    }
    if (status === 'returned') {
      const due = transferDue(returned);
      const cs = `cs-sec-${id}`;
      const closedOn = returned < '2026-10-01' ? returned : '2026-10-09';
      const note = 'Objectives reviewed with the host supervisor; the main lessons are listed for the knowledge-capture session.';
      const met = Object.fromEntries(objs.map((o, k) => [o.id, k === 0 || objs.length === 1 || id !== 'sec-khnp-ops-01']));
      history.push({ at: ts(closedOn, 15), status: 'returned', by: 'p-chco', note });
      Object.assign(row, { returned_on: returned, outcome_note: note, objectives_met: met, transfer_due_on: due, capture_session_id: cs, closed_by: 'p-chco', closed_at: ts(closedOn, 15) });
      const plannedOn = capturePlannedOn(returned, closedOn);
      const held = capture === 'held';
      const lmP = people.get(lm);
      T.capture_sessions.push({
        id: cs, sme_id: pid, interviewer_id: lm, created_by: 'p-chco', template: 'critical_decisions', title: captureTitle(host_en), lang: 'en', status: held ? 'held' : 'planned',
        planned_on: plannedOn, held_on: held ? plannedOn : null, duration_min: 60, skill_ids: objs.map((o) => o.skill_id), standard_ids: [], position_id: null, action_id: null,
        transcript: '', transcript_words: 0, notes: `Return-and-transfer obligation for secondment ${id}; due by ${due}`, asset_id: null,
        sme_name: p.display_name, sme_name_ar: p.display_name_ar || p.display_name, interviewer_name: lmP.display_name, interviewer_name_ar: lmP.display_name_ar || lmP.display_name,
        history: held ? [{ at: ts(closedOn, 15), status: 'planned', by: 'p-chco', note: null }, { at: ts(plannedOn, 13), status: 'held', by: lm, note: null }] : [{ at: ts(closedOn, 15), status: 'planned', by: 'p-chco', note: null }],
        created_at: ts(closedOn, 15), updated_at: ts(held ? plannedOn : closedOn, held ? 13 : 15),
      });
    }
    row.updated_at = history[history.length - 1].at;
    T.secondments.push(row);
    if (status === 'planned' && start_on > AS_OF) notify(`nt-${id}-planned`, pid, `Secondment planned: ${host_en}`, `تم التخطيط لإعارة: ${host_ar}`, '/opportunities/secondments', 'ok', ts(planned, 10));
  }
  const fa = T.opportunity_applications.filter((a) => gigs.get(a.opportunity_id)?.channel);
  console.log(`fs27/28: ${T.opportunities.filter((o) => o.channel && o.status === 'open').length} open future gigs (${CHANNELS.map((c) => T.opportunities.filter((o) => o.channel === c).length).join('/')}), ${T.time_envelopes.length} envelopes, ${fa.length} applications (${fa.filter((a) => a.envelope_id).length} inside an envelope); ${FUTURE_TEMPLATES.filter((t) => t.status === 'active').length} future-role templates; ${T.secondments.length} secondments (${T.secondments.filter((s) => s.capture_session_id).length} capture sessions)`);
}
