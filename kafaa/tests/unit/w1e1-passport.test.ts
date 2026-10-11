/** F03 Skills Passport and F04 Credential Wallet acceptance (LocalBackend path; SQL path: scripts/validate/w1e1-passport.mjs). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { competencyLevels } from '../../src/domain/engines/skills';
import { lintRanked } from '../../src/domain/engines';
import { hasKey } from '../../src/i18n';
import { verifyCredential } from '../../src/modules/m17/issuer';
import { publicPayloadProblems } from '../../src/modules/m17/publicPayload';
import {
  ageingSkills, badgeCandidates, badgeSourceCheck, badgeView, courseAlignment, expiringQuals, passportHtml, passportJson, radarByCompetency, radarByDomain, radarPoints, securityComps, transferableStrengths, addMonths,
  type PassportModel,
} from '../../src/modules/m17/passport';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } }).tables;
const NOW = (seed as unknown as { meta: { demo_today: string } }).meta.demo_today;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const lastAudit = () => b.raw('audit_events')[b.raw('audit_events').length - 1];
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const world = (me: string, over: Partial<Parameters<typeof badgeSourceCheck>[1]> = {}) => ({
  me, today: NOW, initials: 'RO', certificates: T.certificates, training_records: T.training_records, courses: T.courses, competencies: T.competencies, badges: T.badges, licences: T.licences, qual_records: T.qual_records, ...over,
});

describe('F03 passport data', () => {
  it('k-ro sees every RO-required competency with a level and a basis, and every Verified state names its qualification record', () => {
    const req = T.role_competencies.filter((r) => r.role_id === 'reactor-operator');
    expect(req.length).toBeGreaterThanOrEqual(8);
    const states = T.person_skills.filter((s) => s.person_id === 'p-k-ro' && s.active);
    for (const r of req) {
      const s = states.find((x) => x.skill_id === `sk-${r.competency_id}`);
      expect(s, r.competency_id).toBeTruthy();
      expect(s.level).toBeGreaterThan(0);
      expect(['verified', 'evidenced', 'validated', 'claimed']).toContain(s.basis);
    }
    const verified = states.filter((s) => s.basis === 'verified');
    expect(verified.length).toBeGreaterThan(5);
    for (const s of verified) {
      const ev = T.skill_evidence.find((e) => e.id === s.reasons[0].evidence_id);
      expect(ev.kind).toBe('qual');
      expect(T.qual_records.find((q) => q.id === ev.ref_id && q.person_id === 'p-k-ro')).toBeTruthy();
    }
  });
  it('the radar compares current level with the role (by competency and by domain) and mirrors in RTL', () => {
    const states = T.person_skills.filter((s) => s.person_id === 'p-k-ro' && s.active);
    const have = competencyLevels(states, T.skills);
    const byComp = radarByCompetency(have, T.competencies as never, T.role_competencies, 'reactor-operator', 'senior-reactor-operator');
    expect(byComp.length).toBeGreaterThanOrEqual(8);
    expect(byComp.every((a) => a.label.en && a.label.ar && a.target != null)).toBe(true);
    const byDom = radarByDomain(have, T.competencies as never, T.role_competencies, 'reactor-operator');
    expect(byDom.length).toBeGreaterThanOrEqual(3);
    expect(byDom.some((a) => a.required != null)).toBe(true);
    const ltr = radarPoints([4, 4, 4, 4], 100, 200, 200, false);
    const rtl = radarPoints([4, 4, 4, 4], 100, 200, 200, true);
    ltr.forEach(([x, y], i) => { expect(rtl[i][0]).toBeCloseTo(400 - x, 1); expect(rtl[i][1]).toBeCloseTo(y, 1); });
  });
  it('strengths for the next move: three ranked skills with readable reasons (F02 lint) and keys in both languages', () => {
    const states = T.person_skills.filter((s) => s.person_id === 'p-k-ro' && s.active);
    const r = transferableStrengths({
      states, skills: T.skills, comps: T.competencies as never, have: competencyLevels(states, T.skills), roleComps: T.role_competencies, edges: T.career_paths, currentRole: 'reactor-operator',
      pathOnly: T.job_roles.filter((x) => x.security_sensitive).map((x) => x.id), roleLabels: Object.fromEntries(T.job_roles.map((x) => [x.id, { en: x.title_en, ar: x.title_ar }])),
    });
    expect(r.strengths).toHaveLength(3);
    expect(lintRanked(r.strengths)).toEqual([]);
    expect(lintRanked(r.roles)).toEqual([]);
    for (const x of r.strengths) for (const reason of x.reasons) expect(hasKey(reason.key), reason.key).toBe(true);
    expect(r.roles.map((x) => x.id)).toContain('senior-reactor-operator');
    expect(r.roles.some((x) => T.job_roles.find((j) => j.id === x.id)?.security_sensitive)).toBe(false);
  });
  it('expiring and decaying: notices within 90 days, ageing evidence, security records excluded', () => {
    const recs = [
      { id: 'a', standard_id: 'qs-ro', status: 'qualified', expires_on: '2026-11-01', security_mirror_only: false },
      { id: 'b', standard_id: 'qs-ro', status: 'qualified', expires_on: '2027-11-01', security_mirror_only: false },
      { id: 'c', standard_id: 'qs-ro', status: 'qualified', expires_on: '2026-10-20', security_mirror_only: true },
    ];
    const ex = expiringQuals(recs, T.qual_standards, NOW);
    expect(ex.map((x) => x.id)).toEqual(['a']);
    expect(ex[0].notice).toBe(30);
    const ag = ageingSkills([{ id: 's', person_id: 'p', skill_id: 'sk-x', level: 2, confidence: 0.5, basis: 'evidenced', evidence_count: 1, reasons: [{ code: 'course', evidence_id: 'e', level: 2, basis: 'evidenced', observed_on: '2023-12-01', ageing: false }] }], NOW);
    expect(ag[0].state).toBe('soon');
    expect(lintRanked(ag.map((x) => ({ id: x.skill_id, score: 1, reasons: x.reasons })))).toEqual([]);
    expect(ag[0].reasons.every((r) => hasKey(r.key))).toBe(true);
  });
  it('the printed passport contains no email, no photo and no security task detail', () => {
    const restricted = T.qual_standards.filter((s) => s.security_restricted).map((s) => s.id);
    const secTasks = T.task_items.filter((t) => restricted.includes(t.standard_id));
    const m: PassportModel = {
      generated_on: NOW, holder: { name: 'Reactor Operator, Crew B', initials: 'RO' }, role: 'Reactor Operator', family: 'Operations', years: 8,
      skills: T.person_skills.filter((s) => s.person_id === 'p-k-ro').map((s) => ({ id: s.skill_id, code: s.skill_id, name: T.skills.find((k) => k.id === s.skill_id).name_en, area: 'x', level: s.level, basis: s.basis, confidence: s.confidence, required: null, evidence: [] })),
      quals: [{ code: 'QS-SEC', title: 'Security qualification (status only)', status: 'Qualified', expires_on: null }], licence: { type: 'RO', status: 'Valid (mirror)' },
      badges: [{ name: 'HU-101', status: 'Active', slug: 'kb1', issued_on: NOW }], credentials: [],
    };
    for (const lang of ['en', 'ar'] as const) {
      const html = passportHtml(m, lang, { title: 'Passport', footer: "Kafa'a is not an authority" }, { date: (d) => d, num: (n) => String(n) });
      expect(html).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      expect(html).not.toMatch(/<img|photo|avatar/i);
      for (const tk of secTasks) { expect(html).not.toContain(tk.id); expect(html).not.toContain(tk.statement_en); }
      expect(html).toContain('is not an authority');
      expect(html).toContain(lang === 'ar' ? 'dir="rtl"' : 'dir="ltr"');
    }
    const j = JSON.stringify(passportJson(m));
    expect(j).toContain('VerifiablePresentation');
    expect(j).not.toMatch(/@[A-Za-z0-9.-]+\.[a-z]{2,}/);
  });
});

describe('F03 claimSkill (LocalBackend)', () => {
  it('a claim on a security competency is refused with security_restricted and an audit row', async () => {
    await as('k-ro');
    const n = b.raw('audit_events').length;
    const r = await b.rpc.claimSkill({ skill_id: 'sk-sa-01', level: 2, note: 'I know the security procedures' });
    expect(r.code).toBe('security_restricted');
    expect(b.raw('audit_events').length).toBe(n + 1);
    expect(lastAudit()).toMatchObject({ action: 'skills.claim', outcome: 'refused' });
  });
  it('a claim stays claimed, records rating evidence, updates the state and supersedes the previous claim', async () => {
    await as('k-ro');
    const r1 = await b.rpc.claimSkill({ skill_id: 'sk-da-01-scripting', level: 2, note: 'Wrote a trend script', evidence_url: 'https://example.org/x' });
    expect(r1.ok).toBe(true);
    expect(b.rawGet('person_skills', 'ps:p-k-ro:sk-da-01-scripting')).toMatchObject({ level: 2, basis: 'claimed' });
    const r2 = await b.rpc.claimSkill({ skill_id: 'sk-da-01-scripting', level: 3, note: 'A bigger project since' });
    expect(r2.ok).toBe(true);
    expect(b.rawGet('skill_claims', r1.data!.id)?.status).toBe('superseded');
    expect(b.rawGet('skill_evidence', `se:rating:${r1.data!.id}:sk-da-01-scripting`)?.active).toBe(false);
    expect(b.rawGet('skill_claims', r2.data!.id)?.status).toBe('claimed');
  });
  it('validates level, note and link; enforces 20 claims a day; refuses non-staff', async () => {
    await as('k-ro');
    expect((await b.rpc.claimSkill({ skill_id: 'sk-da-01', level: 0, note: 'level zero' })).code).toBe('invalid');
    expect((await b.rpc.claimSkill({ skill_id: 'sk-da-01', level: 2, note: 'x' })).code).toBe('invalid');
    expect((await b.rpc.claimSkill({ skill_id: 'sk-da-01', level: 2, note: 'note ok', evidence_url: 'javascript:alert(1)' })).code).toBe('invalid');
    expect((await b.rpc.claimSkill({ skill_id: 'nope', level: 2, note: 'note ok' })).code).toBe('not_found');
    let code = '';
    for (let i = 0; i < 21 && !code; i++) { const r = await b.rpc.claimSkill({ skill_id: 'sk-hu-02-brief', level: 2, note: `claim ${i}` }); if (!r.ok) code = r.code; }
    expect(code).toBe('rate_limited');
    await as('k-auditor');
    expect((await b.rpc.claimSkill({ skill_id: 'sk-da-01', level: 2, note: 'auditor' })).code).toBe('forbidden');
    await as('alnoor-gm');
    expect((await b.rpc.claimSkill({ skill_id: 'sk-da-01', level: 2, note: 'partner' })).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.claimSkill({ skill_id: 'sk-da-01', level: 2, note: 'anon' })).code).toBe('not_signed_in');
  });
});

describe('F04 badges (LocalBackend and rules)', () => {
  it('nothing in the licence or qualification tables can be issued as a badge', async () => {
    for (const l of T.licences) expect(badgeSourceCheck(l.id, world(l.person_id)).code, l.id).toBe('not_eligible');
    for (const q of T.qual_records) expect(badgeSourceCheck(q.id, world(q.person_id)).code, q.id).toBe('not_eligible');
    await as('k-ro');
    for (const id of [...T.licences, ...T.qual_records].filter((x) => x.person_id === 'p-k-ro').map((x) => x.id)) expect((await b.rpc.issueBadge(id)).code, id).toBe('not_eligible');
    expect((await b.rpc.issueBadge('lic-p-sro')).code).toBe('not_found');
  });
  it('a badge cannot be issued from an expired or revoked certificate (not_eligible)', async () => {
    expect(badgeSourceCheck('KAF-2025-000233', world('w-lo-08')).code).toBe('not_eligible');
    expect(badgeSourceCheck('KAF-2025-000301', world('w-mnt-08')).code).toBe('not_eligible');
    await as('k-ro');
    b.rawInsert('certificates', { id: 'KAF-T-EXP', person_id: 'p-k-ro', org_id: 'enec-ops', holder_initials: 'RO', course_id: 'c-onb', issued_on: '2023-01-01', valid_to: '2025-01-01', status: 'valid', enrolment_id: null, issued_by: null } as never);
    b.rawInsert('certificates', { id: 'KAF-T-REV', person_id: 'p-k-ro', org_id: 'enec-ops', holder_initials: 'RO', course_id: 'c-onb', issued_on: '2026-01-01', valid_to: '2028-01-01', status: 'revoked', enrolment_id: null, issued_by: null } as never);
    expect((await b.rpc.issueBadge('KAF-T-EXP')).code).toBe('not_eligible');
    expect((await b.rpc.issueBadge('KAF-T-REV')).code).toBe('not_eligible');
  });
  it('refuses security training, duplicates and other people\'s records; lists candidates with reasons', async () => {
    await as('k-ro');
    const tr = (c: string) => T.training_records.find((t) => t.person_id === 'p-k-ro' && t.course_id === c).id;
    expect((await b.rpc.issueBadge(tr('c-sec-aw'))).code).toBe('security_restricted');
    expect((await b.rpc.issueBadge('KAF-2026-000417')).code).toBe('already_issued');
    expect((await b.rpc.issueBadge('SA-CERT-00101')).code).toBe('not_found');
    expect((await b.rpc.issueBadge(tr('c-hu'))).code).toBe('not_eligible');
    const c = badgeCandidates(world('p-k-ro'));
    expect(c.find((x) => x.source_id === tr('c-scwe'))?.code).toBe('ok');
    expect(c.find((x) => x.source_id === 'KAF-2026-000417')?.code).toBe('already_issued');
    expect(c.some((x) => x.source_id === tr('c-hu'))).toBe(false);
  });
  it('issues a signed badge, verifies it publicly with initials only, and withdraws it', async () => {
    await as('k-ro');
    const tr = T.training_records.find((t) => t.person_id === 'p-k-ro' && t.course_id === 'c-scwe').id;
    const r = await b.rpc.issueBadge(tr);
    expect(r.ok).toBe(true);
    const bd = b.rawGet('badges', r.data!.id)!;
    expect(verifyCredential(bd.credential)).toEqual({ outcome: 'valid', keyId: 'key-offline', slug: r.data!.slug });
    expect(lastAudit()).toMatchObject({ action: 'badge.issue', outcome: 'ok' });
    expect(b.raw('skill_evidence').filter((e) => e.ref_id === bd.id && e.kind === 'credential' && e.active).length).toBe(courseAlignment(T.courses.find((c) => c.id === 'c-scwe'), T.skills, securityComps(T.competencies)).length);
    expect((await b.rpc.issueBadge(tr)).code).toBe('already_issued');
    await as(null);
    const v = await b.rpc.verifyBadge(r.data!.slug);
    expect(v.ok && v.data?.status).toBe('active');
    expect(publicPayloadProblems(v)).toEqual([]);
    expect(JSON.stringify(v)).not.toContain(T.people.find((p) => p.id === 'p-k-ro').display_name);
    expect(lastAudit()).toMatchObject({ action: 'badge.verify', outcome: 'ok', actor_person_id: null });
    await as('sro');
    expect((await b.rpc.revokeBadge(bd.id, 'not mine')).code).toBe('not_found');
    await as('k-ro');
    expect((await b.rpc.revokeBadge(bd.id, '')).code).toBe('invalid');
    expect((await b.rpc.revokeBadge(bd.id, 'Withdrawn for the test')).ok).toBe(true);
    expect((await b.rpc.revokeBadge(bd.id, 'again please')).code).toBe('conflict');
    expect(b.raw('skill_evidence').filter((e) => e.ref_id === bd.id && e.active)).toHaveLength(0);
    await as(null);
    expect((await b.rpc.verifyBadge(r.data!.slug)).data?.status).toBe('revoked');
    expect((await b.rpc.verifyBadge('kb-unknown')).code).toBe('not_found');
  });
  it('every seeded verify payload passes the public payload check; status follows the certificate; verification is rate-limited', async () => {
    await as(null);
    for (const bd of T.badges.slice(0, 40)) {
      const v = await b.rpc.verifyBadge(bd.public_slug);
      expect(v.ok).toBe(true);
      expect(publicPayloadProblems(v), bd.id).toEqual([]);
    }
    const kr = T.badges.find((x) => x.source_id === 'KAF-2026-000417');
    expect(badgeView(kr, NOW, T.certificates)).toBe('active');
    expect(badgeView(kr, NOW, T.certificates.map((c) => (c.id === kr.source_id ? { ...c, valid_to: '2026-01-01' } : c)))).toBe('expired');
    expect(T.badges.some((x) => x.course_id === 'c-get' || x.course_id === 'c-sec-aw')).toBe(false);
    expect(badgeView(T.badges.find((x) => x.source_id === 'KAF-2025-000301'), NOW, T.certificates)).toBe('revoked');
    const slug = T.badges[0].public_slug;
    let code = '';
    for (let i = 0; i < 25 && !code; i++) { const v = await b.rpc.verifyBadge(slug); if (!v.ok) code = v.code; }
    expect(code).toBe('rate_limited');
  });
  it('a training manager can revoke any badge; HR and partners read no individual badges', async () => {
    await as('training-mgr');
    const other = T.badges.find((x) => x.person_id === 'p-sro');
    expect((await b.rpc.revokeBadge(other.id, 'Revoked after review')).ok).toBe(true);
    await as('k-hr-analyst');
    expect((await b.list('badges', {})).filter((x) => x.person_id !== 'p-k-hr-analyst')).toHaveLength(0);
    await as('alnoor-gm');
    expect(await b.list('badges', {})).toHaveLength(0);
    expect(await b.list('skill_claims', {})).toHaveLength(0);
    await as(null);
    expect(await b.list('badges', {})).toHaveLength(0);
  });
  it('dates add months like SQL (clamped to the month end)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2025-12-14', 24)).toBe('2027-12-14');
  });
});
