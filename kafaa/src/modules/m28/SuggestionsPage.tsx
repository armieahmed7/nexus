// FS72 /my/skills/suggestions (skills_profile Own): "Skills you may have". Skills inferred from my own gigs, contributions, learning
// activity, skills that usually go together and adjacent skills (src/modules/m28/suggestions.ts#inferSuggestions, a deterministic rule
// on the FS55 ranked-surface register), each with its reasons (<WhyThis>). Private to me (never a manager): confirm adds claimed
// evidence and updates My skills; reject or "not me" hides the suggestion for 180 days. Refresh recomputes for today.
import { useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, BenchmarkChips, Callout, ConfirmDialog, EmptyState, EngineBadge, Page, Section, StatTile, WhyThis } from '../../ui';
import type { Reason } from '../../domain/engines/types';
import { CO, LEVEL2_SCORE, MAX_PER_PERSON, POINTS, REFRESHER_MIN, SOURCES, SUPPRESS_DAYS, THRESHOLD, XAPI_DAYS, type SuggestResponse } from './suggestions';
import { SkillLink, SuggestionStatus, useRef70, useRun28, type Ref, type Row } from './fs70ui';

export default function SuggestionsPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useRef70();
  const q = useQuery(['skill_suggestions'], () => repo.list('skill_suggestions' as never, { order: [['score', 'desc']] } as never) as Promise<Row[]>);
  return (
    <Page title={t('m28.routes.my-skills-suggestions.title')} intro={t('m28.ssg.intro')} eyebrow={<BenchmarkChips feature="FS72" />}
      actions={<L to="/my/skills" className="btn-outline btn-sm no-underline">{t('m28.ssg.toMine')}</L>}>
      <Async state={ref}>{(r) => <Async state={q} isEmpty={() => false}>{(rows) => <Suggestions r={r} rows={rows} />}</Async>}</Async>
    </Page>
  );
}

