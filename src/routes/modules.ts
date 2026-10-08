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
};
