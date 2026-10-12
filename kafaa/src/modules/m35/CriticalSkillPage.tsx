// FS50 /workforce/critical-skills/:id (workforce_strategy Agg/R/W/A): one critical future skill. Owner, decision and rationale (with its
// history), computed progress against this year's target (suppressed under 10), the level mix, KPIs (computed, never typed), the target
// trajectory against the released FS51 forecast supply (SIMULATED), linked FS04 gap plans and the quarterly reviews. The HR director records
// the quarter's review (rpc.reviewCriticalSkill: audit + ledger; may change the decision with a new rationale); HR analysts edit drafts.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import {
  Page, Section, Card, Async, EmptyState, ErrorState, KeyValue, Timeline, ProgressRing, LineChart, BarChart, BenchmarkChips, ConfirmDialog, RadioGroup, TextArea, SelectField,
  Callout, SimChip, StatusPill,
} from '../../ui';
import { L, useFormat, useLang, useT } from '../../i18n';
import { DECISIONS, RATINGS, reviewProblem, targetFor, type Board, type BoardRow, type Rating, type Target } from './critical';
import { BASE_YEAR, HORIZON, type ForecastResult, type ScenarioKey } from './forecast';
import { DecisionPill, ProgressPill, ReviewPill, Sup, useM35Ref, useOwnerLabel, useSkillName, type M35Ref, type Row } from './ui';
import { CriticalEditor } from './CriticalEditor';

export default function CriticalSkillPage() {
  const t = useT();
  const { id = '' } = useParams();
  const repo = useRepo();
  const ref = useM35Ref();
  const q = useQuery(['critical_skills', 'critical_skill_reviews', 'person_skills', 'skill_gap_plans', 'skill_forecasts'], async () => {
    const [b, row, reviews, forecasts] = await Promise.all([
      repo.rpc.criticalSkillBoard(), repo.get('critical_skills', id) as Promise<Row | null>,
      repo.list('critical_skill_reviews', { filter: { critical_skill_id: id } } as never) as Promise<Row[]>, repo.list('skill_forecasts') as Promise<Row[]>,
    ]);
    if (!b.ok || !b.data) throw new Error(b.message);
    return { board: b.data, row, reviews, forecasts };
  }, [id]);
  return (
    <Async state={ref}>{(d) => (
      <Async state={q}>{(x) => (x.row ? <Detail data={x as { board: Board; row: Row; reviews: Row[]; forecasts: Row[] }} refData={d} /> : (
        <Page title={t('m35.routes.workforce-critical-skill.title')}><ErrorState title={t('m35.csd.notFound')} /></Page>
      ))}</Async>
    )}</Async>
  );
}

