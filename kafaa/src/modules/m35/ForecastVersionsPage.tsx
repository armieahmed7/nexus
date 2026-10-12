// FS51 /workforce/skill-forecasts/versions (workforce_strategy Agg/R/W/A): the annual refresh with saved versions (MATCH pattern). Every
// version keeps its cycle, assumptions, results and method basis; one version per cycle is released (the HR director; summaries in EN and
// AR pass the headcount and site check; ledger) and supersedes the previous release. Comparing two versions side by side is blocked when
// the method, catalogue or scope differ (methodology banner): a methodology change voids year-on-year comparison.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { publicTextIsClean } from '../../domain/future';
import { Page, Section, Async, EmptyState, Callout, DataTable, StatusPill, ConfirmDialog, TextArea, BenchmarkChips, SimChip, type Column } from '../../ui';
import { L, useFormat, useLang, useT } from '../../i18n';
import { comparisonBlockers, type ForecastResult, type ScenarioKey, type VersionBasis } from './forecast';
import { SimLabels, useM35Ref, useSkillName, type Row } from './ui';

export default function ForecastVersionsPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useM35Ref();
  const skillName = useSkillName(ref.data);
  const q = useQuery('skill_forecasts' as Table, () => repo.list('skill_forecasts' as never, { order: [['cycle', 'desc']] } as never) as unknown as Promise<Row[]>);
  return (
    <Page title={t('m35.routes.workforce-skill-forecast-versions.title')} intro={t('m35.ver.intro')} wide eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS51" /><SimChip /></div>}
      actions={<L to="/workforce/skill-forecasts" className="btn-ghost btn-sm no-underline">{t('m35.fcd.back')}</L>}>
      <SimLabels method="fs51-v1" />
      <Async state={q} isEmpty={(x) => x.length === 0} empty={<EmptyState title={t('m35.ver.empty')} />}>{(rows) => <Versions rows={rows} skillName={skillName} />}</Async>
    </Page>
  );
}

