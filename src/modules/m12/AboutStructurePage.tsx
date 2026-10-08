// M12 · Group structure and oversight: ENEC entities, ownership, and oversight bodies with sources. Entities and roles only.
import { useQuery, useRepo } from '../../data';
import { L, usePick, useT } from '../../i18n';
import { Async, Card, Page, Section, SourceLink, StatusPill } from '../../ui';
import { Prose, SourcesList, useContentPage, type SourceRef } from './parts';
import type { OrganisationsRow } from '../../data/types';

const ENTITY_ORDER = ['enec', 'enec-ops', 'enec-com', 'enec-con'];
const OVERSIGHT = ['fanr', 'iaea', 'ead', 'ad-doe', 'ncema'];

export default function AboutStructurePage() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const page = useContentPage('about/structure');
  // Group entities are not in the public partner directory; the structure page shows their public facts from the page text
  // and from the organisations the visitor can read (shareholder, regulators, emergency bodies).
  const orgs = useQuery('organisations', () => repo.list('organisations', { filter: { id: [...ENTITY_ORDER, 'adq', 'kepco', ...OVERSIGHT, 'wano'] } }));
  const byId = new Map((orgs.data ?? []).map((o) => [o.id, o]));
  const srcOf = (o?: OrganisationsRow) => (Array.isArray(o?.sources) && o!.sources[0] ? (o!.sources[0] as SourceRef) : null);
  return (
    <Page title={t('m12.routes.about-structure.title')} eyebrow={t('m12.about.eyebrow')} intro={t('m12.structure.intro')}>
      <Section title={t('m12.structure.ownershipTitle')}>
        <OwnershipDiagram />
        <p className="text-[12px] text-ink-3">{t('m12.structure.diagramNote')}</p>
      </Section>

      <Section title={t('m12.structure.entitiesTitle')}>
        <div className="grid gap-4 sm:grid-cols-2" data-testid="m12-entities">
          {ENTITY_ORDER.map((id) => (
            <Card key={id} eyebrow={t(`m12.structure.entities.${id}.legal`)} title={t(`m12.structure.entities.${id}.name`)}>
              <p className="text-[13px] text-ink-2">{t(`m12.structure.entities.${id}.role`)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill tone="neutral">{t(`m12.structure.entities.${id}.owner`)}</StatusPill>
              </div>
              <div className="mt-2 text-[11.5px]">
                <SourceLink href={t(`m12.structure.entities.${id}.url`)}>{t(`m12.structure.entities.${id}.source`)}</SourceLink>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={t('m12.structure.oversightTitle')} description={t('m12.structure.oversightIntro')}>
        <Async state={orgs}>
          {() => (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="m12-oversight">
              {OVERSIGHT.map((id) => {
                const o = byId.get(id);
                const s = srcOf(o);
                return (
                  <li key={id} className="card p-4">
                    <div className="font-semibold">{o ? pick(o, 'name') : t(`m12.structure.oversight.${id}.name`)}</div>
                    <p className="mt-1 text-[13px] text-ink-2">{t(`m12.structure.oversight.${id}.body`)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
                      {s && <SourceLink href={s.url}>{s.label}</SourceLink>}
                      {o?.public_listed && <L to={`/partners/${o.id}`}>{t('m12.structure.directoryEntry')}</L>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Async>
      </Section>

      <Async state={page} isEmpty={(p) => !p}>
        {(p) => (
          <Section title={t('m12.structure.summaryTitle')}>
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <Prose text={pick(p!, 'body')} />
              <SourcesList sources={p!.sources as SourceRef[]} asOf={p!.as_of} />
            </div>
          </Section>
        )}
      </Async>
    </Page>
  );
}

/** Ownership tree drawn with HTML boxes so it mirrors in RTL without SVG maths. */
function OwnershipDiagram() {
  const t = useT();
  const Box = ({ k, tone = 'neutral' }: { k: string; tone?: 'accent' | 'neutral' | 'partner' }) => (
    <div className={`rounded-card border px-3 py-2 text-center text-[13px] ${tone === 'accent' ? 'border-accent bg-accent-soft font-semibold' : tone === 'partner' ? 'border-dashed border-line-strong bg-raised' : 'border-line bg-panel'}`}>{t(`m12.structure.tree.${k}`)}</div>
  );
  return (
    <figure className="card p-4" aria-label={t('m12.structure.ownershipTitle')} data-testid="m12-ownership">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
        <Box k="adq" />
        <span className="h-4 w-px bg-line-strong" aria-hidden />
        <Box k="enec" tone="accent" />
        <span className="h-4 w-px bg-line-strong" aria-hidden />
        <div className="grid w-full gap-3 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-2">
            <Box k="ops" />
            <Box k="kepco18" tone="partner" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Box k="com" />
            <Box k="kepco18" tone="partner" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Box k="con" />
          </div>
        </div>
      </div>
      <figcaption className="sr-only">{t('m12.structure.diagramAlt')}</figcaption>
    </figure>
  );
}
