// FS29 /recognition/review · RPL assessor queue (recognition A: instructors, the training manager, the HR director; R: auditors).
// To recommend (submitted), to confirm (recommended by someone else: maker-checker), decided, all. Assessors also open a request on
// behalf of a contractor (F33), who has no Kafa'a grant; the contractor then reads their own request. Kafa'a is not an authority.
import { useMemo, useState } from 'react';
import { Async, Callout, DataTable, Drawer, EmptyState, Page, Section, SelectField, StatTile, Tabs, TextArea, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, useNav, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { OPEN_STATUSES, checkOpen } from './rpl';
import { Bench, NotAuthority, OutcomePill, ReqStatus, levelName, useCredits, type Row } from './ui';

export default function RplQueuePage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['rpl_requests', 'rpl_evidence'], async () => {
    const [reqs, ev] = await Promise.all([
      repo.list('rpl_requests', { order: [['updated_at', 'desc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('rpl_evidence', {}).catch(() => []) as Promise<Row[]>,
    ]);
    return { reqs, ev };
  }, []);
  return (
    <Page title={t('m34.routes.rpl-queue.title')} eyebrow={t('m34.queue.eyebrow')} intro={t('m34.queue.intro')} wide>
      <Bench />
      <NotAuthority />
      <Async state={q}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

function Body({ d }: { d: { reqs: Row[]; ev: Row[] } }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const credits = useCredits();
  const s = useSession();
  const me = s.identity.personId;
  const assessor = s.can('recognition', ['A']);
  const [behalf, setBehalf] = useState(false);
  const toRecommend = d.reqs.filter((r) => r.status === 'submitted');
  const toConfirm = d.reqs.filter((r) => r.status === 'recommended');
  const decided = d.reqs.filter((r) => r.status === 'decided');
  const items = (id: string) => d.ev.filter((e) => e.request_id === id && e.active).length;
  const cols = (extra?: Column<Row>): Column<Row>[] => [
    { key: 'person', header: t('m34.queue.colPerson'), value: (r) => pick({ n_en: r.person_name, n_ar: r.person_name_ar }, 'n'), sortable: true,
      render: (r) => <span>{pick({ n_en: r.person_name, n_ar: r.person_name_ar }, 'n')}{r.person_kind === 'contractor' && <span className="ms-1 text-[12px] text-ink-3">({t('m34.ui.contractor')})</span>}</span> },
    { key: 'target', header: t('m34.queue.colTarget'), value: (r) => pick(r, 'target_title'), sortable: true, render: (r) => <L to={`/recognition/review/${r.id}`} className="font-semibold text-accent hover:underline">{pick(r, 'target_title')}</L> },
    { key: 'level', header: t('m34.my.colLevel'), value: (r) => r.level ?? '', render: (r) => (r.level ? f.num(r.level) : t('m34.target.credential')) },
    { key: 'items', header: t('m34.queue.colItems'), value: (r) => items(r.id), render: (r) => f.num(items(r.id)) },
    { key: 'status', header: t('m34.my.colStatus'), value: (r) => r.status, render: (r) => <span className="flex flex-wrap gap-1"><ReqStatus status={r.status} /><OutcomePill outcome={r.outcome} /></span> },
    ...(extra ? [extra] : []),
  ];
  const mcCol: Column<Row> = { key: 'mc', header: t('m34.queue.colMc'), value: (r) => (r.recommended_by === me ? 'mine' : ''), render: (r) => (r.recommended_by === me ? <span className="text-[12px] text-sim">{t('m34.queue.yours')}</span> : <span className="text-[12px] text-ok">{t('m34.queue.canConfirm')}</span>) };
  const decCol: Column<Row> = { key: 'credits', header: t('m34.decision.credits'), value: (r) => Number(r.hours ?? 0), render: (r) => <span className="num">{credits(r.hours)}</span> };
  const table = (rows: Row[], extra?: Column<Row>, empty = t('m34.queue.empty')) => (rows.length === 0 ? <EmptyState title={empty} /> : <DataTable rows={rows} columns={cols(extra)} rowKey={(r) => r.id} pageSize={10} caption={t('m34.routes.rpl-queue.title')} csvName="kafaa-rpl-queue.csv" />);
  const full = decided.filter((r) => r.outcome === 'full').length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m34-queue-tiles">
        <StatTile label={t('m34.queue.tRecommend')} value={f.num(toRecommend.length)} sub={t('m34.queue.tRecommendSub')} tone="info" />
        <StatTile label={t('m34.queue.tConfirm')} value={f.num(toConfirm.length)} sub={t('m34.queue.tConfirmSub')} tone="sim" />
        <StatTile label={t('m34.queue.tDecided')} value={f.num(decided.length)} sub={t('m34.queue.tDecidedSub', { full: f.num(full), partial: f.num(decided.filter((r) => r.outcome === 'partial').length), notyet: f.num(decided.filter((r) => r.outcome === 'not_yet').length) })} tone="ok" />
        <StatTile label={t('m34.queue.tCredits')} value={credits(decided.reduce((a, r) => a + Number(r.hours ?? 0), 0))} sub={t('m34.queue.tCreditsSub')} />
      </div>
      <Callout tone="info" title={t('m34.queue.mcTitle')}>{t('m34.queue.mcBody')}</Callout>
      <Section title={t('m34.queue.listTitle')} actions={assessor ? <button type="button" className="btn-outline" onClick={() => setBehalf(true)} data-testid="m34-behalf">{t('m34.queue.behalf')}</button> : undefined}>
        <div data-testid="m34-queue">
          <Tabs tabs={[
            { id: 'recommend', label: t('m34.queue.tabRecommend'), badge: toRecommend.length || undefined, content: table(toRecommend) },
            { id: 'confirm', label: t('m34.queue.tabConfirm'), badge: toConfirm.length || undefined, content: table(toConfirm, mcCol) },
            { id: 'decided', label: t('m34.queue.tabDecided'), content: table(decided, decCol) },
            { id: 'all', label: t('m34.queue.tabAll'), content: table(d.reqs) },
          ]} />
        </div>
      </Section>
      {behalf && <BehalfDrawer reqs={d.reqs} onClose={() => setBehalf(false)} />}
    </div>
  );
}

function BehalfDrawer({ reqs, onClose }: { reqs: Row[]; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const nav = useNav();
  const s = useSession();
  const me = s.identity.personId ?? '';
  const q = useQuery(['people', 'skills'], async () => {
    const [people, skills, ranges, states] = await Promise.all([
      repo.list('people', { filter: { kind: 'contractor', status: 'active' } }).catch(() => []) as Promise<Row[]>,
      repo.list('skills', { order: [['sort', 'asc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('skill_level_ranges', {}).catch(() => []) as Promise<Row[]>,
      repo.list('person_skills', { filter: { contractor: true } }).catch(() => []) as Promise<Row[]>,
    ]);
    return { people, skills: skills.filter((k) => k.area !== 'security' && k.fs_area !== 'cyber_hygiene' && k.lifecycle !== 'obsolete'), ranges, states };
  }, []);
  const [pid, setPid] = useState('');
  const [skill, setSkill] = useState('');
  const [level, setLevel] = useState('2');
  const [en, setEn] = useState('');
  const input = { person_id: pid, target_kind: 'skill', skill_id: skill, level: Number(level), narrative_en: en };
  const check = useMemo(() => {
    const d = q.data;
    if (!d) return 'person';
    const p = d.people.find((x) => x.id === pid);
    const sk = d.skills.find((x) => x.id === skill);
    const rg = d.ranges.find((x) => x.skill_id === skill);
    const cur = d.states.find((x) => x.person_id === pid && x.skill_id === skill && x.active !== false);
    return checkOpen(input, {
      me, assessor: s.can('recognition', ['A']), own: s.can('recognition', ['Own']), person: p ? { id: p.id, kind: p.kind, status: p.status } : null,
      skill: sk ? { id: sk.id, area: sk.area, fs_area: sk.fs_area, lifecycle: sk.lifecycle } : null, range: rg ? { min_level: rg.min_level, max_level: rg.max_level } : null, def: null,
      held: !!cur && Number(cur.level) >= Number(level) && ['verified', 'evidenced'].includes(cur.basis),
      open: reqs.some((r) => r.person_id === pid && OPEN_STATUSES.includes(r.status) && r.skill_id === skill),
    });
  }, [q.data, pid, skill, level, en, me, s, reqs]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Drawer open onClose={onClose} title={t('m34.behalf.title')}>
      <Async state={q}>{(d) => (
        <div className="space-y-3" data-testid="m34-behalf-drawer">
          <p className="text-[13px] text-ink-2">{t('m34.behalf.body')}</p>
          <SelectField name="person" label={t('m34.behalf.person')} value={pid} onChange={setPid} placeholder={t('m34.behalf.pick')} options={d.people.map((p) => ({ value: p.id, label: pick({ n_en: p.display_name, n_ar: p.display_name_ar }, 'n') }))} />
          <SelectField name="skill" label={t('m34.start.skill')} value={skill} onChange={setSkill} placeholder={t('m34.start.pickSkill')} options={d.skills.map((k) => ({ value: k.id, label: pick(k, 'name') }))} />
          <SelectField name="level" label={t('m34.start.level')} value={level} onChange={setLevel} options={[1, 2, 3, 4].map((l) => ({ value: String(l), label: t('m34.ui.levelN', { n: f.num(l), name: levelName(lang, l) }) }))} />
          <TextArea name="en" label={t('m34.behalf.narrative')} rows={3} value={en} onChange={setEn} />
          {check !== 'ok' ? <Callout tone="bad" title={t('m34.start.failTitle')}>{t(`m34.msg.${check}`)}</Callout> : <Callout tone="ok" title={t('m34.start.okTitle')}>{t('m34.behalf.ok')}</Callout>}
          <button type="button" className="btn-primary" disabled={check !== 'ok'} data-testid="m34-behalf-send"
            onClick={async () => { const x = await act(() => repo.rpc.submitRpl({ action: 'open', ...input } as never)); if (x.ok && x.data) { onClose(); nav(`/my/recognition/rpl/${x.data.id}`); } }}>{t('m34.behalf.send')}</button>
        </div>
      )}</Async>
    </Drawer>
  );
}
