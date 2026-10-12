// FS66 /universities/programmes/:id: one programme alignment. The owning university, ENEC reviewers and HR open it (RLS decides; anyone else
// gets "not found"). Coverage by target role and horizon (the FS57 rule), mapped skills with their modules and international anchors (FS08),
// the endorsement panel for framework owners (three computed criteria, three reviewer criteria, the graduation window; never the submitter;
// rpc.endorseProgramme behind a confirmation), the decision history and, for HR, the graduates recorded at hire and their evidence.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { can } from '../../data/access';
import { Async, BenchmarkChips, Callout, Card, CheckboxField, ConfirmDialog, DataTable, EmptyState, Grid, Icon, KeyValue, Page, Section, SimChip, StatusPill, TextArea, TextField, Timeline } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { REVIEW_CRITERIA, autoCriteria, defaultCoversFrom, programmeCoverage, type UaWorld } from './alignment';
import { Anchors, CoverageBlock, CriteriaList, ProgrammeEditor, UaStatusPill, useNames, useUaWorld } from './ua';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function ProgrammePage() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const { id = '' } = useParams();
  const w = useUaWorld();
  const q = useQuery(['programme_alignments', 'programme_graduates'], async () => {
    const [p, grads] = await Promise.all([repo.get('programme_alignments', id), repo.list('programme_graduates', { filter: { programme_id: id } })]);
    return { p: p as Row | null, grads: grads as Row[] };
  }, [id]);
  return (
    <Page title={q.data?.p ? pick(q.data.p, 'title') : t('m10.routes.university-programme.title')} eyebrow={t('m10.ua.detail.eyebrow')} intro={t('m10.ua.detail.intro')} wide
      actions={<L to="/training/university-programmes" className="btn-outline btn-sm"><Icon name="back" className="rtl:-scale-x-100" />{t('m10.ua.detail.back')}</L>}>
      <BenchmarkChips feature="FS66" />
      <Async state={{ ...q, data: q.data && w.data ? { ...q.data, w: w.data } : undefined, loading: q.loading || w.loading, error: q.error ?? w.error }}>
        {(d) => (d.p ? <Detail p={d.p} grads={d.grads} w={d.w} /> : <EmptyState title={t('m10.ua.detail.notFound')}>{t('m10.ua.detail.notFoundBody')}</EmptyState>)}
      </Async>
    </Page>
  );
}

