// FS05 (wave A · E4) shared UI for future role profiles: data hook, benchmark chips, the "Now, 2030, 2035" panel and the
// concept-role banner. Rules live in ./roleProfiles (import-free); this file only renders. Benchmarks read kafaa_benchmarks
// (FS01) when that table is registered and otherwise fall back to the three FS05 rows of PLAN.md section 4.
import { useMemo, useState } from 'react';
import { Card, Callout, StatusPill, SourceLink, Icon, Drawer, WhyThis, EmptyState } from '../../ui';
import { useQuery, useRepo } from '../../data';
import type { RowOf, Table } from '../../data';
import { SCHEMA } from '../../data/schema';
import { useT, usePick, useFormat, useLang, L } from '../../i18n';
import { useSession } from '../../auth/session';
import type { Reason } from '../../domain/engines/types';
import { HORIZONS, diffProfiles, publishedByHorizon, reasonsFor, reqsOf, type DiffRow, type Horizon, type ProfileReq, type ProfileSource } from './roleProfiles';

export type ProfileRow = RowOf<'role_profile_versions'>;

/** Profile versions the caller can see (RLS: published for everyone; drafts and history for training, admins and auditors),
 *  plus the labels needed to render requirements. */
export function useProfileData() {
  const repo = useRepo();
  return useQuery(['role_profile_versions', 'competencies', 'skills', 'proficiency_levels'], async () => {
    const [versions, comps, skills, levels] = await Promise.all([
      repo.list('role_profile_versions', { order: [['role_id', 'asc'], ['horizon', 'asc'], ['version', 'asc']] }),
      repo.list('competencies'),
      repo.list('skills'),
      repo.list('proficiency_levels', { order: [['level', 'asc']] }),
    ]);
    return {
      versions,
      comps: new Map(comps.map((c) => [c.id, c])),
      skills: new Map(skills.map((s) => [s.id, s])),
      levels: new Map(levels.map((l) => [l.level, l])),
      compDomain: new Map(comps.map((c) => [c.id, c.domain])),
      skillArea: new Map(skills.map((s) => [s.id, s.area])),
    };
  });
}
export type ProfileData = NonNullable<ReturnType<typeof useProfileData>['data']>;

/** Label of a requirement reference (competency code + name, or skill name). */
export function useReqLabel(data: ProfileData | undefined) {
  const pick = usePick();
  return (r: Pick<ProfileReq, 'kind' | 'ref_id'>) => {
    if (r.kind === 'competency') {
      const c = data?.comps.get(r.ref_id);
      return c ? `${c.code} · ${pick(c, 'name')}` : r.ref_id;
    }
    const s = data?.skills.get(r.ref_id);
    return s ? pick(s, 'name') : r.ref_id;
  };
}

/** Can the signed-in person maintain role profiles (training manager or admin; the RPC enforces it again)? */
export function useCanEditProfiles() {
  const s = useSession();
  return s.hasRole('training_manager', 'admin');
}