function Detail({ data, refData }: { data: { board: Board; row: Row; reviews: Row[]; forecasts: Row[] }; refData: M35Ref }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const s = useSession();
  const skillName = useSkillName(refData);
  const owner = useOwnerLabel(refData);
  const { row, board } = data;
  const b = board.rows.find((r) => r.id === row.id) as BoardRow;
  const [editing, setEditing] = useState(false);
  const canEdit = s.can('workforce_strategy', ['A']) || (s.can('workforce_strategy', ['W']) && row.status === 'draft');
  const canReview = s.can('workforce_strategy', ['A']) && row.status === 'active' && b.review.state !== 'done';
  const skill = refData.skills.get(row.skill_id);
  const fc = board.forecast ? data.forecasts.find((x) => x.id === board.forecast!.id) : null;
  const fRes = fc?.results as ForecastResult | undefined;
  const fSkill = fRes?.skills.find((k) => k.skill_id === row.skill_id);
  const years = Array.from({ length: HORIZON - BASE_YEAR + 1 }, (_, i) => BASE_YEAR + i);
  const targets = (row.targets ?? []) as Target[];
  const plans = refData.plans.filter((g) => (row.gap_plan_ids ?? []).includes(g.id));
  const reviews = [...data.reviews].sort((a, c) => (a.quarter < c.quarter ? 1 : -1));
  const series = [
    { name: t('m35.csd.target'), points: years.map((y) => ({ x: String(y), y: targetFor(targets, y) })), tone: 'ink' },
    ...(fSkill && board.forecast ? [{ name: t('m35.csd.forecastSupply', { s: t(`m35.scenario.${board.forecast.scenario}`) }), points: years.map((y, i) => ({ x: String(y), y: fSkill.sc[board.forecast!.scenario as ScenarioKey].s[i][row.target_level - 1] })), tone: 'sim', dashed: true }] : []),
    ...(b.progress.pe != null ? [{ name: t('m35.csd.measured'), points: years.map((y) => ({ x: String(y), y: y === board.year ? b.progress.pe : null })), tone: 'ok' }] : []),
  ];
  return (
    <Page title={skillName(row.skill_id)} intro={t('m35.csd.intro')} wide
      eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS50" /><DecisionPill decision={row.decision} /><StatusPill tone={row.status === 'active' ? 'ok' : 'neutral'}>{t(`m35.status.${row.status}`)}</StatusPill></div>}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/workforce/critical-skills" className="btn-ghost btn-sm no-underline">{t('m35.csd.back')}</L>
        {fSkill && <L to={`/workforce/skill-forecasts/skills/${row.skill_id}`} className="btn-outline btn-sm no-underline" data-testid="m35-csd-forecast-link">{t('m35.csd.toForecast')}</L>}
        {canEdit && <button type="button" className="btn-outline btn-sm" onClick={() => setEditing(true)} data-testid="m35-csd-edit">{t('m35.csd.edit')}</button>}
      </div>}>
      <div className="space-y-6" data-testid="m35-csd" data-id={row.id}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title={t('m35.csd.progress')}>
            <div className="flex items-center gap-4" data-testid="m35-csd-progress" data-status={b.progress.status} data-pe={b.progress.pe ?? ''}>
              {b.progress.suppressed ? <div className="grid h-16 w-16 place-items-center rounded-full bg-sunken text-[12px] text-ink-3" data-suppressed="true">{t('common.suppressedShort')}</div>
                : <ProgressRing value={Math.min(100, b.progress.pct ?? 0)} size={64} label={`${f.num(b.progress.pct ?? 0)}%`} tone={b.progress.status === 'off_track' ? 'bad' : b.progress.status === 'at_risk' ? 'sim' : 'ok'} />}
              <div className="space-y-1 text-[13px]">
                <ProgressPill status={b.progress.status} />
                <p>{b.progress.suppressed ? t('m35.csd.suppressedBody', { n: f.num(board.min_group) }) : t('m35.cs.peOf', { pe: f.num(b.progress.pe ?? 0), target: f.num(b.progress.target_pe), year: String(b.progress.target_year) })}</p>
                <p className="text-[11.5px] text-ink-3">{t('m35.csd.computed', { level: t(`m35.level.${row.target_level}`) })}</p>
              </div>
            </div>
          </Card>
          <Card title={t('m35.csd.owner')}>
            <KeyValue items={[
              [t('m35.csd.ownerLabel'), owner(row.owner_function, row.owner_person_id)],
              [t('m35.csd.targetLevel'), t(`m35.level.${row.target_level}`)],
              [t('m35.csd.adopted'), row.adopted_on ? f.date(row.adopted_on) : t('m35.status.draft')],
              [t('m35.csd.version'), <span className="num" key="v">{f.num(Number(row.version))}</span>],
              [t('m35.csd.area'), skill ? t(`m35.area.${skill.area}`) : '—'],
            ]} />
          </Card>
          <Card title={t('m35.csd.review')}>
            <div className="space-y-2 text-[13px]" data-testid="m35-csd-review-state">
              <ReviewPill state={b.review.state} />
              <p>{t('m35.csd.reviewDue', { q: b.review.quarter, date: f.date(b.review.due_on) })}</p>
              {b.review.last_quarter && <p className="text-ink-3">{t('m35.csd.lastReview', { q: b.review.last_quarter })}</p>}
            </div>
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Section title={t('m35.csd.trajectory')} description={t('m35.csd.trajectoryIntro')}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-2"><SimChip />{fSkill ? t('m35.csd.forecastFrom', { name: board.forecast?.name ?? '' }) : t('m35.csd.noForecast')}</div>
            <div data-testid="m35-csd-trajectory"><LineChart title={t('m35.csd.trajectory')} series={series} /></div>
          </Section>
          <Section title={t('m35.csd.mix')} description={t('m35.csd.mixIntro', { n: f.num(board.min_group) })}>
            <div data-testid="m35-csd-mix"><BarChart title={t('m35.csd.mix')} data={b.progress.mix.map((v, i) => ({ label: t(`m35.level.${i + 1}`), value: v, suppressed: v == null }))} /></div>
            <p className="mt-2 text-[12px] text-ink-2">{t('m35.csd.shareL3')}: <Sup v={b.progress.share_l3} suffix="%" /></p>
          </Section>
        </div>
        <Section title={t('m35.csd.kpis')} description={t('m35.csd.kpisIntro')}>
          <table className="w-full text-[13px]" data-testid="m35-csd-kpis">
            <thead><tr className="text-ink-3"><th scope="col" className="py-1 text-start">{t('m35.csd.kpi')}</th><th scope="col" className="py-1 text-end">{t('m35.csd.kpiTarget')}</th><th scope="col" className="py-1 text-end">{t('m35.csd.kpiValue')}</th><th scope="col" className="py-1 text-end">{t('m35.csd.kpiMet')}</th></tr></thead>
            <tbody>
              {b.kpis.map((k) => (
                <tr key={k.kind} className="border-t border-line" data-kind={k.kind} data-met={String(k.met)}>
                  <th scope="row" className="py-1.5 text-start font-medium">{t(`m35.kpi.${k.kind}`)}<span className="block text-[11.5px] font-normal text-ink-3">{t(`m35.kpiHint.${k.kind}`)}</span></th>
                  <td className="py-1.5 text-end"><span className="num">{k.kind === 'forecast_gap_mid' ? '≤ ' : '≥ '}{f.num(k.target)}{k.kind === 'share_l3' ? '%' : ''}</span></td>
                  <td className="py-1.5 text-end">{k.value == null ? <span className="text-ink-3" data-suppressed="true">{k.kind === 'forecast_gap_mid' ? t('m35.csd.notModelled') : t('common.suppressedShort')}</span> : <span className="num">{f.num(k.value)}{k.kind === 'share_l3' ? '%' : ''}</span>}</td>
                  <td className="py-1.5 text-end">{k.met == null ? '—' : <StatusPill tone={k.met ? 'ok' : 'bad'}>{k.met ? t('m35.csd.yes') : t('m35.csd.no')}</StatusPill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title={t('m35.csd.decision')}>
            <div className="space-y-2" data-testid="m35-csd-decision">
              <DecisionPill decision={row.decision} />
              <p className="text-[13.5px]" lang={lang}>{lang === 'ar' ? row.rationale_ar : row.rationale_en}</p>
              {(row.decision_history ?? []).length > 0 && (
                <div className="mt-2">
                  <h3 className="caps mb-1">{t('m35.csd.history')}</h3>
                  <Timeline items={(row.decision_history as Row[]).map((h, i) => ({ id: String(i), when: f.date(h.until), title: t(`m35.decision.${h.decision}`), detail: lang === 'ar' ? h.rationale_ar : h.rationale_en, tone: 'neutral' as const }))} />
                </div>
              )}
            </div>
          </Section>
          <Section title={t('m35.csd.plans')} description={t('m35.csd.plansIntro')}>
            {plans.length ? (
              <ul className="space-y-2" data-testid="m35-csd-plans">
                {plans.map((g) => (
                  <li key={g.id} className="rounded-card border border-line p-2.5 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2"><b>{t(`m35.planAction.${g.action}`)}</b><StatusPill tone={g.status === 'active' ? 'ok' : 'neutral'}>{t(`m35.planStatus.${g.status}`)}</StatusPill><span className="num text-ink-3">{g.target_quarter}</span></div>
                    <p className="mt-1 text-ink-2">{g.owner_role}{g.note ? ` · ${g.note}` : ''}</p>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title={t('m35.csd.noPlans')} />}
          </Section>
        </div>
        <Section title={t('m35.csd.reviews')} description={t('m35.csd.reviewsIntro')} actions={canReview ? <ReviewButton row={row} quarter={b.review.quarter} /> : undefined}>
          {reviews.length ? (
            <div data-testid="m35-csd-reviews">
              <Timeline items={reviews.map((r) => ({
                id: r.id, when: r.quarter, tone: (r.rating === 'off_track' ? 'bad' : r.rating === 'at_risk' ? 'reserved' : 'ok') as 'bad' | 'reserved' | 'ok',
                title: <span className="inline-flex flex-wrap items-center gap-2">{t(`m35.progress.${r.rating}`)}<span className="text-[12px] font-normal text-ink-3">{r.progress?.suppressed ? t('m35.csd.snapSuppressed') : t('m35.csd.snapshot', { pct: f.num(r.progress?.pct ?? 0), pe: f.num(r.progress?.pe ?? 0) })}</span></span>,
                detail: <span>{lang === 'ar' ? r.note_ar : r.note_en}{r.decision_after !== r.decision_before ? ` · ${t('m35.csd.decisionChanged', { from: t(`m35.decision.${r.decision_before}`), to: t(`m35.decision.${r.decision_after}`) })}` : ''}</span>,
              }))} />
            </div>
          ) : <EmptyState title={t('m35.csd.noReviews')} />}
        </Section>
        <Callout tone="info" title={t('m35.cs.how.title')}>{t('m35.cs.how.body', { n: f.num(board.min_group) })}</Callout>
        {editing && <CriticalEditor open={editing} onClose={() => setEditing(false)} row={row} taken={[]} refData={refData} />}
      </div>
    </Page>
  );
}

function ReviewButton({ row, quarter }: { row: Row; quarter: string }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<Rating>('on_track');
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [decision, setDecision] = useState<string>(row.decision);
  const [ren, setRen] = useState('');
  const [rar, setRar] = useState('');
  const input = { critical_skill_id: row.id, rating, note_en: en, note_ar: ar, decision, rationale_en: ren, rationale_ar: rar };
  const problem = reviewProblem(input, row.decision);
  return (
    <>
      <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)} data-testid="m35-csd-review">{t('m35.csd.recordReview', { q: quarter })}</button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={t('m35.csd.recordReview', { q: quarter })} consequence={t('m35.csd.reviewConsequence')} actingAs={t('m35.actingDirector')}
        confirmLabel={t('m35.csd.saveReview')}
        onConfirm={async () => {
          if (problem) return;
          const r = await run(() => repo.rpc.reviewCriticalSkill(input));
          if (r.ok) setOpen(false);
        }}>
        <div className="space-y-3" data-testid="m35-csd-review-form">
          <RadioGroup label={t('m35.csd.rating')} name="m35-rating" value={rating} onChange={(v) => setRating(v as Rating)} options={RATINGS.map((x) => ({ value: x, label: t(`m35.progress.${x}`) }))} />
          <TextArea name="m35-rev-1" label={t('m35.csd.noteEn')} value={en} onChange={setEn} rows={2} />
          <div dir="rtl" lang="ar"><TextArea name="m35-rev-2" label={t('m35.csd.noteAr')} value={ar} onChange={setAr} rows={2} /></div>
          <SelectField name="m35-rev-3" label={t('m35.csd.decisionReview')} value={decision} onChange={setDecision} options={DECISIONS.map((x) => ({ value: x, label: t(`m35.decision.${x}`) }))} />
          {decision !== row.decision && (
            <>
              <TextArea name="m35-rev-4" label={t('m35.cse.rationaleEn')} value={ren} onChange={setRen} rows={2} />
              <div dir="rtl" lang="ar"><TextArea name="m35-rev-5" label={t('m35.cse.rationaleAr')} value={rar} onChange={setRar} rows={2} /></div>
            </>
          )}
          {problem && <p className="text-[12.5px] text-ink-3" data-testid="m35-csd-review-problem" data-problem={problem}>{t(`m35.csd.reviewProblem.${problem}`)}</p>}
        </div>
      </ConfirmDialog>
    </>
  );
}
