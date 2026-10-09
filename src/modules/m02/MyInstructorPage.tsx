// /my/instructor (M02 · F31): my instructor track. With an open track: stage stepper, what is next, the requirements checklist, my
// observations with checklist scores, my annual currency and hours (log my own continuing development), close the track. Without one:
// "teach what you know": my best-matching standards from my F01 skill state (<WhyThis>), the sourced programme facts (ASIP, REG-16,
// FANR's internal trainers) and a self-nomination (the ASIP route only with a valid SRO licence mirror).
import { useMemo, useState } from 'react';
import { Page, Section, Grid, Card, Async, Callout, ConfirmDialog, WhyThis, EngineBadge } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { rankSmeCandidates } from './instructorMatch';
import {
  CurrencyCard, HoursChart, LogHoursModal, MirrorNote, NominateModal, ObservationList, ProgrammeFacts, Requirements, RouteChip, StagePill, StageStepper, StdChips, useInsData,
  type InsData, type TrackView,
} from './instructorUi';

export default function MyInstructorPage() {
  const t = useT();
  const q = useInsData();
  const s = useSession();
  const me = s.identity.personId;
  return (
    <Page title={t('m02.routes.my-instructor.title')} eyebrow={t('m02.ins.eyebrow')} intro={t('m02.ins.my.intro')} wide>
      <Async state={q}>
        {(d) => {
          const mine = [...d.views.values()].filter((v) => v.track.person_id === me).sort((a, b) => (a.track.started_on < b.track.started_on ? 1 : -1));
          const open = mine.find((v) => ['active', 'qualified', 'lapsed'].includes(v.track.status));
          return open ? <MyTrack v={open} d={d} /> : <Volunteer d={d} closed={mine[0] ?? null} />;
        }}
      </Async>
    </Page>
  );
}

function MyTrack({ v, d }: { v: TrackView; d: InsData }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [log, setLog] = useState(false);
  const [close, setClose] = useState(false);
  const course = d.courseById.get(v.track.route === 'asip' ? 'c-asip' : 'c-instr');
  const nextKey = v.track.status === 'lapsed' ? 'lapsed' : v.track.status === 'qualified' ? (v.currency && !v.currency.met ? 'currencyShort' : 'currencyOk') : v.stage;
  return (
    <div className="space-y-6" data-testid="m02-ins-my-track">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2"><StagePill v={v} /><RouteChip route={v.track.route} /><StdChips ids={v.track.standard_ids} d={d} /></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => setLog(true)} data-testid="m02-ins-log-cpd">{t('m02.ins.my.logCpd')}</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setClose(true)} data-testid="m02-ins-withdraw">{t('m02.ins.act.withdraw')}</button>
          </div>
        </div>
        <div className="mt-4"><StageStepper v={v} /></div>
        <div className="mt-4" data-testid="m02-ins-next">
          <Callout tone={v.track.status === 'lapsed' || nextKey === 'currencyShort' ? 'bad' : 'info'} title={t('m02.ins.my.nextTitle')}>
            {t(`m02.ins.my.next.${nextKey}`, { code: course?.code ?? 'INSTR-101', hours: f.num(v.currency?.short_hours ?? 0), cpd: f.num(v.currency?.short_cpd ?? 0), date: f.date(v.currency?.due ?? null) })}
          </Callout>
        </div>
      </Card>
      <Grid cols={2}>
        <Card title={t('m02.ins.track.requirements')}><Requirements v={v} d={d} /></Card>
        {v.currency ? <CurrencyCard v={v} /> : <Card title={t('m02.ins.my.howTitle')}><ol className="list-decimal space-y-1.5 ps-5 text-[13px] text-ink-2">{['1', '2', '3', '4', '5'].map((k) => <li key={k}>{t(`m02.ins.my.how${k}`, { code: course?.code ?? 'INSTR-101' })}</li>)}</ol></Card>}
      </Grid>
      <Section title={t('m02.ins.my.observations')}><ObservationList obs={v.obs} /></Section>
      <Card><HoursChart hours={v.hours.filter((h) => h.kind === 'delivery')} today={d.today} /></Card>
      <ProgrammeFacts />
      <MirrorNote />
      {log && <LogHoursModal open={log} onClose={() => setLog(false)} personId={v.track.person_id} cpdOnly d={d} />}
      <ConfirmDialog open={close} onClose={() => setClose(false)} title={t('m02.ins.act.withdrawTitle', { name: '' })} consequence={t('m02.ins.my.withdrawBody')} danger requireReason reasonLabel={t('m02.ins.act.reason')}
        onConfirm={async (reason) => { await run(() => repo.rpc.withdrawInstructorTrack(v.track.id, reason)); }} />
    </div>
  );
}

