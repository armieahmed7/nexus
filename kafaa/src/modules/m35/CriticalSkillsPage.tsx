// FS50 /workforce/critical-skills (workforce_strategy Agg/R/W/A): the Critical Future-Skills Register. Every row: owner (function and role
// card), target level, people-equivalent targets, KPIs, build/buy/borrow/bot decision with its rationale, FS04 gap plans. Progress comes from
// rpc.criticalSkillBoard (computed from F01 skill states, suppressed under 10; never typed), with the quarterly review state and the
// "needs attention" list (ranks register rows, never people; <WhyThis>). HR analysts draft rows; the HR director adopts and reviews.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { Page, Section, Async, Card, EmptyState, StatTile, Donut, DataTable, ProgressBar, WhyThis, BenchmarkChips, Callout, SimChip, type Column } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import type { Board, BoardRow } from './critical';
import { DecisionPill, ProgressPill, ReviewPill, Sup, useM35Ref, useOwnerLabel, useSkillName, type M35Ref, type Row } from './ui';
import { CriticalEditor } from './CriticalEditor';

type Item = { row: Row; b: BoardRow };

export default function CriticalSkillsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const ref = useM35Ref();
  const board = useQuery(['critical_skills', 'critical_skill_reviews', 'person_skills', 'skill_gap_plans', 'skill_forecasts'], async () => {
    const r = await repo.rpc.criticalSkillBoard();
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  const rows = useQuery('critical_skills', () => repo.list('critical_skills', { order: [['sort', 'asc']] } as never) as Promise<Row[]>);
  const canEdit = s.can('workforce_strategy', ['W', 'A']);
  const [editing, setEditing] = useState(false);
  return (
    <Page title={t('m35.routes.workforce-critical-skills.title')} intro={t('m35.cs.intro')} wide eyebrow={<BenchmarkChips feature="FS50" />}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/workforce/skill-forecasts" className="btn-outline btn-sm no-underline">{t('m35.cs.toForecasts')}</L>
        {canEdit && <button type="button" className="btn-primary btn-sm" onClick={() => setEditing(true)} data-testid="m35-cs-add">{t('m35.cs.add')}</button>}
      </div>}>
      <Async state={ref}>{(d) => (
        <Async state={board}>{(b) => (
          <Async state={rows} isEmpty={(x) => x.length === 0} empty={<EmptyState title={t('m35.cs.empty')} />}>{(rs) => (
            <>
              <Register b={b} rows={rs} refData={d} />
              {editing && <CriticalEditor open={editing} onClose={() => setEditing(false)} taken={rs.map((r) => r.skill_id)} refData={d} />}
            </>
          )}</Async>
        )}</Async>
      )}</Async>
    </Page>
  );
}

