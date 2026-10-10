/** Module catalogue: ownership groups for the parallel build (see CONTRACT.md). Tables come from src/data/schema.ts (`module`). */
import type { Group, ModuleId } from './types';

export interface ModuleMeta {
  id: ModuleId;
  group: Group;
  en: string;
  ar: string;
}
export const MODULES: Record<ModuleId, ModuleMeta> = {
  M01: { id: 'M01', group: 'G1', en: 'Career map and role catalogue', ar: 'خريطة المهن ودليل الأدوار' },
  M02: { id: 'M02', group: 'G1', en: 'Competency and qualification framework', ar: 'إطار الكفاءات والتأهيل' },
  M03: { id: 'M03', group: 'G1', en: 'Operator licensing support', ar: 'دعم ترخيص المشغّلين' },
  M04: { id: 'M04', group: 'G2', en: 'Learning and training management', ar: 'إدارة التعلم والتدريب' },
  M05: { id: 'M05', group: 'G2', en: 'Assessment and evaluation', ar: 'التقييم والاختبار' },
  M06: { id: 'M06', group: 'G3', en: 'Talent pipeline and programmes', ar: 'مسار المواهب والبرامج' },
  M07: { id: 'M07', group: 'G3', en: 'Workforce analytics and Emiratization', ar: 'تحليلات القوى العاملة والتوطين' },
  M08: { id: 'M08', group: 'G5', en: 'Safety culture and human performance', ar: 'ثقافة السلامة والأداء البشري' },
  M09: { id: 'M09', group: 'G4', en: 'Partners, suppliers and localisation', ar: 'الشركاء والموردون والتوطين' },
  M10: { id: 'M10', group: 'G3', en: 'Universities and research', ar: 'الجامعات والبحث' },
  M11: { id: 'M11', group: 'G4', en: 'Future workforce (ADVANCE)', ar: 'قوى المستقبل العاملة (ADVANCE)' },
  M12: { id: 'M12', group: 'G5', en: 'Public site and content', ar: 'الموقع العام والمحتوى' },
  M13: { id: 'M13', group: 'G5', en: 'Dalil, the governed AI guide', ar: 'دليل، المرشد الذكي المحوكم' },
  M14: { id: 'M14', group: 'G5', en: 'Identity, access and personal data', ar: 'الهوية والوصول والبيانات الشخصية' },
  M15: { id: 'M15', group: 'F', en: 'Bilingual experience (EN/AR)', ar: 'التجربة ثنائية اللغة' },
  M16: { id: 'M16', group: 'G5', en: 'Administration, audit and integrations', ar: 'الإدارة والتدقيق والتكاملات' },
  // F01 (wave 0): additional-features modules. group = the wave that first owns the folder (BACKLOG.md section 3).
  M17: { id: 'M17', group: 'W1', en: 'Skills Passport', ar: 'جواز المهارات' },
  M18: { id: 'M18', group: 'W1', en: 'Career Navigator', ar: 'مستكشف المسار المهني' },
  M19: { id: 'M19', group: 'W1', en: 'Learning Coach', ar: 'مدرّب التعلّم' },
  M20: { id: 'M20', group: 'W1', en: 'Opportunities (marketplace, rotations, alumni)', ar: 'الفرص (السوق الداخلي والتناوب والخبراء السابقون)' },
  M21: { id: 'M21', group: 'W1', en: 'Future Me (personal ADVANCE readiness and horizon)', ar: 'أنا في المستقبل (الجاهزية الشخصية لعصر ADVANCE والأفق)' },
  M22: { id: 'M22', group: 'W2', en: 'Leadership and communities', ar: 'القيادة ومجتمعات الممارسة' },
  M23: { id: 'M23', group: 'W3', en: 'Talent review and succession', ar: 'مراجعة المواهب والتعاقب الوظيفي' },
  M24: { id: 'M24', group: 'W3', en: 'Knowledge continuity', ar: 'استمرارية المعرفة' },
  M25: { id: 'M25', group: 'W4', en: 'Training effectiveness and needs', ar: 'فعالية التدريب واحتياجاته' },
  M26: { id: 'M26', group: 'W4', en: 'SAT and accreditation workbench', ar: 'منصة النهج المنهجي للتدريب والاعتماد' },
  M27: { id: 'M27', group: 'W4', en: 'Learning record store', ar: 'مخزن سجلات التعلّم' },
  // FS01 (future skills, wave A): group = the FS wave that first owns the folder (PLAN.md section 2).
  M28: { id: 'M28', group: 'FSB', en: 'Skills Intelligence', ar: 'ذكاء المهارات' },
  M29: { id: 'M29', group: 'FSB', en: 'AI and Digital Fluency', ar: 'الطلاقة في الذكاء الاصطناعي والتقنيات الرقمية' },
  M30: { id: 'M30', group: 'FSB', en: 'Role Transformation', ar: 'تحوّل الأدوار' },
  M31: { id: 'M31', group: 'FSE', en: 'Next-Gen Nuclear Readiness', ar: 'الجاهزية للجيل القادم من الطاقة النووية' },
  M32: { id: 'M32', group: 'FSE', en: 'Energy Transition Skills', ar: 'مهارات تحوّل الطاقة' },
  M33: { id: 'M33', group: 'FSC', en: 'Human Skills Studio', ar: 'استوديو المهارات الإنسانية' },
  M34: { id: 'M34', group: 'FSD', en: 'Recognition (RPL, NQF, credits)', ar: 'الاعتراف بالتعلّم (التعلّم السابق والإطار الوطني للمؤهلات والأرصدة)' },
  M35: { id: 'M35', group: 'FSF', en: 'Workforce Strategy and Disclosure', ar: 'استراتيجية القوى العاملة والإفصاح' },
  M36: { id: 'M36', group: 'FSG', en: 'Skills Ecosystem', ar: 'منظومة المهارات' },
  M37: { id: 'M37', group: 'FSG', en: 'National Alignment', ar: 'المواءمة الوطنية' },
};
