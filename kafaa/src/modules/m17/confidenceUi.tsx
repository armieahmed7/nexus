// FS03 shared UI (M17): the "how sure are we" band chip and interval bar, the decay-class chip, the multi-source record of a skill, the
// Navigator's readiness range (rendered by M18), the methodology-change banner and the benchmark chips. Built inside the module
// (CONTRACT section 5); nothing here imports a backend. Pure rules: ./decay.ts and src/domain/skills.ts.
import { useMemo, type ReactNode } from 'react';
import { BenchmarkChip, Callout, Icon, WhyThis } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { SCHEMA } from '../../data/schema';
import { useT, useFormat, usePick, useLang, L } from '../../i18n';
import { todayIso } from '../../domain/rules';
import type { ConfidenceBand, DecayClass } from '../../domain/skills';
import { methodNotice, readinessRange, type RecordEntry, type RecordRow } from './decay';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const BAND_STYLE: Record<string, { cls: string; icon: string }> = {
  high: { cls: 'border-ok-line bg-ok-bg text-ok', icon: 'check' },
  medium: { cls: 'border-info-line bg-info-bg text-info', icon: 'info' },
  low: { cls: 'border-sim-line bg-sim-bg text-sim', icon: 'alert' },
};
/** "How sure are we": the band, optionally with the 80% interval. */
export function BandChip({ band, low, high, testId }: { band: ConfidenceBand | string | null | undefined; low?: number | string | null; high?: number | string | null; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const b = band && band in BAND_STYLE ? band : 'low';
  const s = BAND_STYLE[b];
  return (
    <span className={`chip ${s.cls}`} data-band={b} data-testid={testId ?? 'm17-band'} title={t('m17.dk.band.hint')}>
      <Icon name={s.icon} size={12} />
      {t(`m17.dk.band.${b}`)}
      {low != null && high != null && (
        <span className="num opacity-80">
          {' · '}
          <bdi dir="ltr">{t('m17.dk.range', { low: f.pct(Number(low) * 100, 0), high: f.pct(Number(high) * 100, 0) })}</bdi>
        </span>
      )}
    </span>
  );
}
/** A small bar: the interval as a segment and the confidence as a tick (logical positions, so it mirrors in Arabic). */
export function IntervalBar({ low, high, point, width = 96 }: { low: number; high: number; point: number; width?: number }) {
  const t = useT();
  const f = useFormat();
  const pct = (x: number) => `${Math.max(0, Math.min(100, x * 100))}%`;
  return (
    <span className="relative inline-block h-2.5 rounded-full bg-sunken ring-1 ring-inset ring-line align-middle" style={{ width }} role="img"
      aria-label={t('m17.dk.intervalAria', { point: f.pct(point * 100, 0), low: f.pct(low * 100, 0), high: f.pct(high * 100, 0) })}>
      <span className="absolute inset-y-0 rounded-full bg-accent/30" style={{ insetInlineStart: pct(low), width: `${Math.max(2, (high - low) * 100)}%` }} />
      <span className="absolute -inset-y-0.5 w-0.5 rounded bg-accent" style={{ insetInlineStart: pct(point) }} />
    </span>
  );
}
export function ClassChip({ cls, months }: { cls: DecayClass; months?: number | null }) {
  const t = useT();
  const f = useFormat();
  const tone = cls === 'fast' ? 'border-bad-line bg-bad-bg text-bad' : cls === 'slow' ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-2';
  return (
    <span className={`chip ${tone}`} data-class={cls} data-testid="m17-class-chip">
      <Icon name="calendar" size={12} />
      {t(`m17.dk.class.${cls}`)}
      {months != null && <span className="num">{` · ${t('m17.dk.months', { n: f.num(months) })}`}</span>}
    </span>
  );
}

const SOURCE_ICON: Record<string, string> = { self: 'user', peer: 'users', validation: 'shield', assessment: 'check', work: 'briefcase', qualification: 'grad', training: 'book', credential: 'sparkle' };
/** The multi-source record of one skill: one card per source with every row's date, provenance, weight and status. */
export function SourceRecordView({ record, label }: { record: RecordEntry[]; label: (row: RecordRow) => { title: string; system: string } }) {
  const t = useT();
  const f = useFormat();
  if (!record.length) return <p className="text-[13px] text-ink-3">{t('m17.dk.record.none')}</p>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="m17-source-record">
      {record.map((e) => (
        <li key={e.source} className={`min-w-0 rounded-card border p-3 ${e.counted ? 'border-line bg-panel' : 'border-dashed border-line bg-sunken/40'}`} data-testid="m17-source" data-source={e.source} data-counted={e.counted ? 'yes' : 'no'}>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold">
              <Icon name={SOURCE_ICON[e.source] ?? 'info'} size={14} />
              <span className="truncate">{t(`m17.dk.source.${e.source}`)}</span>
            </span>
            {e.counted && e.best != null ? (
              <span className="num shrink-0 text-[12px] text-ink-2" title={t('m17.dk.record.weightHint')}>{t('m17.dk.record.weight', { pct: f.pct(e.best * 100, 0) })}</span>
            ) : (
              <span className="chip shrink-0 border-line bg-sunken text-ink-3">{t('m17.dk.record.notCounted')}</span>
            )}
          </div>
          <ol className="mt-1.5 space-y-1">
            {e.rows.slice(0, 4).map((r) => {
              const x = label(r);
              return (
                <li key={r.id} className="text-[12.5px] leading-snug">
                  <div className="truncate text-ink">{x.title}</div>
                  <div className="text-ink-3">
                    {t('m17.dk.record.row', { date: r.observed_on ? f.date(r.observed_on) : '—', level: f.num(r.level), system: x.system })}
                    {r.ageing && <span className="ms-1 text-sim">{t('m17.dk.record.ageing')}</span>}
                  </div>
                </li>
              );
            })}
            {e.rows.length > 4 && <li className="text-[12px] text-ink-3">{t('m17.dk.record.more', { n: f.num(e.rows.length - 4) })}</li>}
          </ol>
          {e.source === 'peer' && <p className="mt-1 text-[12px] text-ink-3">{t('m17.dk.record.peerNote')}</p>}
        </li>
      ))}
    </ul>
  );
}

