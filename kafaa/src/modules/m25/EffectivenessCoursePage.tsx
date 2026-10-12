// /training/effectiveness/:courseId (F25): one course's Kirkpatrick levels in depth. L1 item means and recommend share (10+ answers),
// L2 before/after knowledge checks from released attempts (10+ pairs), L3 transfer to the job from supervisor observations (10+
// recorded) with the checklist, L4 SAMPLE KPI series (association, not causation). Training managers flag the course for redesign.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { Async, BarChart, Callout, Card, ConfirmDialog, EmptyState, Grid, Icon, KeyValue, LineChart, Page, ProgressRing, SimChip, StatTile, StatusPill, WhyThis } from '../../ui';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { L1_ITEMS, type CourseCard } from './eff';
import { LevelDots, Sup, TrendChip, VerdictPill, useM25Labels, useM25Refs } from './ui';
import { SkillChangeCard } from './fs56ui'; // FS56 (wave F · E4)

export default function EffectivenessCoursePage() {
  const { courseId = '' } = useParams();
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const refs = useM25Refs();
  const lab = useM25Labels(refs.data);
  const [flag, setFlag] = useState(false);
  const q = useQuery(['eval_responses', 'l3_observations', 'redesign_flags', 'attempts'], async () => {
    const r = await repo.rpc.effectivenessReport(courseId);
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data.cards[0] as CourseCard;
  }, [courseId]);
  const survey = refs.data?.surveys.find((x) => x.course_id === courseId);
  const c = lab.course(courseId);

  return (
    <Page title={c.title || t('m25.routes.training-effectiveness-course.title')} eyebrow={<L to="/training/effectiveness" className="link">{t('m25.course.back')}</L>} intro={t('m25.course.intro')} wide>
      <Async state={q}>
        {(card) => (
          <>
            <div className="flex flex-wrap items-center gap-3" data-testid="m25-course-head">
              <span className="ltr text-[13px] text-ink-3">{c.code}</span>
              <StatusPill tone="neutral">{lab.committee(card.committee)}</StatusPill>
              <LevelDots card={card} />
              <VerdictPill card={card} />
              <WhyThis reasons={card.reasons} />
              {s.can('learning_analytics', ['A']) && !card.open_flag && (
                <button type="button" className={card.redesign ? 'btn-primary btn-sm ms-auto' : 'btn-outline btn-sm ms-auto'} onClick={() => setFlag(true)} data-testid="m25-flag-open"><Icon name="alert" />{t('m25.course.flag')}</button>
              )}
            </div>
            <Grid cols={4}>
              <StatTile label={t('m25.course.completions')} value={card.completions === null ? t('m25.common.suppressed') : f.num(card.completions)} />
              <StatTile label={t('m25.course.responses')} value={card.l1.n === null ? t('m25.common.suppressed') : f.num(card.l1.n)} sub={card.l1.rate === null ? undefined : t('m25.course.rate', { n: card.l1.rate })} />
              <StatTile label={t('m25.course.pairs')} value={card.l2.forms ? (card.l2.pairs === null ? t('m25.common.suppressed') : f.num(card.l2.pairs)) : '—'} />
              <StatTile label={t('m25.course.observed')} value={card.l3.qualifying ? (card.l3.done === null ? t('m25.common.suppressed') : f.num(card.l3.done)) : '—'} sub={card.l3.overdue !== null ? t('m25.course.overdue', { n: card.l3.overdue }) : undefined} tone={card.l3.overdue !== null ? 'bad' : undefined} />
            </Grid>

            <Grid cols={2}>
              <Card title={t('m25.level.l1.name')} eyebrow={t('m25.course.level', { n: 1 })}>
                {card.l1.suppressed ? (
                  <EmptyState title={t('m25.course.smallTitle')}>{t('m25.course.l1Small', { n: MIN_GROUP_SIZE })}</EmptyState>
                ) : (
                  <div className="space-y-3" data-testid="m25-l1">
                    <BarChart title={t('m25.level.l1.name')} data={L1_ITEMS.map((k) => ({ label: t(`m25.l1.item.${k}`), value: (card.l1.items[k] ?? 0) / 10, tone: (card.l1.items[k] ?? 0) < 35 ? 'bad' : 'accent' }))} max={5} target={3.5} />
                    <KeyValue items={[[t('m25.eff.recommend'), <Sup key="r" v={card.l1.recommend} pct />], [t('m25.course.responseRate'), <Sup key="rr" v={card.l1.rate} pct />]]} />
                  </div>
                )}
                <p className="mt-2 text-[12px] text-ink-3">{t('m25.course.l1Anon')}</p>
              </Card>

              <Card title={t('m25.level.l2.name')} eyebrow={t('m25.course.level', { n: 2 })}>
                {!card.l2.forms ? (
                  <EmptyState title={t('m25.course.l2None')}>{t('m25.course.l2NoneHint')}</EmptyState>
                ) : card.l2.pairs === null ? (
                  <EmptyState title={t('m25.course.smallTitle')}>{t('m25.course.l2Small', { n: MIN_GROUP_SIZE })}</EmptyState>
                ) : (
                  <div className="space-y-3" data-testid="m25-l2">
                    <BarChart title={t('m25.level.l2.name')} data={[{ label: t('m25.course.before'), value: (card.l2.pre ?? 0) / 10, tone: 'ink' }, { label: t('m25.course.after'), value: (card.l2.post ?? 0) / 10, tone: 'leaf' }]} unit="%" max={100} />
                    <KeyValue items={[[t('m25.course.gain'), <span key="g" className="num">+{f.num((card.l2.gain ?? 0) / 10, { maximumFractionDigits: 1 })} {t('m25.course.points')}</span>], [t('m25.course.normGain'), <Sup key="n" v={card.l2.norm_gain} pct />]]} />
                  </div>
                )}
                <p className="mt-2 text-[12px] text-ink-3">{t('m25.course.l2Released')}{card.l2.unreleased_excluded ? ` ${t('m25.course.l2Excluded')}` : ''}</p>
              </Card>

              <Card title={t('m25.level.l3.name')} eyebrow={t('m25.course.level', { n: 3 })}>
                {!card.l3.qualifying ? (
                  <EmptyState title={t('m25.course.l3NotQualifying')}>{t('m25.course.l3NotQualifyingHint')}</EmptyState>
                ) : (
                  <div className="space-y-3" data-testid="m25-l3">
                    {card.l3.applied === null ? (
                      <Callout tone="info" title={t('m25.course.smallTitle')}>{t('m25.course.l3Small', { n: MIN_GROUP_SIZE })}</Callout>
                    ) : (
                      <div className="flex items-center gap-4">
                        <ProgressRing value={card.l3.applied} size={72} tone={card.l3.applied < 70 ? 'bad' : 'ok'} />
                        <p className="text-[13px] text-ink-2">{t('m25.course.appliedText', { n: card.l3.applied })}</p>
                      </div>
                    )}
                    <KeyValue items={[[t('m25.course.l3Scheduled'), <Sup key="s" v={card.l3.scheduled} />], [t('m25.course.l3Done'), <Sup key="d" v={card.l3.done} />], [t('m25.course.l3Overdue'), <Sup key="o" v={card.l3.overdue} />]]} />
                    {Array.isArray(survey?.l3_items) && (survey!.l3_items as { key: string; en: string; ar: string }[]).length > 0 && (
                      <div>
                        <div className="caps mb-1">{t('m25.course.checklist', { days: survey!.l3_days })}</div>
                        <ol className="list-decimal space-y-0.5 ps-5 text-[13px] text-ink-2">{(survey!.l3_items as { key: string; en: string; ar: string }[]).map((i) => <li key={i.key}>{lang === 'ar' ? i.ar : i.en}</li>)}</ol>
                      </div>
                    )}
                    <L to="/training/observations" className="link text-[13px]">{t('m25.course.toL3')}</L>
                  </div>
                )}
              </Card>

              <Card title={t('m25.level.l4.name')} eyebrow={t('m25.course.level', { n: 4 })} actions={<SimChip label={t('common.sample')} />}>
                <Callout tone="sim" title={t('m25.course.l4CaveatTitle')}>{t('m25.course.l4Caveat')}</Callout>
                {card.l4.kpis.length === 0 ? (
                  <EmptyState title={t('m25.course.l4None')} />
                ) : (
                  <div className="mt-3 space-y-4" data-testid="m25-l4">
                    {card.l4.kpis.map((k) => (
                      <div key={k.id}>
                        <div className="mb-1 flex flex-wrap items-center gap-2"><TrendChip k={k} /><span className="text-[12px] text-ink-3">{k.unit}</span></div>
                        <LineChart title={pick(k, 'label')} series={[{ name: pick(k, 'label'), points: k.series.map((p) => ({ x: p.period, y: p.value })), tone: k.trend === 'worsening' ? 'bad' : 'accent' }]} height={150} />
                        <p className="text-[12px] text-ink-3">{t('m25.course.delivered', { q: k.series.filter((p) => p.delivered).map((p) => p.period).join(', ') || '—' })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Grid>

            <SkillChangeCard courseId={courseId} />

            <ConfirmDialog
              open={flag}
              onClose={() => setFlag(false)}
              title={t('m25.course.flag')}
              consequence={t('m25.course.flagConsequence')}
              requireReason
              reasonLabel={t('m25.course.flagReason')}
              confirmLabel={t('m25.course.flag')}
              onConfirm={async (reason) => { await run(() => repo.rpc.flagRedesign(courseId, reason)); setFlag(false); }}
            />
          </>
        )}
      </Async>
    </Page>
  );
}
