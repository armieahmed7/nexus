// FS29 /my/recognition · My recognition of prior learning: my requests (every state), "start a request" (a skill at a level or a current
// micro-credential, with my narrative; checked live with the same checkOpen rule the backend runs) and the attestations other people
// asked me to give (?tab=attest). Kafa'a is not a licensing or regulatory authority: the notice is on the page.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Async, Callout, Card, DataTable, Drawer, EmptyState, Page, RadioGroup, Section, SelectField, StatTile, Tabs, TextArea, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, useNav, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { OPEN_STATUSES, checkAttest, checkOpen } from './rpl';
import { Bench, EvidenceItem, NotAuthority, OutcomePill, ReqStatus, levelName, useCredits, type Row } from './ui';

export default function MyRecognitionPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const [sp, setSp] = useSearchParams();
  const q = useQuery(['rpl_requests', 'rpl_evidence', 'skills', 'person_skills', 'credit_ledger'], async () => {
    const [reqs, attests, skills, defs, mine, awards, ranges, ledger] = await Promise.all([
      repo.list('rpl_requests', { order: [['created_at', 'desc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('rpl_evidence', { filter: { attester_id: me ?? '' } }).catch(() => []) as Promise<Row[]>,
      repo.list('skills', { order: [['sort', 'asc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('microcred_defs', { filter: { status: 'current' } }).catch(() => []) as Promise<Row[]>,
      repo.list('person_skills', { filter: { person_id: me ?? '' } }).catch(() => []) as Promise<Row[]>,
      repo.list('microcred_awards', { filter: { person_id: me ?? '' } }).catch(() => []) as Promise<Row[]>,
      repo.list('skill_level_ranges', {}).catch(() => []) as Promise<Row[]>,
      repo.list('credit_ledger', { filter: { person_id: me ?? '' } }).catch(() => []) as Promise<Row[]>,
    ]);
    return { reqs: reqs.filter((r) => r.person_id === me || r.opened_by === me), attests, skills, defs, mine, awards, ranges, ledger };
  }, [me]);
  const tab = sp.get('tab') === 'attest' ? 'attest' : 'requests';
  return (
    <Page title={t('m34.routes.my-recognition.title')} eyebrow={t('m34.my.eyebrow')} intro={t('m34.my.intro')} wide
      actions={<><L to="/recognition" className="btn-outline">{t('m34.my.how')}</L><L to="/my/recognition/certificates" className="btn-outline" data-testid="m34-to-certs">{t('m34.xc.toCerts')}</L><L to="/my/learning-balance" className="btn-outline">{t('m34.sb.toBalance')}</L></>}>
      <Bench />
      <NotAuthority />
      <Async state={q}>{(d) => (
        <Tabs value={tab} onChange={(id) => setSp(id === 'attest' ? { tab: 'attest' } : {}, { replace: true })} tabs={[
          { id: 'requests', label: t('m34.my.tabRequests'), content: <Requests d={d} me={me ?? ''} /> },
          { id: 'attest', label: t('m34.my.tabAttest'), badge: d.attests.filter((e) => e.attestation_status === 'requested').length || undefined, content: <Attestations rows={d.attests} /> },
        ]} />
      )}</Async>
    </Page>
  );
}

type D = { reqs: Row[]; attests: Row[]; skills: Row[]; defs: Row[]; mine: Row[]; awards: Row[]; ranges: Row[]; ledger: Row[] };

function Requests({ d, me }: { d: D; me: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const credits = useCredits();
  const [start, setStart] = useState(false);
  const open = d.reqs.filter((r) => OPEN_STATUSES.includes(r.status));
  const decided = d.reqs.filter((r) => r.status === 'decided');
  const rplHours = d.ledger.filter((r) => r.item_kind === 'rpl' && r.status === 'counted').reduce((a, r) => a + Number(r.notional_hours), 0);
  const cols: Column<Row>[] = [
    { key: 'target', header: t('m34.my.colTarget'), value: (r) => pick(r, 'target_title'), sortable: true, render: (r) => <L to={`/my/recognition/rpl/${r.id}`} className="font-semibold text-accent hover:underline">{pick(r, 'target_title')}</L> },
    { key: 'kind', header: t('m34.my.colKind'), value: (r) => t(`m34.target.${r.target_kind}`) },
    { key: 'level', header: t('m34.my.colLevel'), value: (r) => r.level ?? '', render: (r) => (r.level ? f.num(r.level) : '—') },
    { key: 'status', header: t('m34.my.colStatus'), value: (r) => r.status, render: (r) => <span className="flex flex-wrap gap-1"><ReqStatus status={r.status} />{r.status === 'decided' && <OutcomePill outcome={r.outcome} />}</span> },
    { key: 'updated', header: t('m34.my.colUpdated'), value: (r) => String(r.updated_at ?? ''), sortable: true, render: (r) => f.date(String(r.updated_at).slice(0, 10)) },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m34-my-tiles">
        <StatTile label={t('m34.my.tOpen')} value={f.num(open.length)} sub={t('m34.my.tOpenSub')} tone="info" />
        <StatTile label={t('m34.my.tDecided')} value={f.num(decided.length)} sub={t('m34.my.tDecidedSub', { n: f.num(decided.filter((r) => r.outcome !== 'not_yet').length) })} tone="ok" />
        <StatTile label={t('m34.my.tCredits')} value={credits(rplHours)} sub={t('m34.my.tCreditsSub')} />
        <StatTile label={t('m34.my.tAttest')} value={f.num(d.attests.filter((e) => e.attestation_status === 'requested').length)} sub={t('m34.my.tAttestSub')} />
      </div>
      <Section title={t('m34.my.listTitle')} description={t('m34.my.listDesc')} actions={<button type="button" className="btn-primary" onClick={() => setStart(true)} data-testid="m34-start">{t('m34.my.start')}</button>}>
        {d.reqs.length === 0 ? <EmptyState title={t('m34.my.empty')}>{t('m34.my.emptyBody')}</EmptyState> : (
          <div data-testid="m34-my-requests"><DataTable rows={d.reqs} columns={cols} rowKey={(r) => r.id} pageSize={10} caption={t('m34.my.listTitle')} csvName="kafaa-my-rpl.csv" /></div>
        )}
      </Section>
      <Card title={t('m34.my.creditsTitle')}><p className="text-[13px] text-ink-2">{t('m34.my.creditsBody')}</p><L to="/my/credits" className="btn-outline btn-sm mt-2 inline-flex">{t('m34.my.creditsLink')}</L></Card>
      {start && <StartDrawer d={d} me={me} onClose={() => setStart(false)} />}
    </div>
  );
}

function StartDrawer({ d, me, onClose }: { d: D; me: string; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const nav = useNav();
  const s = useSession();
  const [kind, setKind] = useState<'skill' | 'credential'>('skill');
  const [skill, setSkill] = useState('');
  const [def, setDef] = useState('');
  const [level, setLevel] = useState('2');
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const skills = d.skills.filter((k) => k.area !== 'security' && k.fs_area !== 'cyber_hygiene' && k.lifecycle !== 'obsolete');
  const sk = d.skills.find((k) => k.id === skill);
  const df = d.defs.find((x) => x.id === def);
  const range = d.ranges.find((x) => x.skill_id === skill);
  const input = { target_kind: kind, skill_id: skill || undefined, microcred_def_id: def || undefined, level: Number(level), narrative_en: en, narrative_ar: ar };
  const cur = d.mine.find((p) => p.skill_id === skill && p.active !== false);
  const check = useMemo(() => checkOpen(input, {
    me, assessor: false, own: s.can('recognition', ['Own']), person: { id: me, kind: 'staff', status: 'active' },
    skill: sk ? { id: sk.id, area: sk.area, fs_area: sk.fs_area, lifecycle: sk.lifecycle } : null, range: range ? { min_level: range.min_level, max_level: range.max_level } : null,
    def: df ? { id: df.id, status: df.status, restricted: false } : null,
    held: kind === 'skill' ? !!cur && Number(cur.level) >= Number(level) && ['verified', 'evidenced'].includes(cur.basis) : d.awards.some((a) => a.def_id === def && a.status === 'awarded'),
    open: d.reqs.some((r) => r.person_id === me && OPEN_STATUSES.includes(r.status) && (kind === 'skill' ? r.skill_id === skill : r.microcred_def_id === def)),
  }), [input, me, sk, df, range, cur, kind, level, d, def, skill, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const levels = [1, 2, 3, 4].filter((l) => !range || (l >= range.min_level && l <= range.max_level));
  return (
    <Drawer open onClose={onClose} title={t('m34.start.title')}>
      <div className="space-y-3" data-testid="m34-start-drawer">
        <p className="text-[13px] text-ink-2">{t('m34.start.body')}</p>
        <RadioGroup label={t('m34.start.kind')} name="kind" value={kind} onChange={(v) => setKind(v as 'skill' | 'credential')} options={[{ value: 'skill', label: t('m34.target.skill') }, { value: 'credential', label: t('m34.target.credential') }]} />
        {kind === 'skill' ? (
          <>
            <SelectField name="skill" label={t('m34.start.skill')} value={skill} onChange={setSkill} placeholder={t('m34.start.pickSkill')} options={skills.map((k) => ({ value: k.id, label: pick(k, 'name') }))} />
            {cur && <p className="text-[12px] text-ink-3">{t('m34.start.current', { n: f.num(cur.level), basis: t(`common.skills.basis.${cur.basis}`) })}</p>}
            <SelectField name="level" label={t('m34.start.level')} value={level} onChange={setLevel} options={levels.map((l) => ({ value: String(l), label: t('m34.ui.levelN', { n: f.num(l), name: levelName(lang, l) }) }))} />
          </>
        ) : (
          <SelectField name="def" label={t('m34.start.credential')} value={def} onChange={setDef} placeholder={t('m34.start.pickCredential')} options={d.defs.map((x) => ({ value: x.id, label: pick(x, 'title') }))} />
        )}
        <TextArea name="en" label={t('m34.start.narrativeEn')} rows={4} value={en} onChange={setEn} />
        <div dir="rtl" lang="ar"><TextArea name="ar" label={t('m34.start.narrativeAr')} rows={3} value={ar} onChange={setAr} /></div>
        <div aria-live="polite" data-testid="m34-start-check">
          {check === 'ok' ? <Callout tone="ok" title={t('m34.start.okTitle')}>{t('m34.start.okBody')}</Callout> : <Callout tone="bad" title={t('m34.start.failTitle')}>{t(`m34.msg.${check}`)}</Callout>}
        </div>
        <button type="button" className="btn-primary" disabled={check !== 'ok'} data-testid="m34-start-send"
          onClick={async () => { const x = await act(() => repo.rpc.submitRpl({ action: 'open', ...input } as never)); if (x.ok && x.data) { onClose(); nav(`/my/recognition/rpl/${x.data.id}`); } }}>{t('m34.start.send')}</button>
      </div>
    </Drawer>
  );
}

function Attestations({ rows }: { rows: Row[] }) {
  const t = useT();
  const pick = usePick();
  if (!rows.length) return <EmptyState title={t('m34.att.empty')}>{t('m34.att.emptyBody')}</EmptyState>;
  return (
    <ul className="space-y-3" data-testid="m34-attestations">
      {rows.map((e) => (
        <li key={e.id} className="space-y-2">
          <p className="text-[13px] text-ink-2">{t('m34.att.for', { name: pick({ n_en: e.requester_name, n_ar: e.requester_name_ar }, 'n'), target: pick(e, 'target_title') })}</p>
          <EvidenceItem e={e} target={[]} actions={e.attestation_status === 'requested' ? <AttestForm e={e} /> : undefined} />
        </li>
      ))}
    </ul>
  );
}

function AttestForm({ e }: { e: Row }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const [open, setOpen] = useState<'confirm' | 'decline' | null>(null);
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const input = { evidence_id: e.id, confirm: open === 'confirm', text_en: en, text_ar: ar };
  const c = checkAttest(input, { kind: e.kind, attester_id: e.attester_id, attestation_status: e.attestation_status, active: e.active }, 'submitted', s.identity.personId ?? '');
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-primary btn-sm" onClick={() => setOpen('confirm')} data-testid={`m34-attest-confirm-${e.id}`}>{t('m34.att.confirm')}</button>
      <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen('decline')}>{t('m34.att.decline')}</button>
      {open && (
        <Drawer open onClose={() => setOpen(null)} title={t(open === 'confirm' ? 'm34.att.confirmTitle' : 'm34.att.declineTitle')}>
          <div className="space-y-3">
            <p className="text-[13px] text-ink-2">{t(open === 'confirm' ? 'm34.att.confirmBody' : 'm34.att.declineBody')}</p>
            <TextArea name="en" label={t(open === 'confirm' ? 'm34.att.textEn' : 'm34.att.reason')} rows={4} value={en} onChange={setEn} />
            {open === 'confirm' && <div dir="rtl" lang="ar"><TextArea name="ar" label={t('m34.att.textAr')} rows={3} value={ar} onChange={setAr} /></div>}
            {c !== 'ok' && <p className="text-[12px] text-ink-3">{t(`m34.msg.${c}`)}</p>}
            <button type="button" className="btn-primary" disabled={c !== 'ok'} data-testid="m34-attest-save"
              onClick={async () => { const x = await act(() => repo.rpc.attestRpl(input)); if (x.ok) setOpen(null); }}>{t('m34.att.save')}</button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
