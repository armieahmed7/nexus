// /workforce/transformation (M30 · FS11 HR overview by family + FS12 exposure aggregate). Tabs:
//  - Maps: every current role's transformation map (archetype, drivers, status, version, open draft), the archetype mix and driver
//    frequency; editors (training manager, HR director) open the editor.
//  - Readiness (HR, transformation Agg): people already meeting their role's 2030 / 2035 profile and the median months to get there,
//    by family group and family; groups under 10 people suppressed.
//  - Exposure (HR, FS12): task exposure weighted by the people in each role, by family group and family; suppressed under 10;
//    security, safeguards and cyber never broken out.
import { useState } from 'react';
import { Page, Card, Async, EmptyState, Callout, StatTile, Donut, BarChart, Tabs, DataTable, StatusPill, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT, L } from '../../i18n';
import { ARCHETYPES, BANDS, DRIVERS, MIN_GROUP, type ExposureCell, type ReadyCell } from './transform';
import { BenchTies, DriverChip, FS11, FS12, HorizonToggle, useRefData, type RefData } from './ui';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function WorkforceTransformationPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useRefData();
  const [h, setH] = useState<'2030' | '2035'>('2030');
  const agg = useQuery(['people', 'person_skills', 'jta_tasks', 'role_profile_versions'], async () => {
    const [ov, ex, edit] = await Promise.all([repo.rpc.transformationOverview(h), repo.rpc.exposureAggregate(), repo.rpc.roleTransformation(null, '2030')]);
    return { ov, ex, canEdit: !!edit?.can_edit };
  }, [h]);
  return (
    <Page title={t('m30.routes.workforce-transformation.title')} intro={t('m30.wf.intro')} wide
      eyebrow={<span className="inline-flex flex-wrap items-center gap-2"><BenchTies feature={FS11} /><BenchTies feature={FS12} /></span>}>
      <Async state={ref}>{(d) => (
        <Async state={agg}>{(a) => (
          <Tabs tabs={[
            { id: 'maps', label: t('m30.wf.tab.maps'), content: <Maps d={d} canEdit={a.canEdit} /> },
            { id: 'ready', label: t('m30.wf.tab.ready'), content: a.ov ? <Ready cells={a.ov} d={d} h={h} setH={setH} /> : <Callout tone="info" title={t('m30.wf.hrOnly')}>{t('m30.wf.hrOnlyBody')}</Callout> },
            { id: 'exposure', label: t('m30.wf.tab.exposure'), content: a.ex ? <Exposure agg={a.ex} d={d} /> : <Callout tone="info" title={t('m30.wf.hrOnly')}>{t('m30.wf.hrOnlyBody')}</Callout> },
          ]} />
        )}</Async>
      )}</Async>
    </Page>
  );
}

