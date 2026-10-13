/** Audit 2026-10-13 (final audit fixes): the TS side of the fixes. SQL mirrors: scripts/validate/audit2-fixes.mjs. */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { publicCourseHref } from '../../src/modules/m04/CourseLink';
import { preferredLangPath, translate } from '../../src/i18n';
import { composeDigest, dayKey, type DigestItem } from '../../src/shell/digest/rules';
import { BASIS_NOTE_AR, OPEN_ENROL } from '../../scripts/seed/ext/zz-audit2-integrity.mjs';

const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
const T = seed.tables as Record<string, Record<string, any>[]>;

describe('finding 3: course links on public pages', () => {
  it('links readable courses, sends signed-out visitors to sign-in for internal ones, plain text otherwise', () => {
    expect(publicCourseHref('c-1', { visible: true, signedIn: false })).toEqual({ kind: 'link', to: '/learn/course/c-1' });
    expect(publicCourseHref('c-adv-smr', { visible: false, signedIn: false })).toEqual({ kind: 'signin', to: '/sign-in?next=%2Flearn%2Fcourse%2Fc-adv-smr' });
    expect(publicCourseHref('c-adv-smr', { visible: false, signedIn: true })).toEqual({ kind: 'text' });
  });
  it('the five internal courses the audit found are internal in the seed', () => {
    for (const id of ['c-adv-smr', 'c-ai-gov', 'c-hu-ref', 'c-et-esg-clinic', 'c-et-ghg-mgr']) expect(T.courses.find((c) => c.id === id)?.public_summary).toBe(false);
  });
  it('signed out, the local backend returns only public courses (the visibility the link helper relies on)', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    b.setPersona(null);
    const rows = await b.list('courses', { filter: { id: ['c-adv-smr', 'c-ai-gov'] } });
    expect(rows).toHaveLength(0);
  });
});

describe('finding 4: owed approvals before future-dated ones (from FS75_FROM)', () => {
  const ap = (id: string, days: number | null, today: string): DigestItem => ({
    id, kind: 'approval', urgency: 2, ref_table: id.split(':')[1], ref_id: id, title_en: id, title_ar: id, meta_en: null, meta_ar: null, link: '/', score: null, why: [],
    days, due_on: days == null ? null : new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10),
  });
  it('from 2026-10-12 an undated owed approval outranks one due in 48 days; the cap of 3 keeps the owed ones', () => {
    const day = '2026-10-13';
    const items = [ap('approval:prearrival_shares:a', 48, day), ap('approval:prearrival_shares:b', 49, day), ap('approval:fellowship_milestones:f', null, day),
      ap('approval:plant_visits:v', null, day), ap('approval:roleplay_sessions:r', null, day), ap('approval:skill_checkins:late', -2, day)];
    expect(dayKey(items[0])).toBeGreaterThan(dayKey(items[3]));
    expect(composeDigest(items, { muted_kinds: [] }).map((i) => i.ref_table)).toEqual(['skill_checkins', 'fellowship_milestones', 'plant_visits']);
  });
  it('before 2026-10-12 the order is unchanged (dated before undated)', () => {
    const day = '2026-10-08';
    const items = [ap('approval:skill_checkins:a', 12, day), ap('approval:plant_visits:v', null, day)];
    expect(composeDigest(items, { muted_kinds: [] }).map((i) => i.id)).toEqual(['approval:skill_checkins:a', 'approval:plant_visits:v']);
  });
});

describe('finding 5: re-applying reopens the withdrawn application (local mirror)', () => {
  let b: LocalBackend;
  beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); b.setPersona('k-student'); await b.whenReady(); });
  it('same id, one row, history kept', async () => {
    const r1 = await b.rpc.submitApplication('gpo', {});
    await b.rpc.withdrawApplication(r1.data!.id, 'test');
    const r2 = await b.rpc.submitApplication('gpo', { nationality: 'uae' });
    expect(r2.ok).toBe(true);
    expect(r2.data!.id).toBe(r1.data!.id);
    expect(await b.list('applications', { filter: { programme_id: 'gpo' } })).toHaveLength(1);
    const ap = await b.get('applications', r1.data!.id);
    expect([ap?.stage, ap?.decision, ap?.delete_after ?? null]).toEqual(['submitted', 'none', null]);
    expect((await b.list('application_events', { filter: { application_id: r1.data!.id } })).map((e) => e.stage)).toEqual(['submitted', 'withdrawn', 'submitted']);
  });
});