/** F05 Navigator readiness tile: how sure the readiness is (all skills vs only the skills we are fairly sure of). Rendered by M18. */
export function ReadinessSure({ states, skills, roleComps, roleId, weights, detail = false }: {
  states: Row[]; skills: Row[]; roleComps: Row[]; roleId: string; weights?: Record<string, number>; detail?: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const r = useMemo(() => readinessRange({ states, skills, roleComps, roleId, weights }), [states, skills, roleComps, roleId, weights]);
  if (!r) return null;
  const skillName = (id: string) => pick(skills.find((s: Row) => s.id === id), 'name');
  return (
    <span className={detail ? 'block space-y-1' : 'inline-flex flex-wrap items-center gap-1'} data-testid="m18-readiness-sure" data-band={r.band}>
      <span className="inline-flex flex-wrap items-center gap-1">
        <BandChip band={r.band} testId="m18-readiness-band" />
        <span className="num text-[12px] text-ink-2" title={t('m17.dk.ready.rangeHint')}>
          {t('m17.dk.ready.label')}{' '}
          <bdi dir="ltr">{r.pctSure === r.pct ? f.pct(r.pct, 0) : t('m17.dk.range', { low: f.pct(r.pctSure, 0), high: f.pct(r.pct, 0) })}</bdi>
        </span>
        <WhyThis reasons={r.reasons} testId={`m18-readiness-sure-why-${roleId}`} />
      </span>
      {detail && (
        <span className="block text-[12.5px] text-ink-2">
          {r.unsure.length ? t('m17.dk.ready.unsure', { skills: r.unsure.slice(0, 3).map((u) => skillName(u.skill_id)).join(t('m17.dk.listSep')) }) : t('m17.dk.ready.allSure')}{' '}
          <L to="/my/skills/confidence">{t('m17.dk.ready.link')}</L>
        </span>
      )}
    </span>
  );
}

/** FORECAST: a banner when the way confidence is calculated changed (FS03 itself, or a later half-life change by an admin). */
export function MethodBanner({ settings }: { settings?: Row | null }) {
  const t = useT();
  const f = useFormat();
  const n = methodNotice(settings ?? null, todayIso());
  if (!n) return null;
  return (
    <div data-testid="m17-method-banner" data-kind={n.kind}>
      <Callout tone="info" title={t('m17.dk.method.title')}>
        {t(`m17.dk.method.${n.kind}`, { date: f.date(n.since) })}
      </Callout>
    </div>
  );
}

/** Benchmark chips (FS01 shared <BenchmarkChip>s, rows from kafaa_benchmarks), each opening the registry drawer with sources,
 *  plus one line per benchmark on what this feature takes from it. */
export function Fs03Benchmarks({ ids = ['WEF-FOJ', 'SKILLS-TECH', 'FORECAST'], children }: { ids?: string[]; children?: ReactNode }) {
  const t = useT();
  return (
    <div className="space-y-2" data-testid="m17-benchmarks">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="caps me-1">{t('m17.dk.bench.title')}</span>
        {ids.map((id) => <BenchmarkChip key={id} id={id} />)}
      </div>
      <ul className="grid grid-cols-1 gap-1 text-[12.5px] text-ink-2 md:grid-cols-3">
        {ids.map((id) => <li key={id}><span className="font-semibold text-ink" dir="ltr">{id}</span>: {t(`m17.dk.bench.${id}`)}</li>)}
      </ul>
      {children}
    </div>
  );
}

/** The three decay classes (public reference rows): meaning, examples, default vs current half-life, areas and sourced facts. */
export function DecayClassCards({ classes, months, counts }: { classes: Row[]; months: Record<DecayClass, number>; counts?: Partial<Record<DecayClass, number>> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!classes.length) return <p className="text-[13px] text-ink-3">{t('m17.dk.classes.none')}</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="m17-decay-classes">
      {[...classes].sort((a, b) => a.sort - b.sort).map((c) => {
        const cur = months[c.id as DecayClass];
        return (
          <li key={c.id} className="card flex min-w-0 flex-col gap-2 p-4" data-testid="m17-decay-class" data-class={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold">{pick(c, 'name')}</h3>
              <ClassChip cls={c.id} months={cur} />
            </div>
            <p className="text-[13px] text-ink-2">{pick(c, 'summary')}</p>
            {pick(c, 'examples') && <p className="text-[12.5px] text-ink-3">{t('m17.dk.classes.examples', { list: pick(c, 'examples') })}</p>}
            <div className="text-[12.5px] text-ink-2">
              {cur === c.default_months ? t('m17.dk.classes.atDefault', { n: f.num(cur) }) : t('m17.dk.classes.changed', { n: f.num(cur), d: f.num(c.default_months) })}
              {counts?.[c.id as DecayClass] != null && <> · {t('m17.dk.classes.skills', { n: f.num(counts[c.id as DecayClass]!) })}</>}
            </div>
            {(c.areas ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(c.areas as string[]).map((a) => <span key={a} className="chip border-line bg-sunken text-ink-2">{t(`m17.dk.area.${a}`)}</span>)}
              </div>
            )}
            {(c.facts ?? []).map((x: Row, i: number) => (
              <div key={i} className="rounded-card border border-line bg-sunken/50 p-2.5 text-[12.5px]" data-testid="m17-decay-fact">
                <div className="flex items-start gap-2">
                  {x.value && <span className="num shrink-0 text-[18px] font-semibold leading-none text-eyebrow"><bdi dir="ltr">{x.value}</bdi></span>}
                  <span className="text-ink-2">{pick(x, 'label')}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px] text-ink-3">
                  <span className="font-mono" dir="ltr">{x.benchmark}</span> ·
                  <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5">{x.source} <Icon name="external" size={10} /></a>
                  · {t('m17.dk.asOf', { date: f.date(x.as_of) })}
                </div>
              </div>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

/** How the number is made: the published weights and thresholds (same constants as the server). */
export function MethodCard() {
  const t = useT();
  const f = useFormat();
  const rows: [string, string][] = [
    [t('m17.dk.methodCard.weights'), t('m17.dk.methodCard.weightsValue', { v: f.num(1), e: f.num(0.8), a: f.num(0.6), c: f.num(0.3) })],
    [t('m17.dk.methodCard.sources'), t('m17.dk.methodCard.sourcesValue')],
    [t('m17.dk.methodCard.diminish'), t('m17.dk.methodCard.diminishValue')],
    [t('m17.dk.methodCard.interval'), t('m17.dk.methodCard.intervalValue', { pct: f.pct(80, 0) })],
    [t('m17.dk.methodCard.bands'), t('m17.dk.methodCard.bandsValue', { high: f.pct(60, 0), medium: f.pct(30, 0) })],
    [t('m17.dk.methodCard.ageing'), t('m17.dk.methodCard.ageingValue')],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]" data-testid="m17-method-card">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-ink">{k}</dt>
          <dd className="text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
