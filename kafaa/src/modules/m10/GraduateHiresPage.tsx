// FS66 /workforce/graduate-hires: graduate recruiters (the HR director, applications A; auditors read) record the hire of a programme graduate
// (rpc.recordGraduateHire behind a confirmation). Validated evidence for the mapped skills is written only when the programme is endorsed
// and its window covers the graduation date; otherwise the record waits for the endorsement or stays "not covered". People are shown by
// their synthetic id only.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { Can } from '../../auth/guards';
import { Async, BenchmarkChips, Callout, Card, ConfirmDialog, DataTable, EmptyState, Grid, Page, SelectField, StatTile, StatusPill, TextField } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { displayStatus } from './alignment';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function GraduateHiresPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['programme_graduates', 'programme_alignments'], async () => {
    const [grads, progs] = await Promise.all([repo.list('programme_graduates', { order: [['recorded_at', 'desc']] }), repo.list('programme_alignments')]);
    return { grads: grads as Row[], progs: progs as Row[] };
  });
  return (
    <Page title={t('m10.routes.workforce-graduate-hires.title')} intro={t('m10.ua.gh.intro')} wide actions={<L to="/training/university-programmes" className="btn-outline btn-sm">{t('m10.ua.gh.toRegister')}</L>}>
      <BenchmarkChips feature="FS66" />
      <Callout tone="info" title={t('m10.ua.gh.ruleTitle')}>{t('m10.ua.gh.ruleBody')}</Callout>
      <Async state={{ ...q, data: q.data ? q.data : undefined }}>
        {({ grads, progs }) => {
          const n = (s: string) => grads.filter((g) => g.status === s).length;
          const pmap = new Map(progs.map((p) => [String(p.id), p]));
          return (
            <div className="space-y-4">
              <Grid cols={4}>
                <StatTile label={t('m10.ua.gh.recorded')} value={f.num(grads.length)} sim />
                <StatTile label={t('m10.ua.gh.st.evidence_written')} value={f.num(n('evidence_written'))} tone="ok" />
                <StatTile label={t('m10.ua.gh.st.awaiting_endorsement')} value={f.num(n('awaiting_endorsement'))} tone="info" />
                <StatTile label={t('m10.ua.gh.st.not_covered')} value={f.num(n('not_covered'))} />
              </Grid>
              <Can res="applications" levels={['A']}><HireForm progs={progs} /></Can>
              {grads.length === 0 ? <EmptyState title={t('m10.ua.gh.none')} /> : (
                <div data-testid="m10-gh-table">
                  <DataTable rows={grads} rowKey={(g) => g.id} csvName="graduate-hires.csv" columns={[
                    { key: 'person', header: t('m10.ua.gh.person'), value: (g) => g.person_id, sortable: true, render: (g) => <span className="num">{g.person_id}</span> },
                    { key: 'prog', header: t('m10.ua.reg.cProgramme'), value: (g) => pick(pmap.get(g.programme_id), 'title') || g.programme_id, render: (g) => <L to={`/universities/programmes/${g.programme_id}`}>{pick(pmap.get(g.programme_id), 'title') || g.programme_id}</L> },
                    { key: 'pst', header: t('m10.ua.gh.programmeStatus'), value: (g) => (pmap.get(g.programme_id) ? displayStatus(pmap.get(g.programme_id)!, new Date().toISOString().slice(0, 10)) : '') ,
                      render: (g) => (pmap.get(g.programme_id) ? t(`m10.ua.status.${displayStatus(pmap.get(g.programme_id)!, new Date().toISOString().slice(0, 10))}`) : '—') },
                    { key: 'grad', header: t('m10.ua.gh.graduated'), value: (g) => g.graduated_on, sortable: true, render: (g) => f.date(g.graduated_on) },
                    { key: 'hired', header: t('m10.ua.gh.hired'), value: (g) => g.hired_on, render: (g) => f.date(g.hired_on) },
                    { key: 'status', header: t('m10.ua.reg.fStatus'), value: (g) => g.status, render: (g) => <StatusPill tone={g.status === 'evidence_written' ? 'ok' : g.status === 'not_covered' ? 'neutral' : 'info'}><span data-testid="m10-gh-status">{t(`m10.ua.gh.st.${g.status}`)}</span></StatusPill> },
                    { key: 'ev', header: t('m10.ua.gh.evidence'), value: (g) => (g.evidence_ids ?? []).length, align: 'end' },
                  ]} />
                </div>
              )}
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function HireForm({ progs }: { progs: Row[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({ person_id: '', programme_id: '', graduated_on: '', hired_on: today });
  const [ask, setAsk] = useState(false);
  const opts = useMemo(() => progs.map((p) => ({ value: String(p.id), label: `${pick(p, 'title')} (${t(`m10.ua.status.${displayStatus(p, today)}`)})` })), [progs, pick, t, today]);
  const ready = v.person_id.trim() && v.programme_id && v.graduated_on && v.hired_on;
  return (
    <Card title={t('m10.ua.gh.formTitle')}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="m10-gh-form">
        <TextField label={t('m10.ua.gh.person')} name="person" value={v.person_id} onChange={(x) => setV({ ...v, person_id: x })} hint={t('m10.ua.gh.personHint')} />
        <SelectField label={t('m10.ua.reg.cProgramme')} name="programme" value={v.programme_id} onChange={(x) => setV({ ...v, programme_id: x })} options={opts} />
        <TextField label={t('m10.ua.gh.graduated')} name="graduated" type="date" value={v.graduated_on} onChange={(x) => setV({ ...v, graduated_on: x })} />
        <TextField label={t('m10.ua.gh.hired')} name="hired" type="date" value={v.hired_on} onChange={(x) => setV({ ...v, hired_on: x })} />
      </div>
      <button type="button" className="btn-primary btn-sm mt-3" disabled={!ready} onClick={() => setAsk(true)} data-testid="m10-gh-record">{t('m10.ua.gh.record')}</button>
      <ConfirmDialog open={ask} onClose={() => setAsk(false)} title={t('m10.ua.gh.record')} consequence={t('m10.ua.gh.recordConsequence')} confirmLabel={t('m10.ua.gh.record')}
        onConfirm={async () => { const r = await run(() => repo.rpc.recordGraduateHire({ ...v, person_id: v.person_id.trim() })); if (r.ok) setV({ person_id: '', programme_id: '', graduated_on: '', hired_on: today }); setAsk(false); }} />
    </Card>
  );
}
