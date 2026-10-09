// F10 /team/skills/validate: validate skill check-ins (line managers, managers and instructors in scope, training manager)
// and the calibration view. Each skill is validated at the self level, adjusted with a reason, or left "not yet"; the page
// shows the self level, peer answers, the current skill state with its evidence (<WhyThis>) and the independent evidence
// level. Calibration: level distribution per skill for a group (suppressed below 10) and raters who run systematically
// higher or lower than the independent evidence (deterministic mean offset). The person can never validate their own.
import { useMemo, useState } from 'react';
import { Page, Async, Card, Callout, ConfirmDialog, EmptyState, Tabs, TextArea, SelectField, WhyThis, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, useFormat, usePick, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import { skillReasons } from '../../domain/skills';
import type { Reason } from '../../domain/engines/types';
import { securityComps } from './badgeRules';
import { BasisChip, Stat } from './ui';
import { checkinBlock, evidenceLevels, isOverdue, stateKey, OFFSET, type CheckinSkill } from './checkins';
import { CheckinStatus, LevelDots, LevelPicker, OutcomePill, PersonName, RaterFlag, useCatalogue, useGroupLabel, useName, useSkillName, type Catalogue } from './ciUi';
import type { CheckinCalibration } from './backend/rpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function ValidatePage() {
  const t = useT();
  const s = useSession();
  const me = s.identity.personId;
  const repo = useRepo();
  const cat = useCatalogue();
  const q = useQuery(['skill_checkins', 'skill_ratings', 'person_skills', 'skill_evidence', 'people'], async () => {
    const [checkins, ratings, people] = await Promise.all([
      repo.list('skill_checkins', { order: [['requested_at', 'desc']] }) as Promise<Row[]>,
      repo.list('skill_ratings') as Promise<Row[]>,
      repo.list('people', { filter: { kind: 'staff' } }).catch(() => []) as Promise<Row[]>,
    ]);
    const subjects = [...new Set(checkins.filter((c) => c.person_id !== me).map((c) => c.person_id))];
    const [states, evidence] = await Promise.all([
      Promise.all(subjects.map((p) => repo.list('person_skills', { filter: { person_id: p, active: true } }) as Promise<Row[]>)).then((x) => x.flat()),
      Promise.all(subjects.map((p) => repo.list('skill_evidence', { filter: { person_id: p, active: true } }) as Promise<Row[]>)).then((x) => x.flat()),
    ]);
    return { checkins: checkins.filter((c) => c.person_id !== me), ratings, people: new Map(people.map((p) => [p.id, p])), states, evidence };
  }, [me]);
  return (
    <Page title={t('m17.routes.team-skills-validate.title')} intro={t('m17.val.intro')} actions={<L to="/team/skills" className="btn-outline btn-sm no-underline">{t('m17.val.toHeatmap')}</L>}>
      <Async state={{ data: q.data && cat.data ? { ...q.data, cat: cat.data } : undefined, loading: q.loading || cat.loading, error: q.error ?? cat.error, reload: q.reload }}>
        {(d) => <Validate d={d} me={me} />}
      </Async>
    </Page>
  );
}
interface Data { checkins: Row[]; ratings: Row[]; people: Map<string, Row>; states: Row[]; evidence: Row[]; cat: Catalogue }

function Validate({ d, me }: { d: Data; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const today = todayIso();
  const open = d.checkins.filter((c) => c.status === 'open');
  const mine = open.filter((c) => c.manager_id === me);
  const decided = d.checkins.filter((c) => c.status === 'validated' || c.status === 'adjusted');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m17-val-stats">
        <Stat label={t('m17.val.stat.queue')} value={f.num(open.length)} sub={t('m17.val.stat.queueSub', { n: f.num(mine.length) })} tone={open.length ? 'info' : undefined} />
        <Stat label={t('m17.val.stat.overdue')} value={f.num(open.filter((c) => isOverdue(c, today)).length)} tone={open.some((c) => isOverdue(c, today)) ? 'bad' : undefined} />
        <Stat label={t('m17.val.stat.decided')} value={f.num(decided.length)} />
        <Stat label={t('m17.val.stat.adjusted')} value={f.num(decided.filter((c) => c.status === 'adjusted').length)} sub={t('m17.val.stat.adjustedSub')} />
      </div>
      <Tabs tabs={[
        { id: 'queue', label: t('m17.val.tab.queue'), badge: open.length ? f.num(open.length) : undefined, content: <Queue d={d} list={open} /> },
        { id: 'decided', label: t('m17.val.tab.decided'), content: <Decided d={d} list={decided} /> },
        { id: 'calibration', label: t('m17.val.tab.calibration'), content: <Calibration cat={d.cat} /> },
      ]} />
    </div>
  );
}

