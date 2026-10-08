// M12 · Home: the front door. Four audience cards, Barakah in numbers (every figure sourced and dated), featured
// programmes, latest sourced news, safety culture and emergency pointers, and Dalil.
import { useEffect } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, Card, Icon, Section, Skeleton, SourceLink, StatusPill } from '../../ui';
import { FactTile, NewsCard, useSourceMap } from './parts';
import { useFlags } from '../m16/flags';

const AUDIENCES = [
  { id: 'students', icon: 'grad', links: [['/pathways', 'pathways'], ['/pathways/dnt', 'dnt'], ['/community', 'stem']] },
  { id: 'seekers', icon: 'briefcase', links: [['/careers', 'careers'], ['/licensing', 'licensing'], ['/careers/jobs', 'jobs']] },
  { id: 'staff', icon: 'user', links: [['/my', 'my'], ['/learn', 'learn'], ['/safety-culture', 'safety']] },
  { id: 'partners', icon: 'users', links: [['/suppliers', 'suppliers'], ['/partners', 'directory'], ['/universities', 'universities']] },
] as const;

export default function HomePage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const { isOn } = useFlags();
  useEffect(() => {
    document.title = `${t('shell.brand')} · ${t('m12.home.titleTag')}`;
  }, [t]);
  const facts = useQuery(['facts', 'sources'], async () => {
    const [rows, sources] = await Promise.all([repo.list('facts', { filter: { public: true } }), repo.list('sources')]);
    return { rows, sources };
  });
  const programmes = useQuery('talent_programmes', () => repo.list('talent_programmes', { order: [['sort', 'asc']] }));
  const news = useQuery('content_pages', () => repo.list('content_pages', { filter: { kind: 'news', is_published: true }, order: [['published_on', 'desc']], limit: 3 }));
  const srcMap = useSourceMap(facts.data?.sources);
  const barakah = (facts.data?.rows ?? []).filter((x) => x.topic === 'barakah');
  const people = (facts.data?.rows ?? []).filter((x) => ['employees', 'emiratization', 'training-hours', 'certifications'].includes(x.key));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6" data-testid="m12-home">
      {/* Hero */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="frame-line absolute inset-x-0 top-0 h-1" aria-hidden />
        <div className="eyebrow">{t('m12.home.eyebrow')}</div>
        <h1 className="mt-2 max-w-3xl text-[28px] font-semibold leading-tight sm:text-[36px]">{t('m12.home.title')}</h1>
        <p className="mt-3 max-w-2xl text-[15.5px] text-ink-2">{t('m12.home.intro')}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <L to="/careers" className="btn-primary" data-testid="m12-cta-careers">
            {t('m12.home.ctaCareers')}
          </L>
          <L to="/pathways" className="btn-outline">
            {t('m12.home.ctaProgrammes')}
          </L>
          <L to="/ask" className="btn-ghost">
            <Icon name="sparkle" className="text-accent" />
            {t('m12.home.ctaAsk')}
          </L>
        </div>
        <p className="mt-4 text-[12px] text-ink-3">{t('m12.home.concept')}</p>
      </section>

      {/* Audiences */}
      <Section title={t('m12.home.audiencesTitle')} id="audiences">
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="m12-audiences">
          {AUDIENCES.map((a) => (
            <Card key={a.id} as="article" className="flex h-full flex-col">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-btn bg-accent-soft text-eyebrow">
                  <Icon name={a.icon} />
                </span>
                <h2 className="text-[16px] font-semibold">{t(`m12.home.aud.${a.id}.title`)}</h2>
              </div>
              <p className="mt-2 flex-1 text-[13px] text-ink-2">{a.id === 'staff' && s.status === 'signed_in' ? t('m12.home.aud.staff.signedIn') : t(`m12.home.aud.${a.id}.body`)}</p>
              <ul className="mt-3 space-y-1.5 text-[13px]">
                {a.links.map(([to, key]) => (
                  <li key={to}>
                    <L to={to} className="inline-flex items-center gap-1 font-semibold" data-testid={`m12-aud-${a.id}-${key}`}>
                      {t(`m12.home.aud.${a.id}.links.${key}`)}
                      <Icon name="chevron" size={12} />
                    </L>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      {/* Barakah in numbers */}
      <div className="mt-8">
        <Section title={t('m12.home.numbersTitle')} description={t('m12.home.numbersIntro')} actions={<L to="/about" className="btn-ghost btn-sm">{t('m12.home.aboutLink')}</L>}>
          <Async state={facts} isEmpty={(d) => d.rows.length === 0}>
            {() => (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="m12-barakah-facts">
                {barakah.map((x) => (
                  <FactTile key={x.id} fact={x} source={x.source_id ? srcMap.get(x.source_id) : null} />
                ))}
              </div>
            )}
          </Async>
        </Section>
      </div>

      {/* People */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title={t('m12.home.programmesTitle')} description={t('m12.home.programmesIntro')} actions={<L to="/pathways" className="btn-ghost btn-sm">{t('common.viewAll')}</L>}>
          <Async state={programmes}>
            {(rows) => (
              <ul className="grid gap-3 sm:grid-cols-2" data-testid="m12-programmes">
                {rows.slice(0, 4).map((p) => (
                  <li key={p.id} className="card flex flex-col p-4">
                    <L to={`/pathways/${p.id}`} className="link-plain font-semibold hover:text-eyebrow">
                      {pick(p, 'name')}
                    </L>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StatusPill tone="accent">{t(`m12.home.nat.${p.nationality}`)}</StatusPill>
                      <StatusPill tone="neutral">{pick(p, 'duration')}</StatusPill>
                    </div>
                    <p className="mt-2 flex-1 text-[12.5px] text-ink-2">{pick(p, 'education')}</p>
                    {Array.isArray(p.sources) && p.sources[0] && (
                      <div className="mt-2 text-[11.5px]">
                        <SourceLink href={(p.sources[0] as { url: string }).url}>{(p.sources[0] as { label: string }).label}</SourceLink>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Section>
        <Section title={t('m12.home.peopleTitle')}>
          {!facts.data ? (
            <Skeleton lines={4} />
          ) : (
            <ul className="card divide-y divide-line" data-testid="m12-people-facts">
              {people.map((x) => {
                const src = x.source_id ? srcMap.get(x.source_id) : null;
                return (
                  <li key={x.id} className="p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] text-ink-2">{pick(x, 'label')}</span>
                      <span className="num text-[18px] font-semibold">{pick(x, 'value') || x.value}</span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">
                      {src && <SourceLink href={src.url}>{src.label}</SourceLink>} · {t('common.asOf', { date: f.date(x.as_of) })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {/* News */}
      {isOn('news') && (
        <div className="mt-8">
          <Section title={t('m12.home.newsTitle')} actions={<L to="/news" className="btn-ghost btn-sm">{t('common.viewAll')}</L>}>
            <Async state={news}>
              {(rows) => (
                <div className="grid gap-4 sm:grid-cols-3" data-testid="m12-home-news">
                  {rows.map((n) => (
                    <NewsCard key={n.id} item={n} />
                  ))}
                </div>
              )}
            </Async>
          </Section>
        </div>
      )}

      {/* Safety culture, emergency, Dalil */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card title={t('m12.home.safetyTitle')} eyebrow={t('m12.home.safetyEyebrow')}>
          <p className="text-[13px] text-ink-2">{t('m12.home.safetyBody')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <L to="/safety-culture" className="btn-outline btn-sm">{t('m12.home.safetyLink')}</L>
            <L to="/speak-up" className="btn-ghost btn-sm">{t('m12.home.speakUpLink')}</L>
          </div>
        </Card>
        <Card title={t('m12.home.emergencyTitle')} eyebrow={t('m12.home.emergencyEyebrow')}>
          <p className="text-[15px] font-semibold text-eyebrow">{t('m12.emergency.headline')}</p>
          <p className="mt-1 text-[13px] text-ink-2">{t('m12.home.emergencyBody')}</p>
          <L to="/emergency" className="btn-outline btn-sm mt-3">{t('m12.home.emergencyLink')}</L>
        </Card>
        <Card title={t('m12.home.dalilTitle')} eyebrow={t('m12.home.dalilEyebrow')}>
          <p className="text-[13px] text-ink-2">{t('m12.home.dalilBody')}</p>
          <L to="/ask" className="btn-primary btn-sm mt-3">
            <Icon name="sparkle" />
            {t('m12.home.ctaAsk')}
          </L>
        </Card>
      </div>
    </div>
  );
}
