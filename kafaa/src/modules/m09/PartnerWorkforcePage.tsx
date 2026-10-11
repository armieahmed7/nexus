// M09 /partner/workforce (partner admin): contractor staff qualification evidence and equivalency requests, own organisation only.
// Contractor staff meet the same qualifications as ENEC staff, through ENEC training or an equivalency decision recorded by an
// ENEC evaluator. A request for another organisation's record returns "not found" and is audited (M09 acceptance).
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Card, Callout, Async, EmptyState, ErrorState, Skeleton, Drawer, DataTable, ConfirmDialog, SelectField, TextField, Grid, StatTile, KeyValue, Icon, type Column } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useAction, useQuery, useRepo, type Result, type RowOf } from '../../data';
import { EVIDENCE_KINDS, equivalencyCoverage, type MappingRow } from '../../domain/partners';
import { HistoryTimeline, MStatus, fileFingerprint, shortHash, useMyOrg } from './shared';

type Eq = RowOf<'equivalency_requests'>;
type Ev = { name: string; kind: string; sha256?: string | null; size_kb?: number | null };

export default function PartnerWorkforcePage() {
  const t = useT();
  const repo = useRepo();
  const { orgId } = useMyOrg();
  const q = useQuery(['equivalency_requests', 'people', 'qual_standards', 'task_items', 'enrolments', 'courses'], async () => {
    const [eq, people, standards, tasks, enrol, courses] = await Promise.all([
      repo.list('equivalency_requests', { filter: { org_id: orgId ?? '' }, order: [['submitted_at', 'desc']] }),
      repo.list('people', { filter: { org_id: orgId ?? '' }, order: [['display_name', 'asc']] }),
      repo.list('qual_standards', { filter: { status: 'current' }, order: [['code', 'asc']] }),
      repo.list('task_items', { order: [['sort', 'asc']] }),
      repo.list('enrolments', { filter: { org_id: orgId ?? '' } }),
      repo.list('courses', { filter: { audience: 'supplier' } }),
    ]);
    return { eq, people, standards, tasks, enrol, courses };
  }, [orgId]);
  return (
    <Page title={t('m09.routes.partner-workforce.title')} intro={t('m09.wf.intro')} actions={<L to="/partner/workforce/passport" className="btn-outline" data-testid="m09-wf-passport">{t('m09.cp.wfLink')}</L>} /* W5E2 (F33) */>
      <Callout tone="info" title={t('m09.wf.ruleTitle')}>{t('m09.wf.ruleBody')}</Callout>
      <Async state={q} isEmpty={() => false}>{(d) => <Workforce {...d} />}</Async>
    </Page>
  );
}

