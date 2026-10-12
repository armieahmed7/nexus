// FS67 /workforce/fellowships: HR runs the fellowship programme (ecosystem A: HR director, platform admin; HR analysts read the aggregates).
// Completion rate first (computed from milestones, suppressed under 10, award counts only beside it), breakdowns by kind, host project and
// university, overdue milestones, every fellowship (HR director), award a new fellowship (rpc.saveFellowship: host project + supervisor role
// card + planned span; five milestones from the template) and withdraw one with a reason (it stays in the completion rate).
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { can } from '../../data/access';
import { Async, BenchmarkChips, Card, ConfirmDialog, DataTable, EmptyState, Grid, Page, Section, SelectField, StatTile, TextArea, TextField } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { CompletionPair, FwStatusPill, StatsTable, useFwLabels, useFwStats } from './fw';
import { FW_KINDS, FW_MIN, HOST_KINDS, fellowshipProblem, isOverdue } from './fellowship';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function WorkforceFellowshipsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const who = useSession().identity;
  const hr = can(who, 'ecosystem', ['A']);
  const stats = useFwStats(true);
  const lab = useFwLabels();
  const q = useQuery(['fellowships', 'fellowship_milestones'], async () => {
    const [fws, ms] = await Promise.all([repo.list('fellowships', { order: [['starts_on', 'desc']] }), repo.list('fellowship_milestones')]);
    return { fws: fws as Row[], ms: ms as Row[] };
  });
  const [withdraw, setWithdraw] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const run = useAction();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Page title={t('m10.routes.workforce-fellowships.title')} intro={t('m10.fw.wf.intro')} wide actions={<L to="/universities/fellowships" className="btn-outline btn-sm">{t('m10.fw.wf.toPublic')}</L>}>
      <BenchmarkChips feature="FS67" />
      <Async state={{ ...stats, data: stats.data ?? undefined }}>
        {(s) => (
          <div className="space-y-4">
            <Grid cols={4}>
              <StatTile label={t('m10.fw.overall')} value={s.overall.rate == null ? t('m10.fw.suppressed', { n: FW_MIN }) : f.pct(s.overall.rate, 0)} sub={<CompletionPair cell={s.overall} />} sim />
              <StatTile label={t('m10.fw.k.nest_fellowship')} value={s.by_kind[0].rate == null ? '—' : f.pct(s.by_kind[0].rate, 0)} sub={<CompletionPair cell={s.by_kind[0]} />} />
              <StatTile label={t('m10.fw.k.sponsored_study')} value={s.by_kind[1].rate == null ? '—' : f.pct(s.by_kind[1].rate, 0)} sub={<CompletionPair cell={s.by_kind[1]} />} />
              <StatTile label={t('m10.fw.wf.overdue')} value={s.overdue == null ? t('m10.fw.suppressed', { n: FW_MIN }) : f.num(s.overdue)} tone="bad" />
            </Grid>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <StatsTable title={t('m10.fw.byKind')} cells={s.by_kind} label={(k) => t(`m10.fw.k.${k}`)} />
              <StatsTable title={t('m10.fw.byHost')} cells={s.by_host} label={(k) => t(`m10.fw.k.${k}`)} />
              <StatsTable title={t('m10.fw.byUniversity')} cells={s.by_university} label={lab.key} />
            </div>
            <p className="text-[12.5px] text-ink-3">{t('m10.fw.definition')}</p>
          </div>
        )}
      </Async>
      {hr && <AwardForm />}
      <Section title={t('m10.fw.wf.all')}>
        <Async state={q}>
          {({ fws, ms }) => fws.length === 0 ? <EmptyState title={t('m10.fw.wf.noneVisible')}>{t('m10.fw.wf.noneVisibleBody')}</EmptyState> : (
            <div data-testid="m10-fw-wf-table">
              <DataTable rows={fws} rowKey={(x) => x.id} pageSize={50} csvName="fellowships.csv" columns={[
                { key: 'title', header: t('m10.fw.cTitle'), value: (x) => pick(x, 'title'), sortable: true, render: (x) => <L to={`/universities/fellowships/${x.id}`}>{pick(x, 'title')}</L> },
                { key: 'kind', header: t('m10.fw.cKind'), value: (x) => t(`m10.fw.k.${x.kind}`) },
                { key: 'host', header: t('m10.fw.cHost'), value: (x) => lab.host(x) },
                { key: 'sup', header: t('m10.fw.cSupervisor'), value: (x) => pick(x, 'supervisor_name') },
                { key: 'uni', header: t('m10.fw.cUniversity'), value: (x) => lab.org(x.university_org_id) },
                { key: 'od', header: t('m10.fw.wf.overdue'), value: (x) => ms.filter((m) => m.fellowship_id === x.id && isOverdue(m, x, today)).length, align: 'end' },
                { key: 'status', header: t('m10.fw.cStatus'), value: (x) => x.status, render: (x) => <FwStatusPill f={x} /> },
                { key: 'act', header: '', csv: false, render: (x) => (hr && x.status === 'active' ? <button type="button" className="btn-ghost btn-sm" onClick={() => { setReason(''); setWithdraw(x); }} data-testid={`m10-fw-withdraw-${x.id}`}>{t('m10.fw.wf.withdraw')}</button> : null) },
              ]} />
            </div>
          )}
        </Async>
      </Section>
      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m10.fw.wf.withdraw')} consequence={t('m10.fw.wf.withdrawConsequence')} confirmLabel={t('m10.fw.wf.withdraw')} danger
        onConfirm={async () => { if (withdraw) await run(() => repo.rpc.withdrawFellowship(withdraw.id, reason)); setWithdraw(null); }}>
        <TextArea label={t('m10.fw.wf.reason')} name="reason" value={reason} onChange={setReason} rows={3} hint={t('m10.fw.wf.reasonHint')} />
      </ConfirmDialog>
    </Page>
  );
}