function Queue({ d, list }: { d: Data; list: Row[] }) {
  const t = useT();
  if (!list.length) return <EmptyState title={t('m17.val.emptyTitle')}>{t('m17.val.empty')}</EmptyState>;
  const sorted = [...list].sort((a, b) => String(a.due_on).localeCompare(String(b.due_on)));
  return <div className="space-y-4" data-testid="m17-val-queue">{sorted.map((c) => <Decide key={c.id} c={c} d={d} />)}</div>;
}

type Dec = { outcome: 'validate' | 'adjust' | 'not_yet'; level: number | null; reason: string };
function Decide({ c, d }: { c: Row; d: Data }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const sk = useSkillName(d.cat);
  const repo = useRepo();
  const act = useAction();
  const today = todayIso();
  const person = d.people.get(c.person_id);
  const sec = useMemo(() => securityComps(d.cat.comps), [d.cat.comps]);
  const std = useMemo(() => new Set(d.cat.standards.map((s) => String(s.id))), [d.cat.standards]);
  const evl = useMemo(() => evidenceLevels(d.evidence.filter((e) => e.person_id === c.person_id)), [d.evidence, c.person_id]);
  const skills = (c.skills ?? []) as CheckinSkill[];
  const [dec, setDec] = useState<Record<string, Dec>>(Object.fromEntries(skills.map((s) => [s.skill_id, { outcome: 'validate', level: s.self_level, reason: '' }])));
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const rs = d.ratings.filter((r) => r.checkin_id === c.id);
  const blocked = (id: string) => { const s = d.cat.skill.get(id); return !s || checkinBlock(s, { secComps: sec, standardIds: std, evidence: d.evidence, person: c.person_id }) !== null; };
  const valid = skills.every((s) => {
    const x = dec[s.skill_id];
    if (blocked(s.skill_id) || x.outcome === 'validate') return true;
    if (x.outcome === 'adjust') return x.level != null && x.level !== s.self_level && x.reason.trim().length >= 3;
    return x.reason.trim().length >= 3;
  });
  const set = (id: string, p: Partial<Dec>) => setDec((cur) => ({ ...cur, [id]: { ...cur[id], ...p } }));
  const nameOf = (id: string) => (d.people.get(id) ? pick(d.people.get(id), 'display_name') || d.people.get(id).display_name : t('m17.ci.colleague'));
  return (
    <Card title={<PersonName name={person ? pick(person, 'display_name') || person.display_name : c.person_id} sub={pick(d.cat.role.get(person?.job_role_id ?? ''), 'title')} />}
      eyebrow={t('m17.val.requested', { date: f.date(c.requested_at), due: f.date(c.due_on) })} actions={<CheckinStatus status={c.status} overdue={isOverdue(c, today)} />}>
      {c.message && <p className="mb-3 text-[13px] italic text-ink-2">“{c.message}”</p>}
      <div className="space-y-3" data-testid="m17-val-item">
        {skills.map((s) => {
          const st = d.states.find((x) => x.person_id === c.person_id && x.skill_id === s.skill_id);
          const ev = evl.get(stateKey(c.person_id, s.skill_id)) ?? null;
          const peers = rs.filter((r) => r.rater_kind === 'peer' && r.skill_id === s.skill_id);
          const x = dec[s.skill_id];
          const qual = blocked(s.skill_id);
          const why: Reason[] = st ? skillReasons(st.reasons ?? []) : [];
          return (
            <div key={s.skill_id} className="rounded-card border border-line p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-ink">{sk(s.skill_id)}</h3>
                  <p className="text-[12px] text-ink-3">{s.note}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  {st ? <><BasisChip basis={st.basis} /><LevelDots level={st.level} /></> : <span className="text-ink-3">{t('m17.ci.noState')}</span>}
                  {why.length > 0 && <WhyThis reasons={why} />}
                </div>
              </div>
              <dl className="mt-2 grid gap-2 text-[13px] sm:grid-cols-3">
                <div><dt className="caps">{t('m17.ci.col.self')}</dt><dd><LevelDots level={s.self_level} tone="sim" /></dd></div>
                <div><dt className="caps">{t('m17.val.evidence')}</dt><dd>{ev != null ? <LevelDots level={ev} tone="ok" /> : <span className="text-ink-3">{t('m17.val.noEvidence')}</span>}</dd></div>
                <div>
                  <dt className="caps">{t('m17.ci.col.peers')}</dt>
                  <dd className="space-y-0.5">
                    {!peers.length && <span className="text-ink-3">{t('m17.ci.noPeers')}</span>}
                    {peers.map((p) => (
                      <div key={p.id} className="text-[12px]">{nameOf(p.rater_person_id)}: {p.status === 'submitted' ? <><LevelDots level={p.level} tone="info" /> <span className="text-ink-3">“{p.example}”</span></> : t(`m17.ci.rstatus.${p.status}`)}</div>
                    ))}
                  </dd>
                </div>
              </dl>
              {qual ? (
                <Callout tone="info" title={t('m17.ci.outcome.qualification_only')}>{t('m17.val.qualOnly')}</Callout>
              ) : (
                <div className="mt-3 space-y-2">
                  <div role="radiogroup" aria-label={t('m17.val.decision')} className="flex flex-wrap gap-1.5">
                    {(['validate', 'adjust', 'not_yet'] as const).map((o) => (
                      <button key={o} type="button" role="radio" aria-checked={x.outcome === o} onClick={() => set(s.skill_id, { outcome: o, level: o === 'validate' ? s.self_level : o === 'adjust' ? (ev ?? s.self_level) : null })}
                        className={`rounded-md border px-2.5 py-1 text-[13px] ${x.outcome === o ? 'border-accent bg-accent-soft font-semibold text-eyebrow' : 'border-line bg-panel text-ink-2 hover:bg-sunken'}`} data-testid={`m17-val-${o}`}>
                        {t(`m17.val.choose.${o}`, { n: f.num(s.self_level) })}
                      </button>
                    ))}
                  </div>
                  {x.outcome === 'adjust' && <LevelPicker name={`adj-${c.id}-${s.skill_id}`} label={t('m17.val.adjustTo')} value={x.level} onChange={(v) => set(s.skill_id, { level: v })} cat={d.cat} skillId={s.skill_id} />}
                  {x.outcome !== 'validate' && <TextArea name={`why-${s.skill_id}`} label={t('m17.val.reason')} rows={2} value={x.reason} onChange={(v) => set(s.skill_id, { reason: v.slice(0, 300) })} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <TextArea name={`note-${c.id}`} label={t('m17.val.note')} rows={2} value={note} onChange={(v) => setNote(v.slice(0, 300))} />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn-primary" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m17-val-submit">{t('m17.val.submit')}</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m17.val.confirmTitle')} confirmLabel={t('m17.val.submit')} consequence={t('m17.val.confirmBody')}
        onConfirm={async () => {
          await act(() => repo.rpc.validateCheckin({ checkin_id: c.id, note: note.trim() || null, decisions: skills.map((s) => ({ skill_id: s.skill_id, outcome: blocked(s.skill_id) ? 'validate' : dec[s.skill_id].outcome, level: dec[s.skill_id].level, reason: dec[s.skill_id].reason.trim() || null })) }));
          setConfirm(false);
        }} />
    </Card>
  );
}

function Decided({ d, list }: { d: Data; list: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const sk = useSkillName(d.cat);
  if (!list.length) return <EmptyState title={t('m17.val.decidedEmpty')} />;
  return (
    <div className="overflow-x-auto" data-testid="m17-val-decided">
      <table className="w-full min-w-[640px] text-[13px]">
        <caption className="sr-only">{t('m17.val.tab.decided')}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="caps py-1.5 text-start">{t('m17.val.col.person')}</th>
            <th scope="col" className="caps py-1.5 text-start">{t('m17.ci.col.skill')}</th>
            <th scope="col" className="caps py-1.5 text-start">{t('m17.ci.col.self')}</th>
            <th scope="col" className="caps py-1.5 text-start">{t('m17.val.col.outcome')}</th>
            <th scope="col" className="caps py-1.5 text-start">{t('m17.val.col.date')}</th>
          </tr>
        </thead>
        <tbody>
          {list.flatMap((c) => ((c.skills ?? []) as CheckinSkill[]).map((s, i) => (
            <tr key={`${c.id}-${s.skill_id}`} className="border-b border-line/60 align-top">
              <td className="py-1.5 pe-2">{i === 0 ? pick(d.people.get(c.person_id), 'display_name') || d.people.get(c.person_id)?.display_name || c.person_id : ''}</td>
              <td className="py-1.5 pe-2">{sk(s.skill_id)}</td>
              <td className="py-1.5 pe-2"><LevelDots level={s.self_level} tone="sim" /></td>
              <td className="py-1.5 pe-2"><span className="flex flex-wrap items-center gap-1.5">{s.outcome && <OutcomePill outcome={s.outcome} />}{s.final_level != null && <LevelDots level={s.final_level} tone="ok" />}</span>{s.reason && <div className="text-[12px] text-ink-3">{s.reason}</div>}</td>
              <td className="py-1.5">{i === 0 ? f.date(c.decided_at) : ''}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────── calibration
function Calibration({ cat }: { cat: Catalogue }) {
  const t = useT();
  const repo = useRepo();
  const [group, setGroup] = useState<string | null>(null);
  const q = useQuery(['skill_checkins', 'skill_ratings', 'person_skills'], () => repo.rpc.checkinCalibration(group), [group]);
  return <Async state={q}>{(c) => <CalibrationView c={c} cat={cat} onGroup={setGroup} />}</Async>;
}
function CalibrationView({ c, cat, onGroup }: { c: CheckinCalibration; cat: Catalogue; onGroup: (g: string) => void }) {
  const t = useT();
  const f = useFormat();
  const sk = useSkillName(cat);
  const name = useName();
  const groupLabel = useGroupLabel();
  return (
    <div className="space-y-4" data-testid="m17-cal">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <SelectField label={t('m17.tm.group.label')} name="cal-group" value={c.group ?? ''} onChange={onGroup}
            options={c.groups.map((g) => ({ value: g.key, label: `${groupLabel(g.key)} · ${t('m17.tm.people', { n: f.num(g.size) })}` }))} />
        </div>
        <p className="text-[13px] text-ink-2">{t('m17.cal.summary', { n: f.num(c.size), k: f.num(c.checkins) })}</p>
      </div>
      {c.suppressed && <Callout tone="sim" title={t('m17.cal.suppressedTitle')}>{t('m17.cal.suppressed', { n: f.num(c.size) })}</Callout>}
      <Card title={t('m17.cal.distTitle')} eyebrow={t('m17.cal.distEyebrow')}>
        {!c.distributions.length ? <p className="text-[13px] text-ink-3">{t('m17.cal.noRatings')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13px]" data-testid="m17-cal-dist">
              <caption className="sr-only">{t('m17.cal.distTitle')}</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="caps py-1.5 text-start">{t('m17.ci.col.skill')}</th>
                  <th scope="col" className="caps py-1.5 text-start">{t('m17.cal.levels')}</th>
                  <th scope="col" className="caps py-1.5 text-end">{t('m17.cal.mean.self')}</th>
                  <th scope="col" className="caps py-1.5 text-end">{t('m17.cal.mean.peer')}</th>
                  <th scope="col" className="caps py-1.5 text-end">{t('m17.cal.mean.manager')}</th>
                </tr>
              </thead>
              <tbody>
                {c.distributions.map((x) => (
                  <tr key={x.skill_id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pe-2 text-start font-normal">{sk(x.skill_id)}<div className="text-[11px] text-ink-3">{t('m17.cal.ratings', { n: f.num(x.ratings) })}</div></th>
                    <td className="py-1.5 pe-2">{x.dist ? <DistBar dist={x.dist} /> : <span className="chip border-line bg-sunken text-ink-3">{t('common.suppressedShort')}</span>}</td>
                    <td className="num py-1.5 text-end">{x.means ? f.num(x.means.self, { maximumFractionDigits: 2 }) : '—'}</td>
                    <td className="num py-1.5 text-end">{x.means ? f.num(x.means.peer, { maximumFractionDigits: 2 }) : '—'}</td>
                    <td className="num py-1.5 text-end">{x.means ? f.num(x.means.manager, { maximumFractionDigits: 2 }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title={t('m17.cal.ratersTitle')} eyebrow={t('m17.cal.ratersEyebrow', { flag: f.num(OFFSET.FLAG, { maximumFractionDigits: 2 }), n: f.num(OFFSET.MIN_N) })}>
        {!c.raters.length ? <p className="text-[13px] text-ink-3">{t('m17.cal.noRaters')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]" data-testid="m17-cal-raters">
              <caption className="sr-only">{t('m17.cal.ratersTitle')}</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="caps py-1.5 text-start">{t('m17.cal.rater')}</th>
                  <th scope="col" className="caps py-1.5 text-start">{t('m17.cal.kind')}</th>
                  <th scope="col" className="caps py-1.5 text-end">{t('m17.cal.n')}</th>
                  <th scope="col" className="caps py-1.5 text-end">{t('m17.cal.offset')}</th>
                  <th scope="col" className="caps py-1.5 text-start ps-3">{t('m17.cal.flagCol')}</th>
                </tr>
              </thead>
              <tbody>
                {c.raters.map((r) => (
                  <tr key={`${r.rater_id}-${r.kind}`} className="border-b border-line/60">
                    <td className="py-1.5 pe-2">{name(r)}</td>
                    <td className="py-1.5 pe-2">{t(`m17.cal.kinds.${r.kind}`)}</td>
                    <td className="num py-1.5 text-end">{f.num(r.n)}</td>
                    <td className={`num py-1.5 text-end ${r.offset > 0 ? 'text-sim' : r.offset < 0 ? 'text-info' : ''}`}>{r.offset > 0 ? '+' : ''}{f.num(r.offset, { maximumFractionDigits: 2 })}</td>
                    <td className="py-1.5 ps-3"><span className="inline-flex items-center gap-1.5"><RaterFlag flag={r.flag} />
                      <WhyThis reasons={[{ code: 'cal_offset', key: 'm17.reasons.cal_offset', vars: { n: f.num(r.n), offset: f.num(r.offset, { maximumFractionDigits: 2 }) } }, { code: 'cal_rule', key: 'm17.reasons.cal_rule', vars: { flag: f.num(OFFSET.FLAG, { maximumFractionDigits: 2 }), min: f.num(OFFSET.MIN_N) } }]} />
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-ink-3"><Icon name="info" size={12} className="mt-0.5" /> {t('m17.cal.note')}</p>
      </Card>
    </div>
  );
}
function DistBar({ dist }: { dist: number[] }) {
  const t = useT();
  const f = useFormat();
  const total = dist.reduce((a, b) => a + b, 0) || 1;
  const tones = ['bg-sunken', 'bg-accent/25', 'bg-accent/45', 'bg-accent/70', 'bg-accent'];
  return (
    <span className="flex w-full max-w-[280px] items-center gap-2">
      <span className="flex h-3 flex-1 overflow-hidden rounded-sm ring-1 ring-inset ring-line" aria-hidden>
        {dist.map((n, i) => (n ? <span key={i} className={tones[i]} style={{ width: `${(n / total) * 100}%` }} title={`${i}: ${n}`} /> : null))}
      </span>
      <span className="sr-only">{dist.map((n, i) => t('m17.cal.distSr', { level: f.num(i), n: f.num(n) })).join(', ')}</span>
      <span className="num whitespace-nowrap text-[11px] text-ink-3" aria-hidden>{dist.map((n) => f.num(n)).join(' · ')}</span>
    </span>
  );
}
