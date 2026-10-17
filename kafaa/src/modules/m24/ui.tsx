// M24 shared page pieces (F20 KLRA, F21 knowledge capture): label lookups, status pills, factor dots, the IAEA risk matrix, the
// method sources and the optional-route check for mitigation links. Pages never import backend/*.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useRepo, type RowOf } from '../../data';
import { usePick, useT, useFormat } from '../../i18n';
import { SourceLink, StatusPill, type PillTone } from '../../ui';
import { bandOf, type Band, type Thresholds } from './klra';

/** Reference data every M24 page labels with (all staff-readable). */
export function useKcRefs() {
  const repo = useRepo();
  return useQuery(['skills', 'job_roles', 'qual_standards', 'oe_lessons', 'courses', 'competencies', 'refusal_policies', 'job_families'], async () => {
    const [skills, roles, standards, oe, courses, comps, policies, families] = await Promise.all([
      repo.list('skills', { order: [['sort', 'asc']] }),
      repo.list('job_roles', { order: [['sort', 'asc']] }),
      repo.list('qual_standards').catch(() => [] as RowOf<'qual_standards'>[]),
      repo.list('oe_lessons').catch(() => [] as RowOf<'oe_lessons'>[]),
      repo.list('courses').catch(() => [] as RowOf<'courses'>[]),
      repo.list('competencies').catch(() => [] as RowOf<'competencies'>[]),
      repo.list('refusal_policies').catch(() => [] as RowOf<'refusal_policies'>[]),
      repo.list('job_families').catch(() => [] as RowOf<'job_families'>[]),
    ]);
    const sec = new Set(comps.filter((c) => c.domain === 'security').map((c) => c.id));
    const safeSkills = skills.filter((s) => s.area !== 'security' && !sec.has(s.competency_id));
    const safeCourses = courses.filter((c) => !(c.competency_ids ?? []).some((id) => sec.has(id)));
    return { skills, safeSkills, roles, standards: standards.filter((q) => !q.security_restricted), oe: oe.filter((o) => o.status === 'published'), courses, safeCourses, policies, families };
  });
}
export type KcRefs = NonNullable<ReturnType<typeof useKcRefs>['data']>;

export function useKcLabels(refs: KcRefs | undefined) {
  const pick = usePick();
  const t = useT();
  return useMemo(() => {
    const m = <R extends { id: string }>(xs: R[] | undefined) => new Map((xs ?? []).map((x) => [x.id, x]));
    const sk = m(refs?.skills), ro = m(refs?.roles), st = m(refs?.standards), oe = m(refs?.oe), co = m(refs?.courses), fa = m(refs?.families);
    return {
      skill: (id: string) => (sk.get(id) ? pick(sk.get(id), 'name') : id),
      role: (id: string | null | undefined) => (id && ro.get(id) ? pick(ro.get(id), 'title') : t('m24.common.noRole')),
      standard: (id: string) => (st.get(id) ? `${st.get(id)!.code} · ${pick(st.get(id), 'title')}` : id),
      oe: (id: string) => oe.get(id),
      course: (id: string) => co.get(id),
      family: (id: string | null | undefined) => (id && fa.get(id) ? pick(fa.get(id), 'name') : '—'),
    };
  }, [refs, pick, t]);
}

const BAND_TONE: Record<Band, PillTone> = { high: 'bad', medium: 'sim', low: 'ok' };
export function BandPill({ band }: { band: Band }) {
  const t = useT();
  return <StatusPill tone={BAND_TONE[band]} status={band}>{t(`m24.band.${band}`)}</StatusPill>;
}
const MIT_TONE: Record<string, PillTone> = { not_required: 'neutral', planned: 'info', done: 'ok', needed: 'sim', overdue: 'bad' };
export function MitigationPill({ state }: { state: string }) {
  const t = useT();
  return <StatusPill tone={MIT_TONE[state] ?? 'neutral'} status={state}>{t(`m24.mitigation.${state}`)}</StatusPill>;
}
const SESSION_TONE: Record<string, PillTone> = { planned: 'info', held: 'accent', transcribed: 'ok', cancelled: 'neutral' };
export function SessionPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={SESSION_TONE[status] ?? 'neutral'} status={status}>{t(`m24.session.${status}`)}</StatusPill>;
}
const ASSET_TONE: Record<string, PillTone> = { draft: 'neutral', review: 'sim', published: 'ok', withdrawn: 'bad' };
export function AssetPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={ASSET_TONE[status] ?? 'neutral'} status={status}>{t(`m24.asset.${status}`)}</StatusPill>;
}
const ACTION_TONE: Record<string, PillTone> = { planned: 'info', in_progress: 'accent', done: 'ok', cancelled: 'neutral' };
export function ActionPill({ status, overdue }: { status: string; overdue?: boolean }) {
  const t = useT();
  return <StatusPill tone={overdue ? 'bad' : ACTION_TONE[status] ?? 'neutral'} status={status}>{overdue ? t('m24.action.overdue') : t(`m24.action.${status}`)}</StatusPill>;
}

/** A 1-5 factor as five dots with a screen-reader label. */
export function FactorDots({ value, label }: { value: number; label: string }) {
  const f = useFormat();
  return (
    <span className="relative inline-flex items-center gap-0.5" title={label} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden className={`h-2 w-2 rounded-full ${i <= value ? (value >= 4 ? 'bg-bad' : value === 3 ? 'bg-sim' : 'bg-accent') : 'bg-sunken ring-1 ring-line'}`} />)}
      <span className="num ms-1 text-[12px] text-ink-2" aria-hidden>{f.num(value)}</span>
    </span>
  );
}

