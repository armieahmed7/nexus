// FS83 /my/consortium (ecosystem Own: ENEC staff). My place in the consortium trainee cohort: status, pseudonymous trainee code, the
// mentor from another employer (a role card) and my project team, the shared modules hosted in turn, my cross-site visits and the
// evidence written when the host confirms (validated, kind ojt, on the host site's focus skill). Without a place: the cohort taking
// nominations and whether I am eligible (entry level or hired within 5 years); HR nominates ENEC trainees.
import { useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, Card, Callout, EmptyState, KeyValue, ConfirmDialog, WhyThis, BenchmarkChips } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { cohortPhase, consortiumOrg, enecEligibilityReasons, enecTraineeEligible, memberReasons, mentorsOf, visitReasons, ENEC_TRAINEE_YEARS } from './consortium';
import { CohortPill, ConsortiumLabels, MemberPill, ModuleTimeline, VisitPill, usePartnerName } from './fs82ui';
import { LogVisit } from './ConsortiumCohortPage';
import { useSkillName, useSkills, type Row } from './ui';

export default function MyConsortiumPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const pid = s.identity.personId;
  const q = useQuery(['consortium_cohorts', 'consortium_members', 'consortium_visits'] as unknown as Table[], async () => {
    const [cohorts, members, visits, me] = await Promise.all([
      repo.list('consortium_cohorts' as never) as unknown as Promise<Row[]>,
      repo.list('consortium_members' as never, { filter: { person_id: pid } } as never) as unknown as Promise<Row[]>,
      repo.list('consortium_visits' as never, { filter: { person_id: pid } } as never) as unknown as Promise<Row[]>,
      pid ? (repo.get('people' as never, pid) as unknown as Promise<Row | null>).catch(() => null) : Promise.resolve(null),
    ]);
    return { cohorts: cohorts.slice().sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0)), members, visits, me };
  }, [pid]);
  return (
    <Page title={t('m36.routes.my-consortium.title')} intro={t('m36.ccm.intro')} wide eyebrow={<BenchmarkChips feature="FS83" />}
      actions={<L to="/ecosystem/consortium" className="btn-outline btn-sm no-underline" data-testid="m36-ccm-to-public">{t('m36.ccm.toPublic')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Mine {...d} />}</Async>
    </Page>
  );
}

function Mine({ cohorts, members, visits, me }: { cohorts: Row[]; members: Row[]; visits: Row[]; me: Row | null }) {
  const t = useT();
  const f = useFormat();
  const today = todayIso();
  const byId = Object.fromEntries(cohorts.map((c) => [c.id, c]));
  const places = members.filter((m) => byId[m.cohort_id]).sort((a, b) => Number(byId[a.cohort_id].sort ?? 0) - Number(byId[b.cohort_id].sort ?? 0));
  const nominating = cohorts.find((c) => cohortPhase(c, today) === 'nominating' && !places.some((m) => m.cohort_id === c.id && m.status !== 'declined' && m.status !== 'withdrawn'));
  const eligible = enecTraineeEligible(me, today);
  return (
    <div className="space-y-6" data-testid="m36-ccm" data-places={places.length}>
      <ConsortiumLabels />
      {places.length === 0 && <EmptyState title={t('m36.ccm.noPlace')}>{t('m36.ccm.noPlaceBody')}</EmptyState>}
      {places.map((m) => <Place key={m.id} m={m} cohort={byId[m.cohort_id]} visits={visits.filter((v) => v.member_id === m.id)} />)}
      {nominating && (
        <Card title={t('m36.ccm.nextTitle', { code: nominating.code })} eyebrow={<CohortPill phase="nominating" />}>
          <div className="space-y-2 text-[13px]" data-testid="m36-ccm-next" data-eligible={eligible ? 'yes' : 'no'}>
            <p>{t('m36.ccm.nextBody', { date: f.date(nominating.nominations_close_on) })}</p>
            <p className={eligible ? 'text-ok' : 'text-ink-2'}>{eligible ? t('m36.ccm.eligible') : t('m36.ccm.notEligible', { n: f.num(ENEC_TRAINEE_YEARS) })}</p>
            <WhyThis reasons={enecEligibilityReasons(me, today)} testId="m36-ccm-eligibility-why" />
          </div>
        </Card>
      )}
    </div>
  );
}

