// M09 /partners/:slug: one directory entry. Relationship type, dates, status, binding flag, agreements and public sources.
// No individual names, no logos. MoUs are labelled non-binding evaluations unless a source says otherwise.
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Callout, Async, EmptyState, KeyValue, Grid, Icon } from '../../ui';
import { useT, usePick, L, countryName } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { CategoryChips, MStatus, NON_BINDING, SourceList, useSourceDates, type Org, type Source } from './shared';

export default function PartnersDetailPage() {
  const t = useT();
  const { slug = '' } = useParams();
  const repo = useRepo();
  const q = useQuery(['organisations', 'agreements'], async () => {
    const org = await repo.get('organisations', slug);
    if (!org || !org.public_listed) return { org: null, agreements: [], related: [] as Org[] };
    const [agreements, all] = await Promise.all([
      repo.list('agreements', { filter: { org_id: slug }, order: [['id', 'asc']] }),
      repo.list('organisations', { filter: { public_listed: true } }),
    ]);
    const cats = org.categories?.length ? org.categories : [org.category];
    const related = all.filter((o) => o.id !== org.id && (o.categories ?? [o.category]).some((c) => cats.includes(c))).slice(0, 6);
    return { org, agreements, related };
  }, [slug]);
  return (
    <Async state={q}>
      {(d) =>
        !d.org ? (
          <Page title={t('m09.routes.partners-detail.title')}>
            <EmptyState title={t('m09.detail.notFound')} action={<L to="/partners" className="btn-outline btn-sm">{t('m09.detail.back')}</L>}>
              {t('m09.detail.notFoundBody')}
            </EmptyState>
          </Page>
        ) : (
          <Detail org={d.org} agreements={d.agreements} related={d.related} />
        )
      }
    </Async>
  );
}

function Detail({ org, agreements, related }: { org: Org; agreements: { id: string; type: string; binding: boolean; signed: string; status: string; sources: unknown }[]; related: Org[] }) {
  const t = useT();
  const pick = usePick();
  const dates = useSourceDates();
  const cats = org.categories?.length ? org.categories : [org.category];
  const types = org.rel_types ?? [];
  const nonBinding = types.some((x) => NON_BINDING.includes(x)) && !org.binding;
  const isOversight = cats.includes('oversight');
  return (
    <Page title={pick(org, 'name')} eyebrow={isOversight ? t('m09.detail.eyebrowOversight') : t('m09.detail.eyebrow')} intro={pick(org, 'relationship')}
      actions={<L to="/partners" className="btn-outline">{t('m09.detail.back')}</L>}>
      {isOversight && <Callout tone="info" title={t('m09.dir.oversightTitle')}>{t('m09.dir.oversightDesc')}</Callout>}
      {nonBinding && <Callout tone="sim" title={t('m09.detail.mouTitle')}>{t('m09.detail.mouBody')}</Callout>}
      {org.status === 'historic' && <Callout tone="info" title={t('m09.status.historic')}>{t('m09.detail.historicBody')}</Callout>}

      <Grid cols={2}>
        <Card title={t('m09.detail.relationship')}>
          <KeyValue
            items={[
              [t('m09.dir.col.category'), <CategoryChips key="c" cats={cats} />],
              [t('m09.dir.col.type'), types.map((x) => t(`m09.rel.${x}`)).join(', ') || '—'],
              [t('m09.dir.col.dates'), <span key="d" className="num">{org.dates === 'current' || org.dates === 'historic' ? t(`m09.datesWord.${org.dates}`) : org.dates || '—'}</span>],
              [t('m09.dir.col.status'), <MStatus key="s" status={org.status} />],
              [t('m09.dir.col.binding'), org.binding ? t('m09.dir.binding') : t('m09.dir.nonBinding')],
              [t('m09.dir.col.country'), countryName(t, org.country) || '—'],
              [t('m09.detail.contact'), org.contact_route ?? t('m09.detail.noContact')],
            ]}
          />
        </Card>
        <Card title={t('m09.detail.sources')} footer={t('m09.detail.sourcesFoot')}>
          <SourceList sources={(org.sources as Source[]) ?? []} dates={dates} />
        </Card>
      </Grid>

      <Section title={t('m09.detail.agreements')} description={t('m09.detail.agreementsDesc')}>
        {agreements.length === 0 ? (
          <EmptyState title={t('m09.detail.noAgreements')} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base w-full text-[13px]" data-testid="m09-agreements">
              <caption className="sr-only">{t('m09.detail.agreements')}</caption>
              <thead className="bg-raised">
                <tr>
                  <th scope="col">{t('m09.dir.col.type')}</th>
                  <th scope="col">{t('m09.dir.col.dates')}</th>
                  <th scope="col">{t('m09.dir.col.binding')}</th>
                  <th scope="col">{t('m09.dir.col.status')}</th>
                  <th scope="col">{t('m09.dir.col.sources')}</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((a) => (
                  <tr key={a.id}>
                    <td className="font-semibold">{t(`m09.rel.${a.type}`)}</td>
                    <td className="num">{a.signed || '—'}</td>
                    <td>{a.binding ? t('m09.dir.binding') : <span className="chip border-sim-line bg-sim-bg text-sim">{t('m09.dir.nonBinding')}</span>}</td>
                    <td><MStatus status={a.status} /></td>
                    <td><SourceList sources={(a.sources as Source[]) ?? []} dates={dates} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {cats.includes('advanced_rd') && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{t('m09.detail.futureTitle')}</div>
              <p className="text-[13px] text-ink-2">{t('m09.detail.futureBody')}</p>
            </div>
            <L to="/future" className="btn-outline">{t('m09.detail.futureLink')} <Icon name="chevron" size={14} /></L>
          </div>
        </Card>
      )}

      {related.length > 0 && (
        <Section title={t('m09.detail.related')}>
          <ul className="flex flex-wrap gap-2" data-testid="m09-related">
            {related.map((o) => (
              <li key={o.id}>
                <L to={`/partners/${o.id}`} className="chip border-line bg-panel text-ink hover:border-accent">{pick(o, 'name')}</L>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <p className="text-[12.5px] text-ink-3">{t('m09.detail.noLogos')}</p>
    </Page>
  );
}
