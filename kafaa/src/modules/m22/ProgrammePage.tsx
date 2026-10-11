// /leadership/programmes/:id (M22 · F16): one academy programme with its published facts (CNS report, as-of date), who it is for,
// the leadership competencies and behaviours it builds against my levels, how to join, and the line manager's nomination action.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, KeyValue, StatTile, Grid, Icon, ProgressBar } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { requiredFor, stepOf, targetStep, LEAD_TARGETS } from './domain';
import { useLeadership, useLabels, StepName, NomPill, Sources, type LeadData, type Programme } from './ui';
import { NominateModal } from './NominateModal';

export default function ProgrammePage() {
  const t = useT();
  const pick = usePick();
  const { id = '' } = useParams();
  const { q, me, person, session } = useLeadership();
  const g = q.data?.programmes.find((x) => x.id === id);
  return (
    <Page title={g ? pick(g, 'title') : t('m22.routes.leadership-programme.title')} eyebrow={<L to="/leadership">{t('m22.programme.back')}</L>} wide>
      <Async state={q} isEmpty={(d) => !d.programmes.some((x) => x.id === id)} empty={<EmptyState icon="grad" title={t('m22.programme.notFound')} action={<L to="/leadership" className="btn-outline btn-sm">{t('m22.programme.back')}</L>} />}>
        {(d) => <Detail d={d} g={d.programmes.find((x) => x.id === id)!} me={me} person={person} canSelf={session.can('skills_profile', ['Own'])} isManager={session.hasRole('manager')} />}
      </Async>
    </Page>
  );
}

function Detail({ d, g, me, person, canSelf, isManager }: { d: LeadData; g: Programme; me: string | null; person: ReturnType<typeof useLeadership>['person']; canSelf: boolean; isManager: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels(d.skills, d.roles);
  const [nominate, setNominate] = useState(false);
  const req = canSelf ? requiredFor(g as never, person) : null;
  const tgt = targetStep(stepOf(person));
  const levels = new Map(d.states.map((s) => [s.skill_id, s.level]));
  const mine = d.nominations.filter((n) => n.programme_id === g.id && n.person_id === me);
  const team = d.nominations.filter((n) => n.programme_id === g.id && n.nominated_by === me);
  const year = g.completions_year ? f.num(g.completions_year, { useGrouping: false }) : null;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card>
          {req && <div className="mb-3"><Callout tone="bad" title={t(req === 'track' ? 'm22.programme.requiredTrack' : 'm22.programme.requiredStep')}>{t(req === 'track' ? 'm22.programme.requiredTrackBody' : 'm22.programme.requiredStepBody')}</Callout></div>}
          <p className="text-[14.5px] leading-relaxed">{pick(g, 'summary')}</p>
          <div className="mt-4">
            <KeyValue items={[
              [t('m22.programme.audience'), pick(g, 'audience')],
              [t('m22.programme.duration'), pick(g, 'duration')],
              [t('m22.programme.steps'), <span className="flex flex-wrap gap-1">{g.steps.map((s) => <span key={s} className="chip border-line bg-sunken text-ink-2"><StepName step={s} /></span>)}</span>],
              [t('m22.programme.join'), g.nominable ? t('m22.programme.joinNomination') : t('m22.programme.joinOther')],
              ...(g.course_id ? [[t('m22.programme.course'), <L key="c" to={`/learn/course/${g.course_id}`}>{t('m22.programme.openCourse')}</L>] as [string, JSX.Element]] : []),
            ]} />
          </div>
        </Card>

        <Section title={t('m22.programme.factsTitle')} description={t('m22.programme.factsSub')}>
          <Grid cols={3}>
            <StatTile label={t('m22.programme.duration')} value={g.duration_days != null ? t('m22.programme.days', { n: f.num(g.duration_days) }) : pick(g, 'duration')} source={<Sources sources={g.sources} />} />
            {g.completions != null && <StatTile label={year ? t('m22.programme.completedIn', { year }) : t('m22.programme.participants')} value={f.num(g.completions)} source={<Sources sources={g.sources} />} />}
            <StatTile label={t('m22.programme.fact')} value={<span className="text-[14px] font-normal leading-snug">{pick(g, 'fact')}</span>} source={<Sources sources={g.sources} />} />
          </Grid>
          <p className="mt-2 text-[12px] text-ink-3">{t('m22.programme.perSource')}</p>
        </Section>

        <Section title={t('m22.programme.buildsTitle')} description={canSelf ? t('m22.programme.buildsSub', { step: t(`m22.steps.${tgt}`) }) : undefined}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="m22-programme-skills">
            {g.skill_ids.map((s) => {
              const have = levels.get(s) ?? 0;
              const need = LEAD_TARGETS[tgt][s] ?? 2;
              return (
                <li key={s} className="rounded-card border border-line bg-panel p-3">
                  <div className="font-semibold text-[13.5px]">{lab.skill(s)}</div>
                  {canSelf && <div className="mt-2 flex items-center gap-3"><ProgressBar value={(Math.min(have, need) / need) * 100} tone={have >= need ? 'ok' : 'sim'} label={lab.skill(s)} /><span className="num shrink-0 text-[12px] text-ink-2">{t('m22.common.levelOf', { have: f.num(have), need: f.num(need) })}</span></div>}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {g.behaviour_ids.map((b) => <span key={b} className="chip border-accent/30 bg-accent-soft text-eyebrow">{t(`m22.behaviours.${b}.title`)}</span>)}
          </div>
        </Section>
      </div>

      <aside className="space-y-4">
        {canSelf && (
          <Card title={t('m22.programme.yourStatus')}>
            {mine.length ? mine.map((n) => <div key={n.id} className="flex items-center justify-between gap-2"><span className="text-[13px]">{n.cycle}</span><NomPill status={n.status} /></div>)
              : <p className="text-[13px] text-ink-2">{g.nominable ? t('m22.programme.askManager') : t('m22.programme.notNominable')}</p>}
            {g.link_route && <L to={g.link_route} className="btn-outline btn-sm mt-3">{t('m22.programme.openLink')}</L>}
          </Card>
        )}
        {isManager && g.nominable && (
          <Card title={t('m22.programme.managerTitle')}>
            <p className="text-[13px] text-ink-2">{t('m22.programme.managerBody')}</p>
            <button className="btn-primary mt-3 w-full" onClick={() => setNominate(true)} data-testid="m22-nominate"><Icon name="plus" size={14} />{t('m22.programme.nominate')}</button>
            {team.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                {team.map((n) => <li key={n.id} className="flex items-center justify-between gap-2 text-[13px]"><span>{pick({ name_en: n.person_name, name_ar: n.person_name_ar }, 'name')}</span><NomPill status={n.status} /></li>)}
              </ul>
            )}
          </Card>
        )}
        <Callout title={t('m22.leadership.mirrorTitle')}>{t('m22.leadership.mirrorBody')}</Callout>
      </aside>
      <NominateModal open={nominate} onClose={() => setNominate(false)} programmes={d.programmes} fixedProgramme={g.id} />
    </div>
  );
}
