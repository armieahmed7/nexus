// F24 (W3 · E5): per-surface opt-out of ranked recommendations, used by the surfaces themselves (Career Navigator /my/career,
// Learning Coach /my/coach, Opportunity marketplace /opportunities). When the person opted out, the surface shows an
// unranked list (catalogue, roles, opportunities by start date) and this banner instead of ranked cards. The choice is made
// on /my/settings (RecoControlsCard) through rpc.setRecoOptout.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, Callout, EmptyState, Icon, StatusPill } from '../../ui';
import type { OptoutSurface } from './fairness';

/** Has the signed-in person opted out of ranked recommendations on this surface? (own row, read through RLS) */
export function useRecoOptOut(surface: OptoutSurface) {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery('reco_optouts', () => (me ? repo.list('reco_optouts', { filter: { person_id: me } }).catch(() => []) : Promise.resolve([])), [me]);
  const row = q.data?.find((r) => r.surface === surface) ?? null;
  return { optedOut: !!row?.opted_out, loading: q.loading, row };
}

/** The notice a surface shows instead of its ranked cards. */
export function RecoOptedOut({ surface }: { surface: OptoutSurface }) {
  const t = useT();
  return (
    <div data-testid="m16-opted-out" data-surface={surface}>
      <Callout tone="info" title={t('m16.ai.optedOut.title', { surface: t(`m16.ai.surface.${surface}`) })}>
        <p>{t(`m16.ai.optedOut.body.${surface}`)}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-3">
          <L to="/my/settings#recommendations" className="inline-flex items-center gap-1 font-semibold" data-testid="m16-opted-out-settings">
            <Icon name="filter" size={13} />{t('m16.ai.optedOut.change')}
          </L>
          <span className="text-[12.5px] text-ink-3">{t('m16.ai.optedOut.note')}</span>
        </p>
      </Callout>
    </div>
  );
}

/** Coach opt-out: the staff course catalogue in plain alphabetical order (by code), with a text filter. No scores, no reasons. */
export function UnrankedCatalogue() {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const [term, setTerm] = useState('');
  const q = useQuery('courses', () => repo.list('courses', { filter: { audience: 'staff' } }));
  return (
    <section className="space-y-3" aria-labelledby="m16-unranked-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="m16-unranked-title" className="text-[17px] font-semibold">{t('m16.ai.unranked.catalogueTitle')}</h2>
          <p className="text-[13px] text-ink-2">{t('m16.ai.unranked.catalogueBody')}</p>
        </div>
        <label className="flex min-w-[220px] flex-col gap-1">
          <span className="caps">{t('m16.ai.unranked.filter')}</span>
          <input className="input" type="search" value={term} onChange={(e) => setTerm(e.target.value)} data-testid="m16-unranked-filter" />
        </label>
      </div>
      <Async state={q} empty={<EmptyState icon="book" title={t('m16.ai.unranked.none')} />}>
        {(rows) => {
          const s = term.trim().toLowerCase();
          const list = [...rows].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)).filter((c) => !s || `${c.code} ${c.title_en} ${c.title_ar}`.toLowerCase().includes(s));
          return (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="m16-unranked-catalogue">
              {list.map((c) => (
                <li key={c.id} className="card min-w-0 p-3">
                  <div className="font-mono text-[11.5px] text-ink-3" dir="ltr">{c.code}</div>
                  <L to={`/learn/course/${c.id}`} className="block truncate font-semibold" title={pick(c, 'title')}>{pick(c, 'title')}</L>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                    <StatusPill tone="neutral">{t(`m16.ai.unranked.modality.${c.modality}`)}</StatusPill>
                    {c.duration_hours != null && <span>{t('m16.ai.unranked.hours', { n: f.num(Number(c.duration_hours)) })}</span>}
                    {c.mandatory && <StatusPill tone="info">{t('m16.ai.unranked.mandatory')}</StatusPill>}
                  </div>
                </li>
              ))}
            </ul>
          );
        }}
      </Async>
    </section>
  );
}

/** Navigator opt-out: the published roles grouped by job family, alphabetical. No readiness, no ranking. */
export function UnrankedRoles() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['job_roles', 'job_families'], async () => {
    const [roles, families] = await Promise.all([repo.list('job_roles'), repo.list('job_families', { order: [['sort', 'asc']] })]);
    return { roles, families };
  });
  return (
    <section className="space-y-3" aria-labelledby="m16-roles-title">
      <div>
        <h2 id="m16-roles-title" className="text-[17px] font-semibold">{t('m16.ai.unranked.rolesTitle')}</h2>
        <p className="text-[13px] text-ink-2">{t('m16.ai.unranked.rolesBody')} <L to="/careers/paths">{t('m16.ai.unranked.paths')}</L></p>
      </div>
      <Async state={q}>
        {(d) => <RoleGroups d={d} pick={pick} />}
      </Async>
    </section>
  );
}
function RoleGroups({ d, pick }: { d: { roles: { id: string; family_id: string; title_en: string; title_ar: string; status?: string | null }[]; families: { id: string; name_en: string; name_ar: string }[] }; pick: ReturnType<typeof usePick> }) {
  const groups = useMemo(() => d.families.map((fam) => ({ fam, roles: d.roles.filter((r) => r.family_id === fam.id && (r.status ?? 'published') === 'published').sort((a, b) => (pick(a, 'title') < pick(b, 'title') ? -1 : 1)) })).filter((g) => g.roles.length), [d, pick]);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m16-unranked-roles">
      {groups.map(({ fam, roles }) => (
        <div key={fam.id} className="card min-w-0 p-3">
          <div className="caps mb-1.5">{pick(fam, 'name')}</div>
          <ul className="flex flex-wrap gap-1.5">
            {roles.map((r) => <li key={r.id}><L to={`/careers/roles/${r.id}`} className="chip border-line bg-panel">{pick(r, 'title')}</L></li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
