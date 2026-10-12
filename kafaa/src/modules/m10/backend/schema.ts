// M10 extension tables (owner: FS wave G · E4, FS66 University programme alignment + FS67 Fellowships and sponsored placements).
// Merged into SCHEMA through src/data/ext/schema.ts (one-line hook, marked FS66). Same DSL as src/data/schema.ts; keep this file import-free
// except for `import type` (node scripts load it directly). The G3 M10 tables (scholar_cohorts, scholars, internships, research_*) stay in
// the M10 block of src/data/schema.ts.
//
//   programme_alignments   a university programme mapped to ENEC skills and levels, with its endorsement (FS66). Read: the owning university
//                          (partner_org OwnOrg on university_org_id; a partner university never sees another university's programmes),
//                          ENEC partnerships admins and auditors (partner_org R/A), and the recognition reviewers (recognition A: instructors,
//                          training manager, HR director; auditor R). Written only through rpc.saveProgramme / rpc.endorseProgramme.
//   programme_graduates    a graduate of a programme recorded by HR at hire, and whether validated evidence was written (FS66). Read: the
//                          graduate (own_profile Own) and HR (applications A: HR director; auditor R). rpc.recordGraduateHire only.
//   fellowships            NEST-style fellowships and sponsored study with placement (FS67), each with a host project and a supervisor role
//                          card. Read: the fellow and the supervisor (own_profile Own), the host university (partner_org OwnOrg), HR
//                          (applications A: HR director; auditor R) and partnerships admins (partner_org R/A). Staff see completion rates
//                          through rpc.fellowshipStats only.
//   fellowship_milestones  the five required milestones of each fellowship (same readers, columns copied from the fellowship).
import type { TableDef } from '../../../data/schema';

const FW_READ = [
  { res: 'own_profile', person: 'fellow_person_id' },
  { res: 'own_profile', person: 'supervisor_person_id' },
  { res: 'partner_org', org: 'university_org_id' },
  { res: 'applications' },
];

export const TABLES_M10: Record<string, TableDef> = {
  programme_alignments: {
    module: 'M10', label: 'University programme mapped to ENEC skills and levels, with coverage inputs and an INMA-style endorsement (FS66)',
    cols: {
      id: 'text pk', university_org_id: 'text ref:organisations idx', code: 'text', title_en: 'text', title_ar: 'text',
      degree: 'text enum:bachelor|master|diploma|doctorate|certificate', nqf_level: 'int?', field_en: 'text =\'\'', field_ar: 'text =\'\'',
      summary_en: 'text =\'\'', summary_ar: 'text =\'\'', target_role_ids: 'text[] =[]', skills: 'json =[]', placement: 'bool =false', accreditation_ref: 'text =\'\'',
      status: 'text enum:draft|submitted|endorsed|returned =\'draft\' idx', version: 'int =1',
      submitted_by: 'text?', submitted_at: 'ts?', decided_by: 'text?', decided_at: 'ts?', decision_note: 'text?', criteria: 'json ={}',
      covers_from: 'date?', valid_to: 'date?', coverage_snapshot: 'json?', history: 'json =[]', sample: 'bool =true',
      created_by: 'text?', updated_at: 'ts =now',
    },
    read: [{ res: 'partner_org', org: 'university_org_id' }, { res: 'recognition' }],
    write: { mode: 'rpc', res: 'frameworks' },
  },
  programme_graduates: {
    module: 'M10', label: 'Graduate of a university programme recorded at hire, with the evidence decision (FS66)',
    cols: {
      id: 'text pk', person_id: 'text ref:people idx', programme_id: 'text ref:programme_alignments idx', university_org_id: 'text ref:organisations',
      graduated_on: 'date', hired_on: 'date', status: 'text enum:evidence_written|awaiting_endorsement|not_covered idx', evidence_ids: 'text[] =[]',
      evidence_on: 'date?', recorded_by: 'text', recorded_at: 'ts =now', updated_at: 'ts =now',
    },
    read: [{ res: 'own_profile', person: 'person_id' }, { res: 'applications' }],
    write: { mode: 'rpc', res: 'applications' },
  },
  fellowships: {
    module: 'M10', label: 'NEST-style fellowship or sponsored study with placement: host project, supervisor role card, planned span (FS67)',
    cols: {
      id: 'text pk', kind: 'text enum:nest_fellowship|sponsored_study idx', title_en: 'text', title_ar: 'text',
      fellow_person_id: 'text ref:people idx', fellow_initials: 'text =\'\'', university_org_id: 'text? ref:organisations idx',
      host_kind: 'text enum:research_challenge|advance_study', host_ref: 'text', supervisor_person_id: 'text ref:people idx',
      supervisor_name_en: 'text =\'\'', supervisor_name_ar: 'text =\'\'', starts_on: 'date', ends_on: 'date', placement_en: 'text =\'\'', placement_ar: 'text =\'\'',
      status: 'text enum:active|completed|withdrawn =\'active\' idx', completed_on: 'date?', withdrawn_on: 'date?', withdraw_reason: 'text?',
      sample: 'bool =true', created_by: 'text?', created_at: 'ts =now', updated_at: 'ts =now',
    },
    read: FW_READ,
    write: { mode: 'rpc', res: 'ecosystem' },
  },
  fellowship_milestones: {
    module: 'M10', label: 'Required milestone of a fellowship: submitted by the fellow or university, signed off by the supervisor or HR (FS67)',
    cols: {
      id: 'text pk', fellowship_id: 'text ref:fellowships idx', fellow_person_id: 'text ref:people idx', university_org_id: 'text? ref:organisations idx',
      supervisor_person_id: 'text ref:people idx', n: 'int', kind: 'text', owner: 'text enum:enec|university', required: 'bool =true', due_on: 'date',
      status: 'text enum:planned|submitted|signed_off =\'planned\' idx', submitted_by: 'text?', submitted_at: 'ts?', note: 'text =\'\'',
      signed_by: 'text?', signed_at: 'ts?', return_note: 'text?', updated_at: 'ts =now',
    },
    read: FW_READ,
    write: { mode: 'rpc', res: 'ecosystem' },
  },
};