function Workforce({ eq, people, standards, tasks, enrol, courses }: { eq: Eq[]; people: RowOf<'people'>[]; standards: RowOf<'qual_standards'>[]; tasks: RowOf<'task_items'>[]; enrol: RowOf<'enrolments'>[]; courses: RowOf<'courses'>[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const openId = params.get('eq');
  const std = (id: string) => standards.find((s) => s.id === id);
  const setOpen = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set('eq', id); else p.delete('eq'); setParams(p, { replace: true }); };
  const contractors = people.filter((p) => p.kind === 'contractor');
  const supplierIds = new Set(courses.map((c) => c.id));
  const decided = eq.filter((e) => ['equivalent', 'training_required', 'rejected'].includes(e.status));

  const cols: Column<Eq>[] = [
    { key: 'person', header: t('m09.wf.col.person'), value: (e) => e.person_label, sortable: true, render: (e) => <button className="link-plain text-start font-semibold text-accent" onClick={() => setOpen(e.id)}>{e.person_label}</button> },
    { key: 'std', header: t('m09.wf.col.standard'), value: (e) => { const s = std(e.standard_id); return s ? `${s.code} ${pick(s, 'title')}` : e.standard_id; }, sortable: true },
    { key: 'status', header: t('m09.onb.col.status'), value: (e) => e.status, render: (e) => <MStatus status={e.status} />, sortable: true },
    { key: 'cov', header: t('m09.wf.col.coverage'), value: (e) => { const c = equivalencyCoverage(tasks.filter((x) => x.standard_id === e.standard_id), e.mapping as MappingRow[]); return `${c.covered}/${c.total}`; } },
    { key: 'ev', header: t('m09.wf.col.evidence'), value: (e) => (Array.isArray(e.evidence) ? (e.evidence as unknown[]).length : 0) },
    { key: 'sub', header: t('m09.wf.col.submitted'), value: (e) => e.submitted_at, render: (e) => f.date(e.submitted_at), sortable: true },
  ];

  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m09.wf.statContractors')} value={f.num(contractors.length)} />
        <StatTile label={t('m09.wf.statOpen')} value={f.num(eq.filter((e) => ['submitted', 'under_review'].includes(e.status)).length)} />
        <StatTile label={t('m09.wf.statEquivalent')} value={f.num(eq.filter((e) => e.status === 'equivalent').length)} tone="ok" />
        <StatTile label={t('m09.wf.statTraining')} value={f.num(decided.filter((e) => e.status === 'training_required').length)} />
      </Grid>

      <Section title={t('m09.wf.requestsTitle')} actions={<button className="btn-primary" onClick={() => setCreating(true)} data-testid="m09-wf-new">{t('m09.wf.new')}</button>}>
        {eq.length === 0 ? <EmptyState title={t('m09.wf.noRequests')} action={<button className="btn-outline btn-sm" onClick={() => setCreating(true)}>{t('m09.wf.new')}</button>} /> : (
          <DataTable rows={eq} columns={cols} rowKey={(e) => e.id} csvName="kafaa-equivalency-requests" initialSort={{ key: 'sub', dir: 'desc' }} caption={t('m09.wf.requestsTitle')} />
        )}
      </Section>

      <Section title={t('m09.wf.staffTitle')} description={t('m09.wf.staffDesc')}>
        {contractors.length === 0 ? <EmptyState title={t('m09.wf.noStaff')} /> : (
          <div className="card overflow-x-auto">
            <table className="table-base w-full text-[13px]" data-testid="m09-wf-staff">
              <caption className="sr-only">{t('m09.wf.staffTitle')}</caption>
              <thead className="bg-raised"><tr><th scope="col">{t('m09.wf.col.person')}</th><th scope="col">{t('m09.wf.col.academy')}</th><th scope="col">{t('m09.wf.col.equivalency')}</th></tr></thead>
              <tbody>
                {contractors.map((p) => {
                  const mine = enrol.filter((e) => e.person_id === p.id && supplierIds.has(e.course_id));
                  const done = mine.filter((e) => e.status === 'completed').length;
                  const reqs = eq.filter((e) => e.person_id === p.id);
                  return (
                    <tr key={p.id}>
                      <th scope="row" className="text-start font-medium">{p.display_name}<div className="text-[11.5px] font-normal text-ink-3">{t('m09.wf.contractor')}</div></th>
                      <td className="num">{t('m09.wf.coursesDone', { n: f.num(done), total: f.num(courses.length) })}</td>
                      <td>{reqs.length ? <span className="flex flex-wrap gap-1">{reqs.map((r) => <button key={r.id} className="link-plain" onClick={() => setOpen(r.id)}><MStatus status={r.status} /></button>)}</span> : <span className="text-ink-3">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Drawer open={!!openId} onClose={() => setOpen(null)} title={t('m09.wf.detailTitle')}>
        {openId && <EqDetail id={openId} standards={standards} tasks={tasks} />}
      </Drawer>
      {creating && <NewRequest onClose={() => setCreating(false)} contractors={contractors} standards={standards} />}
    </>
  );
}

/** Reads one request through rpc.getEquivalency so another organisation's id returns "not found" and is audited. */
function EqDetail({ id, standards, tasks }: { id: string; standards: RowOf<'qual_standards'>[]; tasks: RowOf<'task_items'>[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const [state, setState] = useState<Result<Eq> | null>(null);
  useEffect(() => {
    let live = true;
    setState(null);
    repo.rpc.getEquivalency(id).then((r) => live && setState(r), (e: unknown) => live && setState({ ok: false, code: 'error', message: String(e) }));
    return () => { live = false; };
  }, [id, repo]);
  if (!state) return <Skeleton lines={5} />;
  if (!state.ok || !state.data) {
    return state.code === 'not_found' ? (
      <div data-testid="m09-wf-notfound"><EmptyState title={t('m09.wf.notFound')} icon="lock">{t('m09.wf.notFoundBody')}</EmptyState></div>
    ) : <ErrorState error={state.message} />;
  }
  const r = state.data;
  const s = standards.find((x) => x.id === r.standard_id);
  const stdTasks = tasks.filter((x) => x.standard_id === r.standard_id);
  const map = (Array.isArray(r.mapping) ? r.mapping : []) as MappingRow[];
  const cov = equivalencyCoverage(stdTasks, map);
  const ev = (Array.isArray(r.evidence) ? r.evidence : []) as Ev[];
  return (
    <div className="space-y-4" data-testid="m09-wf-detail">
      <KeyValue items={[
        [t('m09.wf.col.person'), r.person_label],
        [t('m09.wf.col.standard'), s ? `${s.code} · ${pick(s, 'title')}` : r.standard_id],
        [t('m09.onb.col.status'), <MStatus key="s" status={r.status} />],
        [t('m09.wf.col.submitted'), f.dateTime(r.submitted_at)],
        [t('m09.wf.decision'), r.decision_note || '—'],
        [t('m09.wf.decider'), r.decider_role ? t('m09.wf.deciderRole') : '—'],
      ]} />
      <Card title={t('m09.wf.evidence')}>
        <ol className="space-y-1 text-[13px]">
          {ev.map((e, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2"><span><span className="num">{f.num(i + 1)}.</span> {e.name} <span className="chip border-line bg-sunken text-ink-2">{t(`m09.evkind.${e.kind}`)}</span></span><span className="num text-[11.5px] text-ink-3">{e.sha256 ? `SHA-256 ${shortHash(e.sha256)}` : ''}</span></li>
          ))}
        </ol>
      </Card>
      <Card title={t('m09.wf.mapping', { n: f.num(cov.covered), total: f.num(cov.total) })}>
        <ul className="space-y-1 text-[13px]">
          {stdTasks.map((tk) => {
            const m = map.find((x) => x.task_id === tk.id);
            return (
              <li key={tk.id} className="flex items-start gap-2">
                <Icon name={m?.covered ? 'check' : 'info'} size={14} className={m?.covered ? 'mt-0.5 text-ok' : 'mt-0.5 text-ink-3'} />
                <span>{pick(tk, 'statement')}{tk.critical && <span className="chip ms-1 border-bad-line bg-bad-bg text-bad">{t('m09.wf.critical')}</span>}{m?.note ? <span className="block text-[12px] text-ink-3">{m.note}</span> : null}</span>
              </li>
            );
          })}
        </ul>
        {map.length === 0 && <p className="mt-2 text-[12.5px] text-ink-3">{t('m09.wf.notMapped')}</p>}
      </Card>
      <Card title={t('m09.onb.history')}><HistoryTimeline history={r.history} /></Card>
    </div>
  );
}

function NewRequest({ onClose, contractors, standards }: { onClose: () => void; contractors: RowOf<'people'>[]; standards: RowOf<'qual_standards'>[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [person, setPerson] = useState('');
  const [label, setLabel] = useState('');
  const [standard, setStandard] = useState('');
  const [ev, setEv] = useState<Ev[]>([{ name: '', kind: 'certificate' }]);
  const [confirm, setConfirm] = useState(false);
  const allowed = useMemo(() => standards.filter((s) => !s.security_restricted), [standards]);
  const finalLabel = person ? (contractors.find((p) => p.id === person)?.display_name ?? label) : label;
  const valid = !!finalLabel.trim() && !!standard && ev.length > 0 && ev.every((e) => e.name.trim());
  const setRow = (i: number, patch: Partial<Ev>) => setEv((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Drawer open onClose={onClose} title={t('m09.wf.new')}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m09-wf-submit">{t('common.submit')}</button></>}>
      <div className="space-y-3" data-testid="m09-wf-form">
        <SelectField label={t('m09.wf.f.person')} name="person" value={person} onChange={setPerson} options={contractors.map((p) => ({ value: p.id, label: p.display_name }))} placeholder={t('m09.wf.f.other')} />
        {!person && <TextField label={t('m09.wf.f.label')} name="label" value={label} onChange={setLabel} hint={t('m09.wf.f.labelHint')} required />}
        <SelectField label={t('m09.wf.f.standard')} name="standard" value={standard} onChange={setStandard} required options={allowed.map((s) => ({ value: s.id, label: `${s.code} · ${pick(s, 'title')}` }))} hint={t('m09.wf.f.standardHint')} />
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold">{t('m09.wf.evidence')}</legend>
          {ev.map((e, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-btn border border-line p-2 sm:grid-cols-[2fr_1fr]">
              <TextField label={t('m09.wf.f.evName', { n: i + 1 })} name={`ev-${i}`} value={e.name} onChange={(v) => setRow(i, { name: v })} required />
              <SelectField label={t('m09.wf.f.evKind')} name={`evk-${i}`} value={e.kind} onChange={(v) => setRow(i, { kind: v })} options={EVIDENCE_KINDS.map((k) => ({ value: k, label: t(`m09.evkind.${k}`) }))} />
              <label className="flex flex-wrap items-center gap-2 text-[12.5px] sm:col-span-2">
                <span className="btn-outline btn-sm cursor-pointer">{t('m09.wf.f.attach')}
                  <input type="file" className="sr-only" onChange={async (x) => { const file = x.target.files?.[0]; if (file) { const fp = await fileFingerprint(file); setRow(i, { name: e.name || fp.name, sha256: fp.sha256, size_kb: fp.sizeKb }); } }} />
                </span>
                {e.sha256 ? <span className="num text-ink-3">SHA-256 {shortHash(e.sha256)}</span> : <span className="text-ink-3">{t('m09.wf.f.attachHint')}</span>}
                {ev.length > 1 && <button className="btn-ghost btn-sm ms-auto" onClick={() => setEv((rows) => rows.filter((_, j) => j !== i))}>{t('m09.wf.f.remove')}</button>}
              </label>
            </div>
          ))}
          {ev.length < 10 && <button className="btn-outline btn-sm" onClick={() => setEv((rows) => [...rows, { name: '', kind: 'training_record' }])}><Icon name="plus" size={12} /> {t('m09.wf.f.addEvidence')}</button>}
        </fieldset>
        <Callout tone="info" title={t('m09.wf.privacyTitle')}>{t('m09.wf.privacyBody')}</Callout>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m09.wf.new')} consequence={t('m09.wf.submitBody')} actingAs={t('m09.home.roleAdmin')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.submitEquivalency({ person_id: person || null, person_label: finalLabel.trim(), standard_id: standard, evidence: ev.map((e) => ({ ...e, name: e.name.trim() })) }), { success: t('m09.wf.submitted') });
          if (r.ok) onClose();
        }} />
    </Drawer>
  );
}
