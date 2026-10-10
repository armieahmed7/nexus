// FS16 /careers/outlook-criteria (FS wave B · E5): "Role outlook labels and how they are decided". Public: the three labels,
// the criteria in force with every threshold, the precedence and sources, the earlier criteria version, and every role's label
// for each year (past labels are kept). Staff (transformation R) also see the components behind each label (demand growth,
// shortfall, profile change, all percentages, never headcount) and "Why this label?". The training manager and the HR director
// preview this year's labels from today's inputs; only the HR director publishes them (rpc.publishOutlookLabels, ConfirmDialog,
// audited and ledgered). Inputs are SIMULATED planning numbers; no deployment decision implied.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Grid, Async, EmptyState, Callout, StatusPill, SimChip, SourceLink, Icon, BenchmarkChips, BenchmarkLine, ConfirmDialog } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { criteriaFor, thresholdsOf, type Components, type OutlookLabel, type Thresholds } from './outlookLabels';
import type { OutlookPreview } from './backend/rpc';
import { LABEL_ICON, LABEL_TONE, OutlookChip, useFamilyLabels, useOutlookData, useRolesById, useSeesComponents, type OutlookData } from './futureUi';

const ORDER: OutlookLabel[] = ['growing', 'changing', 'stable'];

export default function CareersOutlookCriteriaPage() {
  const t = useT();
  const q = useOutlookData();
  return (
    <Page title={t('m18.routes.careers-outlook-criteria.title')} eyebrow={t('m18.fs16.eyebrow')} intro={t('m18.fs16.intro')} wide
      actions={<L to="/careers/horizons" className="btn-outline btn-sm" data-testid="m18-fs16-to-horizons"><Icon name="calendar" size={14} />{t('m18.fs16.toHorizons')}</L>}>
      <div className="flex flex-wrap items-center gap-2">
        <BenchmarkChips feature="FS16" />
        <SimChip label={t('m18.fs16.simChip')} />
      </div>
      <Async state={q}>{(d) => (d.labels.length === 0 ? <EmptyState title={t('m18.fs16.none')} icon="chart" /> : <Criteria d={d} />)}</Async>
    </Page>
  );
}