// ───────────── benchmarks (FS01 kafaa_benchmarks when present; PLAN.md section 4 fallback)
interface Bench {
  id: string;
  name_en: string;
  name_ar: string;
  owner: string;
  year: string;
  urls: string[];
  borrow_en: string;
  borrow_ar: string;
  as_of: string;
}
const FALLBACK: Record<string, Bench> = {
  'SG-JTM': {
    id: 'SG-JTM', name_en: 'Jobs Transformation Maps', name_ar: 'خرائط تحوّل الوظائف', owner: 'Workforce Singapore', year: '2025',
    urls: ['https://wsg.gov.sg/for-employers/jobs-transformation-maps.html', 'https://www.mom.gov.sg/newsroom/parliament-questions-and-replies/2025/1104-written-answer-to-pq-on-update-on-jobs-transformation-maps'],
    borrow_en: 'A per-role transformation page: technology drivers, tasks added or removed, the redesigned profile and a dated reskilling path.',
    borrow_ar: 'صفحة تحوّل لكل دور: المحركات التقنية، والمهام المضافة أو المحذوفة، والملف المعاد تصميمه، ومسار إعادة تأهيل مؤرخ.', as_of: '2026-10-10',
  },
  'SSG-SF': {
    id: 'SSG-SF', name_en: 'SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks', name_ar: 'أطر مهارات SkillsFuture والمهارات الأساسية الحرجة وإمكانات الذكاء الاصطناعي في المهام', owner: 'SkillsFuture Singapore', year: '2025',
    urls: ['https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf'],
    borrow_en: 'A task layer between role and skill, AI exposure per task, role archetypes with ladder-rung protection, and a core-skills set.',
    borrow_ar: 'طبقة مهام بين الدور والمهارة، وتعرّض كل مهمة للذكاء الاصطناعي، ونماذج أدوار تحمي درجات السلم الوظيفي، ومجموعة مهارات أساسية.', as_of: '2026-10-10',
  },
  'IAEA-WFP': {
    id: 'IAEA-WFP', name_en: 'IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework', name_ar: 'دليل الوكالة الدولية للطاقة الذرية NG-T-3.10 لتخطيط القوى العاملة وإطار كفاءات البنية التحتية النووية', owner: 'IAEA', year: '2011',
    urls: ['https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf', 'https://www.iaea.org/sites/default/files/20/11/nicf.pdf'],
    borrow_en: 'Scenario bands rather than point estimates, a fill plan per gap, and a "why this competency exists" link to its activity.',
    borrow_ar: 'نطاقات سيناريوهات بدلاً من تقديرات نقطية، وخطة سدّ لكل فجوة، ورابط "لماذا توجد هذه الكفاءة" بنشاطها.', as_of: '2026-10-10',
  },
};
export const FS05_BENCHMARKS = ['SG-JTM', 'SSG-SF', 'IAEA-WFP'];

function useBenchmarks(ids: string[]) {
  const repo = useRepo();
  const has = Object.prototype.hasOwnProperty.call(SCHEMA, 'benchmarks');
  return useQuery((has ? ['benchmarks'] : ['job_roles']) as Table[], async () => {
    let rows: Record<string, unknown>[] = [];
    if (has) rows = (await repo.list('benchmarks' as Table).catch(() => [])) as unknown as Record<string, unknown>[];
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    return ids.map((id): Bench => {
      const r = byId.get(id);
      if (!r) return FALLBACK[id] ?? { id, name_en: id, name_ar: id, owner: '', year: '', urls: [], borrow_en: '', borrow_ar: '', as_of: '' };
      return {
        id, name_en: String(r.name_en ?? id), name_ar: String(r.name_ar ?? r.name_en ?? id), owner: String(r.owner ?? ''), year: String(r.year ?? ''),
        urls: Array.isArray(r.urls) ? (r.urls as string[]) : [], borrow_en: String(r.borrow_en ?? ''), borrow_ar: String(r.borrow_ar ?? ''), as_of: String(r.as_of ?? ''),
      };
    });
  }, [has, ids.join(',')]);
}

