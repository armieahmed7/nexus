// F37 (W5 · E5) LocalBackend mirror of kafaa_dalil_career_turn: kill switch, signed-in staff only, question length, the shared
// hourly rate limit (every Dalil question of the person counts), concern redaction, sessions and turns with submode 'career'.
// FS76 (fsHe4): dalilFutureTurn and setDalilIntent (mirrors of kafaa_dalil_future_turn / kafaa_set_dalil_intent). Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { DalilTurnResult } from '../../../data/types';
import { CONCERN_WITHHELD, dalilModeAllowed, defaultDalilMode } from '../../../domain/g5rules';
import { intentBase, isPersonalIntent } from '../career/futureIntents';
import type { CareerTurnInput, M13Rpc } from './rpc';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function makeLocalM13(b: LocalBackend, h: LocalRpcHelpers): M13Rpc {
  async function dalilCareerTurn(p: CareerTurnInput) {
      await b.whenReady();
      type R = DalilTurnResult;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('dalil.career_turn', 'advisor_turns', null, code, msg, role);
      const settings = b.rawGet('dalil_settings', 'global');
      const who = b.identity();
      const me = who.personId;
      if (!settings || !settings.enabled) return refuse('disabled', 'Dalil is switched off by the AI owner');
      if (!me) return refuse('not_signed_in', 'Sign in to use career mode');
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role || !dalilModeAllowed('staff', who.roles, true)) return refuse('forbidden', 'Career mode is for staff with a skills profile');
      const q = typeof p?.question === 'string' ? p.question : '';
      if (!q.trim() || q.length > 2000) return refuse('invalid', 'Questions must be 1 to 2,000 characters', role);
      const limit = settings.signed_in_rate_limit_per_hour;
      const since = new Date(Date.now() - 3_600_000).toISOString();
      const mine = new Set(b.raw('advisor_sessions').filter((x) => x.person_id === me).map((x) => x.id));
      const used = b.raw('advisor_turns').filter((t) => t.speaker === 'user' && mine.has(t.session_id) && t.ts >= since).length;
      if (used >= limit) {
        const r = await refuse('rate_limited', `You have reached ${limit} questions this hour. Try again later.`, role);
        return { ...r, data: { session_id: p.session_id ?? '', used, limit, remaining: 0 } };
      }
      const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      let session = p.session_id ? b.rawGet('advisor_sessions', p.session_id) : undefined;
      if (session && (session.person_id !== me || session.submode !== 'career')) session = undefined; // never append to someone else's or a non-career session
      if (!session) {
        const keep = new Date();
        keep.setUTCDate(keep.getUTCDate() + settings.retention_days);
        session = b.rawInsert('advisor_sessions', { id: `as-${crypto.randomUUID().replace(/-/g, '')}`, person_id: me, mode: 'staff', submode: 'career', started_at: now, retention_until: isoDate(keep), client_key: null, page_context: (p.page_context ?? null)?.slice(0, 200) ?? null, turns: 0, last_turn_at: now } as never);
      }
      const redacted = !!p.redact_question || p.refusal_category === 'concern';
      const n = session.turns;
      b.rawInsert('advisor_turns', { id: `${session.id}-${n + 1}`, session_id: session.id, person_id: me, speaker: 'user', text: redacted ? CONCERN_WITHHELD : q.slice(0, 2000), citations: [], refused: false, refusal_category: null, ts: now, intent: p.intent ?? null, confidence: null, redacted, mode: 'staff', submode: 'career' } as never);
      b.rawInsert('advisor_turns', { id: `${session.id}-${n + 2}`, session_id: session.id, person_id: me, speaker: 'dalil', text: String(p.answer ?? '').slice(0, 4000), citations: (p.citations ?? []).slice(0, 10), refused: !!p.refused, refusal_category: p.refusal_category ?? null, ts: now, intent: p.intent ?? null, confidence: p.confidence ?? null, redacted: false, mode: 'staff', submode: 'career' } as never);
      b.rawUpdate('advisor_sessions', session.id, { turns: n + 2, last_turn_at: now } as never);
      return h.done<R>('dalil.career_turn', 'advisor_turns', session.id, `career ${p.intent ?? '-'}${p.refused ? ` refused:${p.refusal_category}` : ''}`, role, null, '', 'ok',
        { session_id: session.id, used: used + 1, limit, remaining: Math.max(0, limit - used - 1) }, ['advisor_sessions', 'advisor_turns']);
  }
  return {
    dalilCareerTurn,
    // FS76 (fsHe4) mirror of kafaa_dalil_future_turn: the intent switch, personal answers for staff only, then the career or the Dalil turn log.
    async dalilFutureTurn(p) {
      await b.whenReady();
      type R = DalilTurnResult;
      const base = intentBase(p?.intent);
      const row = base ? b.rawGet('dalil_intents' as never, base) as { enabled?: boolean } | undefined : undefined;
      if (base && row && row.enabled === false) return h.refuse<R>('dalil.future_turn', 'advisor_turns', base, 'intent_disabled', 'This answer type is switched off by the AI owner');
      const who = b.identity();
      if (!who.personId) return h.refuse<R>('dalil.future_turn', 'advisor_turns', null, 'not_signed_in', 'Sign in to log a future-skills turn');
      const staff = !!b.access().actingRole('skills_profile', ['Own']) && dalilModeAllowed('staff', who.roles, true);
      if ((p.personal || isPersonalIntent(p.intent)) && !staff) return h.refuse<R>('dalil.future_turn', 'advisor_turns', null, 'personal_not_allowed', 'Personal future-skills answers are for staff with a skills profile');
      const { personal: _p, mode, ...rest } = p;
      void _p;
      if (staff) return dalilCareerTurn(rest);
      return b.rpc.dalilTurn({ ...rest, mode: mode ?? defaultDalilMode(who.roles, true), client_key: null });
    },
    // FS76 (fsHe4) mirror of kafaa_set_dalil_intent: the AI owner switches one future-skills intent, with a reason; audited and ledgered.
    async setDalilIntent(id, enabled, note) {
      await b.whenReady();
      type R = { id: string; enabled: boolean };
      const role = b.access().actingRole('dalil_config', ['A']);
      if (!role) return h.refuse<R>('dalil.intent', 'dalil_intents', id, 'forbidden', 'Only the AI owner (admin) may switch a Dalil intent');
      const row = b.rawGet('dalil_intents' as never, id) as { enabled: boolean } | undefined;
      if (!row) return h.refuse<R>('dalil.intent', 'dalil_intents', id, 'not_found', 'Unknown intent', role);
      const why = typeof note === 'string' ? note.trim() : '';
      if (why.length < 5 || why.length > 300) return h.refuse<R>('dalil.intent', 'dalil_intents', id, 'invalid', 'A reason of 5 to 300 characters is required', role);
      if (row.enabled === !!enabled) return h.refuse<R>('dalil.intent', 'dalil_intents', id, 'unchanged', enabled ? 'This intent is already on' : 'This intent is already off', role);
      b.rawUpdate('dalil_intents' as never, id, { enabled: !!enabled, changed_role: role, changed_at: new Date().toISOString(), change_note: why } as never);
      return h.done<R>('dalil.intent', 'dalil_intents', id, `${enabled ? 'enabled' : 'disabled'}: ${why}`, role, `kafaa.dalil.intent_${enabled ? 'enable' : 'disable'}`, `Dalil intent ${id}`,
        enabled ? 'Intent switched on' : 'Intent switched off', { id, enabled: !!enabled }, ['dalil_intents']);
    },
  };
}
