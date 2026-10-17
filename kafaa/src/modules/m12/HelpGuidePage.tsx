// M12 · Help guide (/help/:guide): title, summary, steps or sections, "Go to" buttons into the real pages, sources with the
// date they were read, related guides, the last-reviewed date and a print button (the print stylesheet hides the chrome).
import { useParams } from 'react-router-dom';
import { L, useFormat, useLang, useT } from '../../i18n';
import { Callout, EmptyState, Icon, Page, Section } from '../../ui';
import { useCrumbLabel } from '../../shell/crumbs';
import { GUIDE_BY_ID } from './help/content';
import { GoToLink, HelpSources } from './help/ui';

export default function HelpGuidePage() {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const { guide: id = '' } = useParams<{ guide: string }>();
  const g = GUIDE_BY_ID[id];
  useCrumbLabel(g ? g.title[lang] : null);

  if (!g) {
    return (
      <Page title={t('m12.help.notFound')}>
        <EmptyState title={t('m12.help.notFound')} action={<L to="/help" className="btn-outline btn-sm">{t('m12.help.back')}</L>}>
          {t('m12.help.notFoundBody')}
        </EmptyState>
      </Page>
    );
  }

  const List = g.numbered ? 'ol' : 'div';
  return (
    <Page
      title={g.title[lang]}
      eyebrow={t(`m12.help.cat.${g.category}`)}
      intro={g.summary[lang]}
      actions={
        <button type="button" className="btn-outline btn-sm no-print" onClick={() => window.print()} data-testid="m12-help-print">
          {t('m12.help.print')}
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink-2" data-testid="m12-help-meta">
        <span className="flex flex-wrap items-center gap-1">
          <span className="sr-only">{t('m12.help.audienceLabel')}: </span>
          {g.audiences.map((a) => (
            <span key={a} className="chip border-line bg-sunken text-ink-2">
              {t(`m12.help.aud.${a}`)}
            </span>
          ))}
        </span>
        <span data-testid="m12-help-reviewed">{t('m12.help.reviewed', { date: f.date(g.reviewed, 'long') })}</span>
      </div>

      <section aria-labelledby="help-steps" data-testid="m12-help-steps">
        <h2 id="help-steps" className="sr-only">
          {t(g.numbered ? 'm12.help.steps' : 'm12.help.sections')}
        </h2>
        <List className="space-y-3">
          {g.steps.map((x, i) => {
            const Item = g.numbered ? 'li' : 'section';
            return (
              <Item key={i} className="card flex gap-3 p-4">
                {g.numbered && (
                  <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-eyebrow" aria-hidden>
                    {f.num(i + 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold">{x.title[lang]}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{x.body[lang]}</p>
                </div>
              </Item>
            );
          })}
        </List>
      </section>

      {g.note && <Callout tone="info" title={t('m12.help.noteTitle')}>{g.note[lang]}</Callout>}

      <Section title={t('m12.help.goTo')}>
        <div className="flex flex-wrap gap-2" data-testid="m12-help-links">
          {g.links.map((l) => (
            <GoToLink key={`${l.route}-${l.params ? JSON.stringify(l.params) : ''}`} link={l} />
          ))}
        </div>
      </Section>

      {g.sources.length > 0 && (
        <Section title={t('m12.help.sources')}>
          <HelpSources sources={g.sources} testid="m12-help-sources" />
        </Section>
      )}

      {g.related.length > 0 && (
        <Section title={t('m12.help.related')}>
          <ul className="grid gap-3 sm:grid-cols-3" data-testid="m12-help-related">
            {g.related.map((rid) => {
              const r = GUIDE_BY_ID[rid];
              return r ? (
                <li key={rid}>
                  <L to={`/help/${rid}`} className="link-plain card flex h-full flex-col p-3 hover:border-accent">
                    <span className="font-semibold text-accent">{r.title[lang]}</span>
                    <span className="mt-1 text-[12.5px] text-ink-2">{r.summary[lang]}</span>
                  </L>
                </li>
              ) : null;
            })}
          </ul>
        </Section>
      )}

      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[13px]">
        <L to="/help" className="inline-flex items-center gap-1">
          <Icon name="back" size={14} />
          {t('m12.help.back')}
        </L>
        <L to="/ask" className="inline-flex items-center gap-1">
          <Icon name="sparkle" size={14} />
          {t('m12.help.stillStuck')}
        </L>
      </div>
    </Page>
  );
}
