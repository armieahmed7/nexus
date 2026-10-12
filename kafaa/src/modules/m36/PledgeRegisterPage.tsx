// FS65 /ecosystem/pledges/register (ecosystem OwnOrg/OrgW/Agg/A; auditors): our pledges. RLS decides the rows: a partner or university
// reads only its own organisation's pledges and snapshots; HR, admins and auditors read all. Every pledge names its organisation, skill
// area and target date; pledged, started and completed stay three columns. Partner and university administrators (OrgW) register
// pledges for their own organisation and record progress; HR (ecosystem W) does so for the ENEC entities. RPCs behind ConfirmDialogs.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, EmptyState, StatTile, DataTable, WhyThis, BenchmarkChips, Drawer, Modal, ConfirmDialog, LineChart, TextField, SelectField, Callout, StatusPill, type Column } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { ENEC_ENTITIES, PLEDGE_AREAS, latestProgress, pledgeProblem, pledgeReasons, pledgeStatus, progressProblem, type PledgeInput } from './pledges';
import { DemoLabels, PledgeStatusPill, useOrgName, type Row } from './ui';

type Item = { p: Row; latest: Row | null; status: string };

export default function PledgeRegisterPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const orgw = !!s.identity.orgId && s.can('ecosystem', ['OrgW']);
  const hrw = s.can('ecosystem', ['W']);
  const canRegister = orgw || hrw;
  const pledges = useQuery('pledges' as Table, () => repo.list('pledges' as never, { order: [['target_date', 'asc']] } as never) as unknown as Promise<Row[]>);
  const progress = useQuery('pledge_progress' as Table, () => repo.list('pledge_progress' as never, { order: [['as_of', 'asc']] } as never) as unknown as Promise<Row[]>);
  const [open, setOpen] = useState(false);
  return (
    <Page title={t('m36.routes.ecosystem-pledges-register.title')} intro={hrw && !orgw ? t('m36.pr.introHr') : t('m36.pr.intro')} wide eyebrow={<BenchmarkChips feature="FS65" />}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/ecosystem/pledges" className="btn-outline btn-sm no-underline">{t('m36.pr.toLedger')}</L>
        {canRegister && <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)} data-testid="m36-pr-open">{t('m36.pr.register')}</button>}
      </div>}>
      <Async state={pledges}>{(ps) => (
        <Async state={progress}>{(pp) => (
          <>
            <Register pledges={ps} progress={pp} orgw={orgw} hrw={hrw} />
            {open && <PledgeForm open={open} onClose={() => setOpen(false)} orgw={orgw} />}
          </>
        )}</Async>
      )}</Async>
    </Page>
  );
}

