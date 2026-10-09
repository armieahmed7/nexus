// /team/instructors (M02 · F31): line managers grow instructors from their team. The team's instructor tracks (stage, currency) and,
// per qualification standard, colleagues in scope ranked by the SME finder (F01 skills, F21 SME profiles, F13 SME mentors; <WhyThis>),
// with a nomination the training manager then decides. Security, cyber and safeguards families never appear.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, WhyThis, EngineBadge, SelectField } from '../../ui';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { rankSmeCandidates } from './instructorMatch';
import { CurrencyPill, MirrorNote, NominateModal, RouteChip, StagePill, StdChips, TrackLink, useInsData, useNamePick, type InsData } from './instructorUi';

export default function TeamInstructorsPage() {
  const t = useT();
  const q = useInsData();
  return (
    <Page title={t('m02.routes.team-instructors.title')} eyebrow={t('m02.ins.eyebrow')} intro={t('m02.ins.team.intro')} wide>
      <Async state={q}>{(d) => <Team d={d} />}</Async>
    </Page>
  );
}

function Team({ d }: { d: InsData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const nm = useNamePick();
  const s = useSession();
  const repo = useRepo();
  const eng = useEngine('match');
  const me = s.identity.personId;
  const stds = d.stds.filter((x) => x.status === 'current' && !x.security_restricted).sort((a, b) => (a.code < b.code ? -1 : 1));
  const [std, setStd] = useState(stds[0]?.id ?? '');
  const [nom, setNom] = useState<{ id: string; name: string } | null>(null);
  const q = useQuery(['people', 'person_skills', 'skills', 'sme_profiles', 'mentors'], async () => {
    const [people, states, skills, sme, mentors] = await Promise.all([
      repo.list('people', { filter: { kind: 'staff', status: 'active' } }), repo.list('person_skills', { filter: { active: true } }), repo.list('skills'),
      repo.list('sme_profiles').catch(() => [] as RowOf<'sme_profiles'>[]), repo.list('mentors').catch(() => [] as RowOf<'mentors'>[]),
    ]);
    return { people: people.filter((p) => p.id !== me), states, skills, sme, mentors };
  }, [me]);
  const team = [...d.views.values()].filter((v) => v.track.person_id !== me).sort((a, b) => (a.track.person_name < b.track.person_name ? -1 : 1));
  const onTrack = useMemo(() => new Set(d.tracks.filter((x) => ['active', 'qualified', 'lapsed'].includes(x.status)).map((x) => x.person_id)), [d.tracks]);
  return (
    <div className="space-y-6">
      <Section title={t('m02.ins.team.tracks')} description={t('m02.ins.team.tracksIntro')}>
        {team.length ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m02-ins-team-tracks">
            {team.map((v) => (
              <li key={v.track.id} className="card p-3" data-testid="m02-ins-team-track">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="font-semibold"><TrackLink v={v}>{nm(v.track.person_name, v.track.person_name_ar)}</TrackLink></div><div className="mt-1 flex flex-wrap gap-1"><RouteChip route={v.track.route} /><StdChips ids={v.track.standard_ids} d={d} /></div></div>
                  <div className="flex flex-col items-end gap-1"><StagePill v={v} />{v.currency && <CurrencyPill c={v.currency} />}</div>
                </div>
                <p className="mt-2 text-[12px] text-ink-3">{v.currency ? t('m02.ins.currency.dueOn', { date: f.date(v.currency.due), days: f.num(v.currency.days) }) : t('m02.ins.board.since', { date: f.date(v.track.accepted_on ?? v.track.started_on) })}</p>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon="users" title={t('m02.ins.team.noTracks')} />}
      </Section>
      <Section title={t('m02.ins.team.find')} description={t('m02.ins.team.findIntro')} actions={<EngineBadge engine={eng} />}>
        <div className="w-full max-w-sm"><SelectField name="ins-team-std" label={t('m02.ins.find.standard')} value={std} onChange={setStd} options={stds.map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'title')}` }))} /></div>
        <Async state={q}>
          {(x) => {
            const ranked = rankSmeCandidates({ standardIds: [std], skills: x.skills as never, people: x.people, states: x.states, smeProfiles: x.sme, smeMentors: x.mentors, onTrack, today: d.today }).slice(0, 6);
            const name = (id: string) => { const p = x.people.find((pp) => pp.id === id); return p ? nm(p.display_name, p.display_name_ar) : id; };
            if (!ranked.length) return <EmptyState icon="search" title={t('m02.ins.find.none')} />;
            return (
              <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m02-ins-team-candidates">
                {ranked.map((c) => (
                  <li key={c.id} className="card p-3" data-testid="m02-ins-candidate">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate font-semibold">{name(c.id)}</div><div className="text-[12px] text-ink-3">{t('m02.ins.find.fit', { pct: Math.round(c.item!.fit * 100) })}</div></div><span className="font-semibold text-accent" dir="ltr">{Math.round(c.score * 100)}</span></div>
                    <div className="mt-2 flex items-center justify-between gap-2"><WhyThis reasons={c.reasons} testId="m02-ins-why" /><button type="button" className="btn-outline btn-sm" onClick={() => setNom({ id: c.id, name: name(c.id) })} data-testid="m02-ins-nominate">{t('m02.ins.act.nominate')}</button></div>
                  </li>
                ))}
              </ul>
            );
          }}
        </Async>
      </Section>
      <Card><p className="text-[13px] text-ink-2">{t('m02.ins.team.how')}</p></Card>
      <MirrorNote />
      {nom && <NominateModal open onClose={() => setNom(null)} personId={nom.id} personName={nom.name} d={d} defaultStd={std} />}
    </div>
  );
}
