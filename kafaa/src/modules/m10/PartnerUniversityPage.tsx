// M10 /partner/university: university partner workspace. Shows only scholars who consented to share with this university
// (enforced by row-level rules), cohort aggregates hosted at the university (small cohorts suppressed), internship placements,
// curriculum alignment and the university's onboarding status and research proposals.
import { useMemo } from 'react';
import { useRepo, useQuery } from '../../data';
import { useSession } from '../../auth/session';
import { Page, Grid, Card, Async, EmptyState, Callout, Tabs, DataTable, StatusPill, StatTile, KeyValue, SimChip } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { suppress } from '../../domain/rules';
import { SourceList } from '../m06/shared';
import { CurriculumAlignment } from './shared';

export default function PartnerUniversityPage() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const org = s.identity.orgId;
  const me = useQuery('organisations', () => (org ? repo.get('organisations', org) : Promise.resolve(null)), [org]);
  return (
    <Page title={t('m10.routes.partner-university.title')} eyebrow={me.data ? pick(me.data, 'name') : undefined} intro={t('m10.pu.intro')} wide>
      <Callout tone="info" title={t('m10.pu.consentTitle')}>{t('m10.pu.consentBody')}</Callout>
      <Tabs
        tabs={[
          { id: 'overview', label: t('m10.pu.tabOverview'), content: <Overview /> },
          { id: 'scholars', label: t('m10.pu.tabScholars'), content: <Scholars /> },
          { id: 'internships', label: t('m10.pu.tabInternships'), content: <Internships /> },
          { id: 'curriculum', label: t('m10.pu.tabCurriculum'), content: <CurriculumAlignment /> },
        ]}
      />
    </Page>
  );
}

