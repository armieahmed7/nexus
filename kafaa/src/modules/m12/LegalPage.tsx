// M12 · Legal: terms of use, privacy notice and accessibility statement (content pages legal/*), with tabs between them.
import { useParams } from 'react-router-dom';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, Callout, EmptyState, Page } from '../../ui';
import { Prose, useContentPage } from './parts';

const PAGES = ['terms', 'privacy', 'accessibility'] as const;

export default function LegalPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const { page = 'terms' } = useParams();
  const known = (PAGES as readonly string[]).includes(page);
  const doc = useContentPage(`legal/${known ? page : 'terms'}`);
  return (
    <Page title={known ? t(`m12.legal.${page}`) : t('m12.routes.legal.title')} intro={t('m12.legal.intro')}>
      <nav aria-label={t('m12.routes.legal.title')} className="flex flex-wrap gap-2" data-testid="m12-legal-tabs">
        {PAGES.map((p) => (
          <L key={p} to={`/legal/${p}`} className={p === page ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-current={p === page ? 'page' : undefined}>
            {t(`m12.legal.${p}`)}
          </L>
        ))}
      </nav>
      {!known ? (
        <EmptyState title={t('m12.legal.unknown')} />
      ) : (
        <Async state={doc} isEmpty={(d) => !d}>
          {(d) => (
            <article className="space-y-4" data-testid="m12-legal-body">
              <Prose text={pick(d!, 'body')} />
              {page === 'privacy' && (
                <Callout tone="info" title={t('m12.legal.rightsTitle')}>
                  {t('m12.legal.rightsBody')} <L to="/my/settings">{t('m12.legal.rightsLink')}</L>
                </Callout>
              )}
              {page === 'accessibility' && (
                <Callout tone="info" title={t('m12.legal.barrierTitle')}>
                  <L to="/contact">{t('m12.legal.barrierLink')}</L>
                </Callout>
              )}
              <p className="text-[12px] text-ink-3">{t('m12.legal.reviewed', { date: f.date(d!.as_of), next: f.date(d!.review_on) })}</p>
            </article>
          )}
        </Async>
      )}
    </Page>
  );
}
