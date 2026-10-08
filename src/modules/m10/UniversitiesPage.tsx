// M10 /universities: academic partners with public sources, nuclear programmes, internship placements, curriculum alignment
// with the competency library, and how a university becomes a Kafa'a partner.
import { useMemo } from 'react';
import { useRepo, useQuery } from '../../data';
import { Page, Section, Grid, Card, Async, EmptyState, StatusPill, Stepper, Callout, DataTable, FilterBar, useFilters, SourceLink } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { SourceList } from '../m06/shared';
import { CurriculumAlignment } from './shared';

const KU_MSC = 'https://www.ku.ac.ae/wp-content/uploads/2024/02/MSc-in-Nuclear-Engineering.pdf';
const CNS10 = 'https://www.iaea.org/sites/default/files/cns-10th-review-meeing-uae-national-report_ae1.pdf';
const ENEC_TALENT = 'https://www.enec.ae/careers-and-scholarships/talent-pipeline-programs/';
const ENEC_SRC = 'https://enec.ae/news/latest-news/enec-saskatchewan-research-council-and-giems-sign-mou-to-advance-nuclear-research-and-capacity/';

export default function UniversitiesPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const [flt, setFlt] = useFilters({ q: '', kind: '', country: '' }, true);
  const orgs = useQuery('organisations', () => repo.list('organisations', { filter: { kind: ['university', 'research'] } }));
  const internships = useQuery(['internships', 'organisations'], async () => {
    const [rows, all] = await Promise.all([repo.list('internships', { filter: { status: 'open' }, order: [['starts_on', 'asc']] }), repo.list('organisations')]);
    return rows.map((r) => ({ ...r, host: pick(all.find((o) => o.id === r.host_entity_id), 'name'), uni: r.university_org_id ? pick(all.find((o) => o.id === r.university_org_id), 'name') : null }));
  });
  const shown = useMemo(() => {
    const term = flt.q.trim().toLowerCase();
    return (orgs.data ?? []).filter((o) => (!flt.kind || o.kind === flt.kind) && (!flt.country || o.country === flt.country) && (!term || `${o.name_en} ${o.name_ar} ${o.relationship_en}`.toLowerCase().includes(term)));
  }, [orgs.data, flt]);
  const countries = useMemo(() => [...new Set((orgs.data ?? []).map((o) => o.country).filter(Boolean))].sort() as string[], [orgs.data]);

  return (
    <Page title={t('m10.routes.universities.title')} eyebrow={t('m10.uni.eyebrow')} intro={t('m10.uni.intro')}>
      <Section title={t('m10.uni.programmesTitle')}>
        <Grid cols={3}>
          {(['ku', 'entc', 'ep', 'nitss', 'iat', 'src'] as const).map((k) => (
            <Card key={k} title={t(`m10.uni.fact.${k}.title`)} eyebrow={t(`m10.uni.fact.${k}.eyebrow`)} footer={<SourceLink href={{ ku: KU_MSC, entc: KU_MSC, ep: ENEC_TALENT, nitss: CNS10, iat: CNS10, src: ENEC_SRC }[k]}>{t(`m10.uni.fact.${k}.source`)}</SourceLink>}>
              <p className="text-[13.5px] text-ink-2">{t(`m10.uni.fact.${k}.body`)}</p>
              {k === 'ep' && <L to="/pathways/energy-pioneers" className="mt-2 inline-block text-[13px]">{t('m10.uni.epLink')}</L>}
            </Card>
          ))}
        </Grid>
      </Section>

      <Section title={t('m10.uni.partnersTitle')} description={t('m10.uni.partnersHint')}>
        <FilterBar
          value={flt}
          onChange={setFlt}
          search="q"
          fields={[
            { key: 'kind', label: t('m10.uni.type'), options: [{ value: 'university', label: t('m10.uni.kind.university') }, { value: 'research', label: t('m10.uni.kind.research') }] },
            { key: 'country', label: t('m10.uni.country'), options: countries.map((c) => ({ value: c, label: c })) },
          ]}
        />
        <Async state={orgs} empty={<EmptyState title={t('m10.uni.none')} />}>
          {() =>
            shown.length === 0 ? (
              <EmptyState title={t('m10.uni.noMatch')} />
            ) : (
              <div data-testid="m10-partners">
                <Grid cols={3}>
                  {shown.map((o) => (
                    <Card key={o.id} as="article" title={pick(o, 'name')} eyebrow={`${t(`m10.uni.kind.${o.kind}`)} · ${o.country ?? ''}`} actions={<StatusPill status={o.status}>{t(`m10.uni.status.${o.status}`)}</StatusPill>} footer={<SourceList sources={o.sources} />}>
                      <p className="text-[13px] text-ink-2">{pick(o, 'relationship')}</p>
                      <div className="mt-2 text-[12.5px] text-ink-3">{t('m10.uni.since', { dates: o.dates ?? '—' })}{o.binding === false && <> · {t('m10.uni.nonBinding')}</>}</div>
                    </Card>
                  ))}
                </Grid>
              </div>
            )
          }
        </Async>
        <p className="text-[12px] text-ink-3">{t('m10.uni.digestNote')}</p>
      </Section>

      <Section title={t('m10.uni.internshipsTitle')} description={t('m10.uni.internshipsHint')}>
        <Async state={internships} empty={<EmptyState title={t('m10.uni.noInternships')} />}>
          {(rows) => (
            <div data-testid="m10-internships">
              <DataTable
                rows={rows}
                rowKey={(r) => r.id}
                searchable={false}
                columns={[
                  { key: 'title', header: t('m10.uni.placement'), value: (r) => pick(r, 'title') },
                  { key: 'host', header: t('m10.uni.host'), value: (r) => r.host },
                  { key: 'uni', header: t('m10.uni.openTo'), value: (r) => r.uni ?? t('m10.uni.anyUniversity') },
                  { key: 'seats', header: t('m10.uni.seats'), value: (r) => r.seats, align: 'end' },
                  { key: 'start', header: t('m10.uni.starts'), value: (r) => r.starts_on, render: (r) => f.date(r.starts_on) },
                ]}
              />
            </div>
          )}
        </Async>
        <L to="/pathways/internships" className="text-[13px]">{t('m10.uni.internshipsApply')}</L>
      </Section>

      <Section title={t('m10.uni.alignTitle')} description={t('m10.uni.alignHint')}>
        <CurriculumAlignment />
      </Section>

      <Section title={t('m10.uni.joinTitle')} description={t('m10.uni.joinHint')}>
        <Card>
          <Stepper current={-1} steps={['interest', 'agreement', 'consent', 'workspace'].map((s) => ({ id: s, label: t(`m10.uni.join.${s}`) }))} />
          <ul className="mt-3 list-disc space-y-1 ps-5 text-[13px] text-ink-2">
            <li>{t('m10.uni.joinRule1')}</li>
            <li>{t('m10.uni.joinRule2')}</li>
            <li>{t('m10.uni.joinRule3')}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <L to="/contact" className="btn-primary btn-sm">{t('m10.uni.contact')}</L>
            <L to="/research" className="btn-outline btn-sm">{t('m10.uni.toResearch')}</L>
          </div>
        </Card>
        <Callout tone="info" title={t('m10.uni.consentTitle')}>{t('m10.uni.consentBody')}</Callout>
      </Section>
    </Page>
  );
}
