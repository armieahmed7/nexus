// /talent/succession (M23 · F19): succession slates for critical and leadership roles. Each slate shows the incumbent role card,
// successors by readiness horizon (ready now / 1-2 years / 3-5 years), emergency cover and risk flags (no ready-now successor,
// a successor on more than two slates, dependence on KHNP or contractor cover). HR sees Emirati and women successor shares as
// aggregates only (suppressed below 10). The HR director rolls confirmed critical slates up into the M07 bench counts.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, Grid, StatTile, ConfirmDialog, SelectField, ProgressBar, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { READINESS } from './domain';
import { ConfidentialNote, FlagPills, ReadinessPill, unwrap, useCatalogue, useLabels, type Labels } from './ui';
import type { SlateView, SuccessionBoard } from './backend/rpc';

const FILTERS = ['all', 'critical', 'leadership', 'flagged'] as const;

export default function SuccessionPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['succession_slates', 'successors', 'bench_rollups', 'critical_roles'], () => unwrap<SuccessionBoard>(repo.rpc.successionBoard()), []);
  const cat = useCatalogue();
  const lab = useLabels(cat.data);
  return (
    <Page title={t('m23.routes.talent-succession.title')} intro={t('m23.sx.intro')} wide
      actions={<L to="/talent/review" className="btn-ghost btn-sm"><Icon name="users" size={14} />{t('m23.routes.talent-review.title')}</L>}>
      <ConfidentialNote />
      <Async state={q}>{(b) => <Board b={b} lab={lab} />}</Async>
    </Page>
  );
}

function Board({ b, lab }: { b: SuccessionBoard; lab: Labels }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const periods = useMemo(() => [...new Set(b.slates.map((s) => s.period))].sort().reverse(), [b.slates]);
  const [period, setPeriod] = useState('');
  const [roll, setRoll] = useState(false);
  const risky = (s: SlateView) => s.flags.some((x) => x !== 'no_emergency');
  const shown = b.slates.filter((s) => filter === 'all' || (filter === 'critical' ? s.critical : filter === 'leadership' ? s.leadership : risky(s)));
  const withReady = b.slates.filter((s) => !s.flags.includes('no_ready_now')).length;
  const lastRoll = b.slates.map((s) => s.rolled_up).filter(Boolean).sort((x, y) => (x!.at < y!.at ? 1 : -1))[0];
  const curP = period || periods[0] || '';
  if (!b.slates.length) return <EmptyState icon="users" title={t('m23.sx.none')}>{t(b.view === 'function' ? 'm23.sx.noneFunction' : 'm23.sx.noneBody')}</EmptyState>;
  return (
    <>
      {b.view === 'function' && <Callout title={t('m23.sx.functionView')}>{t('m23.sx.functionViewBody')}</Callout>}
      <Grid cols={4}>
        <StatTile label={t('m23.sx.slates')} value={f.num(b.slates.length)} sub={t('m23.sx.confirmed', { n: f.num(b.slates.filter((s) => s.status === 'confirmed').length) })} />
        <StatTile label={t('m23.sx.withReady')} value={t('m23.sx.withReadyOf', { n: f.num(withReady), total: f.num(b.slates.length) })} tone={withReady === b.slates.length ? 'ok' : 'bad'} />
        <StatTile label={t('m23.sx.atRisk')} value={f.num(b.slates.filter(risky).length)} tone={b.slates.some(risky) ? 'bad' : 'ok'} sub={t('m23.sx.atRiskSub')} />
        <StatTile label={t('m23.sx.successors')} value={f.num(new Set(b.slates.flatMap((s) => s.successors.filter((x) => x.person_id).map((x) => x.person_id))).size)} sub={t('m23.sx.successorsSub')} />
      </Grid>
      {b.aggregates && (
        <Card title={t('m23.sx.aggTitle')} actions={<span className="text-[12px] text-ink-3">{t('m23.ins.minGroup', { n: f.num(b.aggregates.min_group) })}</span>}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="m23-sx-agg">
            <div className="space-y-2">
              {READINESS.map((r) => (
                <div key={r}>
                  <div className="flex justify-between text-[12.5px]"><span>{t(`m23.readiness.${r}`)}</span>{b.aggregates!.by_readiness[r] == null ? <span className="text-ink-3" data-testid="m23-sx-agg-suppressed">{t('m23.ins.suppressed')}</span> : <span className="num">{f.num(b.aggregates!.by_readiness[r]!)}</span>}</div>
                  <ProgressBar value={b.aggregates!.by_readiness[r] == null || b.aggregates!.successors == null ? 0 : (b.aggregates!.by_readiness[r]! / Math.max(1, b.aggregates!.successors)) * 100} tone={r === 'ready_now' ? 'ok' : r === '1_2y' ? 'accent' : 'sim'} label={t(`m23.readiness.${r}`)} />
                </div>
              ))}
            </div>
            <StatTile label={t('m23.sx.emiratiShare')} value={b.aggregates.emirati_pct == null ? t('m23.ins.suppressed') : f.pct(b.aggregates.emirati_pct, 0)} sub={b.aggregates.successors == null ? t('m23.ins.suppressed') : t('m23.sx.ofSuccessors', { n: f.num(b.aggregates.successors) })} />
            <StatTile label={t('m23.sx.womenShare')} value={b.aggregates.women_pct == null ? t('m23.ins.suppressed') : f.pct(b.aggregates.women_pct, 0)} sub={b.aggregates.successors == null ? t('m23.ins.suppressed') : t('m23.sx.ofSuccessors', { n: f.num(b.aggregates.successors) })} />
          </div>
        </Card>
      )}
      {b.can.rollup && (
        <Card title={t('m23.sx.rollTitle')}>
          <div className="flex flex-wrap items-end gap-3" data-testid="m23-rollup">
            <div className="w-48"><SelectField label={t('m23.sx.period')} name="period" value={curP} onChange={setPeriod} options={periods.map((p) => ({ value: p, label: p }))} /></div>
            <button className="btn-primary" onClick={() => setRoll(true)} data-testid="m23-rollup-btn"><Icon name="chart" size={14} />{t('m23.sx.roll')}</button>
            <L to="/workforce/critical-roles" className="btn-ghost btn-sm">{t('m23.sx.toBench')}</L>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-2">{t('m23.sx.rollBody')}{lastRoll ? ` ${t('m23.sx.lastRoll', { date: f.dateTime(lastRoll.at), period: lastRoll.period })}` : ''}</p>
        </Card>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('m23.sx.filter')}>
        {FILTERS.map((k) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`btn-sm ${filter === k ? 'btn-primary' : 'btn-ghost'}`} data-testid="m23-sx-filter">{t(`m23.sx.f.${k}`)}</button>)}
      </div>
      {shown.length === 0 ? <EmptyState title={t('m23.sx.noneFilter')} /> : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m23-slates">
          {shown.map((s) => <SlateCard key={s.id} s={s} lab={lab} />)}
        </ul>
      )}
      <ConfirmDialog open={roll} onClose={() => setRoll(false)} title={t('m23.sx.rollConfirm')} consequence={t('m23.sx.rollConfirmBody', { period: curP })} confirmLabel={t('m23.sx.roll')}
        onConfirm={async () => { await run(() => repo.rpc.rollupBench(curP)); }} />
    </>
  );
}