function Detail({ p, grads, w }: { p: Row; grads: Row[]; w: UaWorld }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const n = useNames(w);
  const who = useSession().identity;
  const cov = programmeCoverage(p, w);
  const auto = autoCriteria(p, w);
  const [edit, setEdit] = useState(false);
  const owner = (can(who, 'ecosystem', ['OrgW']) && who.orgId === p.university_org_id) || can(who, 'partner_org', ['A']);
  const reviewer = can(who, 'frameworks', ['A']);
  return (
    <div className="space-y-5">
      <Callout tone="sim" title={t('m10.ua.sampleTitle')}>{t('m10.ua.sampleBody')}</Callout>
      <Grid cols={2}>
        <Card title={n.org(p.university_org_id)} eyebrow={t(`m10.ua.degree.${p.degree}`)} actions={<UaStatusPill row={p} />}>
          <KeyValue items={[
            [t('m10.ua.code'), <span key="c" className="num">{p.code}</span>],
            [t('m10.ua.field'), pick(p, 'field') || '—'],
            [t('m10.ua.nqf'), p.nqf_level ? t('m10.ua.nqfValue', { n: f.num(p.nqf_level) }) : '—'],
            [t('m10.ua.version'), f.num(p.version)],
            [t('m10.ua.placement'), p.placement ? t('common.yes') : t('common.no')],
            [t('m10.ua.accreditation'), p.accreditation_ref || '—'],
            [t('m10.ua.window'), p.status === 'endorsed' ? t('m10.ua.windowValue', { from: f.date(p.covers_from), to: f.date(p.valid_to) }) : '—'],
            [t('m10.ua.roles'), (p.target_role_ids ?? []).map((r: string) => n.role(r)).join(' · ')],
          ]} />
          {pick(p, 'summary') && <p className="mt-3 text-[13px] text-ink-2">{pick(p, 'summary')}</p>}
          <p className="mt-2 text-[12px] text-ink-3">{t('m10.ua.nqfNote')}</p>
          {owner && p.status !== 'submitted' && <button type="button" className="btn-outline btn-sm mt-3" onClick={() => setEdit(true)} data-testid="m10-ua-detail-edit">{p.status === 'endorsed' ? t('m10.ua.ws.revise') : t('m10.ua.ws.edit')}</button>}
        </Card>
        <Card title={t('m10.ua.detail.coverage')}>
          <CoverageBlock cov={cov} w={w} />
        </Card>
      </Grid>
      <Section title={t('m10.ua.detail.skills')} description={t('m10.ua.detail.skillsBody')}>
        <div data-testid="m10-ua-skills">
          <DataTable rows={(p.skills ?? []) as Row[]} rowKey={(s) => s.skill_id} searchable={false} columns={[
            { key: 'skill', header: t('m10.ua.ed.skill'), value: (s) => n.skill(s.skill_id), sortable: true },
            { key: 'level', header: t('m10.ua.ed.level'), value: (s) => s.level, align: 'end', render: (s) => <span className="num">{f.num(s.level)}</span> },
            { key: 'modules', header: t('m10.ua.ed.modules'), value: (s) => (s.modules ?? []).join('; ') },
            { key: 'anchors', header: t('m10.ua.detail.anchors'), value: () => '', csv: false, render: (s) => <Anchors skillId={s.skill_id} w={w} /> },
          ]} />
        </div>
      </Section>
      <Grid cols={2}>
        <Card title={t('m10.ua.detail.endorsement')}>
          <CriteriaList auto={auto} review={p.status === 'endorsed' ? p.criteria : undefined} />
          {p.decision_note && <p className="mt-3 rounded-card border border-line bg-sunken p-2 text-[13px]">{t('m10.ua.detail.decisionNote')}: {p.decision_note}</p>}
          {reviewer && p.status === 'submitted' && <EndorsePanel p={p} me={who.personId} />}
          {!reviewer && p.status === 'submitted' && <p className="mt-3 text-[12.5px] text-ink-3">{t('m10.ua.detail.waiting')}</p>}
        </Card>
        <Card title={t('m10.ua.detail.history')}>
          <Timeline items={((p.history ?? []) as Row[]).slice().reverse().map((h, i) => ({ id: String(i), when: f.dateTime(h.at), title: t(`m10.ua.hist.${h.action}`, { v: f.num(h.version) }), tone: h.action === 'endorsed' ? 'ok' : h.action === 'returned' ? 'bad' : 'accent' }))} />
        </Card>
      </Grid>
      {grads.length > 0 && (
        <Section title={t('m10.ua.detail.graduates')} description={t('m10.ua.detail.graduatesBody')}>
          <div data-testid="m10-ua-graduates">
            <DataTable rows={grads} rowKey={(g) => g.id} searchable={false} columns={[
              { key: 'person', header: t('m10.ua.gh.person'), value: (g) => g.person_id, render: (g) => <span className="num">{g.person_id}</span> },
              { key: 'grad', header: t('m10.ua.gh.graduated'), value: (g) => g.graduated_on, render: (g) => f.date(g.graduated_on) },
              { key: 'status', header: t('m10.ua.reg.fStatus'), value: (g) => g.status, render: (g) => <StatusPill tone={g.status === 'evidence_written' ? 'ok' : g.status === 'not_covered' ? 'neutral' : 'info'}>{t(`m10.ua.gh.st.${g.status}`)}</StatusPill> },
              { key: 'ev', header: t('m10.ua.gh.evidence'), value: (g) => (g.evidence_ids ?? []).length, align: 'end' },
            ]} />
          </div>
        </Section>
      )}
      <p className="text-[12px] text-ink-3"><SimChip label={t('m10.ua.sampleChip')} /> {t('m10.ua.notAuthority')}</p>
      {edit && <ProgrammeEditor open onClose={() => setEdit(false)} row={p} org={p.university_org_id} w={w} />}
    </div>
  );
}

function EndorsePanel({ p, me }: { p: Row; me: string | null }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const [crit, setCrit] = useState<Record<string, boolean>>({ assessment: false, placement: false, accreditation: false });
  const [covers, setCovers] = useState(defaultCoversFrom(today));
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState<'endorse' | 'return' | null>(null);
  if (p.submitted_by === me) return <p className="mt-3 text-[12.5px] text-ink-3" data-testid="m10-ua-own-submission">{t('m10.ua.detail.ownSubmission')}</p>;
  const noteOk = note.trim().length >= 10 && note.trim().length <= 500;
  const all = REVIEW_CRITERIA.every((k) => crit[k]);
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-3" data-testid="m10-ua-endorse-panel">
      {REVIEW_CRITERIA.map((k) => <CheckboxField key={k} label={t(`m10.ua.crit.${k}`)} checked={crit[k]} onChange={(v) => setCrit({ ...crit, [k]: v })} />)}
      <TextField label={t('m10.ua.detail.coversFrom')} name="covers" type="date" value={covers} onChange={setCovers} hint={t('m10.ua.detail.coversHint')} />
      <TextArea label={t('m10.ua.detail.note')} name="note" value={note} onChange={setNote} rows={3} hint={t('m10.ua.detail.noteHint')} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm" disabled={!noteOk || !all} onClick={() => setAsk('endorse')} data-testid="m10-ua-endorse">{t('m10.ua.detail.endorse')}</button>
        <button type="button" className="btn-outline btn-sm" disabled={!noteOk} onClick={() => setAsk('return')} data-testid="m10-ua-return">{t('m10.ua.detail.return')}</button>
      </div>
      <ConfirmDialog open={!!ask} onClose={() => setAsk(null)} title={ask === 'endorse' ? t('m10.ua.detail.endorse') : t('m10.ua.detail.return')}
        consequence={ask === 'endorse' ? t('m10.ua.detail.endorseConsequence') : t('m10.ua.detail.returnConsequence')} confirmLabel={ask === 'endorse' ? t('m10.ua.detail.endorse') : t('m10.ua.detail.return')}
        onConfirm={async () => { await run(() => repo.rpc.endorseProgramme(p.id, { decision: ask, note, criteria: crit, covers_from: covers || null })); setAsk(null); }} />
    </div>
  );
}
