// M09 /training/equivalency: ENEC evaluators map contractor evidence to the qualification standard's task items and record the
// equivalency decision (spec M09 "Contractor equivalency"). "Equivalent" needs every task covered by cited evidence; decisions
// are final and need a note; only a holder of the evaluator qualification for the standard (or the training manager) decides.
import { useEffect, useMemo, useState } from 'react';
import { Page, Section, Card, Callout, Async, EmptyState, Grid, StatTile, DataTable, Drawer, ConfirmDialog, FilterBar, useFilters, KeyValue, CheckboxField, TextField, Icon, type Column } from '../../ui';
import { useT, usePick, useFormat } from '../../i18n';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { equivalencyCoverage, type MappingRow } from '../../domain/partners';
import { HistoryTimeline, MStatus, shortHash } from './shared';

type Eq = RowOf<'equivalency_requests'>;
type Ev = { name: string; kind: string; sha256?: string | null };
type Data = { eq: Eq[]; orgs: RowOf<'organisations'>[]; standards: RowOf<'qual_standards'>[]; tasks: RowOf<'task_items'>[]; quals: RowOf<'evaluator_quals'>[] };

export default function TrainingEquivalencyPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['equivalency_requests', 'organisations', 'qual_standards', 'task_items', 'evaluator_quals'], async (): Promise<Data> => {
    const [eq, orgs, standards, tasks, quals] = await Promise.all([
      repo.list('equivalency_requests', { order: [['submitted_at', 'desc']] }),
      repo.list('organisations'),
      repo.list('qual_standards'),
      repo.list('task_items', { order: [['sort', 'asc']] }),
      repo.list('evaluator_quals'),
    ]);
    return { eq, orgs, standards, tasks, quals };
  });
  return (
    <Page title={t('m09.routes.training-equivalency.title')} intro={t('m09.eqr.intro')} wide>
      <Callout tone="info" title={t('m09.eqr.ruleTitle')}>{t('m09.eqr.ruleBody')}</Callout>
      <Async state={q} isEmpty={(d) => d.eq.length === 0} empty={<EmptyState title={t('m09.eqr.empty')} />}>{(d) => <Queue d={d} />}</Async>
    </Page>
  );
}

function Queue({ d }: { d: Data }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const [flt, setFlt] = useFilters({ status: '', org: '', std: '' }, true);
  const [open, setOpen] = useState<string | null>(null);
  const orgName = (id: string) => { const o = d.orgs.find((x) => x.id === id); return o ? pick(o, 'name') : id; };
  const std = (id: string) => d.standards.find((s) => s.id === id);
  const cov = (e: Eq) => equivalencyCoverage(d.tasks.filter((x) => x.standard_id === e.standard_id), e.mapping as MappingRow[]);
  const rows = d.eq.filter((e) => (!flt.status || e.status === flt.status) && (!flt.org || e.org_id === flt.org) && (!flt.std || e.standard_id === flt.std));
  const cols: Column<Eq>[] = [
    { key: 'person', header: t('m09.wf.col.person'), value: (e) => e.person_label, sortable: true, render: (e) => <button className="link-plain text-start font-semibold text-accent" onClick={() => setOpen(e.id)} data-testid={`m09-eqr-open-${e.id}`}>{e.person_label}</button> },
    { key: 'org', header: t('m09.adm.col.org'), value: (e) => orgName(e.org_id), sortable: true },
    { key: 'std', header: t('m09.wf.col.standard'), value: (e) => std(e.standard_id)?.code ?? e.standard_id, sortable: true },
    { key: 'status', header: t('m09.onb.col.status'), value: (e) => e.status, render: (e) => <MStatus status={e.status} />, sortable: true },
    { key: 'cov', header: t('m09.wf.col.coverage'), value: (e) => { const c = cov(e); return `${c.covered}/${c.total}`; } },
    { key: 'sub', header: t('m09.wf.col.submitted'), value: (e) => e.submitted_at, render: (e) => f.date(e.submitted_at), sortable: true },
  ];
  const n = (s: string[]) => d.eq.filter((e) => s.includes(e.status)).length;
  const current = d.eq.find((e) => e.id === open) ?? null;
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m09.eqr.statNew')} value={f.num(n(['submitted']))} tone={n(['submitted']) ? 'info' : undefined} />
        <StatTile label={t('m09.eqr.statReview')} value={f.num(n(['under_review']))} />
        <StatTile label={t('m09.wf.statEquivalent')} value={f.num(n(['equivalent']))} tone="ok" />
        <StatTile label={t('m09.eqr.statOther')} value={f.num(n(['training_required', 'rejected']))} />
      </Grid>
      <Section title={t('m09.eqr.queue')}>
        <FilterBar value={flt} onChange={setFlt} fields={[
          { key: 'status', label: t('m09.onb.col.status'), options: ['submitted', 'under_review', 'equivalent', 'training_required', 'rejected'].map((s) => ({ value: s, label: t(`m09.status.${s}`) })) },
          { key: 'org', label: t('m09.adm.col.org'), options: Array.from(new Set(d.eq.map((e) => e.org_id))).map((o) => ({ value: o, label: orgName(o) })) },
          { key: 'std', label: t('m09.wf.col.standard'), options: Array.from(new Set(d.eq.map((e) => e.standard_id))).map((s) => ({ value: s, label: std(s)?.code ?? s })) },
        ]} />
        <DataTable rows={rows} columns={cols} rowKey={(e) => e.id} csvName="kafaa-equivalency-queue" initialSort={{ key: 'sub', dir: 'desc' }} caption={t('m09.eqr.queue')} />
      </Section>
      <Drawer open={!!current} onClose={() => setOpen(null)} title={current ? `${current.person_label} · ${std(current.standard_id)?.code ?? ''}` : ''}>
        {current && <Review e={current} d={d} orgName={orgName(current.org_id)} />}
      </Drawer>
    </>
  );
}

