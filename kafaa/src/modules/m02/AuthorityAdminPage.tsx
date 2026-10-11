// FS24 /admin/authority · Authority recognitions (recognition R/W/A: assessors, the training manager, the HR director, auditors).
// A recognition above Expert by a panel, never a fifth level, never gamified (no points, no badges) and never a change to the F01
// level. Maker-checker: the training manager (or the HR director) proposes an Expert with a panel and a citation; the HR director,
// who is not the proposer, decides "recognised" (ledger row, 3-year review) or "not yet" (with a note). Expert holders come from
// rpc.authorityCandidates; every action goes through rpc.recogniseAuthority.
import { useMemo, useState } from 'react';
import { Async, BenchmarkChips, Callout, Card, CheckboxField, ConfirmDialog, DataTable, Drawer, EmptyState, FilterBar, Page, Section, StatTile, StatusPill, TextArea, WhyThis, useFilters, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import type { Reason } from '../../domain/engines/types';
import { PANEL_MAX, PANEL_MIN, PANEL_ROLES, authorityReview, checkPropose } from './authority';
import type { AuthorityCandidate } from './backend/rpc';
import type { Row } from './levelsUi';

export default function AuthorityAdminPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['authority_recognitions', 'skills', 'person_skills'], async () => {
    const [recs, skills, cands] = await Promise.all([
      repo.list('authority_recognitions', { order: [['proposed_on', 'desc']] }) as Promise<Row[]>,
      repo.list('skills', { order: [['sort', 'asc']] }) as Promise<Row[]>,
      repo.rpc.authorityCandidates(),
    ]);
    return { recs, skills, cands, skill: new Map(skills.map((s) => [s.id, s])) };
  }, []);
  return (
    <Page title={t('m02.routes.admin-authority.title')} eyebrow={t('m02.au.eyebrow')} intro={t('m02.au.intro')} wide>
      <div data-testid="m02-bench-fs24"><BenchmarkChips feature="FS24" /></div>
      <Async state={q}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

type D = { recs: Row[]; skills: Row[]; cands: AuthorityCandidate[]; skill: Map<string, Row> };

function Body({ d }: { d: D }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const me = s.identity.personId;
  const isDecider = s.hasRole('hr_director') && s.can('recognition', ['A']);
  const canPropose = s.can('recognition', ['A']) && (s.hasRole('hr_director') || s.hasRole('training_manager'));
  const [decide, setDecide] = useState<{ row: Row; action: 'approve' | 'not_yet' | 'withdraw' } | null>(null);
  const [propose, setPropose] = useState<AuthorityCandidate | null>(null);
  const [flt, setFlt] = useFilters({ q: '', skill: '', status: '' }, true);
  const today = todayIso();
  const open = d.recs.filter((r) => r.status === 'proposed');
  const recognised = d.recs.filter((r) => r.status === 'recognised');
  const sName = (id: string) => pick(d.skill.get(id), 'name');
  const term = flt.q.trim().toLowerCase();
  const cands = d.cands.filter((c) => (!flt.skill || c.skill_id === flt.skill) && (!flt.status || (flt.status === 'none' ? !c.recognition_status : c.recognition_status === flt.status))
    && (!term || `${c.name_en} ${c.name_ar} ${sName(c.skill_id)}`.toLowerCase().includes(term)));
  const candCols: Column<AuthorityCandidate>[] = [
    { key: 'person', header: t('m02.au.colPerson'), value: (c) => pick({ n_en: c.name_en, n_ar: c.name_ar } as Row, 'n'), sortable: true },
    { key: 'skill', header: t('m02.au.colSkill'), value: (c) => sName(c.skill_id), sortable: true },
    { key: 'basis', header: t('m02.au.colBasis'), value: (c) => c.basis, render: (c) => <span>{t(`common.skills.basis.${c.basis || 'none'}`)} <span className="num text-ink-3">{f.pct(c.confidence * 100, 0)}</span></span> },
    { key: 'state', header: t('m02.au.colState'), value: (c) => c.recognition_status ?? '', render: (c) => (c.recognition_status ? <StatusPill tone={c.recognition_status === 'recognised' ? 'ok' : c.recognition_status === 'proposed' ? 'info' : 'neutral'}>{t(`m02.au.status.${c.recognition_status}`)}</StatusPill> : <span className="text-ink-3">—</span>) },
    { key: 'act', header: '', csv: false, render: (c) => {
      const why: Reason[] = [{ code: 'expert', key: 'm02.au.why.expert', vars: { basis: { en: c.basis, ar: c.basis } } }, { code: 'panel', key: 'm02.au.why.panel' }, { code: 'level', key: 'm02.au.why.level' }];
      const blocked = c.recognition_status === 'proposed' || c.recognition_status === 'recognised' || c.person_id === me;
      return <span className="flex items-center gap-1"><WhyThis reasons={why} testId={`m02-au-why-${c.person_id}-${c.skill_id}`} />{canPropose && <button type="button" className="btn-outline btn-sm" disabled={blocked} onClick={() => setPropose(c)} data-testid={`m02-au-propose-${c.person_id}-${c.skill_id}`}>{t('m02.au.propose')}</button>}</span>;
    } },
  ];
  return (
    <>
      <Callout tone="info" title={t('m02.au.neverTitle')}>{t('m02.au.neverBody')}</Callout>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m02-au-tiles">
        <StatTile label={t('m02.au.tRecognised')} value={f.num(recognised.length)} sub={t('m02.au.tRecognisedSub')} tone="ok" />
        <StatTile label={t('m02.au.tOpen')} value={f.num(open.length)} sub={t('m02.au.tOpenSub')} tone="info" />
        <StatTile label={t('m02.au.tNotYet')} value={f.num(d.recs.filter((r) => r.status === 'not_yet').length)} sub={t('m02.au.tNotYetSub')} />
        <StatTile label={t('m02.au.tExperts')} value={f.num(d.cands.length)} sub={t('m02.au.tExpertsSub')} />
      </div>

      <Section title={t('m02.au.queueTitle')} description={t('m02.au.queueDesc')}>
        {open.length === 0 ? <EmptyState title={t('m02.au.queueEmpty')} /> : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m02-au-queue">
            {open.map((r) => {
              const mine = r.proposed_by === me;
              return (
                <Card key={r.id} as="li" title={<span className="flex flex-wrap items-center gap-2">{pick({ n_en: r.person_name, n_ar: r.person_name_ar } as Row, 'n')}<span className="text-[13px] font-normal text-ink-3">· {sName(r.skill_id)}</span></span>}>
                  <p className="text-[13px] text-ink-2">{pick(r, 'citation')}</p>
                  <p className="mt-2 text-[12px] text-ink-3">{t('m02.ml.panel', { seats: (r.panel ?? []).map((x: string) => t(`m02.au.seat.${x}`)).join(' · ') })}</p>
                  <p className="text-[12px] text-ink-3">{t('m02.au.proposedBy', { role: t(`m02.au.seat.${r.proposed_role ?? 'training_manager'}`), date: f.date(String(r.proposed_on).slice(0, 10)) })}</p>
                  {mine && <p className="mt-2 text-[12px] text-sim" data-testid={`m02-au-mc-${r.id}`}>{t('m02.au.makerChecker')}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isDecider && !mine && <button type="button" className="btn-primary btn-sm" onClick={() => setDecide({ row: r, action: 'approve' })} data-testid={`m02-au-approve-${r.id}`}>{t('m02.au.approve')}</button>}
                    {isDecider && !mine && <button type="button" className="btn-outline btn-sm" onClick={() => setDecide({ row: r, action: 'not_yet' })} data-testid={`m02-au-notyet-${r.id}`}>{t('m02.au.notYet')}</button>}
                    {(isDecider || mine) && <button type="button" className="btn-ghost btn-sm" onClick={() => setDecide({ row: r, action: 'withdraw' })}>{t('m02.au.withdraw')}</button>}
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t('m02.au.registerTitle')} description={t('m02.au.registerDesc')}>
        {d.recs.length === 0 ? <EmptyState title={t('m02.au.registerEmpty')} /> : (
          <ul className="space-y-2" data-testid="m02-au-register">
            {d.recs.filter((r) => r.status !== 'proposed').map((r) => {
              const rev = authorityReview(r.review_due, today);
              return (
                <li key={r.id} className="card flex flex-wrap items-center gap-2 p-3 text-[13px]">
                  <span className="font-semibold">{pick({ n_en: r.person_name, n_ar: r.person_name_ar } as Row, 'n')}</span>
                  <span className="text-ink-3">· {sName(r.skill_id)}</span>
                  <StatusPill tone={r.status === 'recognised' ? 'ok' : r.status === 'not_yet' ? 'sim' : 'neutral'}>{t(`m02.au.status.${r.status}`)}</StatusPill>
                  {r.decided_on && <span className="text-ink-3">{t('m02.au.decidedOn', { date: f.date(String(r.decided_on).slice(0, 10)) })}</span>}
                  {r.status === 'recognised' && <span className="text-ink-3">{t('m02.au.reviewOn', { date: f.date(String(r.review_due).slice(0, 10)) })}{rev !== 'ok' && rev !== 'none' && <> · <StatusPill tone="sim">{t('m02.au.reviewDue')}</StatusPill></>}</span>}
                  {r.decision_note && <span className="w-full text-[12px] text-ink-3">{r.decision_note}</span>}
                  {r.status === 'recognised' && isDecider && <button type="button" className="btn-ghost btn-sm ms-auto" onClick={() => setDecide({ row: r, action: 'withdraw' })}>{t('m02.au.withdraw')}</button>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t('m02.au.candTitle')} description={t('m02.au.candDesc')}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'skill', label: t('m02.au.colSkill'), options: [...new Set(d.cands.map((c) => c.skill_id))].map((id) => ({ value: id, label: sName(id) })) },
          { key: 'status', label: t('m02.au.colState'), options: [{ value: 'none', label: t('m02.au.status.none') }, ...['proposed', 'recognised', 'not_yet', 'withdrawn'].map((x) => ({ value: x, label: t(`m02.au.status.${x}`) }))] },
        ]} />
        <div data-testid="m02-au-candidates"><DataTable rows={cands} columns={candCols} rowKey={(c) => `${c.person_id}|${c.skill_id}`} pageSize={15} csvName="kafaa-authority-candidates.csv" caption={t('m02.au.candTitle')} /></div>
      </Section>

      {decide && <DecideDialog row={decide.row} action={decide.action} skillName={sName(decide.row.skill_id)} onClose={() => setDecide(null)} />}
      {propose && <ProposeDrawer c={propose} skill={d.skill.get(propose.skill_id)} me={me ?? ''} onClose={() => setPropose(null)} />}
    </>
  );
}

function DecideDialog({ row, action, skillName, onClose }: { row: Row; action: 'approve' | 'not_yet' | 'withdraw'; skillName: string; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const pick = usePick();
  const name = pick({ n_en: row.person_name, n_ar: row.person_name_ar } as Row, 'n');
  return (
    <ConfirmDialog open onClose={onClose} title={t(`m02.au.dlg.${action}`)} consequence={t(`m02.au.dlgBody.${action}`, { name, skill: skillName })} actingAs={t('m02.au.seat.hr_director')}
      requireReason={action !== 'approve'} reasonLabel={t('m02.au.note')} confirmLabel={t(`m02.au.dlgConfirm.${action}`)} danger={action === 'withdraw'}
      onConfirm={async (note) => { await act(() => repo.rpc.recogniseAuthority({ action, id: row.id, note: note || null })); onClose(); }} />
  );
}

function ProposeDrawer({ c, skill, me, onClose }: { c: AuthorityCandidate; skill: Row; me: string; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const pick = usePick();
  const f = useFormat();
  const [panel, setPanel] = useState<string[]>(['hr_director', 'training_manager', 'skill_owner']);
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const input = { action: 'propose', person_id: c.person_id, skill_id: c.skill_id, panel, citation_en: en, citation_ar: ar };
  const check = useMemo(() => checkPropose(input, { me, person: { id: c.person_id, kind: 'staff', status: 'active' }, skill, level: 4, open: c.recognition_status === 'proposed' || c.recognition_status === 'recognised' }), [input, me, c, skill]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Drawer open onClose={onClose} title={t('m02.au.proposeTitle', { name: pick({ n_en: c.name_en, n_ar: c.name_ar } as Row, 'n'), skill: pick(skill, 'name') })}>
      <div className="space-y-3" data-testid="m02-au-propose">
        <Callout tone="info" title={t('m02.au.eligibleTitle')}>{t('m02.au.eligibleBody', { basis: t(`common.skills.basis.${c.basis || 'none'}`), conf: f.pct(c.confidence * 100, 0) })}</Callout>
        <fieldset>
          <legend className="text-[13px] font-semibold">{t('m02.au.panelLegend', { min: f.num(PANEL_MIN), max: f.num(PANEL_MAX) })}</legend>
          <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {PANEL_ROLES.map((p) => <CheckboxField key={p} label={t(`m02.au.seat.${p}`)} checked={panel.includes(p)} onChange={(v) => setPanel((x) => (v ? [...x, p] : x.filter((y) => y !== p)))} />)}
          </div>
        </fieldset>
        <TextArea name="f1" label={t('m02.au.citationEn')} rows={3} value={en} onChange={setEn} />
        <div dir="rtl" lang="ar"><TextArea name="f2" label={t('m02.au.citationAr')} rows={3} value={ar} onChange={setAr} /></div>
        <div aria-live="polite" data-testid="m02-au-propose-check">
          {check === 'ok' ? <Callout tone="ok" title={t('m02.da.checkOk')}>{t('m02.au.proposeOk')}</Callout> : <Callout tone="bad" title={t('m02.da.checkFail')}>{t(`m02.au.msg.${check}`)}</Callout>}
        </div>
        <button type="button" className="btn-primary" disabled={check !== 'ok'} onClick={() => setConfirm(true)} data-testid="m02-au-propose-send">{t('m02.au.proposeSend')}</button>
        <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m02.au.proposeConfirm')} consequence={t('m02.au.proposeConsequence')}
          onConfirm={async () => { const r = await act(() => repo.rpc.recogniseAuthority(input)); setConfirm(false); if (r.ok) onClose(); }} />
      </div>
    </Drawer>
  );
}
