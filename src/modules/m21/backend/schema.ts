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
// FS13 / FS14 (FS wave B · E4):
//   horizon_lanes        + kind (build | watch: the fusion lane is awareness only), milestone_ids, as_of: eleven lanes (Horizon lanes 2.0)
//   horizon_lane_links   lane -> FS02 skills, catalogue courses, ADVANCE tracks, training pathways, resources and gigs (public reference)
//   horizon_milestones   dated, sourced ENEC / UAE / international milestones the lanes are placed against (public reference)
//   future_track_progress my steps through an ADVANCE learning track; a completed track is learning evidence (level 1) in readiness v2
import type { TableDef } from '../../../data/schema';

const OWN = [{ res: 'own_profile', person: 'person_id' }];

export const TABLES_M21: Record<string, TableDef> = {
  horizon_lanes: {
    module: 'M21', label: 'Horizon roadmap lanes 2026-2035 with public sources (F09; no headcount, no sites)',
    cols: {
      id: 'text pk', code: 'text uniq', title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', why_en: 'text', why_ar: 'text',
      skill_ids: 'text[] =[]', horizon: 'text enum:now|next|later', path_only_role_ids: 'text[] =[]', role_ids: 'text[] =[]',
      sources: 'json =[]', sort: 'int =0',
      kind: "text enum:build|watch ='build'", milestone_ids: 'text[] =[]', as_of: 'date?', // FS14
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
  // ───────────── FS14 Horizon lanes 2.0
  horizon_lane_links: {
    module: 'M21', label: 'Horizon lane links: FS02 skills, courses, tracks, pathways, resources and gigs per lane (FS14)',
    cols: {
      id: 'text pk', lane_id: 'text ref:horizon_lanes idx', kind: 'text enum:skill|course|track|pathway|resource|gig idx', ref_id: 'text idx',
      level: 'int?', sort: 'int =0',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  horizon_milestones: {
    module: 'M21', label: 'Dated, sourced milestones the horizon lanes are placed against (FS14; no headcount, no sites)',
    cols: {
      id: 'text pk', year: 'int', month: 'int?', kind: 'text enum:enec|uae|international', title_en: 'text', title_ar: 'text',
      summary_en: 'text', summary_ar: 'text', sources: 'json =[]', sort: 'int =0',
    },
    read: [{ res: 'public_content' }], write: { mode: 'none' },
  },
  // ───────────── FS13 learning evidence for readiness v2
  future_track_progress: {
    module: 'M21', label: 'My steps through an ADVANCE learning track (own rows; a completed track is level-1 learning evidence) (FS13)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', track_id: 'text ref:adv_tracks idx', steps_done: 'json =[]',
      status: "text enum:in_progress|completed ='in_progress'", started_at: 'ts =now', completed_at: 'ts?', updated_at: 'ts =now',
    },
    read: OWN as TableDef['read'], write: { mode: 'rpc', res: 'own_profile' },
  },
};
