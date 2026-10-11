// M01 /careers/jobs: vacancy listing linked to ENEC's official careers channel. Kafa'a takes no job applications here;
// each listing links out. Sample listings are labelled. Reserved-for-UAE-nationals only where ENEC says so.
import { useMemo } from 'react';
import { Page, Async, DataTable, StatusPill, SimChip, Callout, FilterBar, useFilters, Icon, EmptyState } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, L, useFormat } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { useCareerData } from './shared';

export default function CareersJobsPage() {
  const t = useT();
  const pick = usePick();
  const fmt = useFormat();
  const repo = useRepo();
  const career = useCareerData();
  const q = useQuery(['vacancies'], () => repo.list('vacancies', { order: [['posted_on', 'desc']] }));
  const [flt, setFlt] = useFilters({ q: '', family: '', status: 'open', nationals: '' }, true);
  const today = todayIso();
  const rows = useMemo(() => {
    const roles = career.data?.roleById;
    const term = flt.q.trim().toLowerCase();
    return (q.data ?? []).filter((v) => {
      const st = v.status === 'open' && (!v.closes_on || v.closes_on >= today) ? 'open' : 'closed';
      if (flt.status && st !== flt.status) return false;
      if (flt.family && roles?.get(v.role_id ?? '')?.family_id !== flt.family) return false;
      if (flt.nationals && String(v.uae_nationals_only) !== flt.nationals) return false;
      return !term || [v.title_en, v.title_ar, v.location].some((s) => String(s).toLowerCase().includes(term));
    });
  }, [q.data, career.data, flt, today]);
  const official = q.data?.[0]?.official_url ?? 'https://www.enec.ae/careers-and-scholarships/careers/';
  return (
    <Page
      title={t('m01.routes.careers-jobs.title')}
      intro={t('m01.jobs.intro')}
      actions={
        <a className="btn-primary" href={official} target="_blank" rel="noopener noreferrer" data-testid="m01-jobs-official">
          {t('m01.jobs.official')} <Icon name="external" size={13} className="ms-1 inline" />
        </a>
      }
    >
      <Callout tone="info" title={t('m01.jobs.calloutTitle')}>
        {t('m01.jobs.calloutBody')}
      </Callout>
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="q"
        fields={[
          { key: 'status', label: t('m01.jobs.status'), options: [{ value: 'open', label: t('common.status.open') }, { value: 'closed', label: t('common.status.closed') }] },
          { key: 'family', label: t('m01.f.family'), options: (career.data?.families ?? []).map((x) => ({ value: x.id, label: pick(x, 'name') })) },
          { key: 'nationals', label: t('m01.jobs.nationals'), options: [{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }] },
        ]}
      />
      <Async state={q} empty={<EmptyState title={t('m01.jobs.none')} />}>
        {() => (
          <div data-testid="m01-jobs-table">
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              searchable={false}
              csvName="kafaa-vacancies"
              empty={<EmptyState title={t('m01.jobs.noneMatch')} />}
              initialSort={{ key: 'closes', dir: 'asc' }}
              columns={[
                {
                  key: 'title',
                  header: t('m01.jobs.title'),
                  value: (r) => pick(r, 'title'),
                  sortable: true,
                  render: (r) => (
                    <div>
                      <div className="font-semibold">{pick(r, 'title')}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {r.sample && <SimChip label={t('common.sample')} />}
                        {r.uae_nationals_only && <StatusPill tone="reserved">{t('m01.badge.reserved')}</StatusPill>}
                      </div>
                    </div>
                  ),
                },
                { key: 'role', header: t('m01.jobs.role'), value: (r) => pick(career.data?.roleById.get(r.role_id ?? ''), 'title'), render: (r) => (r.role_id ? <L to={`/careers/roles/${r.role_id}`}>{pick(career.data?.roleById.get(r.role_id), 'title') || r.role_id}</L> : '—') },
                { key: 'location', header: t('m01.jobs.location'), value: (r) => r.location, sortable: true },
                { key: 'posted', header: t('m01.jobs.posted'), value: (r) => r.posted_on, render: (r) => fmt.date(r.posted_on), sortable: true },
                { key: 'closes', header: t('m01.jobs.closes'), value: (r) => r.closes_on ?? '9999', render: (r) => (r.closes_on ? fmt.date(r.closes_on) : '—'), sortable: true },
                { key: 'status', header: t('m01.jobs.status'), value: (r) => (r.status === 'open' && (!r.closes_on || r.closes_on >= today) ? 'open' : 'closed'), render: (r) => <StatusPill status={r.status === 'open' && (!r.closes_on || r.closes_on >= today) ? 'open' : 'closed'} /> },
                {
                  key: 'apply',
                  header: t('m01.jobs.apply'),
                  csv: false,
                  render: (r) => (
                    <a href={r.official_url} target="_blank" rel="noopener noreferrer" className="text-[13px]">
                      {t('m01.jobs.applyOfficial')} <Icon name="external" size={12} className="inline" />
                    </a>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Async>
      <p className="text-[12.5px] text-ink-3">
        {t('m01.jobs.programmes')} <L to="/pathways">{t('m01.jobs.toPathways')}</L>
      </p>
    </Page>
  );
}
