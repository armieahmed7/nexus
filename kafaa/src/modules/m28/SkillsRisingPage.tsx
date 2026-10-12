// FS70 /skills/rising (staff: internal_content R): ENEC Skills on the Rise. The quarterly list HR published (kafaa_skill_signal_runs +
// kafaa_skill_signals), split into "in demand now" and "growing". Every listed skill shows its three signals (suppressed under 10, never a
// count of a small group), which signals moved it, the job families behind the demand and its reasons (<WhyThis>). Past quarters stay
// as they were published. "My job family" narrows the list to the skills rising where I work (the same rows FS75 reads for the digest).
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Page, Section, Async, EmptyState, StatTile, Callout, BenchmarkChips } from '../../ui';
import { QuarterPicker, SignalCard, useQuarterLabel, useRef70, type Ref, type Row } from './fs70ui';

function useRising() {
  const repo = useRepo();
  return useQuery(['skill_signal_runs', 'skill_signals', 'technology_badges'], async () => {
    const [runs, rows, badges] = await Promise.all([
      repo.list('skill_signal_runs' as never, { order: [['quarter', 'desc']] } as never) as Promise<Row[]>,
      repo.list('skill_signals' as never) as Promise<Row[]>,
      (repo.list('technology_badges' as never, { filter: { scope: 'enec' } } as never) as Promise<Row[]>).catch(() => [] as Row[]),
    ]);
    return { runs, rows, badges };
  });
}

export default function SkillsRisingPage() {
  const t = useT();
  const s = useSession();
  const ref = useRef70();
  const q = useRising();
  return (
    <Page title={t('m28.routes.skills-rising.title')} intro={t('m28.rs.intro')} wide eyebrow={<BenchmarkChips feature="FS70" />}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/skills/rising/method" className="btn-outline btn-sm no-underline" data-testid="m28-rs-to-method">{t('m28.rs.toMethod')}</L>
        <L to="/skills/technologies" className="btn-outline btn-sm no-underline" data-testid="m28-rs-to-tech">{t('m28.rs.toTech')}</L>
        {s.can('workforce_strategy', ['Agg', 'R', 'W', 'A']) && <L to="/workforce/skill-signals" className="btn-outline btn-sm no-underline" data-testid="m28-rs-to-workbench">{t('m28.rs.toWorkbench')}</L>}
      </div>}>
      <Async state={ref}>{(r) => <Async state={q} isEmpty={(d) => !d.runs.length} empty={<EmptyState title={t('m28.rs.noRuns')} />}>{(d) => <Rising r={r} runs={d.runs} rows={d.rows} badges={d.badges} />}</Async>}</Async>
    </Page>
  );
}

function Rising({ r, runs, rows, badges }: { r: Ref; runs: Row[]; rows: Row[]; badges: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const ql = useQuarterLabel();
  const [quarter, setQuarter] = useState<string>(runs[0].quarter);
  const [mine, setMine] = useState(false);
  const run = runs.find((x) => x.quarter === quarter) ?? runs[0];
  const fam = s.person?.job_family_id ?? null;
  const list = useMemo(() => rows.filter((x) => x.quarter === run.quarter && (!mine || (fam && (x.families ?? []).includes(fam)))), [rows, run.quarter, mine, fam]);
  const now = list.filter((x) => x.category === 'now').sort((a, b) => a.rank - b.rank);
  const growing = list.filter((x) => x.category === 'growing').sort((a, b) => a.rank - b.rank);
  const c = (run.counts ?? {}) as Row;
  const hot = badges.filter((b) => b.quarter === run.quarter).sort((a, b) => Number(a.rank) - Number(b.rank)).slice(0, 4);
  return (
    <div className="space-y-6" data-testid="m28-rs" data-quarter={run.quarter}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <QuarterPicker quarters={runs.map((x) => x.quarter)} value={run.quarter} onChange={setQuarter} testId="m28-rs-quarters" />
        {fam && <label className="flex min-w-0 items-center gap-2 text-[13px]"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} data-testid="m28-rs-mine" /><span className="min-w-0">{t('m28.rs.myFamily', { family: pick(r.families.get(fam) ?? { name_en: fam, name_ar: fam }, 'name') })}</span></label>}
      </div>
      <p className="text-[13px] text-ink-2" data-testid="m28-rs-published">{t('m28.rs.published', { q: ql(run.quarter), date: f.date(run.published_at) })}{pick(run, 'summary') ? ` ${pick(run, 'summary')}` : ''}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m28-rs-tiles">
        <StatTile label={t('m28.rs.tile.now')} value={f.num(Number(c.now ?? 0))} sub={t('m28.rs.tile.nowSub')} tone="info" />
        <StatTile label={t('m28.rs.tile.growing')} value={f.num(Number(c.growing ?? 0))} sub={t('m28.rs.tile.growingSub')} tone="ok" />
        <StatTile label={t('m28.rs.tile.shown')} value={f.num(Number(c.shown ?? 0))} sub={t('m28.rs.tile.shownSub', { n: f.num(Number(c.considered ?? 0)) })} />
        <StatTile label={t('m28.rs.tile.suppressed')} value={f.num(Number(c.suppressed ?? 0))} sub={t('m28.rs.tile.suppressedSub')} tone="sim" />
      </div>
      <Section title={t('m28.rs.nowTitle')} description={t('m28.rs.nowIntro')}>
        {now.length ? <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m28-rs-now">{now.map((x) => <SignalCard key={x.id} x={x} r={r} />)}</ul>
          : <EmptyState title={mine ? t('m28.rs.noneMine') : t('m28.rs.noneNow')} />}
      </Section>
      <Section title={t('m28.rs.growingTitle')} description={t('m28.rs.growingIntro')}>
        {growing.length ? <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m28-rs-growing">{growing.map((x) => <SignalCard key={x.id} x={x} r={r} />)}</ul>
          : <EmptyState title={mine ? t('m28.rs.noneMine') : t('m28.rs.noneGrowing')} />}
      </Section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m28.rs.howTitle')}>{t('m28.rs.howBody')} <L to="/skills/rising/method">{t('m28.rs.toMethod')}</L></Callout>
        <Callout tone="sim" title={t('m28.rs.keptTitle')}>{t('m28.rs.keptBody')}</Callout>
      </div>
      {hot.length > 0 && (
        <Section title={t('m28.rs.hotTitle')} description={t('m28.rs.hotIntro')}>
          <div className="flex min-w-0 flex-wrap gap-2" data-testid="m28-rs-hot">
            {hot.map((b) => { const tech = r.technologies.find((x) => x.id === b.technology_id); return <L key={b.id} to="/skills/technologies" className="chip max-w-full whitespace-normal break-words no-underline">{tech ? pick(tech, 'name') : b.technology_id}</L>; })}
          </div>
        </Section>
      )}
      {s.can('transformation', ['Scope']) && <Callout tone="info" title={t('m28.rs.pulseTitle')}>{t('m28.rs.pulseBody')} <L to="/my/manager-pulse" data-testid="m28-rs-to-pulse">{t('m28.rs.toPulse')}</L></Callout>}
    </div>
  );
}