function Suggestions({ r, rows }: { r: Ref; rows: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useRun28('ssg');
  const [ask, setAsk] = useState<{ row: Row; response: SuggestResponse } | null>(null);
  const open = rows.filter((x) => x.status === 'open').sort((a, b) => Number(b.score) - Number(a.score) || String(a.skill_id).localeCompare(String(b.skill_id)));
  const answered = rows.filter((x) => ['confirmed', 'rejected', 'not_me'].includes(x.status)).sort((a, b) => String(b.responded_on ?? '').localeCompare(String(a.responded_on ?? '')));
  const expired = rows.filter((x) => x.status === 'expired');
  const generated = rows.map((x) => String(x.generated_on ?? '')).sort().pop();
  const skillName = (id: string) => pick(r.skills.get(id) ?? { name_en: id, name_ar: id }, 'name');
  return (
    <div className="space-y-6" data-testid="m28-ssg">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <EngineBadge engine={{ kind: 'deterministic', status: 'active' }} />
          {generated && <span className="text-[13px] text-ink-2" data-testid="m28-ssg-generated">{t('m28.ssg.generated', { date: f.date(generated) })}</span>}
        </div>
        <button type="button" className="btn-outline btn-sm" data-testid="m28-ssg-refresh"
          onClick={() => run(() => repo.rpc.refreshSkillSuggestions(), t('m28.ssg.refreshed'))}>{t('m28.ssg.refresh')}</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t('m28.ssg.status.open')} value={f.num(open.length)} sub={t('m28.ssg.tile.openSub', { n: f.num(MAX_PER_PERSON) })} tone="info" />
        <StatTile label={t('m28.ssg.status.confirmed')} value={f.num(answered.filter((x) => x.status === 'confirmed').length)} tone="ok" />
        <StatTile label={t('m28.ssg.tile.hidden')} value={f.num(answered.filter((x) => x.status !== 'confirmed').length)} sub={t('m28.ssg.tile.hiddenSub', { n: f.num(SUPPRESS_DAYS) })} />
        <StatTile label={t('m28.ssg.status.expired')} value={f.num(expired.length)} tone="sim" />
      </div>
      <Section title={t('m28.ssg.openTitle')} description={t('m28.ssg.openIntro')}>
        {open.length ? (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m28-ssg-open">
            {open.map((x) => (
              <li key={x.id} className="min-w-0 rounded-card border border-line bg-panel p-4" data-testid="m28-ssg-card" data-skill={x.skill_id} data-sources={(x.sources ?? []).join(',')}>
                <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><SkillLink id={x.skill_id} r={r} /></div>
                  <WhyThis reasons={(x.reasons ?? []) as Reason[]} testId="m28-ssg-why" />
                </div>
                <p className="text-[13px] text-ink-2">{t('m28.ssg.levelLine', { level: f.num(Number(x.level)), score: f.num(Number(x.score)) })}</p>
                <div className="mt-2 flex min-w-0 flex-wrap gap-1.5" aria-label={t('m28.ssg.sources')}>
                  {(x.sources as string[] ?? []).map((src) => <span key={src} className="chip">{t(`m28.ssg.src.${src}`)}</span>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary btn-sm" onClick={() => setAsk({ row: x, response: 'confirm' })} data-testid="m28-ssg-confirm">{t('m28.ssg.confirm')}</button>
                  <button type="button" className="btn-outline btn-sm" onClick={() => setAsk({ row: x, response: 'reject' })} data-testid="m28-ssg-reject">{t('m28.ssg.reject')}</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setAsk({ row: x, response: 'not_me' })} data-testid="m28-ssg-notme">{t('m28.ssg.notMe')}</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyState title={t('m28.ssg.noneOpen')}>{t('m28.ssg.noneOpenBody')}</EmptyState>}
      </Section>
      {answered.length > 0 && (
        <Section title={t('m28.ssg.answeredTitle')} description={t('m28.ssg.answeredIntro', { n: f.num(SUPPRESS_DAYS) })}>
          <ul className="space-y-2" data-testid="m28-ssg-answered">
            {answered.map((x) => (
              <li key={x.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-panel px-3 py-2 text-[13.5px]" data-status={x.status} data-skill={x.skill_id}>
                <span className="min-w-0 font-semibold">{skillName(x.skill_id)}</span>
                <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
                  <SuggestionStatus s={x.status} />
                  {x.responded_on && <span>{t('m28.ssg.answeredOn', { date: f.date(x.responded_on) })}</span>}
                  {x.suppressed_until && <span data-testid="m28-ssg-until">{t('m28.ssg.hiddenUntil', { date: f.date(x.suppressed_until) })}</span>}
                  {x.status === 'confirmed' && <L to={`/skills/${x.skill_id}`}>{t('m28.ssg.seeEvidence')}</L>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={t('m28.ssg.howTitle')} description={t('m28.ssg.howIntro', { t: f.num(THRESHOLD), l2: f.num(LEVEL2_SCORE), n: f.num(MAX_PER_PERSON) })}>
        <table className="w-full text-[13px]" data-testid="m28-ssg-points">
          <caption className="sr-only">{t('m28.ssg.howTitle')}</caption>
          <thead><tr className="text-start text-ink-3"><th className="py-1 text-start font-semibold">{t('m28.ssg.col.source')}</th><th className="py-1 text-start font-semibold">{t('m28.ssg.col.rule')}</th><th className="py-1 text-end font-semibold">{t('m28.ssg.col.points')}</th></tr></thead>
          <tbody>
            {SOURCES.map((src) => (
              <tr key={src} className="border-t border-line align-top" data-source={src}>
                <td className="py-1.5 pe-2 font-semibold">{t(`m28.ssg.src.${src}`)}</td>
                <td className="py-1.5 pe-2 text-ink-2">{t(`m28.ssg.rule.${src}`, { days: f.num(XAPI_DAYS), n: f.num(REFRESHER_MIN), holders: f.num(CO.min_holders), both: f.num(CO.min_both), lift: f.num(CO.min_lift100 / 100) })}</td>
                <td className="py-1.5 text-end tabular-nums">{src === 'co_occurrence' ? t('m28.ssg.upTo', { n: f.num(POINTS.co_max) }) : src === 'adjacency' ? `${f.num(POINTS.adjacency)} (+${f.num(POINTS.adjacency_strong)})` : f.num(POINTS[src])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[12.5px] text-ink-3">{t('m28.ssg.never')}</p>
      </Section>
      <Callout tone="info" title={t('m28.ssg.privacyTitle')}>{t('m28.ssg.privacyBody')}</Callout>
      <ConfirmDialog open={!!ask} onClose={() => setAsk(null)}
        title={ask ? t(`m28.ssg.ask.${ask.response}.title`, { skill: skillName(ask.row.skill_id) }) : ''}
        consequence={ask ? t(`m28.ssg.ask.${ask.response}.body`, { skill: skillName(ask.row.skill_id), level: f.num(Number(ask.row.level)), n: f.num(SUPPRESS_DAYS) }) : ''}
        confirmLabel={ask ? t(`m28.ssg.${ask.response === 'not_me' ? 'notMe' : ask.response}`) : undefined}
        onConfirm={async () => { if (!ask) return; const x = await run(() => repo.rpc.respondSuggestion(ask.row.id, ask.response), t(`m28.ssg.done.${ask.response}`)); if (x.ok) setAsk(null); }} />
    </div>
  );
}
