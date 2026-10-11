/** M06 shared pieces: stage vocabulary, programme card, nationality badge, eligibility questions. Module-local (G3). */
import type { ReactNode } from 'react';
import type { TalentProgrammesRow } from '../../data/types';
import { Card, SourceLink, StatusPill, Icon } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';

/** Life stages used by the stage finder (spec M06 "I am in school / finishing school / at university / a graduate / experienced"). */
export const FINDER_STAGES = ['school', 'finishing_school', 'university', 'graduate', 'experienced'] as const;
export type FinderStage = (typeof FINDER_STAGES)[number];
/** Which programme stages fit each finder answer. */
export const FINDER_MATCH: Record<FinderStage, string[]> = {
  school: ['school'],
  finishing_school: ['school_leaver', 'mixed'],
  university: ['university'],
  graduate: ['graduate', 'postgraduate', 'mixed'],
  experienced: ['experienced', 'mixed', 'postgraduate'],
};

/** Plain-language application stages, in order. Closed outcomes are shown separately. */
export const APP_FLOW = ['submitted', 'screening', 'assessment', 'interview', 'offer', 'accepted'] as const;
export const APP_CLOSED = ['withdrawn', 'unsuccessful'] as const;
export const ALL_STAGES = ['interest', ...APP_FLOW, ...APP_CLOSED] as const;
export const isClosed = (stage: string) => (APP_CLOSED as readonly string[]).includes(stage) || stage === 'accepted';
/** Stages HR may record next from a given stage (Kafa'a mirrors the ENEC HR decision; nothing is automatic). */
export function nextStages(stage: string): string[] {
  const order = ['interest', 'submitted', 'screening', 'assessment', 'interview', 'offer', 'accepted'];
  const i = order.indexOf(stage);
  if (i < 0 || isClosed(stage)) return [];
  const forward = order.slice(Math.max(i + 1, 2)).filter((s) => s !== 'accepted' || stage === 'offer');
  return [...forward, 'unsuccessful'];
}
export const stageIndex = (stage: string) => Math.max(0, (APP_FLOW as readonly string[]).indexOf(stage === 'interest' ? 'submitted' : stage));

export function NationalityBadge({ value }: { value: string }) {
  const t = useT();
  const tone = value === 'uae_only' ? 'accent' : value === 'uae_priority' ? 'info' : 'neutral';
  return (
    <StatusPill tone={tone} status={value}>
      {t(`m06.nationality.${value}`)}
    </StatusPill>
  );
}

export function SourceList({ sources }: { sources: unknown }) {
  const list = Array.isArray(sources) ? (sources as { id: string; label: string; url: string }[]) : [];
  if (!list.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {list.map((s) => (
        <li key={s.id}>
          <SourceLink href={s.url}>{s.label}</SourceLink>
        </li>
      ))}
    </ul>
  );
}

export function ProgrammeCard({ p, footer }: { p: TalentProgrammesRow; footer?: ReactNode }) {
  const t = useT();
  const pick = usePick();
  return (
    <Card
      as="article"
      eyebrow={t(`m06.stage.${p.stage}`)}
      title={<L to={`/pathways/${p.id}`} className="link-plain hover:underline">{pick(p, 'name')}</L>}
      actions={<NationalityBadge value={p.nationality} />}
      className="flex h-full flex-col"
      footer={footer ?? <SourceList sources={p.sources} />}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]" data-testid="m06-programme-facts">
        <dt className="caps pt-0.5">{t('m06.card.nationality')}</dt>
        <dd>{t(`m06.nationality.${p.nationality}`)}</dd>
        <dt className="caps pt-0.5">{t('m06.card.education')}</dt>
        <dd>{pick(p, 'education')}</dd>
        <dt className="caps pt-0.5">{t('m06.card.duration')}</dt>
        <dd>{pick(p, 'duration')}</dd>
        {pick(p, 'outcome') && (
          <>
            <dt className="caps pt-0.5">{t('m06.card.leadsTo')}</dt>
            <dd>{pick(p, 'outcome')}</dd>
          </>
        )}
      </dl>
      <p className="mt-2 text-[13px] text-ink-2">{pick(p, 'facts')}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <L to={`/pathways/${p.id}`} className="btn-outline btn-sm" data-testid={`m06-programme-${p.id}`}>
          {t('m06.card.details')}
        </L>
        <ApplyButton p={p} small />
      </div>
    </Card>
  );
}

export function ApplyButton({ p, small }: { p: TalentProgrammesRow; small?: boolean }) {
  const t = useT();
  const cls = `btn-primary ${small ? 'btn-sm' : ''}`;
  if (p.apply_mode === 'closed') return <span className="chip border-line bg-sunken text-ink-3">{t('m06.card.intakeClosed')}</span>;
  if (p.apply_mode === 'link_out' && p.link_out_url)
    return (
      <a href={p.link_out_url} target="_blank" rel="noopener noreferrer" className={cls}>
        {t('m06.card.applyOfficial')}
        <Icon name="external" size={13} />
      </a>
    );
  return (
    <L to={`/apply/${p.id}`} className={cls} data-testid="m06-apply">
      {p.stage === 'school' ? t('m06.card.registerInterest') : t('m06.card.apply')}
    </L>
  );
}

/** Non-binding eligibility questions generated from the programme's published criteria. */
export interface Criterion {
  en: string;
  ar: string;
  kind: 'nationality' | 'education' | 'info' | string;
}
export const criteriaOf = (p: TalentProgrammesRow): Criterion[] => (Array.isArray(p.criteria) ? (p.criteria as unknown as Criterion[]) : []);

export function useStageLabel() {
  const t = useT();
  return (s: string) => t(`m06.appStage.${s}`);
}

export function RelDate({ d }: { d: string | null | undefined }) {
  const f = useFormat();
  return <span className="num">{f.date(d ?? null)}</span>;
}
