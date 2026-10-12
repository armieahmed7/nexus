// FS66 /training/university-programmes: the register of university programme alignments for ENEC reviewers (frameworks A endorse; the
// training manager, instructors and the HR director read through recognition A; auditors read). The review queue lists submitted
// programmes oldest first with their coverage and computed criteria; every coverage figure explains itself (WhyThis). Partnerships
// admins (partner_org A) can add a programme on behalf of a university that has no Kafa'a account (submitted by them, so another
// framework owner must decide it).
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { Can } from '../../auth/guards';
import { Async, BenchmarkChips, Callout, Card, DataTable, EmptyState, FilterBar, Grid, Icon, Page, Section, StatTile, WhyThis, useFilters } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { autoCriteria, displayStatus, programmeCoverage, type UaWorld } from './alignment';
import { CriteriaList, ProgrammeEditor, UaStatusPill, coverageReasons, useNames, useUaWorld } from './ua';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function ProgrammeRegisterPage() {
  const t = useT();
  const repo = useRepo();
  const w = useUaWorld();
  const q = useQuery(['programme_alignments'], () => repo.list('programme_alignments'));
  const [add, setAdd] = useState(false);
  return (
    <Page title={t('m10.routes.training-university-programmes.title')} intro={t('m10.ua.reg.intro')} wide
      actions={<div className="flex flex-wrap gap-2"><L to="/workforce/graduate-hires" className="btn-outline btn-sm">{t('m10.ua.reg.toHires')}</L>
        <Can res="partner_org" levels={['A']}><button type="button" className="btn-primary btn-sm" onClick={() => setAdd(true)} data-testid="m10-ua-add-behalf"><Icon name="plus" size={14} />{t('m10.ua.reg.addBehalf')}</button></Can></div>}>
      <BenchmarkChips feature="FS66" />
      <Callout tone="sim" title={t('m10.ua.sampleTitle')}>{t('m10.ua.sampleBody')}</Callout>
      <Async state={{ ...q, data: q.data && w.data ? { rows: q.data as Row[], w: w.data } : undefined, loading: q.loading || w.loading, error: q.error ?? w.error }}>
        {({ rows, w: world }) => <Body rows={rows} w={world} />}
      </Async>
      {add && w.data && <ProgrammeEditor open onClose={() => setAdd(false)} row={null} org="" orgChoices={w.data.organisations!.filter((o) => o.kind === 'university')} w={w.data} />}
    </Page>
  );
}

function Body({ rows, w }: { rows: Row[]; w: UaWorld }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const n = useNames(w);
  const today = new Date().toISOString().slice(0, 10);
  const [flt, setFlt] = useFilters({ status: '', org: '' });
  const data = useMemo(() => rows.map((p) => ({ p, cov: programmeCoverage(p, w), auto: autoCriteria(p, w), st: displayStatus(p, today) })), [rows, w, today]);
  const queue = data.filter((x) => x.p.status === 'submitted').sort((a, b) => String(a.p.submitted_at).localeCompare(String(b.p.submitted_at)));
  const list = data.filter((x) => (!flt.status || x.st === flt.status) && (!flt.org || x.p.university_org_id === flt.org));
  const orgs = [...new Set(rows.map((p) => String(p.university_org_id)))].sort();
  const st = (s: string) => data.filter((x) => x.st === s).length;
  return (
    <div className="space-y-5">
      <Grid cols={4}>
        <StatTile label={t('m10.ua.reg.total')} value={f.num(rows.length)} sim />
        <StatTile label={t('m10.ua.status.endorsed')} value={f.num(st('endorsed'))} tone="ok" />
        <StatTile label={t('m10.ua.reg.queue')} value={f.num(queue.length)} tone="info" />
        <StatTile label={t('m10.ua.status.lapsed')} value={f.num(st('lapsed'))} sub={t('m10.ua.reg.lapsedSub')} />
      </Grid>
      <Section title={t('m10.ua.reg.queueTitle')} description={t('m10.ua.reg.queueBody')}>
        {queue.length === 0 ? <EmptyState title={t('m10.ua.reg.queueEmpty')} /> : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m10-ua-queue">
            {queue.map(({ p, cov, auto }) => (
              <Card key={p.id} eyebrow={`${n.org(p.university_org_id)} · ${t('m10.ua.reg.submittedOn', { date: f.date(p.submitted_at) })}`} title={pick(p, 'title')} actions={<UaStatusPill row={p} />}>
                <div className="space-y-2" data-testid={`m10-ua-queue-${p.id}`}>
                  <p className="text-[13px] text-ink-2">{t('m10.ua.reg.queueLine', { best: f.num(cov.best ?? 0), n: f.num((p.skills ?? []).length) })} <WhyThis reasons={coverageReasons(cov, w)} testId="m10-ua-queue-why" /></p>
                  <CriteriaList auto={auto} />
                  <L to={`/universities/programmes/${p.id}`} className="btn-primary btn-sm" data-testid={`m10-ua-review-${p.id}`}>{t('m10.ua.reg.review')}</L>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
      <Section title={t('m10.ua.reg.allTitle')}>
        <FilterBar value={flt} onChange={setFlt} fields={[
          { key: 'status', label: t('m10.ua.reg.fStatus'), options: ['draft', 'submitted', 'endorsed', 'returned', 'lapsed'].map((s) => ({ value: s, label: t(`m10.ua.status.${s}`) })) },
          { key: 'org', label: t('m10.ua.reg.fOrg'), options: orgs.map((o) => ({ value: o, label: n.org(o) })) },
        ]} />
        <div data-testid="m10-ua-register">
          <DataTable rows={list} rowKey={(x) => x.p.id} csvName="university-programme-alignment.csv" columns={[
            { key: 'title', header: t('m10.ua.reg.cProgramme'), value: (x) => pick(x.p, 'title'), sortable: true, render: (x) => <L to={`/universities/programmes/${x.p.id}`}>{pick(x.p, 'title')}</L> },
            { key: 'org', header: t('m10.ua.reg.fOrg'), value: (x) => n.org(x.p.university_org_id), sortable: true },
            { key: 'degree', header: t('m10.ua.ed.degree'), value: (x) => t(`m10.ua.degree.${x.p.degree}`) },
            { key: 'status', header: t('m10.ua.reg.fStatus'), value: (x) => t(`m10.ua.status.${x.st}`), render: (x) => <UaStatusPill row={x.p} /> },
            { key: 'now', header: t('m10.ua.cov.now'), value: (x) => x.cov.now, align: 'end', sortable: true, render: (x) => <span className="num">{x.cov.now == null ? '—' : f.num(x.cov.now)}</span> },
            { key: 'h2030', header: t('m10.ua.cov.h2030'), value: (x) => x.cov.h2030, align: 'end', sortable: true, render: (x) => <span className="num">{x.cov.h2030 == null ? '—' : f.num(x.cov.h2030)}</span> },
            { key: 'to', header: t('m10.ua.reg.cValidTo'), value: (x) => x.p.valid_to ?? '', render: (x) => (x.p.valid_to ? f.date(x.p.valid_to) : '—') },
          ]} />
        </div>
      </Section>
    </div>
  );
}
