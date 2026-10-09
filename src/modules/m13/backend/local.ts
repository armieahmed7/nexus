// F37 (W5 · E5) LocalBackend mirror of kafaa_dalil_career_turn: kill switch, signed-in staff only, question length, the shared
// hourly rate limit (every Dalil question of the person counts), concern redaction, sessions and turns with submode 'career'.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { DalilTurnResult } from '../../../data/types';
import { CONCERN_WITHHELD, dalilModeAllowed } from '../../../domain/g5rules';
import type { M13Rpc } from './rpc';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function makeLocalM13(b: LocalBackend, h: LocalRpcHelpers): M13Rpc {
  return {
    async dalilCareerTurn(p) {
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
    },
  };
}
