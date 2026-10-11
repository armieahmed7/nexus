// M08 · Safety culture (public explainer): the 10 traits published by ENEC Operations, the AT SITE values, the
// practices behind them, human performance tools and how concerns are raised. No badges or points, ever.
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, BenchmarkChips, Callout, Card, Icon, Page, Section, SourceLink, StatusPill } from '../../ui';
import { SourcesList, useContentPage, type SourceRef } from '../m12/parts';

const VALUES = ['A', 'T', 'S', 'I', 'T2', 'E'] as const;
const PRACTICES = ['assessment', 'panels', 'steering', 'majlis', 'fair'] as const;

export default function SafetyCulturePage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const page = useContentPage('safety-culture');
  const traits = useQuery('sc_traits', () => repo.list('sc_traits', { order: [['n', 'asc']] }));
  const hu = useQuery('hu_tools', () => repo.list('hu_tools', { order: [['sort', 'asc']] }));
  const staff = s.can('internal_content', ['R']);
  return (
    <Page
      title={t('m08.routes.safety-culture.title')}
      eyebrow={t('m08.sc.eyebrow')}
      intro={t('m08.sc.intro')}
      actions={
        staff ? (
          <>
            <L to="/my/safety-culture" className="btn-primary">{t('m08.sc.myLink')}</L>
            <L to="/oe" className="btn-outline">{t('m08.sc.oeLink')}</L>
          </>
        ) : undefined
      }
    >
      <Section title={t('m08.sc.traitsTitle')} description={t('m08.sc.traitsIntro')}>
        <Async state={traits}>
          {(rows) => (
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="m08-traits">
              {rows.map((r) => (
                <li key={r.id} className="card flex flex-col p-4">
                  <span className="num grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-eyebrow" aria-hidden>
                    {f.num(r.n)}
                  </span>
                  <h3 className="mt-2 text-[14px] font-semibold leading-snug">{pick(r, 'name')}</h3>
                  <p className="mt-1 text-[12.5px] text-ink-2">{pick(r, 'description')}</p>
                </li>
              ))}
            </ol>
          )}
        </Async>
        <div className="text-[12px]">
          <SourceLink href="https://www.enec.ae/our-subsidiaries/enec-operations/nuclear-safety-culture/">ENEC Operations · Nuclear safety culture</SourceLink>
          <span className="text-ink-3"> · {t('m08.sc.informedBy')}</span>
        </div>
      </Section>

      <Section title={t('m08.sc.valuesTitle')} description={t('m08.sc.valuesIntro')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6" data-testid="m08-values">
          {VALUES.map((v) => (
            <div key={v} className="card p-3 text-center">
              <div className="text-[26px] font-bold text-eyebrow" aria-hidden>{v.replace('2', '')}</div>
              <div className="text-[13px] font-semibold">{t(`m08.sc.values.${v}`)}</div>
            </div>
          ))}
        </div>
        <div className="text-[12px]">
          <SourceLink href="https://www.enec.ae/our-subsidiaries/enec-operations/our-values/">ENEC Operations · Our values</SourceLink>
        </div>
      </Section>

      <Section title={t('m08.sc.practicesTitle')}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PRACTICES.map((p) => (
            <li key={p} className="card p-4">
              <div className="font-semibold">{t(`m08.sc.practices.${p}.title`)}</div>
              <p className="mt-1 text-[12.5px] text-ink-2">{t(`m08.sc.practices.${p}.body`)}</p>
            </li>
          ))}
        </ul>
        <div className="text-[12px]">
          <SourceLink href="https://www.iaea.org/sites/default/files/cns-10th-review-meeing-uae-national-report_ae1.pdf">UAE National Report, 10th CNS Review Meeting (IAEA)</SourceLink>
          <span className="text-ink-3"> · {t('common.asOf', { date: f.date('2026-10-08') })}</span>
        </div>
      </Section>

      <Section id="hu" title={t('m08.sc.huTitle')} description={t('m08.sc.huIntro')}>
        <Async state={hu}>
          {(rows) => (
            <div className="grid gap-4 md:grid-cols-2" data-testid="m08-hu">
              {(['core', 'conditional'] as const).map((k) => (
                <Card key={k} title={t(`m08.sc.hu.${k}`)} eyebrow={t(`m08.sc.hu.${k}Hint`)}>
                  <ul className="space-y-2">
                    {rows.filter((r) => r.kind === k && r.topic !== 'ai_automation').map((r) => (
                      <li key={r.id}>
                        <div className="text-[13.5px] font-semibold">{pick(r, 'name')}</div>
                        <div className="text-[12.5px] text-ink-2">{pick(r, 'description')}</div>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
              {/* FS49: HU tools for an AI-augmented plant (public card text; drills and lessons open for staff) */}
              <div className="md:col-span-2">
                <Card title={t('m08.sc.huAiTitle')} eyebrow={t('m08.sc.huAiHint')} actions={staff ? <L to="/my/safety-culture/ai" className="btn-outline btn-sm no-underline" data-testid="m08-sc-to-ai">{t('m08.sc.huAiLink')}</L> : undefined}>
                  <ul className="grid gap-3 sm:grid-cols-2" data-testid="m08-hu-ai">
                    {rows.filter((r) => r.topic === 'ai_automation').map((r) => (
                      <li key={r.id}>
                        <div className="text-[13.5px] font-semibold">{pick(r, 'name')}</div>
                        <div className="text-[12.5px] text-ink-2">{pick(r, 'description')}</div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3"><BenchmarkChips feature="FS49" /></div>
                </Card>
              </div>
            </div>
          )}
        </Async>
      </Section>

      <Section title={t('m08.sc.concernsTitle')}>
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <Card>
            <p className="text-[14px]">{t('m08.sc.concernsBody')}</p>
            <p className="mt-2 text-[13px] text-ink-2">{t('m08.speak.protection')}</p>
            <L to="/speak-up" className="btn-primary mt-3" data-testid="m08-speakup-link">
              <Icon name="shield" />
              {t('m08.sc.concernsLink')}
            </L>
          </Card>
          <Async state={page} isEmpty={(p) => !p}>
            {(p) => <SourcesList sources={p!.sources as SourceRef[]} asOf={p!.as_of} />}
          </Async>
        </div>
      </Section>

      <Callout tone="info" title={t('m08.sc.noGameTitle')}>
        {t('m08.sc.noGameBody')} <StatusPill tone="neutral">{t('m08.sc.noGamePill')}</StatusPill>
      </Callout>
    </Page>
  );
}
