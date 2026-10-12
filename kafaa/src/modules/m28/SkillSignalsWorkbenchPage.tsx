// FS70/FS72 /workforce/skill-signals (workforce_strategy Agg/R/W/A: HR, the training manager, admins, auditors): the signal workbench.
// List: compute any quarter from 2025-Q1 for review (rpc.computeSkillSignals), publish an ended quarter with a short summary (HR analyst
// or HR director: workforce_strategy W/A; ConfirmDialog; kept, never overwritten). Pulse: the manager pulse of a year as an aggregate
// (rpc.managerPulseSummary; nothing under 10). Suggestions: the "Skills you may have" counts as an aggregate (rpc.suggestionStats) and
// the surface's fairness snapshots (integrations A runs one). Never a named person.
import { useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import {
  Async, BarChart, BenchmarkChips, Callout, ConfirmDialog, DataTable, EmptyState, ErrorState, KeyValue, Page, Section, SelectField, StatTile, StatusPill, Tabs, TextArea, type Column,
} from '../../ui';
import { todayIso } from '../../domain/rules';
import { MIN_SIGNAL, quarterClosed, quarterOf, quartersTo, type RisingResult } from './signals';
import { SignalCard, SignalRules, useQuarterLabel, useRef70, useRun28, type Ref, type Row } from './fs70ui';

export default function SkillSignalsWorkbenchPage() {
  const t = useT();
  const ref = useRef70();
  return (
    <Page title={t('m28.routes.workforce-skill-signals.title')} intro={t('m28.sw.intro')} wide eyebrow={<BenchmarkChips feature="FS70" />}
      actions={<L to="/skills/rising" className="btn-outline btn-sm no-underline">{t('m28.sw.toList')}</L>}>
      <Async state={ref}>{(r) => (
        <div data-testid="m28-sw">
          <Tabs tabs={[
            { id: 'list', label: t('m28.sw.tab.list'), content: <ListTab r={r} /> },
            { id: 'pulse', label: t('m28.sw.tab.pulse'), content: <PulseTab r={r} /> },
            { id: 'suggestions', label: t('m28.sw.tab.suggestions'), content: <SuggestTab /> },
          ]} />
        </div>
      )}</Async>
    </Page>
  );
}

// ───────────── the quarterly list
function ListTab({ r }: { r: Ref }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const run = useRun28('rs');
  const ql = useQuarterLabel();
  const today = todayIso();
  const quarters = quartersTo(quarterOf(today)).reverse();
  const canPublish = s.can('workforce_strategy', ['W', 'A']);
  const runs = useQuery(['skill_signal_runs'], () => repo.list('skill_signal_runs' as never, { order: [['quarter', 'desc']] } as never) as Promise<Row[]>);
  const [quarter, setQuarter] = useState(quarters[0]);
  const [preview, setPreview] = useState<RisingResult | null>(null);
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const compute = async (q: string) => { const x = await run(() => repo.rpc.computeSkillSignals(q), t('m28.sw.computed')); setPreview(x.ok && x.data ? x.data : null); };
  return (
    <Async state={runs} isEmpty={() => false}>{(rows) => {
      const published = new Set(rows.map((x) => x.quarter));
      const isPub = published.has(quarter);
      const closed = quarterClosed(quarter, today);
      const cols: Column<Row>[] = [
        { key: 'quarter', header: t('m28.rs.quarter'), value: (x) => x.quarter, render: (x) => ql(x.quarter) },
        { key: 'now', header: t('m28.rs.tile.now'), value: (x) => Number(x.counts?.now ?? 0), render: (x) => f.num(Number(x.counts?.now ?? 0)), align: 'end' },
        { key: 'growing', header: t('m28.rs.tile.growing'), value: (x) => Number(x.counts?.growing ?? 0), render: (x) => f.num(Number(x.counts?.growing ?? 0)), align: 'end' },
        { key: 'suppressed', header: t('m28.rs.tile.suppressed'), value: (x) => Number(x.counts?.suppressed ?? 0), render: (x) => f.num(Number(x.counts?.suppressed ?? 0)), align: 'end' },
        { key: 'method', header: t('m28.sw.method'), value: (x) => x.method },
        { key: 'at', header: t('m28.sw.publishedAt'), value: (x) => x.published_at, render: (x) => f.date(x.published_at) },
      ];
      return (
        <div className="space-y-5 pt-4" data-testid="m28-sw-list">
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="min-w-[12rem]"><SelectField name="quarter" label={t('m28.rs.quarter')} value={quarter} onChange={(x) => { setQuarter(x); setPreview(null); }}
              options={quarters.map((x) => ({ value: x, label: `${ql(x)}${published.has(x) ? ` · ${t('m28.hta.isPublished')}` : ''}` }))} /></div>
            <button type="button" className="btn-outline btn-sm" data-testid="m28-sw-compute" onClick={() => compute(quarter)}>{t('m28.sw.compute')}</button>
          </div>
          <p className="text-[13px] text-ink-2">{isPub ? t('m28.sw.keptNote') : closed ? t('m28.sw.readyNote') : t('m28.sw.openNote')}</p>
          {preview && (
            <div className="space-y-4" data-testid="m28-sw-preview" data-quarter={preview.quarter}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile label={t('m28.rs.tile.now')} value={f.num(preview.counts.now)} tone="info" />
                <StatTile label={t('m28.rs.tile.growing')} value={f.num(preview.counts.growing)} tone="ok" />
                <StatTile label={t('m28.rs.tile.shown')} value={f.num(preview.counts.shown)} sub={t('m28.rs.tile.shownSub', { n: f.num(preview.counts.considered) })} />
                <StatTile label={t('m28.rs.tile.suppressed')} value={f.num(preview.counts.suppressed)} sub={t('m28.rs.tile.suppressedSub')} tone="sim" />
              </div>
              <p className="text-[13px] text-ink-2">{t('m28.sw.window', { start: f.date(preview.start), end: f.date(preview.end), prev: ql(preview.prev), v: preview.method })}</p>
              {preview.rows.length
                ? <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{preview.rows.map((x) => <SignalCard key={`${x.category}-${x.skill_id}`} x={x as unknown as Row} r={r} />)}</ul>
                : <EmptyState title={t('m28.sw.emptyPreview')} />}
              {canPublish && closed && !isPub && (
                <div className="space-y-3 rounded-card border border-line bg-panel p-4" data-testid="m28-sw-publishbox">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <TextArea name="summary_en" label={t('m28.sw.summaryEn')} value={en} onChange={setEn} rows={3} hint={t('m28.sw.summaryHint')} />
                    <TextArea name="summary_ar" label={t('m28.sw.summaryAr')} value={ar} onChange={setAr} rows={3} hint={t('m28.sw.summaryHint')} />
                  </div>
                  <button type="button" className="btn-primary" data-testid="m28-sw-publish" onClick={() => setConfirm(true)}>{t('m28.sw.publish')}</button>
                </div>
              )}
            </div>
          )}
          {!canPublish && <Callout tone="sim" title={t('m28.sw.readOnlyTitle')}>{t('m28.sw.readOnlyBody')}</Callout>}
          <Section title={t('m28.sw.runsTitle')}>
            <DataTable rows={rows} columns={cols} rowKey={(x) => x.id} searchable={false} csvName="skill-signal-runs.csv" caption={t('m28.sw.runsTitle')} empty={<EmptyState title={t('m28.rs.noRuns')} />} />
          </Section>
          <Section title={t('m28.sm.signalsTitle')}><SignalRules /></Section>
          <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m28.sw.publish')} consequence={t('m28.sw.publishConsequence', { q: ql(quarter) })}
            onConfirm={async () => { const x = await run(() => repo.rpc.publishSkillSignals(quarter, en.trim() || null, ar.trim() || null), t('m28.sw.publishedOk')); if (x.ok) { setConfirm(false); setPreview(null); setEn(''); setAr(''); } }} />
        </div>
      );
    }}</Async>
  );
}

// ───────────── manager pulse aggregate
function PulseTab({ r }: { r: Ref }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const thisYear = Number(todayIso().slice(0, 4));
  const years = Array.from({ length: thisYear - 2025 + 1 }, (_, i) => thisYear - i);
  const [year, setYear] = useState(thisYear);
  const q = useQuery(['manager_pulse'], async () => repo.rpc.managerPulseSummary(year), [year]);
  return (
    <div className="space-y-4 pt-4" data-testid="m28-sw-pulse">
      <div className="max-w-xs"><SelectField name="year" label={t('m28.sw.year')} value={String(year)} onChange={(x) => setYear(Number(x))} options={years.map((y) => ({ value: String(y), label: f.num(y, { useGrouping: false }) }))} /></div>
      <p className="font-semibold">{t('m28.mp.question')}</p>
      <Async state={q}>{(res) => {
        if (!res.ok || !res.data) return <ErrorState error={res.message} />;
        const d = res.data;
        if (d.suppressed) return <div data-testid="m28-sw-pulse-suppressed"><EmptyState title={t('m28.sw.pulseSuppressed', { n: f.num(MIN_SIGNAL) })}>{t('m28.sw.pulseSuppressedBody')}</EmptyState></div>;
        return (
          <div className="space-y-4" data-testid="m28-sw-pulse-summary">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label={t('m28.sw.responses')} value={f.num(d.responses ?? 0)} />
              <StatTile label={t('m28.sw.median')} value={`${f.num(d.median ?? 0)}%`} tone="info" />
              <StatTile label={t('m28.sw.p25')} value={`${f.num(d.p25 ?? 0)}%`} />
              <StatTile label={t('m28.sw.p75')} value={`${f.num(d.p75 ?? 0)}%`} />
            </div>
            <BarChart title={t('m28.sw.bandsTitle')} data={d.bands.map((b) => ({ label: `${f.num(b.lo)}-${f.num(b.hi)}%`, value: b.n, suppressed: b.n == null }))} />
            <KeyValue items={d.families.map((x) => [pick(r.families.get(x.family_id) ?? { name_en: t('m28.sw.noFamily'), name_ar: t('m28.sw.noFamily') }, 'name'),
              x.n == null ? t('m28.rs.suppressed') : t('m28.sw.familyRow', { n: f.num(x.n), m: f.num(x.median ?? 0) })])} />
          </div>
        );
      }}</Async>
      <Callout tone="info" title={t('m28.mp.privacyTitle')}>{t('m28.sw.pulsePrivacy', { n: f.num(MIN_SIGNAL) })}</Callout>
    </div>
  );
}

// ───────────── "Skills you may have" aggregate + fairness
function SuggestTab() {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const run = useRun28('ssg');
  const stats = useQuery(['skill_suggestions'], () => repo.rpc.suggestionStats());
  const fair = useQuery(['skill_suggestion_fairness'], () => (repo.list('skill_suggestion_fairness' as never, { order: [['as_of', 'desc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]));
  const [confirm, setConfirm] = useState(false);
  const canRun = s.can('integrations', ['A']);
  const n = (v: number | null) => (v == null ? t('m28.rs.suppressed') : f.num(v));
  const cols: Column<Row>[] = [
    { key: 'as_of', header: t('m28.sw.asOf'), value: (x) => x.as_of, render: (x) => f.date(x.as_of) },
    { key: 'dimension', header: t('m28.sw.dimension'), value: (x) => x.dimension, render: (x) => t(`m28.sw.dim.${x.dimension}`) },
    { key: 'group', header: t('m28.sw.group'), value: (x) => x.group_key, render: (x) => t(`m28.sw.grp.${x.group_key}`) },
    { key: 'n', header: t('m28.sw.n'), value: (x) => x.n, render: (x) => n(x.n), align: 'end' },
    { key: 'rate', header: t('m28.sw.rate'), value: (x) => x.rate, render: (x) => (x.rate == null ? '—' : `${f.num(Math.round(Number(x.rate) * 100))}%`), align: 'end' },
    { key: 'ratio', header: t('m28.sw.ratio'), value: (x) => x.ratio, render: (x) => (x.ratio == null ? '—' : f.num(Number(x.ratio), { maximumFractionDigits: 2 })), align: 'end' },
    { key: 'flag', header: t('m28.sw.flag'), value: (x) => (x.flagged ? 1 : 0), render: (x) => (x.suppressed ? <StatusPill tone="neutral">{t('m28.rs.suppressed')}</StatusPill> : x.flagged ? <StatusPill tone="bad">{t('m28.sw.flagged')}</StatusPill> : <StatusPill tone="ok">{t('m28.sw.within')}</StatusPill>) },
  ];
  return (
    <div className="space-y-5 pt-4" data-testid="m28-sw-suggest">
      <Async state={stats}>{(res) => {
        if (!res.ok || !res.data) return <ErrorState error={res.message} />;
        const d = res.data;
        return (
          <div className="space-y-3" data-testid="m28-sw-stats" data-suppressed={d.suppressed ? '1' : '0'}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label={t('m28.sw.people')} value={n(d.people)} />
              <StatTile label={t('m28.ssg.status.open')} value={n(d.open)} tone="info" />
              <StatTile label={t('m28.ssg.status.confirmed')} value={n(d.confirmed)} tone="ok" />
              <StatTile label={t('m28.sw.confirmRate')} value={d.confirm_rate == null ? t('m28.rs.suppressed') : `${f.num(d.confirm_rate)}%`} />
              <StatTile label={t('m28.ssg.status.rejected')} value={n(d.rejected)} />
              <StatTile label={t('m28.ssg.status.not_me')} value={n(d.not_me)} />
              <StatTile label={t('m28.ssg.status.expired')} value={n(d.expired)} tone="sim" />
            </div>
            <p className="text-[12.5px] text-ink-3">{t('m28.sw.statsNote', { n: f.num(MIN_SIGNAL) })}</p>
          </div>
        );
      }}</Async>
      <Section title={t('m28.sw.fairTitle')} description={t('m28.sw.fairIntro')} actions={canRun ? <button type="button" className="btn-outline btn-sm" onClick={() => setConfirm(true)} data-testid="m28-sw-fair-run">{t('m28.sw.fairRun')}</button> : undefined}>
        <Async state={fair} isEmpty={() => false}>{(rows) => <DataTable rows={rows} columns={cols} rowKey={(x) => x.id} searchable={false} csvName="skill-suggestion-fairness.csv" caption={t('m28.sw.fairTitle')} empty={<EmptyState title={t('m28.sw.fairEmpty')} />} />}</Async>
      </Section>
      {s.hasRole('admin', 'auditor', 'hr_analyst', 'hr_director') && <L to="/admin/ai-transparency" className="text-[13px]">{t('m28.sw.toEngines')}</L>}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m28.sw.fairRun')} consequence={t('m28.sw.fairConsequence')}
        onConfirm={async () => { const x = await run(() => repo.rpc.runSuggestionFairness(null), t('m28.sw.fairDone')); if (x.ok) setConfirm(false); }} />
    </div>
  );
}