function Volunteer({ d, closed }: { d: InsData; closed: TrackView | null }) {
  const t = useT();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const eng = useEngine('match');
  const me = s.identity.personId ?? '';
  const [nom, setNom] = useState<string | null>(null);
  const q = useQuery(['people', 'person_skills', 'skills', 'sme_profiles', 'mentors', 'licences'], async () => {
    const [people, states, skills, sme, mentors, licences] = await Promise.all([
      repo.list('people', { filter: { id: me } }), repo.list('person_skills', { filter: { person_id: me, active: true } }), repo.list('skills'),
      repo.list('sme_profiles', { filter: { person_id: me } }).catch(() => [] as RowOf<'sme_profiles'>[]), repo.list('mentors', { filter: { person_id: me } }).catch(() => [] as RowOf<'mentors'>[]),
      repo.list('licences', { filter: { person_id: me } }).catch(() => [] as RowOf<'licences'>[]),
    ]);
    return { people, states, skills, sme, mentors, licences };
  }, [me]);
  const stds = useMemo(() => d.stds.filter((x) => x.status === 'current' && !x.security_restricted), [d.stds]);
  return (
    <div className="space-y-6" data-testid="m02-ins-volunteer">
      {closed && <Callout tone="sim" title={t(`m02.ins.my.closed.${closed.track.status}`)}>{closed.track.decision_note ?? ''}</Callout>}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl"><h2 className="text-[17px] font-semibold">{t('m02.ins.my.teachTitle')}</h2><p className="mt-1 text-[13.5px] text-ink-2">{t('m02.ins.my.teachBody')}</p></div>
          <EngineBadge engine={eng} />
        </div>
        <Async state={q}>
          {(x) => {
            const person = x.people[0];
            const asip = x.licences.some((l) => (l.type === 'SRO' || l.type === 'SRO_QI') && l.status === 'valid' && l.expires_on >= d.today);
            if (!person || person.kind !== 'staff') return <p className="mt-3 text-[13px] text-ink-3">{t('m02.ins.my.notStaff')}</p>;
            const ranked = stds.map((st) => ({ st, r: rankSmeCandidates({ standardIds: [st.id], skills: x.skills as never, people: [person], states: x.states, smeProfiles: x.sme, smeMentors: x.mentors, onTrack: new Set(), today: d.today })[0] }))
              .filter((y) => y.r).sort((a, b) => b.r!.score - a.r!.score).slice(0, 4);
            return (
              <div className="mt-4 space-y-3">
                {ranked.length ? (
                  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m02-ins-my-matches">
                    {ranked.map(({ st, r }) => (
                      <li key={st.id} className="rounded-card border border-line p-3" data-testid="m02-ins-my-match">
                        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="font-semibold">{st.code}</div><div className="truncate text-[12.5px] text-ink-3">{pick(st, 'title')}</div></div><span className="font-semibold text-accent" dir="ltr">{Math.round(r!.score * 100)}</span></div>
                        <div className="mt-2 flex items-center justify-between gap-2"><WhyThis reasons={r!.reasons} testId="m02-ins-my-why" /><button type="button" className="btn-primary btn-sm" onClick={() => setNom(st.id)} data-testid="m02-ins-volunteer-btn">{t('m02.ins.my.volunteer')}</button></div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-[13px] text-ink-3">{t('m02.ins.my.noMatch')}</p>}
                <div className="flex justify-end"><button type="button" className="btn-outline btn-sm" onClick={() => setNom('')} data-testid="m02-ins-volunteer-any">{t('m02.ins.my.volunteerAny')}</button></div>
                {nom !== null && <NominateModal open onClose={() => setNom(null)} personId={me} personName="" self d={d} defaultStd={nom || undefined} asipEligible={asip} />}
              </div>
            );
          }}
        </Async>
      </Card>
      <Section title={t('m02.ins.my.pathTitle')}>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-5" data-testid="m02-ins-path">
          {['1', '2', '3', '4', '5'].map((k) => <li key={k} className="card p-3 text-[13px]"><div className="caps mb-1">{t('m02.ins.my.step', { n: k })}</div>{t(`m02.ins.my.how${k}`, { code: 'INSTR-101' })}</li>)}
        </ol>
      </Section>
      <Section title={t('m02.ins.facts.title')}><ProgrammeFacts /></Section>
      <MirrorNote />
    </div>
  );
}
