// M07 /workforce: aggregate overview (public GRI baselines + demo-tenant snapshot) and releases to observers
// (HR prepares, the CHCO office approves; maker-checker and audit through rpc.observerReportAction).
import { useMemo, useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import type { ObserverReportsRow } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, LineChart, StatTile, DataTable, StatusPill, Modal, ConfirmDialog, SourceLink, Icon, KeyValue } from '../../ui';
import { L, hasKey, useFormat, usePick, useT } from '../../i18n';
import { shareRows, valueRows } from './metrics';
import { HandoverBurndown } from './handoverUi'; // [W3E3] F22
import { KpiTile, SampleBanner, SR2024, kpiLatest, kpiSeries, useAggregates, useKpis, usePeriods } from './shared';

export default function WorkforcePage() {
  const t = useT();
  const f = useFormat();
  const kpis = useKpis();
  const periods = usePeriods();
  const agg = useAggregates(periods.data?.latest);
  const s = useSession();
  const showReleases = s.can('observer_release', ['W', 'A', 'R']);

  const totals = useMemo(() => {
    const rows = agg.data ?? [];
    const em = shareRows(rows, 'total', 'emirati')[0];
    const wo = shareRows(rows, 'total', 'women')[0];
    const hc = valueRows(rows, 'total', 'headcount')[0];
    const hi = valueRows(rows, 'total', 'hires')[0];
    const at = valueRows(rows, 'total', 'attrition')[0];
    return { em, wo, hc, hi, at };
  }, [agg.data]);

  // Only link to pages this viewer's role can open (route guards: scenarios for HR and auditors, funnel for applications Agg/A/R).
  const canScenarios = s.hasRole('hr_analyst', 'hr_director', 'auditor');
  const canFunnel = s.can('applications', ['Agg', 'A', 'R']);
  const links = ([
    ['emiratization', 'globe', true],
    ['pipeline', 'grad', true],
    ['critical-roles', 'shield', true],
    ['training', 'book', true],
    ['scenarios', 'sparkle', canScenarios],
    ['handover', 'calendar', true], // [W3E3] F22
    ['skills-outlook', 'chart', true], // [W5E4] F35
    ['applications', 'users', canFunnel],
    ['definitions', 'info', true],
  ] as const).filter((x) => x[2]);

  return (
    <Page title={t('m07.routes.workforce.title')} intro={t('m07.overview.intro')} wide>
      <Section title={t('m07.overview.publicTitle')} description={t('m07.overview.publicHint')}>
        <Async state={kpis} empty={<EmptyState title={t('m07.noKpis')} />}>
          {(rows) => (
            <div data-testid="m07-kpi-tiles">
              <Grid cols={4}>
                <KpiTile rows={rows} metric="employees" />
                <KpiTile rows={rows} metric="emiratization" />
                <KpiTile rows={rows} metric="emiratization_senior" />
                <KpiTile rows={rows} metric="top_positions_uae" />
                <KpiTile rows={rows} metric="women" />
                <KpiTile rows={rows} metric="training_hours_per_employee" />
                <KpiTile rows={rows} metric="attrition" />
                <KpiTile rows={rows} metric="hires" />
              </Grid>
            </div>
          )}
        </Async>
        <Callout tone="sim" title={t('m07.reconcile.title')}>
          {t('m07.reconcile.body')} <SourceLink href={SR2024}>SR2024 p.90</SourceLink>
        </Callout>
      </Section>

      <Grid cols={2}>
        <Card title={t('m07.overview.trendTitle')}>
          <Async state={kpis}>
            {(rows) => (
              <LineChart
                title={t('m07.overview.trendTitle')}
                unit="%"
                yMin={0}
                yMax={80}
                series={[
                  { name: t('m07.metric.emiratization'), points: kpiSeries(rows, 'emiratization').map((k) => ({ x: k.period, y: k.value })) },
                  { name: t('m07.metric.emiratization_senior'), points: kpiSeries(rows, 'emiratization_senior').map((k) => ({ x: k.period, y: k.value })), dashed: true },
                  { name: t('m07.metric.women'), points: kpiSeries(rows, 'women').map((k) => ({ x: k.period, y: k.value })), tone: 'leaf' },
                ]}
              />
            )}
          </Async>
          <p className="mt-2 text-[12px] text-ink-3">{t('m07.overview.trendNote')}</p>
        </Card>
        <Card title={t('m07.overview.tenantTitle', { period: periods.data?.latest ?? '—' })}>
          <SampleBanner />
          <Async state={agg} empty={<EmptyState title={t('m07.noData')} />}>
            {() => (
              <div className="mt-3 grid grid-cols-2 gap-3" data-testid="m07-tenant-tiles">
                <StatTile label={t('m07.metric.headcount')} value={totals.hc?.suppressed ? t('common.suppressedShort') : f.num(totals.hc?.value)} />
                <StatTile label={t('m07.metric.share_emirati')} value={totals.em?.suppressed ? t('common.suppressedShort') : f.pct(totals.em?.value)} />
                <StatTile label={t('m07.metric.share_women')} value={totals.wo?.suppressed ? t('common.suppressedShort') : f.pct(totals.wo?.value)} />
                <StatTile label={t('m07.overview.hiresLeavers')} value={`${f.num(totals.hi?.value)} / ${f.num(totals.at?.value)}`} sub={t('m07.overview.inQuarter')} />
              </div>
            )}
          </Async>
        </Card>
      </Grid>

      <Section title={t('m07.overview.explore')}>
        <Grid cols={3}>
          {links.map(([k, icon]) => (
            <L key={k} to={`/workforce/${k}`} className="card link-plain flex items-start gap-3 p-4 hover:border-accent">
              <Icon name={icon} size={20} className="mt-0.5 text-accent" />
              <span>
                <span className="block font-semibold">{t(`m07.overview.link.${k}.title`)}</span>
                <span className="block text-[13px] text-ink-2">{t(`m07.overview.link.${k}.body`)}</span>
              </span>
            </L>
          ))}
        </Grid>
      </Section>

      {showReleases && <Releases kpiRows={kpis.data} />}
    </Page>
  );
}

