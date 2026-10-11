// M22 LocalBackend RPC implementations (owner: W2 · E5 · F16 Leadership journeys, F17 Communities of practice).
// 1:1 mirror of supabase/migrations/20261009125001_kafaa_w2e5_leadership.sql: same checks in the same order, the same
// refusal codes and messages (src/modules/m22/domain.ts NOM_MSG / COP_MSG), the same audit rows and ledger rows.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { RowOf } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import {
  COP_MSG, EXPERT_MIN_LEVEL, EXPERT_REQUESTS_PER_DAY, MAX_360_INVITES, MIN_360_RATERS, NOM_MSG, POST_LIMIT_PER_DAY, RATER_KINDS,
  computeLeadershipStats, cycleOf, firstPostHeld, formVersionFor, hasContactDetails, postGuard, restrictedMessage, summarise360, validScores,
  type ExpertRow, type R360, type Req360,
} from '../domain';
import type { M22Rpc, QueueItem } from './rpc';
import { makeLocalM22Fs } from './local.fs54';

const rid = (p: string) => `${p}-${Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('')}`;
const isAr = (s: string) => /[؀-ۿ]/.test(s);

export function makeLocalM22(b: LocalBackend, h: LocalRpcHelpers): M22Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const notify = (id: string, person: string | null | undefined, kind: string, en: string, ar: string, link: string, severity: 'info' | 'ok' | 'warn' | 'bad' = 'info') => {
    if (!person || !b.rawGet('people', person) || b.rawGet('notifications', id)) return;
    b.rawInsert('notifications', { id, person_id: person, kind, title_en: en, title_ar: ar, link, severity, created_at: nowTs() } as never);
  };
  const policies = () => b.raw('refusal_policies').map((p) => ({ category: p.category, patterns: p.patterns ?? [], enabled: p.enabled }));
  /** Content screen shared by posts, headlines, expert messages and replies: restricted category first, then contact details. */
  const screen = (text: string): { code: string; msg: string } | null => {
    const cat = postGuard(text, policies());
    if (cat) return { code: 'restricted_content', msg: restrictedMessage(cat) };
    if (hasContactDetails(text)) return { code: 'contact_details', msg: COP_MSG.contact };
    return null;
  };
  const person = (id: string) => b.rawGet('people', id);
  const level = (pid: string, sid: string) => {
    const s = b.rawGet('person_skills', `ps:${pid}:${sid}`);
    return s && s.active ? s : null;
  };
  const isSteward = (cid: string, pid: string | null) => !!pid && b.raw('community_members').some((m) => m.community_id === cid && m.person_id === pid && m.role === 'steward' && m.active);
  const recount = (threadId: string) => {
    const t = b.rawGet('threads', threadId);
    if (!t) return;
    const pub = b.raw('posts').filter((p) => p.thread_id === threadId && p.status === 'published');
    const first = t.first_post_id ? b.rawGet('posts', t.first_post_id) : undefined;
    const last = pub.map((p) => p.created_at).sort().pop() ?? t.created_at;
    b.rawUpdate('threads', threadId, { visible: first ? first.status === 'published' : t.visible, reply_count: pub.filter((p) => p.id !== t.first_post_id).length, last_post_at: last } as never);
  };

  return {
    ...makeLocalM22Fs(b, h), // FS46-FS48 (wave E · E4)
    // ───────────────────────────── F16
    async nominateLeader(personId, programmeId, reason) {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('leadership.nominate', 'leadership_nominations', `${programmeId ?? ''}:${personId ?? ''}`, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', NOM_MSG.not_signed_in);
      if (personId === who) return refuse('self_nominate', NOM_MSG.self_nominate, ctx().actingRole('skills_profile', ['Own']));
      const c = ctx();
      const role = c.roleGrant('manager', 'skills_profile', 'Scope') ? 'manager' : null;
      if (!role) return refuse('forbidden', NOM_MSG.forbidden_nominate);
      const p = person(personId);
      if (!p || p.kind !== 'staff' || p.status === 'leaver') return refuse('not_found', NOM_MSG.not_found_person, role);
      if (!(c.inScope('skills_profile', personId) || p.manager_id === who)) return refuse('not_in_scope', NOM_MSG.not_in_scope, role);
      const prog = b.rawGet('leadership_programmes', programmeId);
      if (!prog) return refuse('not_found', NOM_MSG.not_found_programme, role);
      if (!prog.nominable) return refuse('invalid', NOM_MSG.not_nominable, role);
      const text = String(reason ?? '').trim();
      if (text.length < 10 || text.length > 500) return refuse('invalid', NOM_MSG.reason, role);
      if (b.raw('leadership_nominations').some((n) => n.person_id === personId && n.programme_id === programmeId && (n.status === 'nominated' || n.status === 'approved'))) return refuse('conflict', NOM_MSG.duplicate, role);
      const nominator = person(who)!;
      const id = rid('ln');
      const ts = nowTs();
      b.rawInsert('leadership_nominations', {
        id, person_id: personId, programme_id: programmeId, nominated_by: who, reason: text, cycle: cycleOf(todayIso()), status: 'nominated',
        person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, person_role_id: p.job_role_id ?? null, person_family_id: p.job_family_id ?? null,
        nominator_name: nominator.display_name, nominator_name_ar: nominator.display_name_ar || nominator.display_name,
        history: [{ at: ts, status: 'nominated', by: who, note: null }], created_at: ts, updated_at: ts,
      } as never);
      notify(`nt-${id}-nominated`, personId, 'leadership', `You were nominated for ${prog.title_en}`, `تم ترشيحك لبرنامج ${prog.title_ar}`, '/leadership', 'ok');
      return h.done<R>('leadership.nominate', 'leadership_nominations', id, `${programmeId} for ${personId}`, role, null, '', 'Nomination sent to HR for a decision', { id, status: 'nominated' }, ['leadership_nominations', 'notifications']);
    },

    async decideNomination(id, decision, note = '') {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('leadership.decide', 'leadership_nominations', id, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', NOM_MSG.not_signed_in);
      const c = ctx();
      const n = b.rawGet('leadership_nominations', id);
      if (!n || !c.canReadRow('leadership_nominations', n as never)) return refuse('not_found', NOM_MSG.not_found);
      const role = c.has('talent_review', ['A']) ? c.actingRole('talent_review', ['A']) : c.roleGrant('training_manager', 'skills_profile', 'A') ? 'training_manager' : null;
      if (!role) return refuse('forbidden', NOM_MSG.forbidden_decide);
      if (n.person_id === who) return refuse('maker_checker', NOM_MSG.self_decide, role);
      if (n.nominated_by === who) return refuse('maker_checker', NOM_MSG.maker_checker, role);
      if (n.status !== 'nominated') return refuse('invalid', NOM_MSG.not_open, role);
      if (decision !== 'approved' && decision !== 'declined') return refuse('invalid', NOM_MSG.invalid_decision, role);
      const text = String(note ?? '').trim();
      if (decision === 'declined' && text.length < 5) return refuse('invalid', NOM_MSG.decline_note, role);
      const ts = nowTs();
      b.rawUpdate('leadership_nominations', id, { status: decision, decided_by: who, decided_at: ts, decision_note: text || null, history: [...((n.history as unknown[]) ?? []), { at: ts, status: decision, by: who, note: text || null }], updated_at: ts } as never);
      const prog = b.rawGet('leadership_programmes', n.programme_id)!;
      const ok = decision === 'approved';
      notify(`nt-${id}-${decision}`, n.person_id, 'leadership', ok ? `Nomination approved: ${prog.title_en}` : `Nomination not approved this time: ${prog.title_en}`, ok ? `تمت الموافقة على الترشيح: ${prog.title_ar}` : `لم تتم الموافقة على الترشيح هذه المرة: ${prog.title_ar}`, '/leadership', ok ? 'ok' : 'info');
      notify(`nt-${id}-${decision}-by`, n.nominated_by, 'leadership', `Your nomination of ${n.person_name} was ${decision}`, ok ? `تمت الموافقة على ترشيحك لـ ${n.person_name_ar}` : `لم تتم الموافقة على ترشيحك لـ ${n.person_name_ar}`, '/leadership/nominations', ok ? 'ok' : 'info');
      return h.done<R>('leadership.decide', 'leadership_nominations', id, decision, role, 'kafaa.leadership.nomination', `Nomination ${id} (${n.programme_id}) ${decision}`, ok ? 'Nomination approved' : 'Nomination declined', { status: decision }, ['leadership_nominations', 'notifications']);
    },

    async request360(raters) {
      await b.whenReady();
      type R = { cycle: string; invited: number; added: number };
      const who = me();
      const cycle = cycleOf(todayIso());
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('leadership.360.request', 'leadership_360_requests', who ? `${cycle}:${who}` : null, code, msg, role);
      if (!who) return refuse('not_signed_in', NOM_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'Leadership 360 is for staff with a skills profile');
      const list = Array.isArray(raters) ? raters : [];
      const ids = list.map((x) => x?.person_id);
      if (!list.length || list.some((x) => !x || typeof x.person_id !== 'string' || !(RATER_KINDS as readonly string[]).includes(x.kind)) || new Set(ids).size !== ids.length) return refuse('invalid', 'Choose each colleague once, as manager, peer or report', role);
      if (ids.includes(who)) return refuse('invalid', 'Choose colleagues other than yourself (your self-rating is added for you)', role);
      for (const id of ids) {
        const p = person(id);
        if (!p || p.kind !== 'staff' || p.status !== 'active') return refuse('not_found', 'Colleague not found', role);
      }
      const mine = b.raw('leadership_360_requests').filter((q) => q.subject_id === who && q.cycle === cycle && q.rater_kind !== 'self');
      const fresh = list.filter((x) => !mine.some((q) => q.rater_id === x.person_id));
      const total = mine.length + fresh.length;
      if (total < MIN_360_RATERS) return refuse('too_few', `Invite at least ${MIN_360_RATERS} colleagues: results appear only with five or more responses`, role);
      if (total > MAX_360_INVITES) return refuse('limit', `Invite at most ${MAX_360_INVITES} colleagues in a cycle`, role);
      const subj = person(who)!;
      const ts = nowTs();
      // FS46: a new cycle uses the current form (2); a cycle already started keeps its version (old results stay readable)
      const version = formVersionFor(who, cycle, b.raw('leadership_360_requests') as Req360[]);
      const add = (rater: string, kind: string) => {
        const id = `l3q-${cycle}-${who}-${rater}`;
        if (b.rawGet('leadership_360_requests', id)) return;
        b.rawInsert('leadership_360_requests', { id, cycle, subject_id: who, rater_id: rater, rater_kind: kind, status: 'invited', subject_name: subj.display_name, subject_name_ar: subj.display_name_ar || subj.display_name, invited_at: ts, submitted_at: null, form_version: version } as never);
        if (kind !== 'self') notify(`nt-${id}`, rater, 'leadership', `Leadership 360: ${subj.display_name} asked for your feedback`, `تقييم 360 القيادي: طلب ${subj.display_name_ar || subj.display_name} ملاحظاتك`, '/leadership/360', 'info');
      };
      add(who, 'self');
      for (const x of [...fresh].sort((a, c) => (a.person_id < c.person_id ? -1 : 1))) add(x.person_id, x.kind);
      return h.done<R>('leadership.360.request', 'leadership_360_requests', `${cycle}:${who}`, `${fresh.length} invited (${total} total)`, role, null, '', `Feedback requested from ${total} colleagues`, { cycle, invited: total, added: fresh.length }, ['leadership_360_requests', 'notifications']);
    },

    async submit360(requestId, scores) {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('leadership.360.submit', 'leadership_360_requests', requestId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', NOM_MSG.not_signed_in);
      const role = ctx().actingRole('own_profile', ['Own']);
      const q = b.rawGet('leadership_360_requests', requestId);
      if (!q || q.rater_id !== who) return refuse('not_found', 'Feedback request not found', role);
      if (q.status === 'submitted') return refuse('conflict', 'You have already given this feedback', role);
      const version = (q as { form_version?: number }).form_version ?? 1;
      const s = validScores(scores, version);
      if (!s) return refuse('invalid', 'Rate every behaviour from 1 to 5', role);
      const ts = nowTs();
      b.rawInsert('leadership_360', { id: rid('l3'), cycle: q.cycle, subject_id: q.subject_id, rater_kind: q.rater_kind, scores: s, submitted_at: ts, open_read: false, form_version: version } as never);
      b.rawUpdate('leadership_360_requests', q.id, { status: 'submitted', submitted_at: ts } as never);
      return h.done<R>('leadership.360.submit', 'leadership_360_requests', q.id, q.rater_kind, role, null, '', 'Thank you: your feedback is recorded without your name', { status: 'submitted' }, ['leadership_360_requests', 'leadership_360']);
    },

    async my360(cycle) {
      await b.whenReady();
      const who = me();
      const names = new Map(b.raw('people').map((p) => [p.id, { name: p.display_name, name_ar: p.display_name_ar || p.display_name }]));
      return summarise360(who ?? '', cycle ?? null, who ? (b.raw('leadership_360_requests') as Req360[]) : [], who ? (b.raw('leadership_360') as unknown as R360[]) : [], names);
    },

    async leadershipStats() {
      await b.whenReady();
      const c = ctx();
      if (!me() || !(c.has('skills_profile', ['Agg', 'A']) || c.has('talent_review', ['Agg', 'A']) || c.has('audit_log', ['R']))) return null;
      return computeLeadershipStats(b.raw('leadership_360') as unknown as R360[], b.raw('people'), b.raw('leadership_nominations'), MIN_GROUP_SIZE);
    },

    // ───────────────────────────── F17
    async joinCommunity(communityId, join) {
      await b.whenReady();
      type R = { member: boolean };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('community.join', 'community_members', communityId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', COP_MSG.not_signed_in);
      const role = ctx().actingRole('knowledge', ['R']);
      if (!role) return refuse('forbidden', COP_MSG.forbidden);
      const com = b.rawGet('communities', communityId);
      if (!com || !com.open) return refuse('not_found', COP_MSG.not_found, role);
      const id = `cm:${communityId}:${who}`;
      const cur = b.rawGet('community_members', id);
      const ts = nowTs();
      if (join !== false) {
        if (!cur) {
          const p = person(who)!;
          b.rawInsert('community_members', { id, community_id: communityId, person_id: who, role: 'member', active: true, person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, person_role_id: p.job_role_id ?? null, joined_at: ts, updated_at: ts } as never);
        } else if (!cur.active) b.rawUpdate('community_members', id, { active: true, updated_at: ts } as never);
        return h.done<R>('community.join', 'community_members', id, 'joined', role, null, '', 'You joined the community', { member: true }, ['community_members']);
      }
      if (cur && cur.active && cur.role === 'steward') return refuse('conflict', COP_MSG.steward_leave, role);
      if (cur && cur.active) b.rawUpdate('community_members', id, { active: false, updated_at: ts } as never);
      return h.done<R>('community.join', 'community_members', id, 'left', role, null, '', 'You left the community', { member: false }, ['community_members']);
    },

    async postThread(input) {
      await b.whenReady();
      type R = { thread_id: string; post_id: string; status: 'published' | 'held' };
      const cid = input?.community_id ?? '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('community.post', 'posts', cid || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', COP_MSG.not_signed_in);
      const c = ctx();
      const role = c.actingRole('knowledge', ['R']);
      if (!role) return refuse('forbidden', COP_MSG.forbidden);
      const com = b.rawGet('communities', cid);
      if (!com) return refuse('not_found', COP_MSG.not_found, role);
      const mem = b.rawGet('community_members', `cm:${cid}:${who}`);
      if (!mem || !mem.active) return refuse('not_member', COP_MSG.not_member, role);
      const tid = input.thread_id || null;
      let thread: RowOf<'threads'> | undefined;
      const title = String(input.title ?? '').trim();
      if (tid) {
        thread = b.rawGet('threads', tid);
        if (!thread || thread.community_id !== cid || !(thread.visible || thread.author_id === who)) return refuse('not_found', COP_MSG.thread_not_found, role);
        if (thread.status !== 'open') return refuse('invalid', COP_MSG.thread_closed, role);
      } else if (title.length < 5 || title.length > 140) return refuse('invalid', COP_MSG.title, role);
      const body = String(input.body ?? '').trim();
      if (body.length < 10 || body.length > 2000) return refuse('invalid', COP_MSG.body, role);
      const bad = screen(`${tid ? '' : title} ${body}`);
      if (bad) return refuse(bad.code, bad.msg, role);
      const today = todayIso();
      if (b.raw('posts').filter((p) => p.author_id === who && String(p.created_at).slice(0, 10) === today).length >= POST_LIMIT_PER_DAY) return refuse('limit', COP_MSG.limit, role);
      const before = b.raw('posts').filter((p) => p.community_id === cid && p.author_id === who && p.status === 'published').length;
      const held = firstPostHeld(isSteward(cid, who), before);
      const status = held ? 'held' : 'published';
      const lang = input.lang === 'en' || input.lang === 'ar' ? input.lang : isAr(body) ? 'ar' : 'en';
      const p = person(who)!;
      const ts = nowTs();
      const postId = rid('po');
      const threadId = tid ?? rid('th');
      if (!tid) {
        b.rawInsert('threads', { id: threadId, community_id: cid, title, lang, author_id: who, author_name: p.display_name, author_name_ar: p.display_name_ar || p.display_name, first_post_id: postId, status: 'open', visible: !held, reply_count: 0, last_post_at: ts, skill_ids: [], created_at: ts } as never);
      }
      b.rawInsert('posts', { id: postId, thread_id: threadId, community_id: cid, author_id: who, author_name: p.display_name, author_name_ar: p.display_name_ar || p.display_name, body, lang, status, visible: !held, moderated_by: null, moderated_at: null, moderation_note: null, created_at: ts } as never);
      if (tid && !held) recount(threadId);
      if (held) {
        for (const m of b.raw('community_members').filter((x) => x.community_id === cid && x.role === 'steward' && x.active && x.person_id !== who).sort((x, y) => (x.person_id < y.person_id ? -1 : 1)))
          notify(`nt-${postId}-held-${m.person_id}`, m.person_id, 'community', `Post waiting for review in ${com.name_en}`, `مشاركة بانتظار المراجعة في ${com.name_ar}`, `/communities/${cid}`, 'info');
      } else if (thread && thread.author_id !== who) {
        notify(`nt-${postId}-reply`, thread.author_id, 'community', `New reply: ${thread.title}`, `رد جديد: ${thread.title}`, `/communities/thread/${threadId}`, 'info');
      }
      return h.done<R>('community.post', 'posts', postId, `${status} ${tid ? 'reply' : 'thread'} in ${cid}`, role, null, '', held ? 'Sent for review: a steward checks your first post in each community' : 'Posted', { thread_id: threadId, post_id: postId, status }, ['threads', 'posts', 'notifications']);
    },

    async moderatePost(postId, decision, note = '') {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('community.moderate', 'posts', postId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', COP_MSG.not_signed_in);
      const c = ctx();
      const post = b.rawGet('posts', postId);
      if (!post) return refuse('not_found', COP_MSG.post_not_found);
      const steward = isSteward(post.community_id, who);
      const role = c.has('knowledge', ['A']) ? c.actingRole('knowledge', ['A']) : steward ? c.actingRole('knowledge', ['R']) : null;
      if (!role || (!steward && !c.has('knowledge', ['A']))) return refuse('forbidden', COP_MSG.forbidden_moderate, role);
      if (post.author_id === who) return refuse('maker_checker', COP_MSG.own_post, role);
      if (decision !== 'publish' && decision !== 'hide') return refuse('invalid', COP_MSG.invalid_decision, role);
      const text = String(note ?? '').trim();
      if (decision === 'hide' && (text.length < 5 || text.length > 300)) return refuse('invalid', COP_MSG.hide_note, role);
      const status = decision === 'publish' ? 'published' : 'hidden';
      if (post.status === status) return refuse('invalid', COP_MSG.already, role);
      b.rawUpdate('posts', postId, { status, visible: status === 'published', moderated_by: who, moderated_at: nowTs(), moderation_note: text || null } as never);
      recount(post.thread_id);
      const t = b.rawGet('threads', post.thread_id)!;
      notify(`nt-${postId}-${status}`, post.author_id, 'community', status === 'published' ? `Your post is published: ${t.title}` : `Your post was hidden by a steward: ${t.title}`, status === 'published' ? `تم نشر مشاركتك: ${t.title}` : `أخفى المشرف مشاركتك: ${t.title}`, `/communities/thread/${t.id}`, status === 'published' ? 'ok' : 'warn');
      return h.done<R>('community.moderate', 'posts', postId, decision, role, null, '', status === 'published' ? 'Post published' : 'Post hidden', { status }, ['posts', 'threads', 'notifications']);
    },

    async moderationQueue(): Promise<QueueItem[]> {
      await b.whenReady();
      const who = me();
      if (!who) return [];
      const all = ctx().has('knowledge', ['A']);
      const mine = new Set(b.raw('community_members').filter((m) => m.person_id === who && m.role === 'steward' && m.active).map((m) => m.community_id));
      return b.raw('posts')
        .filter((p) => p.status === 'held' && (all || mine.has(p.community_id)))
        .sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : x.id < y.id ? -1 : 1))
        .map((p) => {
          const t = b.rawGet('threads', p.thread_id)!;
          return { post_id: p.id, thread_id: p.thread_id, thread_title: t.title, community_id: p.community_id, author_name: p.author_name, author_name_ar: p.author_name_ar, body: p.body, first_post: t.first_post_id === p.id, created_at: p.created_at };
        });
    },

    async setExpertOptin(skillIds, visible, headline = '') {
      await b.whenReady();
      type R = { visible: boolean; skill_ids: string[] };
      const who = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('expert.optin', 'expert_optin', who ? `eo:${who}` : null, code, msg, role);
      if (!who) return refuse('not_signed_in', COP_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'The expert finder is for staff with a skills passport');
      const ids = Array.isArray(skillIds) ? skillIds : [];
      const vis = visible !== false;
      if (ids.some((x) => typeof x !== 'string') || new Set(ids).size !== ids.length || ids.length > 8 || (vis && ids.length < 1) || ids.some((x) => !b.rawGet('skills', x))) return refuse('invalid', COP_MSG.skills, role);
      if (ids.some((x) => b.rawGet('skills', x)!.area === 'security')) return refuse('security_restricted', COP_MSG.security_skill, role);
      if (ids.some((x) => (level(who, x)?.level ?? 0) < EXPERT_MIN_LEVEL)) return refuse('level_too_low', COP_MSG.level_too_low, role);
      const head = String(headline ?? '').trim();
      if (head.length > 140) return refuse('invalid', COP_MSG.headline, role);
      const bad = head ? screen(head) : null;
      if (bad) return refuse(bad.code, bad.msg, role);
      const p = person(who)!;
      const id = `eo:${who}`;
      const row = { skill_ids: [...ids].sort(), visible: vis, headline: head, person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, role_id: p.job_role_id ?? null, family_id: p.job_family_id ?? null, team_id: p.team_id ?? null, updated_at: nowTs() };
      if (b.rawGet('expert_optin', id)) b.rawUpdate('expert_optin', id, row as never);
      else b.rawInsert('expert_optin', { id, person_id: who, ...row } as never);
      return h.done<R>('expert.optin', 'expert_optin', id, vis ? `visible ${ids.length} skills` : 'hidden', role, null, '', vis ? 'You are listed in the expert finder' : 'You are hidden from the expert finder', { visible: vis, skill_ids: row.skill_ids }, ['expert_optin']);
    },

    async findExperts(skillId = null): Promise<ExpertRow[]> {
      await b.whenReady();
      const who = me();
      if (!who || !ctx().has('knowledge', ['R'])) return [];
      const out: ExpertRow[] = [];
      for (const o of [...b.raw('expert_optin')].sort((x, y) => (x.person_id < y.person_id ? -1 : 1))) {
        if (!o.visible || o.person_id === who) continue;
        const p = person(o.person_id);
        if (!p || p.status === 'leaver') continue;
        const skills = [...(o.skill_ids ?? [])].sort().flatMap((sid) => {
          const s = level(o.person_id, sid);
          return s && s.level >= EXPERT_MIN_LEVEL ? [{ skill_id: sid, level: s.level, basis: s.basis }] : [];
        });
        if (!skills.length || (skillId && !skills.some((s) => s.skill_id === skillId))) continue;
        out.push({ person_id: o.person_id, name: o.person_name, name_ar: o.person_name_ar, role_id: o.role_id ?? null, family_id: o.family_id ?? null, team_id: o.team_id ?? null, headline: o.headline, skills });
      }
      return out;
    },

    async requestExpert(expertId, skillId, message) {
      await b.whenReady();
      type R = { id: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('expert.request', 'expert_requests', expertId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', COP_MSG.not_signed_in);
      const role = ctx().actingRole('knowledge', ['R']);
      if (!role) return refuse('forbidden', COP_MSG.forbidden);
      if (expertId === who) return refuse('conflict', COP_MSG.self_request, role);
      const o = b.rawGet('expert_optin', `eo:${expertId}`);
      const ex = person(expertId);
      if (!o || !o.visible || !ex || ex.status === 'leaver' || !(o.skill_ids ?? []).includes(skillId) || (level(expertId, skillId)?.level ?? 0) < EXPERT_MIN_LEVEL) return refuse('not_found', COP_MSG.expert_not_found, role);
      const text = String(message ?? '').trim();
      if (text.length < 10 || text.length > 500) return refuse('invalid', COP_MSG.message, role);
      const bad = screen(text);
      if (bad) return refuse(bad.code, bad.msg, role);
      const today = todayIso();
      if (b.raw('expert_requests').filter((x) => x.requester_id === who && String(x.created_at).slice(0, 10) === today).length >= EXPERT_REQUESTS_PER_DAY) return refuse('limit', COP_MSG.request_limit, role);
      const p = person(who)!;
      const sk = b.rawGet('skills', skillId)!;
      const id = rid('er');
      b.rawInsert('expert_requests', { id, expert_id: expertId, requester_id: who, skill_id: skillId, message: text, status: 'sent', reply: null, requester_name: p.display_name, requester_name_ar: p.display_name_ar || p.display_name, expert_name: ex.display_name, expert_name_ar: ex.display_name_ar || ex.display_name, created_at: nowTs(), answered_at: null } as never);
      notify(`nt-${id}`, expertId, 'community', `Expert request about ${sk.name_en} from ${p.display_name}`, `طلب خبرة حول ${sk.name_ar} من ${p.display_name_ar || p.display_name}`, '/communities/experts', 'info');
      return h.done<R>('expert.request', 'expert_requests', id, skillId, role, null, '', 'Request sent in the app', { id }, ['expert_requests', 'notifications']);
    },

    async answerExpertRequest(id, decision, reply = '') {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('expert.answer', 'expert_requests', id, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', COP_MSG.not_signed_in);
      const role = ctx().actingRole('knowledge', ['R']);
      const q = b.rawGet('expert_requests', id);
      if (!q || (q.expert_id !== who && q.requester_id !== who)) return refuse('not_found', COP_MSG.request_not_found, role);
      if (q.expert_id !== who) return refuse('forbidden', COP_MSG.forbidden_answer, role);
      if (q.status !== 'sent') return refuse('invalid', COP_MSG.answered, role);
      if (decision !== 'accepted' && decision !== 'declined') return refuse('invalid', COP_MSG.invalid_decision, role);
      const text = String(reply ?? '').trim();
      if (text.length > 300) return refuse('invalid', COP_MSG.reply, role);
      const bad = text ? screen(text) : null;
      if (bad) return refuse(bad.code, bad.msg, role);
      b.rawUpdate('expert_requests', id, { status: decision, reply: text || null, answered_at: nowTs() } as never);
      const ok = decision === 'accepted';
      notify(`nt-${id}-${decision}`, q.requester_id, 'community', ok ? `${q.expert_name} accepted your expert request` : `${q.expert_name} cannot help this time`, ok ? `قبل ${q.expert_name_ar} طلب الخبرة` : `لا يستطيع ${q.expert_name_ar} المساعدة هذه المرة`, '/communities/experts', ok ? 'ok' : 'info');
      return h.done<R>('expert.answer', 'expert_requests', id, decision, role, null, '', ok ? 'Request accepted' : 'Request declined', { status: decision }, ['expert_requests', 'notifications']);
    },
  };
}

