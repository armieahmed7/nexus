// FS21/FS22 shared UI (module-local): reference data, level pill, mode and gate chips, the staircase path, the interactive SIMULATED
// trend chart for performance tasks, the published rubric and the integrity summary. Pages import from here.
import { Fragment, useMemo, type ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { Icon, SimChip, StatusPill } from '../../ui';
import { readingTime, type RubricLine, type TaskData } from './perf';
import { MAX_LEVEL } from './adaptive';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;

/** Reference rows every FS21/FS22 page reads (staff-readable; items and keys are not read here). */
export function useFsRef() {
  const repo = useRepo();
  return useQuery(['adaptive_banks', 'performance_tasks', 'skills', 'microcred_defs'], async () => {
    const safe = (p: Promise<unknown>) => (p as Promise<Row[]>).catch(() => [] as Row[]);
    const [banks, tasks, skills, creds] = await Promise.all([
      safe(repo.list('adaptive_banks' as never, { order: [['sort', 'asc']] } as never)), safe(repo.list('performance_tasks' as never, { order: [['sort', 'asc']] } as never)),
      safe(repo.list('skills')), safe(repo.list('microcred_defs' as never)),
    ]);
    return { banks: banks as Row[], tasks: tasks as Row[], skills: skills as Row[], creds: creds as Row[] };
  }, []);
}
export type FsRef = NonNullable<ReturnType<typeof useFsRef>['data']>;

export const LEVEL_TONE = ['bg-sunken text-ink-3', 'bg-info-bg text-info', 'bg-accent-soft text-eyebrow', 'bg-ok-bg text-ok', 'bg-ok-bg text-ok'];
export function LevelPill({ level, testId }: { level: number | null | undefined; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const l = Math.max(0, Math.min(MAX_LEVEL, Number(level ?? 0)));
  return (
    <span className={`chip border-transparent normal-case tracking-normal ${LEVEL_TONE[l]}`} data-testid={testId} data-level={l}>
      <span className="num">{f.num(l)}</span>
      <span>{t(`m05.ad.level.${l}`)}</span>
    </span>
  );
}

export function ModeChip({ criterion, safety }: { criterion: boolean; safety?: boolean }) {
  const t = useT();
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid="m05-mode" data-mode={criterion ? 'criterion' : 'normative'}>
      <StatusPill tone={criterion ? 'info' : 'accent'}>{t(criterion ? 'm05.ad.mode.criterion' : 'm05.ad.mode.normative')}</StatusPill>
      {safety && <StatusPill tone="sim">{t('m05.ad.mode.safety')}</StatusPill>}
    </span>
  );
}

export function GateChips({ codes, d }: { codes: string[] | null | undefined; d: FsRef }) {
  const t = useT();
  const pick = usePick();
  if (!codes?.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid="m05-gates">
      <span className="text-[12px] text-ink-3">{t('m05.gates.label')}</span>
      {codes.map((c) => {
        const def = d.creds.filter((x: Row) => x.code === c).sort((a: Row, b: Row) => Number(b.version) - Number(a.version))[0];
        return <span key={c} className="chip border-line bg-panel normal-case tracking-normal text-ink-2"><Icon name="shield" size={12} />{def ? pick(def, 'title') : <bdi dir="ltr">{c}</bdi>}</span>;
      })}
    </span>
  );
}

export function SkillLinks({ ids, d, level }: { ids: string[]; d: FsRef; level?: Record<string, number> }) {
  const pick = usePick();
  const t = useT();
  const f = useFormat();
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const s = d.skills.find((x: Row) => x.id === id);
        return (
          <span key={id} className="chip max-w-full border-line bg-panel normal-case tracking-normal text-ink-2">
            {s ? <L to={`/skills/${id}`} className="truncate text-inherit" data-testid="m05-skill-link">{pick(s, 'name')}</L> : <span className="truncate">{id}</span>}
            {level?.[id] != null && <span className="text-ink-3">· {t('m05.ad.res.level', { level: f.num(level[id]) })}</span>}
          </span>
        );
      })}
    </span>
  );
}