function Register({ b, rows, refData }: { b: Board; rows: Row[]; refData: M35Ref }) {
  const t = useT();
  const f = useFormat();
  const skillName = useSkillName(refData);
  const owner = useOwnerLabel(refData);
  const [status, setStatus] = useState<'all' | 'active' | 'draft' | 'retired'>('all');
  const [decision, setDecision] = useState<string>('all');
  const items: Item[] = useMemo(() => rows.map((row) => ({ row, b: b.rows.find((x) => x.id === row.id)! })).filter((x) => x.b), [rows, b]);
  const shown = items.filter((x) => (status === 'all' || x.row.status === status) && (decision === 'all' || x.row.decision === decision));
  const attention = items.filter((x) => x.row.status === 'active' && x.b.score > 0).sort((a, c) => c.b.score - a.b.score || Number(a.row.sort) - Number(c.row.sort)).slice(0, 5);
  const kpiMet = (x: Item) => x.b.kpis.filter((k) => k.met === true).length;
  const cols: Column<Item>[] = [
    { key: 'skill', header: t('m35.cs.col.skill'), value: (x) => skillName(x.row.skill_id), sortable: true,
      render: (x) => <div><L to={`/workforce/critical-skills/${x.row.id}`} className="font-semibold" data-testid="m35-cs-link">{skillName(x.row.skill_id)}</L><span className="block text-[11.5px] text-ink-3">{owner(x.row.owner_function, x.row.owner_person_id)}</span></div> },
    { key: 'decision', header: t('m35.cs.col.decision'), value: (x) => x.row.decision, render: (x) => <DecisionPill decision={x.row.decision} /> },
    { key: 'level', header: t('m35.cs.col.level'), value: (x) => Number(x.row.target_level), render: (x) => t(`m35.levelShort.${x.row.target_level}`), sortable: true },
    { key: 'progress', header: t('m35.cs.col.progress'), value: (x) => x.b.progress.pct ?? -1, sortable: true, width: '220px',
      render: (x) => x.b.progress.suppressed ? <div className="flex items-center gap-2"><Sup v={null} /><ProgressPill status="suppressed" /></div> : (
        <div className="space-y-1" data-testid="m35-cs-progress" data-pct={x.b.progress.pct ?? ''}>
          <ProgressBar value={Math.min(100, x.b.progress.pct ?? 0)} tone={x.b.progress.status === 'off_track' ? 'bad' : x.b.progress.status === 'at_risk' ? 'sim' : 'ok'} label={`${f.num(x.b.progress.pct ?? 0)}%`} />
          <span className="block text-[11.5px] text-ink-3">{t('m35.cs.peOf', { pe: f.num(x.b.progress.pe ?? 0), target: f.num(x.b.progress.target_pe), year: String(x.b.progress.target_year) })}</span>
        </div>) },
    { key: 'status', header: t('m35.cs.col.status'), value: (x) => x.b.progress.status, render: (x) => (x.row.status === 'active' ? <ProgressPill status={x.b.progress.status} /> : <span className="text-[12px] text-ink-3">{t(`m35.status.${x.row.status}`)}</span>) },
    { key: 'kpis', header: t('m35.cs.col.kpis'), align: 'end', value: (x) => kpiMet(x), render: (x) => <span className="num">{f.num(kpiMet(x))}/{f.num(x.b.kpis.length)}</span> },
    { key: 'review', header: t('m35.cs.col.review'), value: (x) => x.b.review.state, render: (x) => <ReviewPill state={x.b.review.state} /> },
  ];
  const dec = b.tiles.decisions;
  return (
    <div className="space-y-6" data-testid="m35-cs">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="m35-cs-tiles">
        <StatTile label={t('m35.cs.tile.active')} value={f.num(b.tiles.active)} sub={t('m35.cs.tile.activeSub', { n: f.num(b.tiles.draft) })} />
        <StatTile label={t('m35.cs.tile.onTrack')} value={f.num(b.tiles.met + b.tiles.on_track)} sub={t('m35.cs.tile.onTrackSub', { met: f.num(b.tiles.met) })} tone="ok" />
        <StatTile label={t('m35.cs.tile.risk')} value={f.num(b.tiles.at_risk + b.tiles.off_track)} sub={t('m35.cs.tile.riskSub', { off: f.num(b.tiles.off_track) })} tone="bad" />
        <StatTile label={t('m35.cs.tile.suppressed')} value={f.num(b.tiles.suppressed)} sub={t('m35.cs.tile.suppressedSub', { n: f.num(b.min_group) })} />
        <StatTile label={t('m35.cs.tile.reviews')} value={f.num(b.tiles.due + b.tiles.overdue)} sub={t('m35.cs.tile.reviewsSub', { q: b.quarter, over: f.num(b.tiles.overdue) })} tone="info" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <Section title={t('m35.cs.attention')} description={t('m35.cs.attentionIntro')}>
          {attention.length ? (
            <ol className="space-y-2" data-testid="m35-cs-attention">
              {attention.map((x, i) => (
                <li key={x.row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-panel p-3" data-testid="m35-cs-attention-item" data-score={x.b.score}>
                  <div className="min-w-0">
                    <span className="num me-2 text-ink-3">{f.num(i + 1)}</span>
                    <L to={`/workforce/critical-skills/${x.row.id}`} className="font-semibold">{skillName(x.row.skill_id)}</L>
                    <span className="ms-2 inline-flex flex-wrap gap-1"><DecisionPill decision={x.row.decision} /><ReviewPill state={x.b.review.state} /></span>
                  </div>
                  <WhyThis reasons={x.b.reasons} testId={`m35-cs-why-${i}`} />
                </li>
              ))}
            </ol>
          ) : <EmptyState title={t('m35.cs.noAttention')} />}
          <p className="mt-2 text-[11.5px] text-ink-3">{t('m35.cs.attentionNote')}</p>
        </Section>
        <Card title={t('m35.cs.decisionMix')}>
          <div data-testid="m35-cs-decisions">
            <Donut title={t('m35.cs.decisionMix')} data={(['build', 'buy', 'borrow', 'bot'] as const).map((k) => ({ label: t(`m35.decision.${k}`), value: dec[k], tone: k === 'build' ? 'ok' : k === 'buy' ? 'info' : k === 'borrow' ? 'accent' : 'sim' }))}
              center={<span className="num text-[18px] font-semibold">{f.num(b.tiles.active)}</span>} />
            <ul className="mt-2 space-y-1 text-[12px] text-ink-2">{(['build', 'buy', 'borrow', 'bot'] as const).map((k) => <li key={k}><b>{t(`m35.decision.${k}`)}</b> · {t(`m35.decisionHint.${k}`)}</li>)}</ul>
          </div>
        </Card>
      </div>
      <Section title={t('m35.cs.register')} description={t('m35.cs.registerIntro', { q: b.quarter })}>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label={t('m35.cs.filter')}>
          {(['all', 'active', 'draft', 'retired'] as const).map((k) => (
            <button key={k} type="button" className={`btn-sm ${status === k ? 'btn-primary' : 'btn-outline'}`} aria-pressed={status === k} onClick={() => setStatus(k)} data-testid={`m35-cs-filter-${k}`}>{t(`m35.cs.status.${k}`)}</button>
          ))}
          <select className="input w-auto" value={decision} onChange={(e) => setDecision(e.target.value)} aria-label={t('m35.cs.col.decision')} data-testid="m35-cs-filter-decision">
            <option value="all">{t('m35.cs.allDecisions')}</option>
            {(['build', 'buy', 'borrow', 'bot'] as const).map((k) => <option key={k} value={k}>{t(`m35.decision.${k}`)}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto" data-testid="m35-cs-register">
          <DataTable rows={shown} columns={cols} rowKey={(x) => x.row.id} searchable={false} pageSize={20} caption={t('m35.cs.register')} csvName="critical-skills-register" />
        </div>
      </Section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m35.cs.how.title')}>{t('m35.cs.how.body', { n: f.num(b.min_group) })}</Callout>
        <Callout tone="sim" title={t('m35.cs.forecast.title')}>
          <span className="inline-flex flex-wrap items-center gap-2"><SimChip />{b.forecast ? t('m35.cs.forecast.body', { name: b.forecast.name, s: t(`m35.scenario.${b.forecast.scenario}`) }) : t('m35.cs.forecast.none')}</span>
        </Callout>
      </div>
    </div>
  );
}
