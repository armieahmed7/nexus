// M17 LocalBackend RPC implementations (owner: W1 · w1e1, F03 Skills Passport, F04 Credential Wallet). Installed on every
// LocalRpc instance by src/data/ext/local.ts. 1:1 mirror of kafaa_claim_skill / kafaa_issue_badge / kafaa_revoke_badge /
// kafaa_verify_badge in supabase/migrations/20261009111001_kafaa_w1e1_passport.sql: same checks, order, codes and audit rows.
// Pages never import this file.
//
// Signing: the in-browser demo backend signs with the "key-offline" demo key below. It is published (with key-1) in
// /kafaa/.well-known/kafaa-issuer.json and labelled as the offline demo key; the server key (key-1) never reaches the browser.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { RowOf } from '../../../data/types';
import type { M17Rpc, BadgeCheck } from './rpc';
import { todayIso } from '../../../domain/rules';
import { evidenceId, stateId } from '../../../domain/skills';
import { applySkills } from '../../../data/local/rpc.w0';
import { newId } from '../../../data/local/store';
import { nowTs } from '../../../data/audit';
import { edSign, fromHex } from '../badgeCrypto';
import { buildCredential, signingBytes, withProof, NOTICE_EN } from '../issuer';
import { badgeSourceCheck, badgeView, courseAlignment, isHttpUrl, isSecuritySkill, securityComps, type CourseRow, type SkillRow } from '../badgeRules';
import { CLAIMS_PER_DAY, LEVEL_MAX, NOTE_MAX } from '../passport';
import { makeLocalM17W2 } from './local.w2'; // W2 · w2e1: F10 check-ins, F11 team heatmap
import { makeLocalM17W5 } from './local.w5'; // W5 · w5e1: F32 micro-credentials
import { makeLocalM17Fs03 } from './local.fs03'; // FS · wave A · E2: FS03 honest skill states
import { makeLocalM17Fs4 } from './local.fs4'; // FS · wave D · E3: FS31 strategic tier, FS32 learner record, FS33 skill goals
import { makeLocalM17Fs9 } from './local.fs9'; // FS · wave I · E5: FS84 team 2030 targets, organisation skills inventory

