// M21 tables (owner: W1 · E5, F09 Future Me). Merged into SCHEMA by src/data/schema.ts; `npm run gen` regenerates types, SQL and RLS.
// Same DSL as src/data/schema.ts. Table names must not start with "kafaa_" (the prefix is added) and must be unique.
// Keep this file import-free except for `import type` (node scripts load it directly).
//
// F09 reads the M11 tables (adv_technologies, adv_skills, skill_bridges, future_roles, adv_tracks), the F01 skill state
// (person_skills, skills) and career_paths. Its own tables:
//   horizon_lanes     public trend lanes 2026-2035, each with "why it matters" and public sources (seeded; no headcount or site)
//   future_resources  public, source-linked learning suggestions for bridge plans: catalogue courses, ADVANCE tracks and
//                     partner programmes (KU MSc, NITSS summer school, SRC/GIEMS MoU capacity building)
//   future_interest   "I am interested in this technology / lane": the person's own rows only (direct, own); HR sees the
//                     aggregate (>= 10) through rpc.futureDemand
//   future_goals      "Add to my learning goals": coach targets handed to F07 (Learning Coach, M19), written by rpc.setFutureGoal
import type { TableDef } from '../../../data/schema';

const OWN = [{ res: 'own_profile', person: 'person_id' }];

export const TABLES_M21: Record<string, TableDef> = {
  horizon_lanes: {
    module: 'M21', label: 'Horizon roadmap lanes 2026-2035 with public sources (F09; no headcount, no sites)',
    cols: {
      id: 'text pk', code: 'text uniq', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', why_en: 'text', why_ar: 'text',
      skill_ids: 'text[] =[]', horizon: 'text enum:now|next|later', path_only_role_ids: 'text[] =[]', role_ids: 'text[] =[]',
      sources: 'json =[]', sort: 'int =0',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  future_resources: {
    module: 'M21', label: 'Source-linked learning suggestions for ADVANCE skill bridges (F09)',
    cols: {
      id: 'text pk', kind: 'text enum:course|track|programme|event|reading idx', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text',
      provider_en: 'text =\'\'', provider_ar: 'text =\'\'', tech_ids: 'text[] =[]', adv_skill_ids: 'text[] =[]', lane_ids: 'text[] =[]',
      course_id: 'text? ref:courses', track_id: 'text? ref:adv_tracks', org_id: 'text? ref:organisations', level: 'int =1', hours: 'num?',
      sources: 'json =[]', sort: 'int =0',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  future_interest: {
    module: 'M21', label: 'My interest in a technology family or horizon lane (own rows; HR sees the aggregate only) (F09)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', target_kind: 'text enum:tech|lane', tech_id: 'text? ref:adv_technologies', lane_id: 'text? ref:horizon_lanes',
      active: 'bool =true', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: OWN as TableDef['read'], write: { mode: 'direct', res: 'own_profile', own: true },
  },
  future_goals: {
    module: 'M21', label: 'Future Me learning goals handed to the Learning Coach as coach targets (F09 -> F07)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', kind: 'text enum:adv_skill|bridge|lane|future_role', ref_id: 'text idx', tech_id: 'text? ref:adv_technologies',
      lane_id: 'text? ref:horizon_lanes', skill_ids: 'text[] =[]', adv_skill_ids: 'text[] =[]', target_level: 'int =2', title_en: 'text', title_ar: 'text',
      status: 'text enum:active|removed =\'active\'', source: 'text =\'future_me\'', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: OWN as TableDef['read'], write: { mode: 'rpc', res: 'own_profile' },
  },
};