describe('finding 7: contact requests go through submitContact', () => {
  it('signed out: the mailbox comes from the topic and the bounds hold', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    await b.reset();
    b.setPersona(null);
    const ok = await b.rpc.submitContact({ topic: 'media', message: 'Interview request', status: 'routed', lang: 'ar' });
    expect(ok.ok).toBe(true);
    expect(ok.data?.route_to).toBe('Media relations (role mailbox)');
    expect((await b.rpc.submitContact({ topic: 'nope', message: 'x' })).code).toBe('invalid');
    expect((await b.rpc.submitContact({ topic: 'careers', message: 'x'.repeat(4001) })).code).toBe('invalid');
    expect((await b.rpc.submitContact({ topic: 'careers', message: 'hello', status: 'closed' as never })).code).toBe('invalid');
  });
});

describe('finding 8: people identity columns are not edited directly', () => {
  it('an admin edits a profile field but not persona, status or organisation', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    await b.reset();
    b.setPersona('k-admin');
    await b.whenReady();
    expect((await b.update('people', 'p-k-student', { language: 'ar' })).ok).toBe(true);
    expect((await b.update('people', 'p-k-student', { persona_id: 'vp-rnd' })).ok).toBe(false);
    expect((await b.update('people', 'p-k-student', { status: 'leaver' })).ok).toBe(false);
  });
});

describe('findings 10 and 15: seed integrity', () => {
  it('at most one open enrolment per person and course; the three duplicates are cancelled with the clean-up note', () => {
    const seen = new Map<string, number>();
    for (const e of T.enrolments) if (OPEN_ENROL.includes(e.status)) seen.set(`${e.person_id}|${e.course_id}`, (seen.get(`${e.person_id}|${e.course_id}`) ?? 0) + 1);
    expect([...seen.values()].filter((n) => n > 1)).toEqual([]);
    for (const [id, kept] of [['en-133', 'en-166'], ['en-140', 'en-164'], ['en-173', 'en-244']]) {
      const e = T.enrolments.find((x) => x.id === id)!;
      expect([e.status, e.decision_note]).toEqual(['cancelled', `Duplicate enrolment closed in data clean-up 2026-10-13 (kept ${kept})`]);
    }
  });
  it('every English role note has its Arabic note', () => {
    const noted = T.job_roles.filter((r) => r.basis_note);
    expect(noted.length).toBe(16);
    for (const r of noted) expect(r.basis_note_ar).toBe(BASIS_NOTE_AR[r.basis_note]);
  });
  it('seed meta: generated_at is the demo day (reproducible) and a content digest is recorded', () => {
    expect(seed.meta.generated_at).toBe(seed.meta.demo_today);
    expect(seed.meta.digest).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('findings 11, 14, 19: i18n', () => {
  it('the NEXUS sign-in error is translated', () => {
    expect(translate('ar', 'm14.signIn.errors.nexus_unavailable')).not.toBe(translate('en', 'm14.signIn.errors.nexus_unavailable'));
    expect(translate('ar', 'm14.signIn.errors.nexus_unavailable')).toMatch(/[؀-ۿ]/);
  });
  it('a stored Arabic choice sends unprefixed entries to /ar, never loops, and an English choice sticks', () => {
    expect(preferredLangPath('/kafaa/learn', '/kafaa', 'ar')).toBe('/kafaa/ar/learn');
    expect(preferredLangPath('/kafaa/', '/kafaa', 'ar')).toBe('/kafaa/ar');
    expect(preferredLangPath('/kafaa', '/kafaa', 'ar')).toBe('/kafaa/ar');
    expect(preferredLangPath('/kafaa/ar/learn', '/kafaa', 'ar')).toBeNull();
    expect(preferredLangPath('/kafaa/learn', '/kafaa', 'en')).toBeNull();
    expect(preferredLangPath('/kafaa/learn', '/kafaa', null)).toBeNull();
    expect(preferredLangPath('/other', '/kafaa', 'ar')).toBeNull();
  });
  it('the entry no longer imports the dictionaries eagerly; each language is one lazy chunk', () => {
    const src = readFileSync('src/i18n/index.tsx', 'utf8');
    expect(src).not.toMatch(/import\.meta\.glob\([^)]*eager/);
    expect(src).toMatch(/import\('\.\/dict\.en'\)/);
    expect(src).toMatch(/import\('\.\/dict\.ar'\)/);
  });
});