function Overview() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const org = s.identity.orgId;
  const q = useQuery(['organisations', 'partner_onboarding', 'agreements', 'scholars', 'scholar_cohorts', 'internships', 'research_proposals'], async () => {
    const [o, onb, ags, sch, coh, ints, props] = await Promise.all([
      org ? repo.get('organisations', org) : Promise.resolve(null),
      repo.list('partner_onboarding'),
      org ? repo.list('agreements', { filter: { org_id: org } }) : Promise.resolve([]),
      repo.list('scholars'),
      repo.list('scholar_cohorts'),
      repo.list('internships', { filter: { status: 'open' } }),
      repo.list('research_proposals'),
    ]);
    return { o, onb: onb.find((x) => x.org_id === org) ?? null, ags, sch, coh, ints: ints.filter((i) => !i.university_org_id || i.university_org_id === org), props };
  }, [org]);
  return (
    <Async state={q} isEmpty={(d) => !d.o} empty={<EmptyState title={t('m10.pu.noOrg')} />}>
      {(d) => (
        <div className="space-y-4" data-testid="m10-pu-overview">
          <Grid cols={4}>
            <StatTile label={t('m10.pu.consentingScholars')} value={f.num(d.sch.length)} sub={t('m10.pu.consentingSub')} />
            <StatTile label={t('m10.pu.cohorts')} value={f.num(d.coh.length)} />
            <StatTile label={t('m10.pu.seats')} value={f.num(d.ints.reduce((n, i) => n + i.seats, 0))} sub={t('m10.pu.seatsSub', { n: d.ints.length })} />
            <StatTile label={t('m10.pu.proposals')} value={f.num(d.props.length)} sub={<L to="/partner/research">{t('m10.pu.toResearch')}</L>} />
          </Grid>
          <Grid cols={2}>
            <Card title={pick(d.o, 'name')} eyebrow={t('m10.pu.relationship')} footer={<SourceList sources={d.o!.sources} />}>
              <p className="text-[13.5px] text-ink-2">{pick(d.o, 'relationship')}</p>
              {d.ags.length > 0 && (
                <ul className="mt-3 space-y-1 text-[13px]">
                  {d.ags.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={a.binding ? 'ok' : 'neutral'}>{t(`m10.pu.agType.${a.binding ? 'binding' : 'nonBinding'}`)}</StatusPill>
                      <span>{a.type}</span>
                      <span className="text-ink-3">{a.signed}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title={t('m10.pu.onboarding')}>
              {d.onb ? (
                <KeyValue
                  items={[
                    [t('m10.pu.status'), <StatusPill key="s" status={d.onb.status}>{t(`m10.pu.onb.${d.onb.status}`)}</StatusPill>],
                    [t('m10.pu.started'), f.date(d.onb.started_at)],
                    [t('m10.pu.decided'), f.date(d.onb.decided_at)],
                  ]}
                />
              ) : (
                <p className="text-ink-3">{t('m10.pu.noOnboarding')}</p>
              )}
              <p className="mt-3 text-[12.5px] text-ink-3">{t('m10.pu.onboardingNote')}</p>
            </Card>
          </Grid>
        </div>
      )}
    </Async>
  );
}

function Scholars() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const q = useQuery(['scholars', 'scholar_cohorts'], async () => {
    const [sch, coh] = await Promise.all([repo.list('scholars'), repo.list('scholar_cohorts', { order: [['intake_year', 'desc']] })]);
    return { sch, coh };
  });
  const cohorts = useMemo(
    () =>
      (q.data?.coh ?? []).map((c) => {
        const hide = suppress(c.size, c.size).suppressed;
        return { ...c, hide };
      }),
    [q.data],
  );
  return (
    <Async state={q} empty={<EmptyState />}>
      {(d) => (
        <div className="space-y-4">
          <Card title={t('m10.pu.cohortTitle')} actions={<SimChip label={t('common.sample')} />}>
            {cohorts.length === 0 ? (
              <p className="text-ink-3">{t('m10.pu.noCohorts')}</p>
            ) : (
              <DataTable
                rows={cohorts}
                rowKey={(r) => r.id}
                searchable={false}
                columns={[
                  { key: 'pathway', header: t('m10.pu.pathway'), value: (r) => r.pathway },
                  { key: 'year', header: t('m10.pu.intake'), value: (r) => r.intake_year, align: 'end' },
                  { key: 'size', header: t('m10.pu.size'), value: (r) => (r.hide ? null : r.size), align: 'end', render: (r) => (r.hide ? <StatusPill tone="sim">{t('m10.pu.suppressed', { n: MIN_GROUP_SIZE })}</StatusPill> : f.num(r.size)) },
                  { key: 'study', header: t('m10.pu.inStudy'), value: (r) => (r.hide ? null : r.in_study), align: 'end', render: (r) => (r.hide ? '—' : f.num(r.in_study)) },
                  { key: 'grad', header: t('m10.pu.graduated'), value: (r) => (r.hide ? null : r.graduated), align: 'end', render: (r) => (r.hide ? '—' : f.num(r.graduated)) },
                ]}
              />
            )}
          </Card>
          <Card title={t('m10.pu.scholarsTitle')} eyebrow={t('m10.pu.consentOnly')}>
            {d.sch.length === 0 ? (
              <EmptyState title={t('m10.pu.noScholars')}>{t('m10.pu.noScholarsBody')}</EmptyState>
            ) : (
              <div data-testid="m10-scholars">
                <DataTable
                  rows={d.sch}
                  rowKey={(r) => r.id}
                  searchable={false}
                  columns={[
                    { key: 'ref', header: t('m10.pu.ref'), value: (r) => r.id, render: (r) => <span className="num">{r.id}</span> },
                    { key: 'cohort', header: t('m10.pu.cohort'), value: (r) => d.coh.find((c) => c.id === r.cohort_id)?.pathway ?? r.cohort_id },
                    { key: 'year', header: t('m10.pu.yearOfStudy'), value: (r) => r.year_of_study, align: 'end', render: (r) => (r.year_of_study ? f.num(r.year_of_study) : '—') },
                    { key: 'status', header: t('m10.pu.status'), value: (r) => r.status, render: (r) => <StatusPill status={r.status === 'in_study' ? 'in_progress' : r.status === 'graduated' ? 'completed' : r.status}>{t(`m10.pu.sst.${r.status}`)}</StatusPill> },
                    { key: 'consent', header: t('m10.pu.consent'), value: () => 'yes', render: () => <StatusPill tone="ok">{t('m10.pu.consented')}</StatusPill> },
                  ]}
                />
              </div>
            )}
            <p className="mt-2 text-[12px] text-ink-3">{t('m10.pu.scholarsNote')}</p>
          </Card>
        </div>
      )}
    </Async>
  );
}

function Internships() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const org = s.identity.orgId;
  const q = useQuery(['internships', 'job_families'], async () => {
    const [rows, fams] = await Promise.all([repo.list('internships', { order: [['starts_on', 'asc']] }), repo.list('job_families')]);
    return rows.filter((i) => !i.university_org_id || i.university_org_id === org).map((i) => ({ ...i, fam: pick(fams.find((x) => x.id === i.family_id), 'name') }));
  }, [org]);
  return (
    <Card title={t('m10.pu.internshipsTitle')}>
      <p className="mb-3 text-[13px] text-ink-2">{t('m10.pu.internshipsHint')}</p>
      <Async state={q} empty={<EmptyState title={t('m10.uni.noInternships')} />}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            searchable={false}
            columns={[
              { key: 'title', header: t('m10.uni.placement'), value: (r) => pick(r, 'title') },
              { key: 'fam', header: t('m10.pu.family'), value: (r) => r.fam || '—' },
              { key: 'for', header: t('m10.uni.openTo'), value: (r) => (r.university_org_id ? t('m10.pu.yourUniversity') : t('m10.uni.anyUniversity')) },
              { key: 'seats', header: t('m10.uni.seats'), value: (r) => r.seats, align: 'end' },
              { key: 'start', header: t('m10.uni.starts'), value: (r) => r.starts_on, render: (r) => f.date(r.starts_on) },
              { key: 'status', header: t('m10.pu.status'), value: (r) => r.status, render: (r) => <StatusPill status={r.status}>{t(`m10.pu.ist.${r.status}`)}</StatusPill> },
            ]}
          />
        )}
      </Async>
      <p className="mt-2 text-[12px] text-ink-3">{t('m10.pu.internshipsNote')}</p>
    </Card>
  );
}