/** Offline demo key (in-browser backend only; see the file header). Not the server key. */
export const OFFLINE_SEED = '80df5566f0f615286d25a424ee54b2c33e94253912786453b748dd943143864d';
export const VERIFY_PER_SLUG_PER_MIN = 20;
export const VERIFY_PER_MIN = 600;
const randomSlug = () => `kb${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

export function makeLocalM17(b: LocalBackend, h: LocalRpcHelpers): M17Rpc {
  const comps = () => b.raw('competencies') as unknown as { id: string; domain: string }[];
  return {
    ...makeLocalM17W2(b, h),
    ...makeLocalM17W5(b, h, OFFLINE_SEED),
    ...makeLocalM17Fs03(b, h),
    ...makeLocalM17Fs4(b, h),
    ...makeLocalM17Fs9(b, h),
    async claimSkill(input) {
      await b.whenReady();
      type R = { id: string; level: number; state_level: number };
      const me = b.identity().personId;
      const skillId = input?.skill_id ?? '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skills.claim', 'skill_claims', skillId || null, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to claim a skill');
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'Only staff can claim skills on their own passport');
      const skill = b.rawGet('skills', skillId) as unknown as SkillRow | undefined;
      if (!skill) return refuse('not_found', 'Skill not found', role);
      if (isSecuritySkill(skill, securityComps(comps() as never))) return refuse('security_restricted', 'Security competencies cannot be self-claimed: they show as qualified or not qualified only', role);
      const level = Number(input.level);
      if (!Number.isInteger(level) || level < 1 || level > LEVEL_MAX) return refuse('invalid', 'Level must be between 1 and 4', role);
      const note = String(input.note ?? '').trim();
      if (note.length < 3 || note.length > NOTE_MAX) return refuse('invalid', 'Add a short note (3 to 500 characters)', role);
      const url = String(input.evidence_url ?? '').trim();
      if (url && !isHttpUrl(url)) return refuse('invalid', 'The evidence link must be an http(s) address of up to 300 characters', role);
      const today = todayIso();
      if (b.raw('skill_claims').filter((c) => c.person_id === me && String(c.created_at).slice(0, 10) === today).length >= CLAIMS_PER_DAY)
        return refuse('rate_limited', 'You can add up to 20 claims a day', role);
      for (const c of b.raw('skill_claims').filter((c) => c.person_id === me && c.skill_id === skill.id && c.status === 'claimed')) {
        b.rawUpdate('skill_claims', c.id, { status: 'superseded' });
        const ev = evidenceId('rating', c.id, skill.id);
        if (b.rawGet('skill_evidence', ev)) b.rawUpdate('skill_evidence', ev, { active: false });
      }
      const id = newId('scl');
      b.rawInsert('skill_claims', { id, person_id: me, skill_id: skill.id, level, note, evidence_url: url || null, status: 'claimed', created_at: nowTs(), decided_by: null, decided_at: null, decision_note: null } as never);
      b.rawInsert('skill_evidence', { id: evidenceId('rating', id, skill.id), person_id: me, skill_id: skill.id, kind: 'rating', ref_table: 'skill_claims', ref_id: id, level, basis: 'claimed', status: 'current', observed_on: today, note, recorded_by: me, active: true, created_at: nowTs() } as never);
      await applySkills(b, me, today);
      const st = b.rawGet('person_skills', stateId(me, skill.id));
      return h.done<R>('skills.claim', 'skill_claims', id, `${skill.id} level ${level}`, role, null, '', 'Claim recorded. It stays "claimed" until a manager or peer validates it.', { id, level, state_level: Number(st?.level ?? 0) }, ['skill_claims', 'skill_evidence', 'person_skills']);
    },

    async issueBadge(sourceId) {
      await b.whenReady();
      type R = { id: string; slug: string };
      const me = b.identity().personId;
      const src = String(sourceId ?? '').trim();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('badge.issue', 'badges', src || null, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to issue a badge');
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'Only staff can issue badges to their own wallet');
      const person = b.rawGet('people', me);
      const today = todayIso();
      const chk = badgeSourceCheck(src, {
        me, today, initials: String(person?.initials ?? '—'), certificates: b.raw('certificates'), training_records: b.raw('training_records'), courses: b.raw('courses') as unknown as CourseRow[],
        competencies: comps(), badges: b.raw('badges'), licences: b.raw('licences'), qual_records: b.raw('qual_records'),
      });
      if (chk.code !== 'ok' || !chk.source) return refuse(chk.code, chk.message, role);
      const s = chk.source;
      const course = b.rawGet('courses', s.course_id) as unknown as CourseRow;
      const aligned = courseAlignment(course, b.raw('skills') as unknown as SkillRow[], securityComps(comps() as never));
      const slug = randomSlug();
      const id = `bdg-${slug}`;
      const cred = buildCredential({ slug, kind: s.kind, certificateNo: s.certificate_no, course, holderInitials: s.holder_initials, issuedOn: today, validTo: s.valid_to, sourceDate: s.source_date, sourceSystem: s.source_system, alignment: aligned, keyId: 'key-offline' });
      const signed = withProof(cred, edSign(signingBytes(cred), fromHex(OFFLINE_SEED)));
      b.rawInsert('badges', {
        id, person_id: me, source_table: s.source_table, source_id: s.source_id, course_id: course.id, holder_initials: s.holder_initials,
        achievement: { kind: s.kind, code: course.code, name_en: course.title_en, name_ar: course.title_ar, skills: aligned.map((a) => a.id) },
        credential: signed, issued_on: today, valid_to: s.valid_to, status: 'active', key_id: 'key-offline', public_slug: slug, revoked_at: null, revoke_reason: null, created_at: nowTs(),
      } as never);
      for (const a of aligned) {
        const ev = evidenceId('credential', id, a.id);
        const row = { id: ev, person_id: me, skill_id: a.id, kind: 'credential', ref_table: 'badges', ref_id: id, level: a.level, basis: 'evidenced', status: 'current', observed_on: s.source_date, note: null, recorded_by: me, active: true, created_at: nowTs() };
        if (b.rawGet('skill_evidence', ev)) b.rawUpdate('skill_evidence', ev, { active: true });
        else b.rawInsert('skill_evidence', row as never);
      }
      await applySkills(b, me, today);
      return h.done<R>('badge.issue', 'badges', id, `${course.code} ${s.kind} ${s.source_id}`, role, 'kafaa.badge.issue', `Badge ${slug} issued for ${course.code} (${s.kind})`, 'Badge issued and signed', { id, slug }, ['badges', 'skill_evidence', 'person_skills']);
    },

    async revokeBadge(badgeId, reason) {
      await b.whenReady();
      const me = b.identity().personId;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse('badge.revoke', 'badges', badgeId || null, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to revoke a badge');
      const ctx = b.access();
      const bd = b.rawGet('badges', badgeId);
      const own = bd?.person_id === me && ctx.has('skills_profile', ['Own']);
      const admin = ctx.has('skills_profile', ['A']);
      if (!bd || (!own && !admin)) return refuse('not_found', 'Badge not found');
      const role = own ? ctx.actingRole('skills_profile', ['Own']) : ctx.actingRole('skills_profile', ['A']);
      if (bd.status === 'revoked') return refuse('conflict', 'This badge is already revoked', role);
      const why = String(reason ?? '').trim();
      if (why.length < 3 || why.length > NOTE_MAX) return refuse('invalid', 'Give a short reason (3 to 500 characters)', role);
      b.rawUpdate('badges', bd.id, { status: 'revoked', revoked_at: nowTs(), revoke_reason: why });
      for (const e of b.raw('skill_evidence').filter((e) => e.ref_table === 'badges' && e.ref_id === bd.id && e.active)) b.rawUpdate('skill_evidence', e.id, { active: false });
      await applySkills(b, bd.person_id, todayIso());
      return h.done('badge.revoke', 'badges', bd.id, `${own ? 'withdrawn by holder' : 'revoked'}: ${why}`, role, 'kafaa.badge.revoke', `Badge ${bd.public_slug} revoked`, own ? 'Badge withdrawn' : 'Badge revoked', undefined, ['badges', 'skill_evidence', 'person_skills']);
    },

    async verifyBadge(slugIn) {
      await b.whenReady();
      const slug = String(slugIn ?? '').trim().slice(0, 64);
      const since = new Date(Date.now() - 60_000).toISOString();
      const recent = (b.raw('audit_events') as RowOf<'audit_events'>[]).filter((a) => a.action === 'badge.verify' && String(a.ts) > since);
      const refuse = (code: string, msg: string) => h.refuse<BadgeCheck>('badge.verify', 'badges', slug || null, code, msg);
      if (recent.filter((a) => a.entity_id === slug).length >= VERIFY_PER_SLUG_PER_MIN || recent.length >= VERIFY_PER_MIN)
        return refuse('rate_limited', 'Too many verification requests: try again in a minute');
      const bd = slug ? b.raw('badges').find((x) => x.public_slug === slug) : undefined;
      if (!bd) return refuse('not_found', 'No Kafa\'a badge has this link');
      const status = badgeView(bd, todayIso(), b.raw('certificates'));
      const data: BadgeCheck = { found: true, slug, status, credential: bd.credential as Record<string, unknown>, key_id: bd.key_id, checked_on: todayIso(), notice: NOTICE_EN };
      return h.done<BadgeCheck>('badge.verify', 'badges', slug, status, null, null, '', 'Badge found', data, ['audit_events']);
    },
  };
}