function Place({ m, cohort, visits }: { m: Row; cohort: Row; visits: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const partnerName = usePartnerName();
  const skills = useSkills();
  const skillName = useSkillName(skills.data);
  const today = todayIso();
  const [withdraw, setWithdraw] = useState<Row | null>(null);
  const mentor = mentorsOf(cohort).find((x) => x.id === m.mentor_id);
  const sorted = visits.slice().sort((a, b) => (String(a.visit_on) < String(b.visit_on) ? 1 : -1));
  const confirmed = visits.filter((v) => v.status === 'confirmed');
  return (
    <div className="space-y-6" data-testid="m36-ccm-place" data-id={m.id} data-status={m.status}>
      <Card eyebrow={cohort.code} title={pick(cohort, 'title')} actions={<MemberPill status={m.status} />}>
        <div className="space-y-3">
          <KeyValue items={[
            [t('m36.ccw.col.code'), <span key="c" className="num font-semibold" data-testid="m36-ccm-code">{m.trainee_code}</span>],
            [t('m36.ccw.col.org'), partnerName(cohort, consortiumOrg(cohort, m.org_id) ?? m.org_id)],
            [t('m36.ccw.col.discipline'), t(`m36.cc.discipline.${m.discipline}`)],
            [t('m36.ccw.col.mentor'), mentor ? `${pick(mentor as unknown as Row, 'label')} · ${partnerName(cohort, mentor.org_id)}` : '—'],
            [t('m36.ccw.col.team'), m.team ? t('m36.cc.teamName', { team: m.team }) : '—'],
            [t('m36.cc.runs'), t('m36.gr.range', { a: f.date(cohort.starts_on), b: f.date(cohort.ends_on) })],
          ]} />
          {m.status === 'declined' && m.decision_note && <p className="rounded bg-sunken p-2 text-[13px]">{m.decision_note}</p>}
          <WhyThis reasons={memberReasons(m, cohort)} testId="m36-ccm-why" />
        </div>
      </Card>
      {m.status === 'accepted' && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <Section title={t('m36.cc.modulesTitle')}><ModuleTimeline cohort={cohort} today={today} /></Section>
            <div className="space-y-4">
              <Card title={t('m36.cc.projectTitle')}><p className="text-[13px]">{pick(cohort, 'project')}</p></Card>
              <LogVisit cohort={cohort} members={[m]} compact />
            </div>
          </div>
          <Section title={t('m36.ccm.visitsTitle')} description={t('m36.ccm.visitsIntro', { n: f.num(confirmed.length) })}>
            {sorted.length ? (
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m36-ccm-visits">
                {sorted.map((v) => (
                  <li key={v.id} className="card p-3" data-testid="m36-ccm-visit" data-id={v.id} data-status={v.status} data-evidence={v.profile_evidence ? 'yes' : 'no'}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{partnerName(cohort, v.host_org_id)}</span><VisitPill status={v.status} /></div>
                    <p className="text-[12.5px] text-ink-2">{f.date(v.visit_on)} · {t('m36.ccm.hours', { n: f.num(Number(v.hours)) })} · <L to={`/skills/${v.skill_id}`}>{skillName(v.skill_id)}</L></p>
                    {v.status === 'confirmed' && <p className="text-[12.5px] text-ok">{v.profile_evidence ? t('m36.ccm.evidenceWritten', { level: f.num(Number(v.level)) }) : t('m36.ccm.evidenceRecord', { level: f.num(Number(v.level)) })}</p>}
                    {v.status === 'declined' && v.decline_reason && <p className="text-[12.5px] text-ink-2">{v.decline_reason}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <WhyThis reasons={visitReasons(v)} testId="m36-ccm-visit-why" />
                      {v.status === 'logged' && <button type="button" className="btn-ghost btn-sm" onClick={() => setWithdraw(v)} data-testid="m36-ccm-withdraw">{t('m36.ccw.withdraw')}</button>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title={t('m36.ccw.noVisits')}>{t('m36.ccm.noVisitsBody')}</EmptyState>}
            {confirmed.some((v) => v.profile_evidence) && <p className="mt-2 text-[12.5px]"><L to="/my/skills">{t('m36.ccm.toSkills')}</L></p>}
          </Section>
        </>
      )}
      {m.status === 'nominated' && <Callout tone="info" title={t('m36.ccm.waitingTitle')}>{t('m36.ccm.waiting')}</Callout>}
      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m36.ccw.withdrawConfirm')} consequence={t('m36.ccw.withdrawConsequence')} confirmLabel={t('m36.ccw.withdraw')}
        onConfirm={async () => { if (withdraw) await run(() => repo.rpc.withdrawConsortiumVisit(String(withdraw.id))); setWithdraw(null); }} />
    </div>
  );
}
