/**
 * F37 Dalil career mode: the signed-in person's career context. Built once per session from the repository (RLS decides what the
 * caller can read: their own skill states, evidence, records, targets and applications; the public role, path, course and
 * opportunity catalogues), or from seed-shaped tables in tests and the release-gate evaluation. Nothing here reads anyone else's data.
 */
import type { Repository, Table } from '../../../data/types';
import { SCHEMA } from '../../../data/schema';
import type { CareerData } from '../../m18/career';
import type { Weights } from '../../../domain/engines/types';
import type { FutureCtx } from './future';

type Row = Record<string, any>;
export interface CareerTables {
  people: Row[]; job_roles: Row[]; career_paths: Row[]; role_competencies: Row[]; competencies: Row[]; skills: Row[]; person_skills: Row[]; skill_evidence: Row[];
  licences: Row[]; qual_records: Row[]; qual_standards: Row[]; programmes: Row[]; courses: Row[]; training_records: Row[]; enrolments: Row[]; sources: Row[];
  career_targets: Row[]; opportunities: Row[]; opportunity_applications: Row[]; engine_settings: Row[]; reco_optouts: Row[];
  /** FS76 (QA_B fix): published FS05 role profiles, so a concept role reads FS15 readiness. Optional for older callers. */
  role_profile_versions?: Row[];
}
export interface CareerCtx {
  now: string;
  me: string;
  person: Row;
  /** F05 input: the catalogue plus the person's own rows only. */
  data: CareerData;
  roles: Row[];
  competencies: Row[];
  skills: Row[];
  states: Row[];
  evidence: Row[];
  courses: Row[];
  done: Set<string>;
  edges: Row[];
  roleComps: Row[];
  programmes: Row[];
  sources: Row[];
  shortlist: string[];
  opps: Row[];
  applied: Set<string>;
  weights: { recommend?: Weights; match?: Weights };
  optouts: Set<string>;
  /** FS76: published FS05 role profiles (concept-role readiness). */
  versions: Row[];
  /** FS76: future-skills catalogues and my own future-skills rows (set by the caller; null when not loaded). */
  future?: FutureCtx | null;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Pure: the context from seed-shaped tables (tests, evaluation). Rows of other people are dropped here as RLS would. */
export function careerCtxFrom(t: CareerTables, me: string, now: string): CareerCtx | null {
  const person = t.people.find((p) => p.id === me);
  if (!person) return null;
  const mine = (rows: Row[]) => rows.filter((r) => r.person_id === me);
  const states = mine(t.person_skills).filter((s) => s.active !== false);
  const data: CareerData = {
    people: [person as never], roles: t.job_roles as never, edges: t.career_paths as never, roleComps: t.role_competencies as never, competencies: t.competencies as never, skills: t.skills as never,
    states: states as never, licences: mine(t.licences) as never, standards: t.qual_standards as never, qualRecords: mine(t.qual_records) as never, programmes: t.programmes as never,
    courses: t.courses as never, trainingRecords: mine(t.training_records) as never, enrolments: mine(t.enrolments) as never,
    weights: (t.engine_settings.find((s) => s.id === 'recommend')?.weights ?? undefined) as never,
  };
  const done = new Set(mine(t.training_records).filter((r) => r.result === 'passed' || r.result === 'completed').map((r) => String(r.course_id)));
  const shortlist = mine(t.career_targets).filter((x) => x.active !== false).sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0) || cmp(a.id, b.id)).map((x) => String(x.role_id));
  const applied = new Set(mine(t.opportunity_applications).filter((a) => a.status !== 'withdrawn').map((a) => String(a.opportunity_id)));
  return {
    now, me, person, data, roles: t.job_roles.filter((r) => r.status !== 'draft'), competencies: t.competencies, skills: t.skills, states, evidence: mine(t.skill_evidence).filter((e) => e.active !== false),
    courses: t.courses, done, edges: [...t.career_paths].sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || cmp(a.id, b.id)), roleComps: t.role_competencies, programmes: t.programmes, sources: t.sources,
    shortlist, opps: t.opportunities.filter((o) => o.status === 'open' && o.listed !== false && o.posted_by !== me), applied,
    weights: { recommend: t.engine_settings.find((s) => s.id === 'recommend')?.weights, match: t.engine_settings.find((s) => s.id === 'match')?.weights },
    optouts: new Set(mine(t.reco_optouts).filter((o) => o.opted_out).map((o) => String(o.surface))),
    versions: (t.role_profile_versions ?? []).filter((v) => v.status === 'published'),
  };
}

export const CAREER_TABLES: Table[] = ['role_profile_versions', 'person_skills', 'skill_evidence', 'career_targets', 'opportunities', 'opportunity_applications', 'reco_optouts', 'engine_settings', 'training_records', 'enrolments', 'qual_records', 'licences'] as Table[];

/** Through the repository (both backends; RLS applies). Tables of features that are not in the schema read as empty. */
export async function loadCareerCtx(repo: Repository, me: string, now: string): Promise<CareerCtx | null> {
  const has = (x: string) => Object.prototype.hasOwnProperty.call(SCHEMA, x);
  const safe = (tb: string, q?: object): Promise<Row[]> => (has(tb) ? (repo.list(tb as Table, q as never) as Promise<Row[]>).catch(() => []) : Promise.resolve([]));
  const own = { filter: { person_id: me } };
  const [people, job_roles, career_paths, role_competencies, competencies, skills, person_skills, skill_evidence, licences, qual_records, qual_standards, programmes, courses, training_records, enrolments,
    sources, career_targets, opportunities, opportunity_applications, engine_settings, reco_optouts] = await Promise.all([
    safe('people', { filter: { id: me } }), safe('job_roles', { order: [['sort', 'asc']] }), safe('career_paths'), safe('role_competencies'), safe('competencies'), safe('skills', { order: [['sort', 'asc']] }),
    safe('person_skills', own), safe('skill_evidence', own), safe('licences', own), safe('qual_records', own), safe('qual_standards'), safe('programmes', { order: [['sort', 'asc']] }), safe('courses'),
    safe('training_records', own), safe('enrolments', own), safe('sources'), safe('career_targets', own), safe('opportunities', { filter: { status: 'open' } }), safe('opportunity_applications', own),
    safe('engine_settings'), safe('reco_optouts', own),
  ]);
  const role_profile_versions = await safe('role_profile_versions', { filter: { status: 'published' } }); // FS76
  return careerCtxFrom({ people, job_roles, career_paths, role_competencies, competencies, skills, person_skills, skill_evidence, licences, qual_records, qual_standards, programmes, courses, training_records,
    enrolments, sources, career_targets, opportunities, opportunity_applications, engine_settings, reco_optouts, role_profile_versions }, me, now);
}