/**
 * The IAEA KLRM 5 x 5 matrix: attrition (rows, 5 at the top) x position (columns). Each cell counts the positions the caller may
 * see individually (KM owner or department head) and is shaded by the band its product falls in.
 */
export function RiskMatrix({ rows, thresholds, onPick, selected }: { rows: { attrition_factor: number; position_factor: number }[]; thresholds: Thresholds; onPick?: (a: number, p: number) => void; selected?: [number, number] | null }) {
  const t = useT();
  const f = useFormat();
  const count = (a: number, p: number) => rows.filter((r) => r.attrition_factor === a && r.position_factor === p).length;
  const shade: Record<Band, string> = { high: 'bg-bad-bg text-bad', medium: 'bg-sim-bg text-sim', low: 'bg-ok-bg text-ok' };
  return (
    <div className="overflow-x-auto" data-testid="m24-risk-matrix">
      <table className="border-separate border-spacing-1 text-[12px]">
        <caption className="sr-only">{t('m24.klra.matrixCaption')}</caption>
        <thead>
          <tr>
            <th className="caps pe-2 text-start align-bottom">{t('m24.klra.attrition')} ↓ / {t('m24.klra.position')} →</th>
            {[1, 2, 3, 4, 5].map((p) => <th key={p} scope="col" className="caps w-14 text-center">{f.num(p)}</th>)}
          </tr>
        </thead>
        <tbody>
          {[5, 4, 3, 2, 1].map((a) => (
            <tr key={a}>
              <th scope="row" className="caps pe-2 text-end">{f.num(a)}</th>
              {[1, 2, 3, 4, 5].map((p) => {
                const n = count(a, p);
                const band = bandOf(a * p, thresholds);
                const sel = selected && selected[0] === a && selected[1] === p;
                return (
                  <td key={p} className="p-0">
                    <button type="button" disabled={!n || !onPick} onClick={() => onPick?.(a, p)} aria-pressed={!!sel}
                      aria-label={t('m24.klra.matrixCell', { a, p, total: a * p, n })}
                      className={`h-12 w-14 rounded-md text-center ${shade[band]} ${n ? 'font-semibold' : 'opacity-50'} ${sel ? 'ring-2 ring-ink' : ''} disabled:cursor-default`}>
                      <span className="num block text-[15px]">{n ? f.num(n) : '·'}</span>
                      <span className="num block text-[10px] opacity-80">{f.num(a * p)}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Published method sources (IAEA KLRM guidance, the CNS national report on FANR's KLRA practice, KHNP OSSA support to 2030). */
export const METHOD_SOURCES = [
  { label: 'IAEA NG-T-6.11, Knowledge Loss Risk Management in Nuclear Organizations (2017)', url: 'https://www.iaea.org/node/41993', as_of: '2026-10-08' },
  { label: 'UAE National Report, 10th CNS Review Meeting (2026)', url: 'https://www.iaea.org/sites/default/files/cns-10th-review-meeing-uae-national-report_ae1.pdf', as_of: '2026-10-08' },
  { label: 'WNN: agreement assures Korean expert support for UAE plant', url: 'https://world-nuclear-news.org/articles/agreement-assures-korean-expert-support-for-uae-pl', as_of: '2026-10-08' },
];
export const CAPTURE_SOURCES = [
  { label: 'IAEA knowledge management: structured interviews and retiree capture', url: 'https://www.iaea.org/node/40917', as_of: '2026-10-08' },
  { label: 'Sandia: retaining knowledge with recorded interviews and searchable transcripts', url: 'https://newsreleases.sandia.gov/?p=18997', as_of: '2026-10-08' },
];
export function Sources({ list }: { list: { label: string; url: string; as_of: string }[] }) {
  const f = useFormat();
  return <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="m24-sources">{list.map((s) => <SourceLink key={s.url} href={s.url} date={f.date(s.as_of)}>{s.label}</SourceLink>)}</span>;
}

/** Does a route exist in this build? Mitigation links to features of other waves degrade gracefully when they do not. */
export function useRouteExists(path: string): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    import('../../routes/registry').then((m) => { if (live) setOk(!!m.routeForPath(path)); }).catch(() => undefined);
    return () => { live = false; };
  }, [path]);
  return ok;
}

export function Chips({ items, empty }: { items: ReactNode[]; empty?: ReactNode }) {
  if (!items.length) return <span className="text-[12.5px] text-ink-3">{empty ?? '—'}</span>;
  return <span className="flex flex-wrap gap-1.5">{items.map((x, i) => <span key={i} className="chip border-line bg-sunken text-ink-2 [&_a]:text-eyebrow">{x}</span>)}</span>;
}

/** A labelled multi-select of checkboxes in a scrollable box (skills, standards). */
export function MultiPick({ label, options, value, onChange, max, testId }: { label: string; options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max: number; testId?: string }) {
  const t = useT();
  const [q, setQ] = useState('');
  const shown = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <fieldset className="min-w-0" data-testid={testId}>
      <legend className="caps">{label} <span className="text-ink-3">({value.length}/{max})</span></legend>
      <input className="input mt-1" placeholder={t('m24.common.filter')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('m24.common.filter')} />
      <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-line p-2">
        {shown.map((o) => (
          <label key={o.id} className="flex items-center gap-2 py-0.5 text-[13px]">
            <input type="checkbox" checked={value.includes(o.id)} disabled={!value.includes(o.id) && value.length >= max} onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))} />
            <span className="min-w-0 truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
