/** FS02 (future skills, wave A) acceptance: the extended catalogue with taxonomy attributes, cyber hygiene kept out of the
 *  security area, "obsolete, never delete", and a deterministic F01 recompute whose digest for the original 71 skills is
 *  unchanged. SQL side: scripts/validate/fs11-foundation.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { deriveStates, statesDigestText, type Evidence } from '../../src/domain/skills';
import { publicTextIsClean } from '../../src/domain/future';
import {
  FS_AREAS, LIFECYCLES, OWNER_ROLES, SKILL_GUARD_MSG, addMonthsIso, isPublishable, levelEssence, publishProblems, reviewState, skillGuard,
} from '../../src/domain/taxonomy';
import { hasKey } from '../../src/i18n';
import { F01_DIGEST_71 } from '../../scripts/validate/fs11-foundation.mjs';
import seed from '../../src/seed/seed.json';

const S = seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } };
const T = S.tables;
const skills = T.skills;
const fresh = skills.filter((s) => s.fs_area);
const original = skills.filter((s) => !s.fs_area);
let b: LocalBackend;
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('FS02 · catalogue size and completeness', () => {
  it('holds at least 110 skills, and 100% carry a source, owner, version, review date and lifecycle', () => {
    expect(skills.length).toBeGreaterThanOrEqual(110);
    for (const s of skills) {
      expect((s.sources as any[]).some((x) => /^https:\/\//.test(x.url)), `${s.id} source`).toBe(true);
      expect(OWNER_ROLES as readonly string[]).toContain(s.owner_role);
      expect(s.version).toBeGreaterThanOrEqual(1);
      expect(s.review_due, `${s.id} review`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(LIFECYCLES as readonly string[]).toContain(s.lifecycle);
      expect(s.level_essence_en && s.level_essence_ar, `${s.id} essence`).toBeTruthy();
    }
  });
  it('adds about 44 skills in the six future areas, each with EN/AR names, a level-essence line and 2+ alternative labels per language', () => {
    expect(fresh.length).toBeGreaterThanOrEqual(44);
    expect(new Set(fresh.map((s) => s.fs_area))).toEqual(new Set(FS_AREAS));
    for (const s of fresh) {
      expect(s.name_en && s.name_ar, s.id).toBeTruthy();
      expect(s.level_essence_en && s.level_essence_ar, s.id).toBeTruthy();
      expect(s.alt_labels_en.length, `${s.id} en`).toBeGreaterThanOrEqual(2);
      expect(s.alt_labels_ar.length, `${s.id} ar`).toBeGreaterThanOrEqual(2);
      expect(s.benchmark_ids.length, s.id).toBeGreaterThan(0);
      expect(/[؀-ۿ]/.test(s.name_ar) && /[؀-ۿ]/.test(s.level_essence_ar), `${s.id} Arabic`).toBe(true);
    }
    const transversal = fresh.filter((s) => s.fs_area === 'transversal').map((s) => s.name_en);
    for (const wef of ['Analytical thinking', 'Systems thinking', 'Resilience, flexibility and agility', 'Curiosity and lifelong learning', 'Creative thinking', 'Technological literacy', 'Leadership and social influence', 'Environmental stewardship']) expect(transversal).toContain(wef);
  });
  it('every published skill passes isPublishable(); only the obsolete one is held back, reachable by link', () => {
    const notReady = skills.filter((s) => !isPublishable(s));
    expect(notReady.map((s) => s.id)).toEqual(['sk-fs-dp-paperwp']);
    expect(publishProblems(notReady[0])).toEqual(['obsolete']);
  });
  it('the original 71 skills keep ids, codes, competencies, evidence keys and adjacency (only the new attributes were back-filled)', () => {
    expect(original.length).toBe(71);
    expect(createHash('md5').update(JSON.stringify(original.map((s) => s.id).sort())).digest('hex')).toBe('60401f16ef73c57472562846d4352dd1');
    expect(original.every((s) => s.fs_area === null && s.replaced_by === null)).toBe(true);
  });
  it('taxonomy labels exist in EN and AR for every value used', () => {
    for (const s of skills) {
      for (const k of [`fs.reusability.${s.reusability}`, `fs.skillType.${s.skill_type}`, `fs.lifecycle.${s.lifecycle}`, `fs.decay.${s.decay_class}`, `fs.owner.${s.owner_role}`, `fs.area.${s.fs_area ?? 'none'}`]) expect(hasKey(k), k).toBe(true);
      if (s.future_group) expect(hasKey(`fs.group.${s.future_group}`)).toBe(true);
    }
  });
});

describe('FS02 · cyber hygiene and advanced-reactor content rules', () => {
  it('no cyber_hygiene skill references a security-restricted task or the SA-01 security area', () => {
    const securityStandards = new Set(T.qual_standards.filter((q) => /secur/i.test(`${q.discipline} ${q.code} ${q.title_en ?? ''}`)).map((q) => q.id));
    const securityTasks = new Set(T.task_items.filter((t) => securityStandards.has(t.standard_id)).map((t) => t.id));
    const domainOf = new Map(T.competencies.map((c) => [c.id, c.domain]));
    const cyber = fresh.filter((s) => s.fs_area === 'cyber_hygiene');
    expect(cyber.length).toBeGreaterThanOrEqual(3);
    for (const s of cyber) {
      expect(s.competency_id).not.toBe('sa-01');
      expect(s.area).not.toBe('security');
      expect(domainOf.get(s.competency_id)).not.toBe('security');
      for (const k of s.evidence_keys) expect(securityStandards.has(k) || securityTasks.has(k), `${s.id} -> ${k}`).toBe(false);
      expect(`${s.description_en} ${s.level_essence_en}`).not.toMatch(/firewall|IP address|port \d|password is|clearance|guard post|vital area/i);
    }
  });
  it('advanced-reactor skills say no deployment decision is implied and carry no headcount or site text', () => {
    const adv = fresh.filter((s) => s.fs_area === 'advanced_reactor');
    expect(adv.length).toBeGreaterThanOrEqual(6);
    for (const s of adv) {
      expect(s.description_en).toContain('no deployment decision is implied');
      expect(publicTextIsClean([s.name_en, s.name_ar, s.description_en, s.description_ar, s.level_essence_en, s.level_essence_ar])).toBe(true);
    }
  });
});

describe('FS02 · F01 recompute stays deterministic', () => {
  it('the digest of the original 71 skills equals the pre-FS02 digest, and no future skill gains a derived state', async () => {
    const ids = new Set(original.map((s) => s.id));
    const states = T.person_skills;
    expect(states.every((s) => ids.has(s.skill_id))).toBe(true);
    expect(createHash('sha256').update(statesDigestText(states.filter((s) => ids.has(s.skill_id)))).digest('hex')).toBe(F01_DIGEST_71);
    const again = deriveStates(T.skill_evidence as Evidence[], S.meta.demo_today);
    expect(statesDigestText(again)).toBe(statesDigestText(states));
  });
  it('recomputeSkills on the LocalBackend gives the same digest twice', async () => {
    b.setPersona('training-mgr');
    await b.whenReady();
    const r1 = await b.rpc.recomputeSkills('p-k-ro');
    const r2 = await b.rpc.recomputeSkills('p-k-ro');
    expect(r1.ok && r2.ok).toBe(true);
    expect(r1.data?.digest).toBe(r2.data?.digest);
  });
});

describe('FS02 · obsolete, never delete (ESCO)', () => {
  it('rules: obsolete is final and dated, no self-replacement, versions only go up', () => {
    expect(skillGuard({ id: 'a', lifecycle: 'obsolete', version: 2 }, { id: 'a', lifecycle: 'stable', version: 3 })).toBe(SKILL_GUARD_MSG.unobsolete);
    expect(skillGuard({ id: 'a', lifecycle: 'stable', version: 1 }, { id: 'a', lifecycle: 'obsolete', version: 2 })).toBe(SKILL_GUARD_MSG.obsoleteDate);
    expect(skillGuard({ id: 'a', lifecycle: 'stable', version: 1 }, { id: 'a', lifecycle: 'obsolete', obsolete_on: '2026-10-10', replaced_by: 'a', version: 2 })).toBe(SKILL_GUARD_MSG.replacedSelf);
    expect(skillGuard({ id: 'a', lifecycle: 'stable', version: 3 }, { id: 'a', lifecycle: 'stable', version: 2 })).toBe(SKILL_GUARD_MSG.version);
    expect(skillGuard({ id: 'a', lifecycle: 'declining', version: 1 }, { id: 'a', lifecycle: 'obsolete', obsolete_on: '2026-10-10', replaced_by: 'b', version: 2 })).toBeNull();
  });
  it('no repository exposes a delete; the seeded superseded skill stays in the catalogue with its replacement', async () => {
    expect((b as unknown as Record<string, unknown>).delete).toBeUndefined();
    expect((b as unknown as Record<string, unknown>).remove).toBeUndefined();
    const s = await b.get('skills', 'sk-fs-dp-paperwp');
    expect(s?.lifecycle).toBe('obsolete');
    expect(s?.replaced_by).toBe('sk-fs-dp-ework');
    expect(s?.obsolete_on).toBe('2026-06-30');
  });
  it('direct writes: a framework owner marks a skill obsolete with a date; returning from obsolete is refused; staff cannot write', async () => {
    b.setPersona('sro');
    await b.whenReady();
    expect((await b.update('skills', 'sk-fs-dp-paperlog', { lifecycle: 'obsolete' as never, obsolete_on: '2026-10-10', version: 2 })).ok).toBe(false);
    b.setPersona('training-mgr');
    await b.whenReady();
    const noDate = await b.update('skills', 'sk-fs-dp-paperlog', { lifecycle: 'obsolete' as never, version: 2 });
    expect(noDate.ok).toBe(false);
    expect(noDate.message).toBe(SKILL_GUARD_MSG.obsoleteDate);
    const okR = await b.update('skills', 'sk-fs-dp-paperlog', { lifecycle: 'obsolete' as never, obsolete_on: '2026-10-10', replaced_by: 'sk-fs-dp-rounds', version: 2 });
    expect(okR.ok, okR.message).toBe(true);
    const back = await b.update('skills', 'sk-fs-dp-paperlog', { lifecycle: 'stable' as never, version: 3 });
    expect(back.ok).toBe(false);
    expect(back.message).toBe(SKILL_GUARD_MSG.unobsolete);
    const down = await b.update('skills', 'sk-fs-tr-systems', { version: 0 });
    expect(down.ok).toBe(false);
    expect((await b.list('skills')).length).toBe(skills.length);
    await b.reset();
  });
});

describe('FS01 · taxonomy helpers', () => {
  it('level essence, review state and month arithmetic', () => {
    expect(levelEssence(3, { en: 'Systems thinking', ar: 'التفكير المنظومي' }).en).toContain('systems thinking');
    expect(levelEssence(9).en).toMatch(/^Expert/);
    expect(levelEssence(0).ar).toMatch(/^إلمام/);
    expect(reviewState('2026-09-01', '2026-10-10')).toBe('overdue');
    expect(reviewState('2026-12-01', '2026-10-10')).toBe('due_soon');
    expect(reviewState('2027-06-01', '2026-10-10')).toBe('ok');
    expect(reviewState(null, '2026-10-10')).toBe('none');
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2026-11-15', 3)).toBe('2027-02-15');
  });
});