function AwardForm() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const q = useQuery(['research_challenges', 'adv_technologies', 'organisations', 'fellowships'], async () => {
    const [rc, adv, orgs, fws] = await Promise.all([repo.list('research_challenges'), repo.list('adv_technologies'), repo.list('organisations'), repo.list('fellowships')]);
    return { rc: rc as Row[], adv: adv as Row[], orgs: orgs as Row[], fws: fws as Row[] };
  });
  const [v, setV] = useState({ kind: 'nest_fellowship', title_en: '', title_ar: '', fellow_person_id: '', university_org_id: '', host_kind: 'research_challenge', host_ref: '', supervisor_person_id: '', starts_on: '', ends_on: '', placement_en: '', placement_ar: '' });
  const [ask, setAsk] = useState(false);
  const hosts = useMemo(() => (v.host_kind === 'research_challenge' ? (q.data?.rc ?? []).filter((r) => r.is_published).map((r) => ({ value: String(r.id), label: pick(r, 'title') })) : (q.data?.adv ?? []).map((a) => ({ value: String(a.id), label: pick(a, 'family') }))), [q.data, v.host_kind, pick]);
  const unis = (q.data?.orgs ?? []).filter((o) => o.kind === 'university').map((o) => ({ value: String(o.id), label: pick(o, 'name') }));
  // client-side pre-check (people are not readable here: the server checks the fellow and the supervisor role card)
  const pre = fellowshipProblem({ ...v, university_org_id: v.university_org_id || null }, { people: [{ id: v.fellow_person_id, kind: 'staff', status: 'active' }, { id: v.supervisor_person_id, kind: 'staff', persona_id: 'x', status: 'active' }].filter((p) => p.id), organisations: q.data?.orgs ?? [], research_challenges: q.data?.rc ?? [], adv_technologies: q.data?.adv ?? [], fellowships: q.data?.fws ?? [] });
  const set = (patch: Partial<typeof v>) => setV({ ...v, ...patch });
  return (
    <Card title={t('m10.fw.wf.awardTitle')}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m10-fw-award">
        <SelectField label={t('m10.fw.cKind')} name="kind" value={v.kind} onChange={(x) => set({ kind: x })} options={FW_KINDS.map((k) => ({ value: k, label: t(`m10.fw.k.${k}`) }))} />
        <SelectField label={t('m10.fw.wf.hostKind')} name="host_kind" value={v.host_kind} onChange={(x) => set({ host_kind: x, host_ref: '' })} options={HOST_KINDS.map((k) => ({ value: k, label: t(`m10.fw.k.${k}`) }))} />
        <SelectField label={t('m10.fw.cHost')} name="host_ref" value={v.host_ref} onChange={(x) => set({ host_ref: x })} options={hosts} />
        <TextField label={t('m10.fw.wf.titleEn')} name="title_en" value={v.title_en} onChange={(x) => set({ title_en: x })} />
        <TextField label={t('m10.fw.wf.titleAr')} name="title_ar" value={v.title_ar} onChange={(x) => set({ title_ar: x })} />
        <SelectField label={t('m10.fw.cUniversity')} name="uni" value={v.university_org_id} onChange={(x) => set({ university_org_id: x })} options={unis} placeholder={t('m10.fw.enecOnly')} />
        <TextField label={t('m10.fw.fellow')} name="fellow" value={v.fellow_person_id} onChange={(x) => set({ fellow_person_id: x.trim() })} hint={t('m10.fw.wf.fellowHint')} />
        <TextField label={t('m10.fw.cSupervisor')} name="sup" value={v.supervisor_person_id} onChange={(x) => set({ supervisor_person_id: x.trim() })} hint={t('m10.fw.wf.supervisorHint')} />
        <div className="grid grid-cols-2 gap-2">
          <TextField label={t('m10.fw.wf.starts')} name="starts" type="date" value={v.starts_on} onChange={(x) => set({ starts_on: x })} />
          <TextField label={t('m10.fw.wf.ends')} name="ends" type="date" value={v.ends_on} onChange={(x) => set({ ends_on: x })} />
        </div>
        <TextField label={t('m10.fw.wf.placementEn')} name="pl_en" value={v.placement_en} onChange={(x) => set({ placement_en: x })} />
        <TextField label={t('m10.fw.wf.placementAr')} name="pl_ar" value={v.placement_ar} onChange={(x) => set({ placement_ar: x })} />
      </div>
      {pre && <p className="mt-2 text-[12.5px] text-ink-3" data-testid="m10-fw-pre">{t(`m10.fw.problem.${pre}`)}</p>}
      <button type="button" className="btn-primary btn-sm mt-3" disabled={!!pre} onClick={() => setAsk(true)} data-testid="m10-fw-award-btn">{t('m10.fw.wf.award')}</button>
      <ConfirmDialog open={ask} onClose={() => setAsk(false)} title={t('m10.fw.wf.award')} consequence={t('m10.fw.wf.awardConsequence')} confirmLabel={t('m10.fw.wf.award')}
        onConfirm={async () => { await run(() => repo.rpc.saveFellowship({ ...v, university_org_id: v.university_org_id || null })); setAsk(false); }} />
    </Card>
  );
}