/** The staircase path of an attempt: one step per item at its level, filled when answered right. */
export function StaircasePath({ path, testId = 'm05-path' }: { path: { level: number; correct: boolean }[]; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const W = Math.max(1, path.length);
  const x = (i: number) => 24 + (i * 452) / Math.max(1, W - 1 || 1);
  const y = (l: number) => 112 - (l - 1) * 30;
  const d = path.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.level)}`).join(' ');
  return (
    <figure className="w-full" data-testid={testId}>
      <div dir="ltr"><svg viewBox="0 0 500 130" className="h-auto w-full" role="img" aria-label={t('m05.ad.path.aria', { n: f.num(path.length) })}>
        {[1, 2, 3, 4].map((l) => (
          <g key={l}>
            <line x1={16} x2={490} y1={y(l)} y2={y(l)} stroke="rgb(var(--line))" strokeDasharray="3 4" />
            <text x={4} y={y(l) + 4} fontSize="10" fill="rgb(var(--ink-3))">{f.num(l)}</text>
          </g>
        ))}
        <path d={d} fill="none" stroke="rgb(var(--accent))" strokeWidth={2} />
        {path.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.level)} r={5} fill={p.correct ? 'rgb(var(--ok))' : 'rgb(var(--panel))'} stroke={p.correct ? 'rgb(var(--ok))' : 'rgb(var(--bad))'} strokeWidth={2}>
            <title>{t(p.correct ? 'm05.ad.path.right' : 'm05.ad.path.wrong', { n: f.num(i + 1), level: f.num(p.level) })}</title>
          </circle>
        ))}
      </svg></div>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-[11.5px] text-ink-3">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(var(--ok))]" />{t('m05.ad.path.legendRight')}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[rgb(var(--bad))]" />{t('m05.ad.path.legendWrong')}</span>
        <span>{t('m05.ad.path.legendAxis')}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{t('m05.ad.path.aria', { n: f.num(path.length) })}</caption>
        <tbody>{path.map((p, i) => <tr key={i}><td>{f.num(i + 1)}</td><td>{f.num(p.level)}</td><td>{t(p.correct ? 'm05.ad.path.legendRight' : 'm05.ad.path.legendWrong')}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

const PALETTE = ['rgb(var(--accent))', 'rgb(var(--sky))', 'rgb(var(--sim))', 'rgb(var(--ok))'];
/** SIMULATED trend set with an optional marked reading (learner's mark, the AI flag, the key window for assessors). */
export function TrendChart({ data, mark, keyWindow, onPick, testId = 'm05-trend' }: {
  data: TaskData; mark?: { series: string; index: number } | null; keyWindow?: { series: string; from: number; to: number } | null;
  onPick?: (series: string, index: number) => void; testId?: string;
}) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const n = Math.max(...data.series.map((s) => s.values.length));
  const H = 70;
  const label = (i: number) => (Array.isArray((data as Row).labels) ? (data as Row).labels[i] : readingTime(data, i));
  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3"><SimChip label={t('m05.pt.simulated')} /><span>{t('m05.pt.noPlant')}</span></div>
      {data.series.map((s, si) => {
        const lo = Math.min(...s.values);
        const hi = Math.max(...s.values);
        const span = hi - lo || 1;
        const x = (i: number) => 8 + (i * 484) / Math.max(1, n - 1);
        const y = (v: number) => 8 + (H - 16) * (1 - (v - lo) / span);
        const dpath = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        const flag = (data as Row).ai_flag && (data as Row).ai_flag.series === s.key ? (data as Row).ai_flag : null;
        const marked = mark && mark.series === s.key ? mark.index : null;
        const win = keyWindow && keyWindow.series === s.key ? keyWindow : null;
        return (
          <div key={s.key} className="rounded-card border border-line p-2" data-series={s.key}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
              <span className="font-semibold">{pick(s as unknown as Row, 'label')}</span>
              <span className="num text-ink-3"><bdi dir="ltr">{f.num(lo)}–{f.num(hi)} {s.unit}</bdi></span>
            </div>
            <div dir="ltr"><svg viewBox={`0 0 500 ${H}`} className={`h-auto w-full ${onPick ? 'cursor-crosshair' : ''}`} role="img" aria-label={pick(s as unknown as Row, 'label')}
              onClick={onPick ? (e) => {
                const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                const px = ((e.clientX - r.left) / Math.max(1, r.width)) * 500;
                onPick(s.key, Math.max(0, Math.min(n - 1, Math.round(((px - 8) / 484) * (n - 1)))));
              } : undefined}>
              {win && <rect x={x(win.from) - 3} y={2} width={Math.max(6, x(win.to) - x(win.from) + 6)} height={H - 4} fill="rgb(var(--sim))" opacity={0.15} />}
              <path d={dpath} fill="none" stroke={PALETTE[si % PALETTE.length]} strokeWidth={1.8} />
              {flag && <g><circle cx={x(flag.index)} cy={y(s.values[flag.index])} r={6} fill="none" stroke="rgb(var(--bad))" strokeWidth={2} /><title>{lang === 'ar' ? flag.label_ar : flag.label_en}</title></g>}
              {marked != null && <g data-testid="m05-trend-mark"><line x1={x(marked)} x2={x(marked)} y1={2} y2={H - 2} stroke="rgb(var(--ink))" strokeWidth={1.5} strokeDasharray="4 3" /><circle cx={x(marked)} cy={y(s.values[marked])} r={4} fill="rgb(var(--ink))" /></g>}
            </svg></div>
            {flag && <p className="mt-1 text-[12px] text-bad"><Icon name="alert" size={12} /> {lang === 'ar' ? flag.label_ar : flag.label_en} · {t('m05.pt.reading', { n: f.num(flag.index + 1), at: label(flag.index) })}</p>}
            <table className="sr-only"><caption>{pick(s as unknown as Row, 'label')}</caption><tbody>{s.values.map((v, i) => <tr key={i}><td>{label(i)}</td><td>{f.num(v)}</td></tr>)}</tbody></table>
          </div>
        );
      })}
      <div className="flex justify-between text-[11.5px] text-ink-3" dir="ltr"><span>{label(0)}</span><span>{label(n - 1)}</span></div>
    </div>
  );
}

export function RubricView({ rubric, passPct, scores, testId = 'm05-rubric' }: { rubric: RubricLine[]; passPct: number; scores?: Record<string, number> | null; testId?: string }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const pick = usePick();
  const max = rubric.reduce((s, l) => s + Number(l.max), 0);
  return (
    <div className="space-y-3" data-testid={testId}>
      <ol className="space-y-3">
        {rubric.map((l, i) => (
          <li key={l.key} className="rounded-card border border-line p-3" data-testid={`m05-rubric-line-${l.key}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold"><span className="num me-1.5 text-ink-3">{f.num(i + 1)}.</span>{pick(l as unknown as Row, 'label')}</span>
              <span className="flex flex-wrap items-center gap-1">
                <StatusPill tone="neutral">{t(`m05.pt.mode.${l.mode}`)}</StatusPill>
                {l.critical && <StatusPill tone="bad">{t('m05.pt.critical')}</StatusPill>}
                {scores && scores[l.key] != null
                  ? <span className="num font-semibold" data-testid={`m05-rubric-score-${l.key}`}>{f.num(scores[l.key])} / {f.num(l.max)}</span>
                  : <span className="num text-ink-3">{t('m05.pt.upTo', { max: f.num(l.max) })}</span>}
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-[13px]">
              {l.levels.map((lv) => (
                <li key={lv.score} className={`flex gap-2 ${scores && scores[l.key] === lv.score ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                  <span className="num w-5 shrink-0 text-ink-3">{f.num(lv.score)}</span>
                  <span>{lang === 'ar' ? lv.ar : lv.en}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="text-[12.5px] text-ink-2" data-testid="m05-rubric-pass">{t('m05.pt.passRule', { pct: f.num(passPct), max: f.num(max) })}</p>
    </div>
  );
}

export function useFlagText() {
  const t = useT();
  return (flag: string) => t(`m05.ir.flag.${flag}`);
}
export function IntegrityStatus({ r }: { r: Row }) {
  const t = useT();
  if (r.decision) return <StatusPill tone={r.decision === 'voided' ? 'bad' : 'ok'}>{t(`m05.ir.decision.${r.decision}`)}</StatusPill>;
  return <StatusPill tone={r.status === 'review' ? 'sim' : 'ok'}>{t(`m05.ir.status.${r.status}`)}</StatusPill>;
}
export function IntegritySummary({ r, children }: { r: Row; children?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const flag = useFlagText();
  const mins = useMemo(() => Math.floor(Number(r.time_on_task_s) / 60), [r.time_on_task_s]);
  const secs = Number(r.time_on_task_s) % 60;
  const rows: [string, ReactNode][] = [
    [t('m05.ir.k.time'), t('m05.ir.minSec', { m: f.num(mins), s: f.num(secs) })],
    ...(r.kind === 'adaptive' ? [
      [t('m05.ir.k.items'), f.num(r.items)], [t('m05.ir.k.fast'), f.num(r.fast_items)], [t('m05.ir.k.median'), r.median_item_s == null ? '—' : t('m05.ir.sec', { s: f.num(r.median_item_s) })],
      [t('m05.ir.k.repeat'), f.num(r.repeat_items)], [t('m05.ir.k.exposure'), t('m05.ir.exposureVal', { max: f.pct(Number(r.exposure_max) * 100, 0), mean: f.pct(Number(r.exposure_mean) * 100, 0), n: f.num(r.exposure_n) })],
    ] as [string, ReactNode][] : [[t('m05.ir.k.resub'), f.num(r.resubmissions)], [t('m05.ir.k.seenBy'), f.num(r.exposure_n)]] as [string, ReactNode][]),
    [t('m05.ir.k.retakes'), f.num(r.retakes)],
  ];
  return (
    <div className="space-y-2" data-testid="m05-integrity" data-status={r.status}>
      <div className="flex flex-wrap items-center gap-2"><IntegrityStatus r={r} />{(r.flags ?? []).map((x: string) => <StatusPill key={x} tone="sim">{flag(x)}</StatusPill>)}</div>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13px]">
        {rows.map(([k, v]) => <Fragment key={k}><dt className="text-ink-3">{k}</dt><dd className="num text-end">{v}</dd></Fragment>)}
      </dl>
      {r.review_note && <p className="rounded-card border border-line bg-sunken p-2 text-[12.5px] text-ink-2">{r.review_note}</p>}
      {children}
    </div>
  );
}