function Maps({ d, canEdit }: { d: RefData; canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const maps = d.roles.map((r) => ({ role: r, map: d.mapByRole.get(r.id) as Row | undefined }));
  const published = maps.filter((m) => m.map?.status === 'published').length;
  const live = maps.filter((m) => m.map && !m.map.path_only);
  const cols: Column<(typeof maps)[number]>[] = [
    { key: 'role', header: t('m30.wf.col.role'), value: (x) => pick(x.role, 'title'), sortable: true, render: (x) => (
      <div className="min-w-0"><L to={`/my/role-2030?role=${x.role.id}`} className="font-semibold">{pick(x.role, 'title')}</L><div className="text-[11.5px] text-ink-3">{pick(d.familyById.get(x.role.family_id), 'name')}</div></div>
    ) },
    { key: 'archetype', header: t('m30.wf.col.archetype'), value: (x) => (x.map?.archetype ? t(`m30.archetype.${x.map.archetype}`) : ''), sortable: true,
      render: (x) => (x.map?.path_only ? <span className="text-ink-3">{t('m30.wf.pathOnly')}</span> : x.map?.archetype ? t(`m30.archetype.${x.map.archetype}`) : '—') },
    { key: 'drivers', header: t('m30.wf.col.drivers'), value: (x) => (x.map?.drivers ?? []).length, render: (x) => <span className="flex flex-wrap gap-1">{((x.map?.drivers ?? []) as string[]).map((dr) => <DriverChip key={dr} driver={dr} />)}</span> },
    { key: 'status', header: t('m30.wf.col.status'), value: (x) => x.map?.status ?? 'none', sortable: true, render: (x) => (
      <span className="inline-flex flex-wrap items-center gap-1"><StatusPill status={x.map?.status ?? 'none'}>{t(`m30.status.${x.map?.status ?? 'none'}`)}</StatusPill>{x.map && <span className="num text-[11.5px] text-ink-3">{t('m30.my.version', { v: f.num(x.map.version) })}</span>}</span>
    ) },
    { key: 'published', header: t('m30.wf.col.published'), value: (x) => String(x.map?.published_at ?? ''), sortable: true, render: (x) => f.date(x.map?.published_at ?? null) },
    ...(canEdit ? [{ key: 'edit', header: '', value: () => '', render: (x: (typeof maps)[number]) => <L to={`/workforce/transformation/${x.role.id}`} className="btn-outline btn-sm no-underline" data-testid="m30-wf-edit">{t('m30.wf.edit')}</L> } as Column<(typeof maps)[number]>] : []),
  ];
  return (
    <div className="space-y-5 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m30-wf-tiles">
        <StatTile label={t('m30.wf.tileMaps')} value={`${f.num(published)} / ${f.num(d.roles.length)}`} tone={published === d.roles.length ? 'ok' : 'info'} sub={t('m30.wf.tileMapsSub')} />
        <StatTile label={t('m30.wf.tilePath')} value={f.num(maps.length - live.length)} sub={t('m30.wf.tilePathSub')} />
        <StatTile label={t('m30.wf.tileDrivers')} value={f.num(new Set(live.flatMap((m) => m.map!.drivers as string[])).size)} sub={t('m30.wf.tileDriversSub')} />
        <StatTile label={t('m30.wf.tileHistory')} value={f.num(live.filter((m) => (m.map!.history as unknown[]).length > 0).length)} sub={t('m30.wf.tileHistorySub')} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={t('m30.wf.archMix')}>
          <Donut title={t('m30.wf.archMix')} data={ARCHETYPES.map((a, i) => ({ label: t(`m30.archetype.${a}`), value: live.filter((m) => m.map!.archetype === a).length, tone: ['accent', 'sky', 'leaf'][i] }))} />
        </Card>
        <Card title={t('m30.wf.driverFreq')}>
          <BarChart title={t('m30.wf.driverFreq')} data={DRIVERS.map((dr) => ({ label: t(`m30.driver.${dr}`), value: live.filter((m) => (m.map!.drivers as string[]).includes(dr)).length }))} />
        </Card>
      </div>
      <div data-testid="m30-wf-maps"><DataTable rows={maps} columns={cols} rowKey={(x) => x.role.id} pageSize={30} csvName="role-transformation-maps" /></div>
    </div>
  );
}

function SuppressedNote() {
  const t = useT();
  const f = useFormat();
  return <p className="text-[12px] text-ink-3" data-testid="m30-wf-suppress-note">{t('m30.wf.suppressNote', { n: f.num(MIN_GROUP) })}</p>;
}

function Ready({ cells, d, h, setH }: { cells: { groups: ReadyCell[]; families: ReadyCell[]; total: ReadyCell }; d: RefData; h: '2030' | '2035'; setH: (h: '2030' | '2035') => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const famName = (k: string) => pick(d.familyById.get(k), 'name') || k;
  const row = (c: ReadyCell, name: string, sub = false) => (
    <tr key={`${sub}-${c.key}`} className="border-t border-line" data-suppressed={c.suppressed ? 'true' : 'false'}>
      <th scope="row" className={`py-1.5 pe-2 text-start ${sub ? 'ps-4 font-normal' : 'font-semibold'}`}>{name}</th>
      {c.suppressed ? <td colSpan={4} className="py-1.5 text-ink-3"><span className="chip border-line bg-sunken text-ink-3">{t('m30.wf.suppressed')}</span></td> : (
        <>
          <td className="num py-1.5 text-end">{f.num(c.people)}</td>
          <td className="num py-1.5 text-end">{f.num(c.ready_now)}</td>
          <td className="num py-1.5 text-end">{f.pct(c.ready_pct, 0)}</td>
          <td className="num py-1.5 text-end">{t('m30.ready.months', { n: f.num(c.median_months) })}</td>
        </>
      )}
    </tr>
  );
  const grpName = (k: string) => (k === 'all' ? t('m30.wf.total') : t(`m30.wf.grp.${k}`));
  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-3xl text-[13px] text-ink-2">{t('m30.wf.readyDesc')}</p>
        <HorizonToggle value={h} onChange={setH} />
      </div>
      <Card title={t('m30.wf.medianTitle', { h: t(`m30.horizon.${h}`) })}>
        <BarChart title={t('m30.wf.medianTitle', { h })} unit="" data={cells.groups.map((c) => ({ label: grpName(c.key), value: c.median_months, suppressed: c.suppressed }))} />
      </Card>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" data-testid="m30-wf-ready">
          <thead><tr className="text-ink-3">
            <th scope="col" className="py-1 text-start font-normal">{t('m30.wf.col.group')}</th>
            <th scope="col" className="py-1 text-end font-normal">{t('m30.wf.col.people')}</th>
            <th scope="col" className="py-1 text-end font-normal">{t('m30.wf.col.readyNow')}</th>
            <th scope="col" className="py-1 text-end font-normal">{t('m30.wf.col.readyPct')}</th>
            <th scope="col" className="py-1 text-end font-normal">{t('m30.wf.col.median')}</th>
          </tr></thead>
          <tbody>
            {row(cells.total, grpName('all'))}
            {cells.groups.flatMap((g) => [row(g, grpName(g.key)), ...cells.families.filter((fm) => d.familyById.get(fm.key)?.grp === g.key).map((fm) => row(fm, famName(fm.key), true))])}
          </tbody>
        </table>
      </div>
      <SuppressedNote />
      <p className="text-[12px] text-ink-3">{t('m30.wf.notBroken')}</p>
    </div>
  );
}

function Exposure({ agg, d }: { agg: { groups: ExposureCell[]; families: ExposureCell[]; total: ExposureCell }; d: RefData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const grpName = (k: string) => (k === 'all' ? t('m30.wf.total') : t(`m30.wf.grp.${k}`));
  const bar = (c: ExposureCell) => (c.shares ? (
    <div className="flex h-3 w-full min-w-[8rem] overflow-hidden rounded-full bg-sunken" aria-hidden="true">
      {BANDS.map((b) => <span key={b} style={{ width: `${c.shares![b]}%`, background: `rgb(var(--${b === 'human_core' ? 'leaf' : b === 'augment' ? 'accent' : 'sim'}))` }} />)}
    </div>
  ) : null);
  const row = (c: ExposureCell, name: string, sub = false) => (
    <tr key={`${sub}-${c.key}`} className="border-t border-line align-middle" data-suppressed={c.suppressed ? 'true' : 'false'}>
      <th scope="row" className={`py-1.5 pe-2 text-start ${sub ? 'ps-4 font-normal' : 'font-semibold'}`}>{name}</th>
      {c.suppressed ? <td colSpan={5} className="py-1.5"><span className="chip border-line bg-sunken text-ink-3">{t('m30.wf.suppressed')}</span></td> : (
        <>
          <td className="num py-1.5 text-end">{f.num(c.people)}</td>
          <td className="num py-1.5 text-end">{f.num(c.analysed)}</td>
          {BANDS.map((b) => <td key={b} className="num py-1.5 text-end">{c.shares ? f.pct(c.shares[b], 0) : '—'}</td>)}
          <td className="py-1.5 ps-3">{bar(c)}</td>
        </>
      )}
    </tr>
  );
  return (
    <div className="space-y-4 pt-4">
      <p className="max-w-3xl text-[13px] text-ink-2">{t('m30.wf.expDesc')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" data-testid="m30-wf-exposure">
          <thead><tr className="text-ink-3">
            <th scope="col" className="py-1 text-start font-normal">{t('m30.wf.col.group')}</th>
            <th scope="col" className="py-1 text-end font-normal">{t('m30.wf.col.people')}</th>
            <th scope="col" className="py-1 text-end font-normal">{t('m30.wf.col.analysed')}</th>
            {BANDS.map((b) => <th key={b} scope="col" className="py-1 text-end font-normal">{t(`m30.band.${b}`)}</th>)}
            <th scope="col" className="py-1 ps-3 text-start font-normal">{t('m30.wf.col.mix')}</th>
          </tr></thead>
          <tbody>
            {row(agg.total, grpName('all'))}
            {agg.groups.flatMap((g) => [row(g, grpName(g.key)), ...agg.families.filter((fm) => d.familyById.get(fm.key)?.grp === g.key).map((fm) => row(fm, pick(d.familyById.get(fm.key), 'name') || fm.key, true))])}
          </tbody>
        </table>
      </div>
      <SuppressedNote />
      <p className="text-[12px] text-ink-3">{t('m30.wf.notBroken')}</p>
      {agg.groups.length === 0 && <EmptyState title={t('m30.wf.none')} />}
    </div>
  );
}