function Criteria({ d }: { d: OutlookData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const staff = useSeesComponents();
  const crit = criteriaFor(d.criteria, d.current);
  const th = crit ? thresholdsOf(crit) : null;
  const cur = d.labels.filter((l) => l.year === d.current);
  const growthValues = staff ? cur.map((l) => d.components.get(l.id)?.growth_pct).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b) : [];
  const median = growthValues.length ? growthValues[Math.floor(growthValues.length / 2)] : null;
  return (
    <div className="space-y-6">
      <Grid cols={3}>
        {ORDER.map((k) => (
          <div key={k} className="card p-4" data-testid="m18-fs16-tile" data-label={k}>
            <div className="flex items-center gap-2"><Icon name={LABEL_ICON[k]} size={18} /><StatusPill tone={LABEL_TONE[k]}>{t(`m18.fs16.label.${k}`)}</StatusPill></div>
            <div className="mt-2 text-[28px] font-semibold num">{f.num(cur.filter((l) => l.label === k).length)}</div>
            <div className="text-[12.5px] text-ink-2">{t('m18.fs16.rolesIn', { year: f.num(d.current, { useGrouping: false }) })}</div>
            <p className="mt-2 text-[13px]">{t(`m18.fs16.meaning.${k}`)}</p>
          </div>
        ))}
      </Grid>

      {crit && th && (
        <Section title={t('m18.fs16.howTitle')} description={t('m18.fs16.howDesc', { v: f.num(crit.version), year: f.num(crit.year_from, { useGrouping: false }) })}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <ol className="space-y-3" data-testid="m18-fs16-rules">
                {(crit.precedence ?? ORDER).map((k, i) => (
                  <li key={k} className="flex gap-3">
                    <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-eyebrow">{f.num(i + 1)}</span>
                    <div className="min-w-0">
                      <StatusPill tone={LABEL_TONE[k as OutlookLabel]}>{t(`m18.fs16.label.${k}`)}</StatusPill>
                      <p className="mt-1 text-[13px]">{ruleText(t, f, k as OutlookLabel, th)}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[12.5px] text-ink-2">{t('m18.fs16.firstMatch')}</p>
            </Card>
            <Card title={t('m18.fs16.thresholdsTitle')}>
              <div className="overflow-x-auto">
                <table className="table-base w-full text-[13px]" data-testid="m18-fs16-thresholds">
                  <thead><tr><th className="text-start">{t('m18.fs16.col.component')}</th><th className="text-start">{t('m18.fs16.col.threshold')}</th><th className="text-start">{t('m18.fs16.col.basis')}</th></tr></thead>
                  <tbody>
                    {th.change_min_pct != null && <tr data-key="change_min_pct"><td>{t('m18.fs16.comp.change')}</td><td className="num">≥ {f.pct(th.change_min_pct, 0)}</td><td>{t('m18.fs16.basis.change')}</td></tr>}
                    <tr data-key="growth_min_pct"><td>{t('m18.fs16.comp.growth', { from: f.num(th.base_year, { useGrouping: false }), to: f.num(th.horizon_year, { useGrouping: false }) })}</td><td className="num">≥ {f.pct(th.growth_min_pct, 0)}</td><td>{t('m18.fs16.basis.growth')}</td></tr>
                    <tr data-key="shortfall_min_pct"><td>{t('m18.fs16.comp.shortfall', { year: f.num(th.horizon_year, { useGrouping: false }) })}</td><td className="num">&gt; {f.pct(th.shortfall_min_pct, 0)}</td><td>{t('m18.fs16.basis.shortfall')}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <BenchmarkLine value={median ?? undefined} max={30} unit="pct" label={staff ? t('m18.fs16.lineStaff') : t('m18.fs16.linePublic')}
                  lines={[{ kind: 'target', label: t('m18.fs16.lineKafaa'), value: th.growth_min_pct }]} benchmark={{ id: 'ONET', figure: 'bright_growth_threshold' }} />
              </div>
              <ul className="mt-3 space-y-1 text-[12.5px]">
                {((crit as unknown as { sources?: { label: string; url: string; as_of?: string }[] }).sources ?? []).map((s) => (
                  <li key={s.url}><SourceLink href={s.url} date={s.as_of}>{s.label}</SourceLink></li>
                ))}
              </ul>
            </Card>
          </div>
        </Section>
      )}

      <RoleLabels d={d} staff={staff} />

      <Section title={t('m18.fs16.versionsTitle')} description={t('m18.fs16.versionsDesc')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m18-fs16-versions">
          {[...d.criteria].sort((a, b) => b.version - a.version).map((c) => {
            const next = d.criteria.find((x) => x.version === c.version + 1);
            const row = c as unknown as { summary_en: string; summary_ar: string; status: string; as_of: string };
            return (
              <li key={c.id} className="card p-4" data-testid="m18-fs16-version" data-status={row.status}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{t('m18.fs16.version', { v: f.num(c.version) })}</div>
                  <StatusPill tone={row.status === 'published' ? 'ok' : 'neutral'}>{t(`m18.fs16.status.${row.status}`)}</StatusPill>
                </div>
                <div className="text-[12.5px] text-ink-2 num">{next ? t('m18.fs16.yearsRange', { from: f.num(c.year_from, { useGrouping: false }), to: f.num(next.year_from - 1, { useGrouping: false }) }) : t('m18.fs16.yearsFrom', { from: f.num(c.year_from, { useGrouping: false }) })}</div>
                <p className="mt-2 text-[13px]">{pick(row as never, 'summary')}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <HrPanel d={d} />
      <p className="text-[12.5px] text-ink-3" data-testid="m18-fs16-disclaimer">{t('m18.fs16.disclaimer')}</p>
    </div>
  );
}

function ruleText(t: (k: string, v?: Record<string, string | number>) => string, f: ReturnType<typeof useFormat>, k: OutlookLabel, th: Thresholds) {
  if (k === 'changing') return t('m18.fs16.rule.changing', { pct: f.pct(th.change_min_pct ?? 0, 0) });
  if (k === 'growing') return t('m18.fs16.rule.growing', { pct: f.pct(th.growth_min_pct, 0), year: f.num(th.horizon_year, { useGrouping: false }) });
  return t('m18.fs16.rule.stable');
}

function RoleLabels({ d, staff }: { d: OutlookData; staff: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const fam = useFamilyLabels();
  const rq = useRolesById();
  const [year, setYear] = useState(String(d.current));
  const [only, setOnly] = useState<OutlookLabel | ''>('');
  const roles = rq.data;
  const rows = useMemo(() => d.labels.filter((l) => l.year === Number(year) && (!only || l.label === only)).sort((a, b) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label) || (pick(roles?.get(a.role_id), 'title') || a.role_id).localeCompare(pick(roles?.get(b.role_id), 'title') || b.role_id)), [d.labels, year, only, roles, pick]);
  const pct = (v: number | null | undefined) => (v == null ? '—' : f.pct(v, 1));
  return (
    <Section title={t('m18.fs16.rolesTitle')} description={staff ? t('m18.fs16.rolesDescStaff') : t('m18.fs16.rolesDescPublic')}>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('m18.fs16.yearPick')} data-testid="m18-fs16-years">
        {d.years.map((y) => (
          <button key={y} className={`btn-sm ${year === String(y) ? 'btn-primary' : 'btn-outline'}`} aria-pressed={year === String(y)} onClick={() => setYear(String(y))}>
            <span className="num">{f.num(y, { useGrouping: false })}</span>{y === d.current ? ` · ${t('m18.fs16.current')}` : ''}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('m18.fs16.filter')} data-testid="m18-fs16-filter">
        {(['', ...ORDER] as (OutlookLabel | '')[]).map((k) => (
          <button key={k || 'all'} className={`chip ${only === k ? 'ring-2 ring-accent/50' : ''}`} aria-pressed={only === k} onClick={() => setOnly(k)}>{k ? t(`m18.fs16.label.${k}`) : t('m18.fs16.all')}</button>
        ))}
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table-base w-full text-[13px]" data-testid="m18-fs16-table">
          <thead>
            <tr>
              <th className="text-start">{t('m18.fs16.col.role')}</th>
              <th className="text-start">{t('m18.fs16.col.label')}</th>
              <th className="text-start">{t('m18.fs16.col.history')}</th>
              {staff && <><th className="text-start">{t('m18.fs16.col.growth')}</th><th className="text-start">{t('m18.fs16.col.shortfall')}</th><th className="text-start">{t('m18.fs16.col.change')}</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const c: Components | undefined = d.components.get(l.id);
              const trail = d.labels.filter((x) => x.role_id === l.role_id).sort((a, b) => a.year - b.year);
              return (
                <tr key={l.id} data-testid="m18-fs16-row" data-role={l.role_id} data-label={l.label}>
                  <td>
                    <L to={`/careers/roles/${l.role_id}`} className="font-medium">{pick(roles?.get(l.role_id), 'title') || l.role_id}</L>
                    <div className="text-[11.5px] text-ink-3">{fam(roles?.get(l.role_id)?.family_id)}</div>
                  </td>
                  <td><OutlookChip row={l} components={c ?? null} criteria={d.criteria} /></td>
                  <td>
                    <div className="flex flex-wrap gap-1" data-testid="m18-fs16-trail">
                      {trail.map((x) => <StatusPill key={x.id} tone={LABEL_TONE[x.label]}><span className="num">{f.num(x.year, { useGrouping: false })}</span>{' '}{t(`m18.fs16.short.${x.label}`)}</StatusPill>)}
                    </div>
                  </td>
                  {staff && <><td className="num">{pct(c?.growth_pct)}</td><td className="num">{pct(c?.shortfall_pct)}</td><td className="num">{c?.archived ? <span className="text-ink-3">{t('m18.fs16.notMeasured')}</span> : pct(c?.change_pct)}</td></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!staff && <Callout tone="info">{t('m18.fs16.publicNote')}</Callout>}
    </Section>
  );
}

function HrPanel({ d }: { d: OutlookData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const act = useAction();
  const rq = useRolesById();
  const [preview, setPreview] = useState<OutlookPreview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const year = new Date().getUTCFullYear();
  if (!s.can('transformation', ['W', 'A'])) return null;
  const canPublish = s.can('transformation', ['A']);
  const run = async () => {
    const r = await repo.rpc.outlookLabelsPreview(year);
    if (r.ok && r.data) setPreview(r.data);
    else await act(async () => r);
  };
  return (
    <Section title={t('m18.fs16.hr.title')} description={t('m18.fs16.hr.desc', { year: f.num(year, { useGrouping: false }) })}>
      <Card>
        <div className="flex flex-wrap items-center gap-2" data-testid="m18-fs16-hr">
          <button className="btn-outline" onClick={() => void run()} data-testid="m18-fs16-preview"><Icon name="reset" size={14} />{t('m18.fs16.hr.preview')}</button>
          {canPublish && <button className="btn-primary" disabled={!preview} onClick={() => setConfirm(true)} data-testid="m18-fs16-publish">{t('m18.fs16.hr.publish')}</button>}
          {!canPublish && <span className="text-[12.5px] text-ink-2">{t('m18.fs16.hr.onlyDirector')}</span>}
        </div>
        {preview && (
          <div className="mt-3 space-y-2" data-testid="m18-fs16-preview-result" aria-live="polite">
            <div className="flex flex-wrap gap-1.5">
              {ORDER.map((k) => <StatusPill key={k} tone={LABEL_TONE[k]}>{t(`m18.fs16.label.${k}`)} · <span className="num">{f.num(preview.counts[k])}</span></StatusPill>)}
              <StatusPill tone={preview.changed ? 'sim' : 'ok'}>{t('m18.fs16.hr.changed', { n: f.num(preview.changed) })}</StatusPill>
            </div>
            {preview.changed > 0 && (
              <ul className="list-disc ps-5 text-[13px]">
                {preview.rows.filter((r) => r.changed).map((r) => <li key={r.role_id}>{pick(rq.data?.get(r.role_id), 'title') || r.role_id}: {r.stored_label ? t(`m18.fs16.label.${r.stored_label}`) : '—'} → {t(`m18.fs16.label.${r.label}`)}</li>)}
              </ul>
            )}
          </div>
        )}
      </Card>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m18.fs16.hr.confirmTitle', { year: f.num(year, { useGrouping: false }) })} consequence={t('m18.fs16.hr.confirmBody', { n: f.num(preview?.rows.length ?? 0), changed: f.num(preview?.changed ?? 0) })} confirmLabel={t('m18.fs16.hr.publish')}
        onConfirm={async () => { await act(() => repo.rpc.publishOutlookLabels(year), { success: t('m18.fs16.hr.done') }); setConfirm(false); setPreview(null); }} />
    </Section>
  );
}