function SlateCard({ s, lab }: { s: SlateView; lab: Labels }) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const f = useFormat();
  const internal = s.successors.filter((x) => x.cover_source === 'internal');
  const ext = s.successors.filter((x) => x.cover_source !== 'internal');
  return (
    <li>
      <Card className="h-full" eyebrow={<span className="flex flex-wrap gap-1.5">{s.critical && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m23.sx.critical')}</span>}{s.leadership && <span className="chip border-info-line bg-info-bg text-info">{t('m23.sx.leadership')}</span>}<span className="num">{s.period}</span></span>}
        title={lab.role(s.role_id)} actions={<span className={`chip ${s.status === 'confirmed' ? 'border-ok-line bg-ok-bg text-ok' : s.status === 'proposed' ? 'border-info-line bg-info-bg text-info' : 'border-line bg-sunken text-ink-2'}`}>{t(`m23.slateStatus.${s.status}`)}</span>}>
        <div className="space-y-3 text-[13px]" data-testid="m23-slate" data-flags={s.flags.join(' ')}>
          <div className="flex items-center gap-1.5 text-ink-2"><Icon name="user" size={13} />{pick({ name_en: s.incumbent_en, name_ar: s.incumbent_ar }, 'name')}</div>
          <FlagPills flags={s.flags} />
          <div className="grid grid-cols-3 gap-2">
            {(['ready_now', '1_2y', '3_5y'] as const).map((r) => (
              <div key={r} className="min-w-0 rounded-btn border border-line p-2">
                <div className="caps mb-1">{t(`m23.readiness.${r}`)}</div>
                <ul className="space-y-1">
                  {internal.filter((x) => x.readiness === r).map((x) => (
                    <li key={x.id} className="truncate" title={lang === 'ar' ? x.person_name_ar : x.person_name}>
                      {x.emergency && <span className="me-1 text-bad" title={t('m23.sx.emergency')}>●</span>}
                      {lang === 'ar' ? x.person_name_ar : x.person_name}
                      {x.slates > 2 && <span className="ms-1 text-[11px] text-bad">×{f.num(x.slates)}</span>}
                    </li>
                  ))}
                  {!internal.some((x) => x.readiness === r) && <li className="text-ink-3">—</li>}
                </ul>
              </div>
            ))}
          </div>
          {ext.map((x) => <div key={x.id} className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2"><ReadinessPill r={null} />{pick({ name_en: x.cover_label_en, name_ar: x.cover_label_ar }, 'name')}{x.emergency && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m23.sx.emergency')}</span>}</div>)}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-ink-3">{t('m23.sx.bench', { n: f.num(internal.length), target: f.num(s.target_bench) })}{s.rolled_up ? ` · ${t('m23.sx.rolled', { period: s.rolled_up.period })}` : ''}</span>
            <L to={`/talent/succession/${s.id}`} className="btn-outline btn-sm" data-testid="m23-open-slate">{t('m23.sx.open')}</L>
          </div>
        </div>
      </Card>
    </li>
  );
}