/** Benchmark chips (name, year) that open a drawer with what Kafa'a borrows and the source links. */
export function BenchmarkChips({ ids = FS05_BENCHMARKS }: { ids?: string[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const q = useBenchmarks(ids);
  const [open, setOpen] = useState<Bench | null>(null);
  if (!q.data) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="m01-benchmarks">
      <span className="caps me-1">{t('m01.fs05.bench.label')}</span>
      {q.data.map((b) => (
        <button key={b.id} type="button" className="chip border-line bg-panel text-ink-2 hover:border-accent" onClick={() => setOpen(b)} data-testid="m01-benchmark-chip">
          <Icon name="book" size={12} className="me-1 inline" />
          {pick(b, 'name')} · <span className="num">{b.year}</span>
        </button>
      ))}
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? pick(open, 'name') : ''}>
        {open && (
          <div className="space-y-3 text-[14px]">
            <div className="caps">
              {open.owner} · <span className="num">{open.year}</span>
            </div>
            <p className="text-ink-2">{t('m01.fs05.bench.borrow')}</p>
            <p>{pick(open, 'borrow')}</p>
            <ul className="space-y-1">
              {open.urls.map((u) => (
                <li key={u}>
                  <SourceLink href={u} date={open.as_of ? f.date(open.as_of) : null}>
                    {new URL(u).hostname}
                  </SourceLink>
                </li>
              ))}
            </ul>
            <p className="text-[12.5px] text-ink-3">{t('m01.fs05.bench.note')}</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/** Planning-assumption notice shown wherever a 2030/2035 profile appears. */
export function PlanningNotice() {
  const t = useT();
  return (
    <Callout tone="sim" title={t('m01.fs05.planning.title')}>
      {t('m01.fs05.planning.body')}
    </Callout>
  );
}

/** Concept-role banner (no vacancy, no deployment decision). */
export function ConceptBanner() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-sim-bg p-3 text-[13.5px] text-sim" role="note" data-testid="m01-concept-banner">
      <StatusPill tone="sim">{t('m01.fs05.concept.pill')}</StatusPill>
      <span>{t('m01.fs05.concept.banner')}</span>
    </div>
  );
}

const CHANGE_TONE: Record<string, 'ok' | 'info' | 'neutral' | 'sim' | 'accent'> = { new: 'ok', raised: 'info', same: 'neutral', lowered: 'sim', dropped: 'sim' };

/** The "Now, 2030, 2035" panel for one role: horizon switch, what changes against the previous horizon, why, drivers, sources. */
export function HorizonPanel({ roleId, pathOnly, concept, data }: { roleId: string; pathOnly: boolean; concept: boolean; data: ProfileData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const lang = useLang();
  const label = useReqLabel(data);
  const canEdit = useCanEditProfiles();
  const byH = useMemo(() => publishedByHorizon(data.versions, roleId), [data.versions, roleId]);
  const available = HORIZONS.filter((h) => byH[h]);
  const [sel, setSel] = useState<Horizon | null>(null);
  const h: Horizon | undefined = sel && byH[sel] ? sel : available.includes('2030') ? '2030' : available[0];
  const drafts = data.versions.filter((v) => v.role_id === roleId && v.status === 'draft');
  if (!h)
    return (
      <EmptyState title={t('m01.fs05.panel.none')} icon="info">
        {t('m01.fs05.panel.noneBody')}
      </EmptyState>
    );
  const cur = byH[h]!;
  const prevH = HORIZONS[HORIZONS.indexOf(h) - 1];
  const prev = prevH ? byH[prevH] : undefined;
  const diff: DiffRow[] = diffProfiles(reqsOf(prev), reqsOf(cur));
  const counts = { new: diff.filter((d) => d.change === 'new').length, raised: diff.filter((d) => d.change === 'raised').length, same: diff.filter((d) => d.change === 'same').length };
  const srcs = (Array.isArray(cur.sources) ? (cur.sources as ProfileSource[]) : []).filter((s) => s && s.url);
  return (
    <div className="space-y-4" data-testid="m01-horizon-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-card border border-line bg-panel p-0.5" role="tablist" aria-label={t('m01.fs05.panel.horizons')} data-testid="m01-horizon-switch">
          {HORIZONS.map((x) => (
            <button
              key={x}
              role="tab"
              aria-selected={x === h}
              disabled={!byH[x]}
              className={`rounded-[6px] px-3 py-1.5 text-[13px] font-semibold ${x === h ? 'bg-accent text-white' : 'text-ink-2 disabled:text-ink-3'}`}
              onClick={() => setSel(x)}
              data-testid={`m01-horizon-${x}`}
            >
              {t(`m01.fs05.h.${x}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2">
          <StatusPill status={cur.status} />
          <span>{t('m01.fs05.panel.version', { n: f.num(cur.version) })}</span>
          {cur.published_at && <span>· {t('m01.fs05.panel.publishedOn', { date: f.date(cur.published_at) })}</span>}
          {canEdit && (
            <L to={`/careers/roles/${roleId}/profile?h=${h}`} className="btn-outline btn-sm ms-1" data-testid="m01-edit-profile">
              <Icon name="sparkle" size={13} className="me-1 inline" />
              {drafts.length ? t('m01.fs05.panel.editDrafts', { n: f.num(drafts.length) }) : t('m01.fs05.panel.edit')}
            </L>
          )}
        </div>
      </div>
      {h !== 'now' && <PlanningNotice />}
      {pathOnly ? (
        <Callout tone="info" title={t('m01.fs05.panel.pathOnlyTitle')}>
          {t('m01.fs05.panel.pathOnlyBody')}
        </Callout>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card title={t('m01.fs05.panel.why')}>
              <p className="text-[14px]">{pick(cur, 'rationale')}</p>
              {cur.drivers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5" data-testid="m01-drivers">
                  <span className="caps me-1">{t('m01.fs05.panel.drivers')}</span>
                  {cur.drivers.map((d) => (
                    <StatusPill key={d} tone="accent">
                      {t(`m01.fs05.driver.${d}`)}
                    </StatusPill>
                  ))}
                </div>
              )}
            </Card>
            <Card title={prev ? t('m01.fs05.panel.vs', { h: t(`m01.fs05.h.${prevH}`) }) : concept ? t('m01.fs05.panel.conceptStart') : t('m01.fs05.panel.today')}>
              <dl className="grid grid-cols-3 gap-2 text-center" data-testid="m01-change-counts">
                {(['new', 'raised', 'same'] as const).map((k) => (
                  <div key={k} className="rounded-card bg-sunken p-2">
                    <dt className="text-[11.5px] text-ink-3">{t(`m01.fs05.change.${k}`)}</dt>
                    <dd className="num text-[20px] font-semibold">{f.num(counts[k])}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="table-base w-full" data-testid="m01-horizon-reqs">
              <caption className="sr-only">{t('m01.fs05.panel.caption', { h: t(`m01.fs05.h.${h}`) })}</caption>
              <thead>
                <tr>
                  <th className="text-start">{t('m01.fs05.panel.requirement')}</th>
                  <th className="text-start">{t('m01.fs05.panel.level')}</th>
                  <th className="text-start">{t('m01.fs05.panel.importance')}</th>
                  <th className="text-start">{t('m01.fs05.panel.change')}</th>
                  <th className="text-start">
                    <span className="sr-only">{t('common.engines.whyThis')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {diff.map((d) => (
                  <tr key={d.key} className={d.change === 'dropped' ? 'text-ink-3' : ''}>
                    <td>
                      <span className="me-1.5 text-[11px] uppercase text-ink-3">{t(`m01.fs05.kind.${d.kind}`)}</span>
                      {label(d)}
                    </td>
                    <td className="whitespace-nowrap">
                      {d.change === 'raised' || d.change === 'lowered' ? (
                        <span className="num">
                          {f.num(d.from)} {lang === 'ar' ? '←' : '→'} {f.num(d.to)}
                        </span>
                      ) : (
                        <span className="num">{f.num(d.change === 'dropped' ? d.from : d.to)}</span>
                      )}
                      <span className="ms-1 text-[12px] text-ink-3">{pick(data.levels.get(d.change === 'dropped' ? d.from : d.to), 'name')}</span>
                    </td>
                    <td>
                      <StatusPill tone={d.importance === 'core' ? 'accent' : 'neutral'}>{t(`m01.importance.${d.importance}`)}</StatusPill>
                    </td>
                    <td>
                      <StatusPill tone={CHANGE_TONE[d.change]}>{t(`m01.fs05.change.${d.change}`)}</StatusPill>
                    </td>
                    <td>
                      <WhyThis reasons={reasonsFor(d, t(`m01.fs05.h.${h}`)) as Reason[]} testId={`m01-why-${d.ref_id}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Card title={t('m01.sources')} footer={t('m01.fs05.panel.sourcesNote')}>
        <ul className="space-y-1" data-testid="m01-horizon-sources">
          {srcs.map((s) => (
            <li key={s.id + s.url}>
              <SourceLink href={s.url} date={s.as_of ? f.date(s.as_of) : null}>
                {s.label}
              </SourceLink>
            </li>
          ))}
        </ul>
      </Card>
      <BenchmarkChips />
    </div>
  );
}