function Review({ e, d, orgName }: { e: Eq; d: Data; orgName: string }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const tasks = useMemo(() => d.tasks.filter((x) => x.standard_id === e.standard_id), [d.tasks, e.standard_id]);
  const std = d.standards.find((x) => x.id === e.standard_id);
  const ev = (Array.isArray(e.evidence) ? e.evidence : []) as Ev[];
  const initial = useMemo(() => tasks.map((tk) => ({ task_id: tk.id, covered: false, evidence: [] as number[], note: '', ...((e.mapping as MappingRow[]) ?? []).find((m) => m.task_id === tk.id) })), [e.mapping, tasks]);
  const [map, setMap] = useState<MappingRow[]>(initial);
  useEffect(() => setMap(initial), [initial]);
  const [pending, setPending] = useState<null | 'map' | 'equivalent' | 'training_required' | 'rejected'>(null);
  const decided = ['equivalent', 'training_required', 'rejected'].includes(e.status);
  const canAct = s.can('equivalency', ['A']) && !decided;
  const qualified = s.roles.includes('training_manager') || d.quals.some((q) => q.person_id === s.identity.personId && q.standard_id === e.standard_id && q.valid_to >= new Date().toISOString().slice(0, 10));
  const cov = equivalencyCoverage(tasks, map);
  const savedCov = equivalencyCoverage(tasks, e.mapping as MappingRow[]);
  const dirty = JSON.stringify(map) !== JSON.stringify(initial);
  const setRow = (taskId: string, patch: Partial<MappingRow>) => setMap((rows) => rows.map((r) => (r.task_id === taskId ? { ...r, ...patch } : r)));
  const toggleEv = (taskId: string, i: number) => setMap((rows) => rows.map((r) => {
    if (r.task_id !== taskId) return r;
    const set = new Set(r.evidence ?? []);
    if (set.has(i)) set.delete(i); else set.add(i);
    const evidence = [...set].sort((a, b) => a - b);
    return { ...r, evidence, covered: evidence.length ? r.covered : false };
  }));
  const exec = async (note: string) => {
    if (pending === 'map') await run(() => repo.rpc.mapEquivalency(e.id, map.map((m) => ({ task_id: m.task_id, covered: !!m.covered, evidence: m.evidence ?? [], note: m.note ?? '' }))));
    else if (pending) await run(() => repo.rpc.decideEquivalency(e.id, pending, note));
  };
  return (
    <div className="space-y-4" data-testid="m09-eqr-review">
      <KeyValue items={[
        [t('m09.adm.col.org'), orgName],
        [t('m09.wf.col.standard'), std ? `${std.code} · ${pick(std, 'title')} (v${std.version})` : e.standard_id],
        [t('m09.onb.col.status'), <MStatus key="s" status={e.status} />],
        [t('m09.wf.col.submitted'), f.dateTime(e.submitted_at)],
        [t('m09.wf.decision'), e.decision_note || '—'],
      ]} />
      {!decided && (
        qualified
          ? <p className="flex items-center gap-2 text-[12.5px] text-ok"><Icon name="check" size={14} />{t('m09.eqr.qualified')}</p>
          : <Callout tone="sim" title={t('m09.eqr.notQualifiedTitle')}>{t('m09.eqr.notQualifiedBody')}</Callout>
      )}
      <Card title={t('m09.wf.evidence')}>
        <ol className="space-y-1 text-[13px]">
          {ev.map((x, i) => <li key={i}><span className="num">{f.num(i + 1)}.</span> {x.name} <span className="chip border-line bg-sunken text-ink-2">{t(`m09.evkind.${x.kind}`)}</span> {x.sha256 && <span className="num text-[11px] text-ink-3">SHA-256 {shortHash(x.sha256)}</span>}</li>)}
        </ol>
      </Card>
      <Card title={t('m09.eqr.mappingTitle', { n: f.num(cov.covered), total: f.num(cov.total) })}>
        <ul className="space-y-3" data-testid="m09-eqr-mapping">
          {tasks.map((tk) => {
            const r = map.find((x) => x.task_id === tk.id)!;
            return (
              <li key={tk.id} className="rounded-btn border border-line p-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-[13px]"><span className="num text-ink-3">{tk.code}</span> {pick(tk, 'statement')} {tk.critical && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m09.wf.critical')}</span>}</div>
                  <span className="text-[11.5px] text-ink-3">{t(`m09.method.${tk.method}`)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  {ev.map((x, i) => (
                    <CheckboxField key={i} label={<span className="text-[12.5px]">{t('m09.eqr.evN', { n: f.num(i + 1) })}</span>} checked={(r.evidence ?? []).includes(i)} onChange={() => canAct && toggleEv(tk.id, i)} disabled={!canAct} />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-1 items-end gap-2 sm:grid-cols-[auto_1fr]">
                  <CheckboxField label={<span className="font-semibold">{t('m09.eqr.covered')}</span>} checked={!!r.covered} onChange={(v) => canAct && setRow(tk.id, { covered: v })} disabled={!canAct || !(r.evidence ?? []).length} hint={!(r.evidence ?? []).length ? t('m09.eqr.citeFirst') : undefined} />
                  <TextField label={t('m09.eqr.note')} name={`note-${tk.id}`} value={r.note ?? ''} onChange={(v) => setRow(tk.id, { note: v })} disabled={!canAct} />
                </div>
              </li>
            );
          })}
        </ul>
        {canAct && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button className="btn-outline btn-sm" disabled={!dirty || !qualified} onClick={() => setPending('map')} data-testid="m09-eqr-save-map">{t('m09.eqr.saveMapping')}</button>
            {dirty && <span className="text-[12px] text-ink-3">{t('m09.eqr.unsaved')}</span>}
          </div>
        )}
      </Card>
      {canAct && (
        <Card title={t('m09.eqr.decisionTitle')}>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary btn-sm" disabled={!qualified || dirty || !savedCov.complete} onClick={() => setPending('equivalent')} data-testid="m09-eqr-equivalent">{t('m09.status.equivalent')}</button>
            <button className="btn-outline btn-sm" disabled={!qualified || dirty} onClick={() => setPending('training_required')} data-testid="m09-eqr-training">{t('m09.status.training_required')}</button>
            <button className="btn-ghost btn-sm text-bad" disabled={!qualified || dirty} onClick={() => setPending('rejected')}>{t('m09.status.rejected')}</button>
          </div>
          {!savedCov.complete && <p className="mt-2 text-[12px] text-ink-3">{t('m09.eqr.equivalentBlocked', { n: f.num(savedCov.uncovered.length) })}</p>}
        </Card>
      )}
      <Card title={t('m09.onb.history')}><HistoryTimeline history={e.history} /></Card>
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending === 'map' ? t('m09.eqr.saveMapping') : pending ? t(`m09.status.${pending}`) : ''}
        consequence={pending === 'map' ? t('m09.eqr.mapBody', { n: f.num(cov.covered), total: f.num(cov.total) }) : t('m09.eqr.decideBody')}
        actingAs={t('m09.eqr.actingEvaluator')}
        requireReason={pending !== 'map' && pending != null}
        reasonLabel={t('m09.eqr.decisionNote')}
        danger={pending === 'rejected'}
        onConfirm={exec}
      />
    </div>
  );
}
