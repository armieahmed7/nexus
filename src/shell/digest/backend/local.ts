// F36 (W5 · E5) LocalBackend RPCs for the personal digest. Installed on every LocalRpc by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009155001_kafaa_w5e5_digest_dalil.sql (kafaa_build_digest, kafaa_set_digest_prefs,
// kafaa_digest_stats): same checks in the same order, refusal codes, messages and audit rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { SCHEMA } from '../../../data/schema';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import {
  PREFS_MSG, buildDigestItems, checkPrefs, digestId, digestNotice, digestNoticeId, digestStats, dubaiHour, hintOk, inQuietHours, periodOf, prefsOf,
  type DigestData, type DigestHints,
} from '../rules';
import type { DigestBuildResult, DigestRpc } from './rpc';

const TABLES: (keyof DigestData)[] = [
  'people', 'qual_records', 'qual_standards', 'licences', 'skill_checkins', 'skill_ratings', 'mentoring_requests', 'mentoring_agreements', 'mentoring_sessions', 'opportunities',
  'opportunity_applications', 'career_conversations', 'refresh_state', 'refresh_prefs', 'enrolments', 'courses', 'person_skills', 'skills', 'role_competencies', 'career_paths',
  'career_targets', 'engine_settings', 'reco_optouts',
];
/** Everything the digest reads, straight from the in-memory tables (no RLS: the RPC is the gate and reads only the caller's items). */
export function localDigestData(b: LocalBackend): DigestData {
  const has = (t: string) => Object.prototype.hasOwnProperty.call(SCHEMA, t);
  return Object.fromEntries(TABLES.map((t) => [t, has(t) ? (b.raw(t as never) as unknown as Record<string, unknown>[]) : []])) as unknown as DigestData;
}
export const quietMessage = (end: number) => `Quiet hours until ${String(end).padStart(2, '0')}:00: your digest will be ready after that`;

export function makeLocalDigest(b: LocalBackend, h: LocalRpcHelpers): DigestRpc {
  return {
    async buildDigest(hints = null) {
      await b.whenReady();
      type R = DigestBuildResult;
      const me = b.identity().personId;
      const refuse = (code: string, msg: string, role: string | null = null, entity: string | null = null) => h.refuse<R>('digest.build', 'digest_runs', entity, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to see your digest');
      const role = b.access().actingRole('notifications', ['Own']);
      if (!role) return refuse('forbidden', 'Digests are for signed-in staff');
      if (hints != null && (typeof hints !== 'object' || Array.isArray(hints))) return refuse('invalid', 'Unreadable digest hints', role);
      const coach = (hints as DigestHints | null)?.coach;
      if (coach != null && !hintOk(coach)) return refuse('invalid', 'The coach suggestion could not be read', role);
      const prefs = prefsOf(b.raw('digest_prefs').find((p) => p.person_id === me));
      if (!prefs.enabled) return refuse('nudges_off', 'Nudges are off: turn them on in your settings to get a digest', role);
      const today = todayIso();
      const period = periodOf(today, prefs.frequency);
      const id = digestId(me, period);
      const cur = b.rawGet('digest_runs', id);
      if (cur) {
        return h.done<R>('digest.build', 'digest_runs', id, `${period}: exists`, role, null, '', 'Your digest for this period is ready',
          { run_id: id, period, created: false, items: cur.items as never, notification_id: cur.notification_id ?? null });
      }
      if (inQuietHours(dubaiHour(new Date()), prefs.quiet_start, prefs.quiet_end)) return refuse('quiet_hours', quietMessage(prefs.quiet_end as number), role);
      const items = buildDigestItems(localDigestData(b), me, today, prefs, (hints as DigestHints | null) ?? {});
      const ts = nowTs();
      let nid: string | null = null;
      if (items.length) {
        nid = digestNoticeId(me, period);
        const n = digestNotice(items, prefs.frequency);
        if (!b.rawGet('notifications', nid)) b.rawInsert('notifications', { id: nid, person_id: me, kind: 'digest', ...n, link: '/my#digest', created_at: ts, read_at: null } as never);
      }
      b.rawInsert('digest_runs', { id, person_id: me, period, frequency: prefs.frequency, as_of: today, items, item_count: items.length, notification_id: nid, coach_hint: items.some((i) => i.ref_table === 'coach'), built_at: ts } as never);
      return h.done<R>('digest.build', 'digest_runs', id, `${period}: ${items.length} items`, role, null, '', items.length ? `Your digest is ready: ${items.length} items` : 'Nothing needs your attention this period',
        { run_id: id, period, created: true, items, notification_id: nid }, ['digest_runs', 'notifications']);
    },

    async setDigestPrefs(p) {
      await b.whenReady();
      const me = b.identity().personId;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<{ id: string }>('digest.prefs', 'digest_prefs', me ? `dp:${me}` : null, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to change your nudge settings');
      const role = b.access().actingRole('notifications', ['Own']);
      if (!role) return refuse('forbidden', 'Digests are for signed-in staff');
      if (!p || typeof p !== 'object' || Array.isArray(p)) return refuse('invalid', PREFS_MSG.enabled, role);
      const bad = checkPrefs(p);
      if (bad) return refuse('invalid', bad, role);
      const id = `dp:${me}`;
      const muted = [...new Set(p.muted_kinds)].sort();
      const qs = p.quiet_start ?? null, qe = p.quiet_end ?? null;
      const row = { enabled: p.enabled, frequency: p.frequency, quiet_start: qs, quiet_end: qe, muted_kinds: muted, updated_at: nowTs() };
      if (b.rawGet('digest_prefs', id)) b.rawUpdate('digest_prefs', id, row as never);
      else b.rawInsert('digest_prefs', { id, person_id: me, ...row } as never);
      const quiet = qs == null ? 'no quiet hours' : `quiet ${qs}-${qe}`;
      return h.done('digest.prefs', 'digest_prefs', id, `${p.enabled ? 'on' : 'off'}, ${p.frequency}, ${quiet}, muted: ${muted.join(',') || 'none'}`, role, null, '',
        p.enabled ? 'Nudge settings saved' : 'Nudges are off: no new digests until you turn them back on', { id }, ['digest_prefs']);
    },

    async digestStats() {
      await b.whenReady();
      const roles = b.identity().roles as string[];
      if (!roles.includes('admin') && !roles.includes('auditor')) throw new Error("Kafa'a · digest statistics are aggregate-only and for admins and auditors");
      return digestStats(b.raw('digest_runs') as never, b.raw('notifications').filter((n) => n.kind === 'digest') as never, b.raw('digest_prefs') as never);
    },
  };
}