function Versions({ rows, skillName }: { rows: Row[]; skillName: (id: string) => string }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const s = useSession();
  const isA = s.can('workforce_strategy', ['A']);
  const sorted = useMemo(() => [...rows].sort((a, b) => Number(b.cycle) - Number(a.cycle) || Number(b.version) - Number(a.version)), [rows]);
  const rel = sorted.filter((r) => r.status === 'released');
  const [a, setA] = useState<string>(rel[0]?.id ?? sorted[0]?.id ?? '');
  const [b, setB] = useState<string>(rel[1]?.id ?? sorted[1]?.id ?? '');
  const [release, setRelease] = useState<Row | null>(null);
  const va = sorted.find((r) => r.id === a), vb = sorted.find((r) => r.id === b);
  const blockers = comparisonBlockers(va?.basis as VersionBasis, vb?.basis as VersionBasis);
  const cols: Column<Row>[] = [
    { key: 'cycle', header: t('m35.ver.col.cycle'), value: (r) => Number(r.cycle) * 100 + Number(r.version), sortable: true, render: (r) => <span className="num">{f.num(Number(r.cycle), { useGrouping: false })} · v{f.num(Number(r.version))}</span> },
    { key: 'name', header: t('m35.ver.col.name'), value: (r) => r.name, render: (r) => <div><span className="font-semibold">{r.name}</span>{r.summary_en && <span className="block text-[11.5px] text-ink-3">{lang === 'ar' ? r.summary_ar : r.summary_en}</span>}</div> },
    { key: 'plan', header: t('m35.ver.col.plan'), value: (r) => r.scenario, render: (r) => t(`m35.scenario.${r.scenario}`) },
    { key: 'basis', header: t('m35.ver.col.basis'), value: (r) => `${r.basis?.method} ${r.basis?.catalogue}`, render: (r) => <span className="text-[12px]"><span className="num">{r.basis?.method}</span> · {t(`m35.catalogue.${r.basis?.catalogue ?? 'all'}`)} · <span className="num">{f.num(Number(r.basis?.skills_in_scope ?? 0))}</span></span> },
    { key: 'status', header: t('m35.ver.col.status'), value: (r) => r.status, render: (r) => <StatusPill tone={r.status === 'released' ? 'ok' : r.status === 'superseded' ? 'neutral' : 'sim'}><span data-testid="m35-ver-status" data-status={r.status}>{t(`m35.ver.status.${r.status}`)}</span></StatusPill> },
    { key: 'when', header: t('m35.ver.col.when'), value: (r) => r.released_at ?? r.created_at, render: (r) => <span className="text-[12px]">{f.date(r.released_at ?? r.created_at)}</span> },
    { key: 'act', header: t('m35.ver.col.actions'), csv: false, render: (r) => (
      <div className="flex flex-wrap gap-1">
        <L to={`/workforce/skill-forecasts/skills/${(r.results as ForecastResult)?.skills?.[0]?.skill_id ?? ''}?version=${r.id}`} className="btn-ghost btn-sm no-underline">{t('m35.ver.view')}</L>
        {isA && r.status === 'draft' && <button type="button" className="btn-outline btn-sm" onClick={() => setRelease(r)} data-testid="m35-ver-release">{t('m35.ver.release')}</button>}
      </div>) },
  ];
  const ra = va?.results as ForecastResult | undefined, rb = vb?.results as ForecastResult | undefined;
  const ids = ra && rb ? [...new Set([...ra.skills.map((k) => k.skill_id), ...rb.skills.map((k) => k.skill_id)])] : [];
  const gapOf = (r: ForecastResult | undefined, v: Row | undefined, id: string) => { const k = r?.skills.find((x) => x.skill_id === id); return k && v ? k.sc[v.scenario as ScenarioKey].gap_mid : null; };
  return (
    <div className="space-y-6" data-testid="m35-ver">
      <Section title={t('m35.ver.list')} description={t('m35.ver.listIntro')}>
        <div className="overflow-x-auto" data-testid="m35-ver-list"><DataTable rows={sorted} columns={cols} rowKey={(r) => r.id} searchable={false} pageSize={20} caption={t('m35.ver.list')} /></div>
      </Section>
      <Section title={t('m35.ver.compare')} description={t('m35.ver.compareIntro')}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          {([['a', a, setA], ['b', b, setB]] as const).map(([k, v, set]) => (
            <label key={k} className="flex min-w-0 max-w-full flex-col gap-1 text-[13px]"><span className="font-semibold">{t(`m35.ver.pick.${k}`)}</span>
              <select className="input w-auto max-w-full" value={v} onChange={(e) => set(e.target.value)} data-testid={`m35-ver-pick-${k}`}>
                {sorted.map((r) => <option key={r.id} value={r.id}>{`${r.cycle} v${r.version} · ${r.name}`}</option>)}
              </select>
            </label>
          ))}
        </div>
        {blockers.length ? (
          <Callout tone="bad" title={t('m35.ver.blockedTitle')}>
            <span data-testid="m35-ver-blocked" data-blockers={blockers.join(',')}>{t('m35.ver.blockedBody', { what: blockers.map((x) => t(`m35.ver.blocker.${x}`)).join(', ') })}</span>{' '}
            <L to="/workforce/skill-forecasts/method#method">{t('m35.banner.link')}</L>
          </Callout>
        ) : (
          <div className="overflow-x-auto" data-testid="m35-ver-diff">
            <table className="w-full text-[13px]">
              <caption className="sr-only">{t('m35.ver.compare')}</caption>
              <thead><tr className="text-ink-3"><th scope="col" className="py-1 text-start">{t('m35.fc.col.skill')}</th><th scope="col" className="py-1 text-end">{va?.name}</th><th scope="col" className="py-1 text-end">{vb?.name}</th><th scope="col" className="py-1 text-end">{t('m35.ver.delta')}</th></tr></thead>
              <tbody>{ids.map((id) => {
                const ga = gapOf(ra, va, id), gb = gapOf(rb, vb, id);
                return (
                  <tr key={id} className="border-t border-line">
                    <th scope="row" className="py-1.5 text-start font-medium">{skillName(id)}</th>
                    <td className="num py-1.5 text-end">{ga == null ? t('common.suppressedShort') : f.num(ga)}</td>
                    <td className="num py-1.5 text-end">{gb == null ? t('common.suppressedShort') : f.num(gb)}</td>
                    <td className="num py-1.5 text-end">{ga == null || gb == null ? '—' : `${gb - ga > 0 ? '+' : ''}${f.num(gb - ga)}`}</td>
                  </tr>
                );
              })}</tbody>
            </table>
            <p className="mt-1 text-[11.5px] text-ink-3">{t('m35.ver.diffNote')}</p>
          </div>
        )}
      </Section>
      {release && <ReleaseDialog row={release} onClose={() => setRelease(null)} />}
    </div>
  );
}

function ReleaseDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const okLen = en.trim().length >= 10 && en.trim().length <= 600 && ar.trim().length >= 10 && ar.trim().length <= 600;
  const clean = publicTextIsClean([row.name, en, ar]);
  return (
    <ConfirmDialog open onClose={onClose} title={t('m35.ver.releaseTitle', { name: row.name })} consequence={t('m35.ver.releaseConsequence')} actingAs={t('m35.actingDirector')} confirmLabel={t('m35.ver.release')}
      onConfirm={async () => {
        if (!okLen || !clean) return;
        const r = await run(() => repo.rpc.releaseSkillForecast(row.id, en, ar));
        if (r.ok) onClose();
      }}>
      <div className="space-y-3" data-testid="m35-ver-release-form">
        <TextArea name="m35-rel-1" label={t('m35.ver.summaryEn')} value={en} onChange={setEn} rows={3} />
        <div dir="rtl" lang="ar"><TextArea name="m35-rel-2" label={t('m35.ver.summaryAr')} value={ar} onChange={setAr} rows={3} /></div>
        {!clean && <p className="text-[12.5px] text-bad" data-testid="m35-ver-not-clean">{t('m35.ver.notClean')}</p>}
        {!okLen && <p className="text-[12px] text-ink-3">{t('m35.ver.summaryHint')}</p>}
      </div>
    </ConfirmDialog>
  );
}
