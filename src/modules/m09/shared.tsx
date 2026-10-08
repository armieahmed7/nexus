// M09 shared helpers: status labels, category chips, source lists, organisation context, file fingerprints and history timelines.
import { useMemo, type ReactNode } from 'react';
import { StatusPill, SourceLink, Timeline, type PillTone } from '../../ui';
import { useFormat, useLang, useT } from '../../i18n';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { ROLE_LABELS, type PlatformRole } from '../../auth/policy';

export type Org = RowOf<'organisations'>;
export type Source = { id?: string; label: string; url: string };

/** Directory groups (spec Section 9 filter list). Oversight is shown apart because regulators are not partners. */
export const CATEGORIES = ['ownership', 'design_build', 'om_support', 'fuel', 'advanced_rd', 'international_operators', 'local_supply_offtake', 'finance', 'education_workforce', 'technology_government', 'emergency_response', 'oversight'] as const;
export const REL_TYPES = ['contract', 'jv', 'mou', 'loi', 'framework', 'agreement', 'loan', 'membership', 'provider', 'shareholder', 'partnership', 'regulator', 'exercise', 'historic', 'proposal', 'supply', 'sca'] as const;
/** Relationship types that are evaluations rather than commitments unless a source says otherwise (spec M09 business rule). */
export const NON_BINDING = ['mou', 'loi', 'proposal', 'membership', 'exercise'];

const M09_STATUS_TONES: Record<string, PillTone> = {
  invited: 'neutral', in_progress: 'info', submitted: 'info', approved: 'ok', returned: 'sim', handed_off: 'accent',
  missing: 'neutral', uploaded: 'info', accepted: 'ok', rejected: 'bad',
  under_review: 'sim', equivalent: 'ok', training_required: 'sim',
  draft: 'neutral', reviewed: 'ok', not_started: 'neutral', done: 'ok',
  assigned: 'neutral', requested: 'neutral', enrolled: 'info', completed: 'ok', failed: 'bad', cancelled: 'neutral',
  active: 'ok', historic: 'neutral', exploratory: 'sim', valid: 'ok', expired: 'bad', revoked: 'bad',
};
/** Status pill with M09 labels in both languages (falls back to common.status.*). */
export function MStatus({ status }: { status: string | null | undefined }) {
  const t = useT();
  const s = status ?? '';
  const key = `m09.status.${s}`;
  const label = t(key) === key ? undefined : t(key);
  return <StatusPill status={s} tone={M09_STATUS_TONES[s]}>{label}</StatusPill>;
}

export function CategoryChips({ cats }: { cats: string[] }) {
  const t = useT();
  return (
    <span className="flex flex-wrap gap-1">
      {cats.map((c) => (
        <span key={c} className="chip border-line bg-sunken text-ink-2">
          {t(`m09.cat.${c}`)}
        </span>
      ))}
    </span>
  );
}

/** "as of" date for cited sources: the access date recorded in the citation registry. */
export function useSourceDates() {
  const repo = useRepo();
  const q = useQuery('sources', () => repo.list('sources'));
  return useMemo(() => new Map((q.data ?? []).map((s) => [s.id, s.accessed ?? null])), [q.data]);
}
export function SourceList({ sources, dates, compact }: { sources: Source[]; dates: Map<string, string | null>; compact?: boolean }) {
  const t = useT();
  const f = useFormat();
  if (!sources?.length) return <span className="text-[12.5px] text-bad">{t('m09.dir.noSource')}</span>;
  return (
    <ul className={compact ? 'flex flex-wrap gap-x-3 gap-y-1' : 'space-y-1'}>
      {sources.map((s, i) => {
        const d = s.id ? dates.get(s.id) : null;
        return (
          <li key={`${s.url}-${i}`}>
            <SourceLink href={s.url} date={d ? t('common.asOf', { date: f.date(d) }) : null}>
              {s.label}
            </SourceLink>
          </li>
        );
      })}
    </ul>
  );
}

/** The signed-in user's organisation (partner lens) and their partner rights. */
export function useMyOrg() {
  const s = useSession();
  const repo = useRepo();
  const orgId = s.identity.orgId;
  const q = useQuery('organisations', async () => (orgId ? repo.get('organisations', orgId) : null), [orgId]);
  return {
    orgId,
    org: q.data ?? null,
    loading: q.loading,
    isAdmin: s.roles.includes('partner_admin'),
    isPartner: s.roles.includes('partner_user') || s.roles.includes('partner_admin'),
    personId: s.identity.personId,
  };
}

export function useRoleName() {
  const lang = useLang();
  return (r: string | null | undefined) => {
    if (!r) return '—';
    const l = ROLE_LABELS[r as PlatformRole];
    return l ? (lang === 'ar' ? l.ar : l.en) : r;
  };
}

export type HistoryRow = { at: string; action: string; status: string; by_role: string | null; note: string | null };
const HIST_TONE: Record<string, PillTone> = { approved: 'ok', equivalent: 'ok', handed_off: 'accent', returned: 'sim', training_required: 'sim', rejected: 'bad', submitted: 'info', under_review: 'sim' };
/** Status-tracking timeline (newest first). Notes are shown as written by the actor. */
export function HistoryTimeline({ history }: { history: unknown }) {
  const t = useT();
  const f = useFormat();
  const roleName = useRoleName();
  const rows = (Array.isArray(history) ? (history as HistoryRow[]) : []).slice().reverse();
  if (!rows.length) return <p className="text-ink-3">{t('m09.history.empty')}</p>;
  return (
    <Timeline
      items={rows.map((h, i) => ({
        id: `${h.at}-${i}`,
        when: `${f.dateTime(h.at)} · ${roleName(h.by_role)}`,
        title: t(`m09.history.${h.action}`) === `m09.history.${h.action}` ? h.action : t(`m09.history.${h.action}`),
        detail: h.note ?? undefined,
        tone: HIST_TONE[h.status] ?? 'neutral',
      }))}
    />
  );
}

/** SHA-256 of a chosen file, computed in the browser. Only the name, size and fingerprint are recorded; the file stays with the supplier. */
export async function fileFingerprint(file: File): Promise<{ name: string; sizeKb: number; sha256: string }> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { name: file.name, sizeKb: Math.max(1, Math.ceil(file.size / 1024)), sha256 };
}

export function KV({ k, children }: { k: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <span className="text-[12.5px] text-ink-2">{k}</span>
      <span className="text-end text-[13px] font-medium">{children}</span>
    </div>
  );
}

/** Short hex fingerprint for display. */
export const shortHash = (h: string | null | undefined) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : '—');