function Register({ pledges, progress, orgw, hrw }: { pledges: Row[]; progress: Row[]; orgw: boolean; hrw: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const orgName = useOrgName();
  const today = todayIso();
  const items: Item[] = useMemo(() => pledges.map((p) => { const latest = latestProgress(progress, String(p.id), today); return { p, latest, status: pledgeStatus(p, latest, today) }; }), [pledges, progress, today]);
  const [sel, setSel] = useState<string | null>(null);
  if (!pledges.length) return <EmptyState title={t('m36.pr.empty')}>{t('m36.pr.emptyBody')}</EmptyState>;
  const active = items.filter((x) => x.status !== 'withdrawn');
  // three separate totals of this organisation's own pledges (exact for the organisation itself); never added together
  const pledged = active.reduce((n, x) => n + Number(x.p.people), 0);
  const started = active.reduce((n, x) => n + Number(x.latest?.started ?? 0), 0);
  const completed = active.reduce((n, x) => n + Number(x.latest?.completed ?? 0), 0);
  const many = new Set(pledges.map((p) => p.org_id)).size > 1;
  const canRecord = (p: Row) => (orgw && p.org_id === s.identity.orgId) || (!orgw && hrw && (ENEC_ENTITIES as readonly string[]).includes(String(p.org_id)));
  const cols: Column<Item>[] = [
    { key: 'title', header: t('m36.pr.col.pledge'), value: (x) => pick(x.p, 'title'), sortable: true,
      render: (x) => <div className="min-w-0"><button type="button" className="text-start font-semibold text-accent hover:underline" onClick={() => setSel(x.p.id)} data-testid="m36-pr-open-pledge">{pick(x.p, 'title')}</button>
        <span className="block text-[11.5px] text-ink-3">{orgName(x.p)}{x.p.department_en ? ` · ${pick({ name_en: x.p.department_en, name_ar: x.p.department_ar }, 'name')}` : ''}</span></div> },
    { key: 'area', header: t('m36.pr.col.area'), value: (x) => t(`m36.area.${x.p.area}`), sortable: true, render: (x) => t(`m36.area.${x.p.area}`) },
    { key: 'target', header: t('m36.pr.col.target'), value: (x) => String(x.p.target_date), sortable: true, render: (x) => f.date(x.p.target_date) },
    { key: 'pledged', header: t('m36.pl.pledged'), align: 'end', value: (x) => Number(x.p.people), sortable: true, render: (x) => <span className="num" data-testid="m36-pr-pledged">{f.num(Number(x.p.people))}</span> },
    { key: 'started', header: t('m36.pl.started'), align: 'end', value: (x) => Number(x.latest?.started ?? 0), render: (x) => <span className="num" data-testid="m36-pr-started">{f.num(Number(x.latest?.started ?? 0))}</span> },
    { key: 'completed', header: t('m36.pl.completed'), align: 'end', value: (x) => Number(x.latest?.completed ?? 0), render: (x) => <span className="num" data-testid="m36-pr-completed">{f.num(Number(x.latest?.completed ?? 0))}</span> },
    { key: 'status', header: t('m36.pr.col.status'), value: (x) => x.status, sortable: true,
      render: (x) => <div className="flex flex-wrap items-center gap-1"><PledgeStatusPill status={x.status} /><WhyThis reasons={pledgeReasons(x.p, x.latest, today)} testId={`m36-pr-why-${x.p.id}`} /></div> },
  ];
  const cur = items.find((x) => x.p.id === sel) ?? null;
  return (
    <div className="space-y-6" data-testid="m36-pr">
      <DemoLabels />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="m36-pr-tiles">
        <StatTile label={t('m36.pl.pledged')} value={f.num(pledged)} sub={many ? t('m36.pr.tileAll', { n: f.num(active.length) }) : t('m36.pr.tileOwn', { n: f.num(active.length) })} />
        <StatTile label={t('m36.pl.started')} value={f.num(started)} sub={t('m36.pl.startedSub')} tone="info" />
        <StatTile label={t('m36.pl.completed')} value={f.num(completed)} sub={t('m36.pl.completedSub')} tone="ok" />
      </div>
      {many && <Callout tone="info" title={t('m36.pr.hrNoteTitle')}>{t('m36.pr.hrNote')}</Callout>}
      <Section title={t('m36.pr.list')}>
        <div className="overflow-x-auto" data-testid="m36-pr-list">
          <DataTable rows={items} columns={cols} rowKey={(x) => x.p.id} searchable={false} pageSize={20} caption={t('m36.pr.list')} csvName="skills-pledges" />
        </div>
      </Section>
      {cur && <PledgeDrawer item={cur} progress={progress.filter((x) => x.pledge_id === cur.p.id)} canRecord={canRecord(cur.p) && cur.p.status === 'active'} onClose={() => setSel(null)} />}
    </div>
  );
}

function PledgeDrawer({ item, progress, canRecord, onClose }: { item: Item; progress: Row[]; canRecord: boolean; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const orgName = useOrgName();
  const today = todayIso();
  const p = item.p;
  const snaps = [...progress].sort((a, b) => (String(a.as_of) < String(b.as_of) ? -1 : 1));
  const prev = snaps.at(-1) ?? null;
  const [asOf, setAsOf] = useState(today);
  const [started, setStarted] = useState('');
  const [completed, setCompleted] = useState('');
  const [confirm, setConfirm] = useState(false);
  const input = { pledge_id: String(p.id), as_of: asOf, started: started === '' ? NaN : Number(started), completed: completed === '' ? NaN : Number(completed) };
  const problem = progressProblem(input, { pledged_on: String(p.pledged_on) }, prev ? { as_of: String(prev.as_of), started: Number(prev.started), completed: Number(prev.completed) } : null, today);
  const points = (k: 'started' | 'completed') => [{ x: String(p.pledged_on), y: 0 }, ...snaps.map((x) => ({ x: String(x.as_of), y: Number(x[k]) }))];
  return (
    <Drawer open onClose={onClose} title={pick(p, 'title')}>
      <div className="space-y-4" data-testid="m36-pr-drawer" data-id={p.id}>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <PledgeStatusPill status={item.status} />{p.sample && <StatusPill tone="sim">{t('m36.sample')}</StatusPill>}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-[13px]" data-testid="m36-pr-facts">
          <div><dt className="caps">{t('m36.pr.col.org')}</dt><dd>{orgName(p)}</dd></div>
          <div><dt className="caps">{t('m36.pr.col.area')}</dt><dd>{t(`m36.area.${p.area}`)}</dd></div>
          <div><dt className="caps">{t('m36.pr.col.target')}</dt><dd>{f.date(p.target_date)}</dd></div>
          <div><dt className="caps">{t('m36.pr.pledgedOn')}</dt><dd>{f.date(p.pledged_on)}</dd></div>
        </dl>
        <div className="grid grid-cols-3 gap-2 text-center" data-testid="m36-pr-three">
          <div><span className="caps block">{t('m36.pl.pledged')}</span><span className="num text-[18px] font-semibold">{f.num(Number(p.people))}</span></div>
          <div><span className="caps block">{t('m36.pl.started')}</span><span className="num text-[18px] font-semibold">{f.num(Number(item.latest?.started ?? 0))}</span></div>
          <div><span className="caps block">{t('m36.pl.completed')}</span><span className="num text-[18px] font-semibold">{f.num(Number(item.latest?.completed ?? 0))}</span></div>
        </div>
        {snaps.length > 0 ? (
          <LineChart title={t('m36.pr.chart')} height={170} series={[
            { name: t('m36.pl.started'), points: points('started'), tone: 'rgb(var(--info))' },
            { name: t('m36.pl.completed'), points: points('completed'), tone: 'rgb(var(--ok))' },
            { name: t('m36.pl.pledged'), points: [{ x: String(p.pledged_on), y: Number(p.people) }, ...snaps.map((x) => ({ x: String(x.as_of), y: Number(p.people) }))], tone: 'rgb(var(--ink-3))', dashed: true },
          ]} />
        ) : <p className="text-[13px] text-ink-3">{t('m36.pr.noProgress')}</p>}
        {snaps.length > 0 && (
          <table className="w-full text-[12.5px]" data-testid="m36-pr-snaps">
            <caption className="sr-only">{t('m36.pr.snaps')}</caption>
            <thead><tr className="text-ink-3"><th scope="col" className="text-start">{t('m36.pr.asOf')}</th><th scope="col" className="text-end">{t('m36.pl.started')}</th><th scope="col" className="text-end">{t('m36.pl.completed')}</th></tr></thead>
            <tbody>{snaps.map((x) => <tr key={x.id} className="border-t border-line"><td>{f.date(x.as_of)}</td><td className="text-end num">{f.num(Number(x.started))}</td><td className="text-end num">{f.num(Number(x.completed))}</td></tr>)}</tbody>
          </table>
        )}
        {canRecord && (
          <div className="space-y-2 rounded-card border border-line p-3" data-testid="m36-pr-record">
            <span className="block text-[13px] font-semibold">{t('m36.pr.record')}</span>
            <TextField name="as_of" type="date" label={t('m36.pr.asOf')} value={asOf} onChange={setAsOf} />
            <div className="grid grid-cols-2 gap-2">
              <TextField name="started" type="number" label={t('m36.pl.started')} value={started} onChange={setStarted} />
              <TextField name="completed" type="number" label={t('m36.pl.completed')} value={completed} onChange={setCompleted} />
            </div>
            {problem && (started !== '' || completed !== '') && <p className="text-[12.5px] text-bad" data-testid="m36-pr-record-problem" data-problem={problem}>{t(`m36.problem.progress.${problem}`)}</p>}
            <button type="button" className="btn-primary btn-sm" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m36-pr-record-submit">{t('m36.pr.recordSave')}</button>
          </div>
        )}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m36.pr.recordConfirm')} consequence={t('m36.pr.recordConsequence')} confirmLabel={t('m36.pr.recordSave')}
        onConfirm={async () => { const r = await run(() => repo.rpc.recordPledgeProgress(input)); if (r.ok) { setStarted(''); setCompleted(''); } setConfirm(false); }} />
    </Drawer>
  );
}

function PledgeForm({ open, onClose, orgw }: { open: boolean; onClose: () => void; orgw: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const today = todayIso();
  const [org, setOrg] = useState<string>(ENEC_ENTITIES[1]);
  const [area, setArea] = useState('');
  const [people, setPeople] = useState('');
  const [target, setTarget] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [deptEn, setDeptEn] = useState('');
  const [deptAr, setDeptAr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const input: PledgeInput = { ...(orgw ? {} : { org_id: org }), area, people: people === '' ? NaN : Number(people), target_date: target, title_en: titleEn, title_ar: titleAr, department_en: deptEn, department_ar: deptAr };
  const problem = pledgeProblem(input, today);
  return (
    <>
      <Modal open={open} onClose={onClose} size="lg" title={t('m36.pr.formTitle')}
        footer={<><button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m36-pr-submit">{t('m36.pr.register')}</button></>}>
        <div className="space-y-3" data-testid="m36-pr-form">
          <p className="text-[12.5px] text-ink-2">{orgw ? t('m36.pr.formOwn') : t('m36.pr.formHr')}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {!orgw && <SelectField name="org" label={t('m36.pr.col.org')} value={org} onChange={setOrg} options={ENEC_ENTITIES.map((e) => ({ value: e, label: t(`m36.entity.${e}`) }))} />}
            <SelectField name="area" label={t('m36.pr.col.area')} value={area} onChange={setArea} options={PLEDGE_AREAS.map((a) => ({ value: a, label: t(`m36.area.${a}`) }))} />
            <TextField name="people" type="number" label={t('m36.pr.people')} value={people} onChange={setPeople} />
            <TextField name="target" type="date" label={t('m36.pr.col.target')} value={target} onChange={setTarget} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextField name="title_en" label={t('m36.pr.titleEn')} value={titleEn} onChange={setTitleEn} />
            <TextField name="title_ar" label={t('m36.pr.titleAr')} value={titleAr} onChange={setTitleAr} />
            <TextField name="department_en" label={t('m36.pr.deptEn')} value={deptEn} onChange={setDeptEn} />
            <TextField name="department_ar" label={t('m36.pr.deptAr')} value={deptAr} onChange={setDeptAr} />
          </div>
          {problem
            ? <p className="text-[12.5px] text-bad" data-testid="m36-pr-problem" data-problem={problem}>{t(`m36.problem.pledge.${problem}`)}</p>
            : <p className="text-[12.5px] text-ok" data-testid="m36-pr-ready">{t('m36.pr.ready', { n: f.num(Number(people)), date: f.date(target) })}</p>}
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m36.pr.confirm')} consequence={t('m36.pr.consequence')} actingAs={orgw ? t('m36.form.actingAs') : t('m36.cd.actingHr')}
        confirmLabel={t('m36.pr.register')} onConfirm={async () => { const r = await run(() => repo.rpc.registerPledge(input)); if (r.ok) onClose(); setConfirm(false); }} />
    </>
  );
}