function Releases({ kpiRows }: { kpiRows: ReturnType<typeof useKpis>['data'] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const canPrepare = s.can('observer_release', ['W', 'A']);
  const canApprove = s.can('observer_release', ['A']);
  const reports = useQuery('observer_reports', () => repo.list('observer_reports', { order: [['period', 'desc']] }));
  // Observer organisations are not public; the release targets come from a narrow read (id and names only).
  const orgs = useQuery('organisations', () => repo.rpc.releaseTargets().catch(() => []));
  const [view, setView] = useState<ObserverReportsRow | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [act, setAct] = useState<{ r: ObserverReportsRow; action: 'submit' | 'approve' | 'withdraw' } | null>(null);
  const [orgSel, setOrgSel] = useState<string[]>([]);
  const orgName = (id: string) => pick(orgs.data?.find((o) => o.id === id), 'name') || id;
  return (
    <Section
      title={t('m07.releases.title')}
      description={t('m07.releases.hint')}
      actions={canPrepare ? <button className="btn-primary btn-sm" onClick={() => setDrafting(true)} data-testid="m07-new-report"><Icon name="plus" size={14} />{t('m07.releases.new')}</button> : undefined}
    >
      <Async state={reports} empty={<EmptyState title={t('m07.releases.none')} />}>
        {(rows) => (
          <div data-testid="m07-releases">
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              searchable={false}
              columns={[
                { key: 'title', header: t('m07.releases.report'), value: (r) => pick(r, 'title'), render: (r) => <button className="link-plain text-start font-semibold hover:underline" onClick={() => setView(r)}>{pick(r, 'title')}</button> },
                { key: 'period', header: t('m07.period'), value: (r) => r.period },
                { key: 'status', header: t('m07.releases.status'), value: (r) => r.status, render: (r) => <StatusPill status={r.status === 'pending_approval' ? 'pending' : r.status}>{t(`m07.releases.st.${r.status}`)}</StatusPill> },
                { key: 'to', header: t('m07.releases.to'), value: (r) => (r.released_to_org_ids ?? []).map(orgName).join(', ') || '—' },
                { key: 'approved', header: t('m07.releases.approved'), value: (r) => r.approved_at ?? '', render: (r) => (r.approved_at ? f.date(r.approved_at) : '—') },
                {
                  key: 'actions', header: '', csv: false,
                  render: (r) => (
                    <span className="flex flex-wrap gap-1">
                      {canPrepare && r.status === 'draft' && <button className="btn-outline btn-sm" onClick={() => { setOrgSel(orgs.data?.map((o) => o.id) ?? []); setAct({ r, action: 'submit' }); }}>{t('m07.releases.submit')}</button>}
                      {canApprove && r.status === 'pending_approval' && <button className="btn-primary btn-sm" disabled={r.prepared_by === me} title={r.prepared_by === me ? t('m07.releases.makerChecker') : undefined} onClick={() => setAct({ r, action: 'approve' })} data-testid="m07-approve">{t('m07.releases.approve')}</button>}
                      {canApprove && r.status === 'released' && <button className="btn-ghost btn-sm text-bad" onClick={() => setAct({ r, action: 'withdraw' })}>{t('m07.releases.withdraw')}</button>}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Async>
      <p className="text-[12px] text-ink-3">{t('m07.releases.rule')}</p>

      <Modal open={!!view} onClose={() => setView(null)} title={view ? pick(view, 'title') : ''} size="lg">
        {view && <ReportBody r={view} orgName={orgName} />}
      </Modal>
      <DraftModal open={drafting} onClose={() => setDrafting(false)} kpiRows={kpiRows} />
      <ConfirmDialog
        open={!!act}
        onClose={() => setAct(null)}
        danger={act?.action === 'withdraw'}
        title={act ? t(`m07.releases.confirm.${act.action}`) : ''}
        consequence={act ? t(`m07.releases.confirmBody.${act.action}`, { title: pick(act.r, 'title') }) : ''}
        actingAs={act?.action === 'submit' ? t('m07.releases.asHr') : t('m07.releases.asChco')}
        onConfirm={async () => {
          if (!act) return;
          await run(() => repo.rpc.observerReportAction(act.r.id, act.action, act.action === 'submit' ? orgSel : []));
        }}
      >
        {act?.action === 'submit' && (
          <fieldset className="space-y-1">
            <legend className="caps mb-1">{t('m07.releases.releaseTo')}</legend>
            {(orgs.data ?? []).map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={orgSel.includes(o.id)} onChange={(e) => setOrgSel(e.target.checked ? [...orgSel, o.id] : orgSel.filter((x) => x !== o.id))} />
                {pick(o, 'name')}
              </label>
            ))}
          </fieldset>
        )}
      </ConfirmDialog>
    </Section>
  );
}

export function ReportBody({ r, orgName }: { r: ObserverReportsRow; orgName?: (id: string) => string }) {
  const t = useT();
  const f = useFormat();
  const body = (r.body ?? {}) as { tiles?: { k: string; v: string; src: string }[]; note?: string; burndown?: { years: number[]; cover: (number | null)[]; ready: (number | null)[] } };
  return (
    <div className="space-y-3">
      <Grid cols={3}>
        {(body.tiles ?? []).map((x) => (
          <StatTile key={x.k} label={hasKey(`m07.metric.${x.k}`) ? t(`m07.metric.${x.k}`) : x.k} value={x.v} source={x.src} />
        ))}
      </Grid>
      {!(body.tiles ?? []).length && <EmptyState title={t('m07.releases.emptyBody')} />}
      {body.burndown && <HandoverBurndown years={body.burndown.years} cover={body.burndown.cover} ready={body.burndown.ready} />}{/* [W3E3] F22 released burn-down */}
      <KeyValue
        items={[
          [t('m07.period'), r.period],
          [t('m07.releases.status'), t(`m07.releases.st.${r.status}`)],
          [t('m07.releases.approved'), r.approved_at ? `${f.date(r.approved_at)} · ${t('m07.releases.byChco')}` : '—'],
          ...(orgName ? ([[t('m07.releases.to'), (r.released_to_org_ids ?? []).map(orgName).join(', ') || '—']] as [string, string][]) : []),
        ]}
      />
      {body.note && <Callout tone="info">{body.note}</Callout>}
    </div>
  );
}

const TILE_CHOICES = ['emiratization', 'emiratization_senior', 'women', 'top_positions_uae', 'employees', 'training_hours_per_employee', 'sro_ro'];

function DraftModal({ open, onClose, kpiRows }: { open: boolean; onClose: () => void; kpiRows: ReturnType<typeof useKpis>['data'] }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [period, setPeriod] = useState('2024');
  const [sel, setSel] = useState<string[]>(['emiratization', 'women']);
  const [busy, setBusy] = useState(false);
  const value = (m: string) => {
    const k = kpiLatest(kpiRows, m);
    if (!k) return null;
    return { v: k.unit === '%' ? `${k.value}%` : String(k.value), src: k.source, period: k.period };
  };
  const valid = titleEn.trim().length >= 5 && titleAr.trim().length >= 5 && period.trim() && sel.length > 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('m07.releases.new')}
      size="lg"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            disabled={!valid || busy}
            data-testid="m07-save-draft"
            onClick={async () => {
              setBusy(true);
              const tiles = sel.map((k) => ({ k, v: value(k)?.v ?? '—', src: value(k)?.src ?? '' }));
              const r = await run(() => repo.rpc.draftObserverReport({ title_en: titleEn, title_ar: titleAr, period, tiles }));
              setBusy(false);
              if (r.ok) onClose();
            }}
          >
            {t('m07.releases.saveDraft')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Callout tone="info">{t('m07.releases.draftHint')}</Callout>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1"><span className="text-[13px] font-semibold">{t('m07.releases.titleEn')}</span><input className="input" dir="ltr" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="text-[13px] font-semibold">{t('m07.releases.titleAr')}</span><input className="input" dir="rtl" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="text-[13px] font-semibold">{t('m07.period')}</span><input className="input" dir="ltr" value={period} onChange={(e) => setPeriod(e.target.value)} /></label>
        </div>
        <fieldset>
          <legend className="caps mb-1">{t('m07.releases.tiles')}</legend>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {TILE_CHOICES.map((k) => {
              const v = value(k);
              return (
                <label key={k} className="flex items-center gap-2 text-[13.5px]">
                  <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={sel.includes(k)} disabled={!v} onChange={(e) => setSel(e.target.checked ? [...sel, k] : sel.filter((x) => x !== k))} />
                  <span>{t(`m07.metric.${k}`)}</span>
                  <span className="num text-ink-3">{v ? `${v.v} · ${v.period}` : '—'}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <p className="text-[12px] text-ink-3">{t('m07.releases.count', { n: f.num(sel.length) })}</p>
      </div>
    </Modal>
  );
}
