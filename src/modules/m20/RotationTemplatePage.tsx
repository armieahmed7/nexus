// /opportunities/rotations/programmes/:id (M20 · F15): one rotation programme: the placement sequence with host role cards,
// durations and skill objectives (with my current level), the sourced programme duration, its cohorts, why it fits me
// (<WhyThis>), and, for HR programme owners, cohort enrolment.
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, KeyValue, WhyThis, EngineBadge, SourceLink, Stepper, StatusPill } from '../../ui';
import { useEngine } from '../../data/useEngine';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { MatchRing } from './ui';
import { rankProgrammes } from './rotationMatch';
import { OWNER_ROLES, totalMonths } from './rotation';
import { useRotations, useRotLabels, targetOf, ProgrammeChip, PlacementRail, ObjectiveList, SiteChip, stepsOf, type RotData, type Template } from './rotUi';
import { EnrolForm } from './rotEnrol';

export default function RotationTemplatePage() {
  const t = useT();
  const { id = '' } = useParams();
  const { q, person } = useRotations();
  const pick = usePick();
  const tpl = q.data?.templates.find((x) => x.id === id);
  return (
    <Page title={tpl ? pick(tpl, 'title') : t('m20.routes.rotation-programme.title')} eyebrow={<L to="/opportunities/rotations">{t('m20.rot.programme.back')}</L>} wide>
      <Async state={q} isEmpty={(d) => !d.templates.some((x) => x.id === id)} empty={<EmptyState icon="grad" title={t('m20.rot.programme.notFound')} action={<L to="/opportunities/rotations" className="btn-outline btn-sm">{t('m20.rot.programme.back')}</L>} />}>
        {(d) => <Detail d={d} tpl={d.templates.find((x) => x.id === id)!} currentRole={person?.job_role_id ?? null} family={person?.job_family_id ?? null} />}
      </Async>
    </Page>
  );
}

function Detail({ d, tpl, currentRole, family }: { d: RotData; tpl: Template; currentRole: string | null; family: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const eng = useEngine('match');
  const s = useSession();
  const owner = s.roles.some((r) => (OWNER_ROLES as readonly string[]).includes(r));
  const steps = stepsOf(tpl);
  const target = targetOf(d, currentRole);
  const r = rankProgrammes([tpl], { states: d.states, skills: d.skills, roleComps: d.roleComps, targetRole: target, family, roleLabels: lab.roleLabels, familyLabels: lab.familyLabels })[0];
  const lv = new Map(d.states.map((x) => [x.skill_id, x.level]));
  const sources = (tpl.sources as unknown as { id: string; label: string; url: string }[]) ?? [];
  const cohorts = d.cohorts.filter((c) => c.template_id === tpl.id);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card>
          <div className="mb-2 flex flex-wrap items-center gap-1.5"><ProgrammeChip programme={tpl.programme} />{tpl.status !== 'active' && <StatusPill status={tpl.status} tone="neutral">{t(`m20.rot.tplStatus.${tpl.status}`)}</StatusPill>}</div>
          <p className="text-[14.5px] leading-relaxed text-ink">{pick(tpl, 'summary')}</p>
          <div className="mt-4">
            <KeyValue items={[
              [t('m20.rot.programme.duration'), <span key="d" data-testid="m20-rot-duration">{t('m20.rot.common.duration', { min: f.num(tpl.duration_min_months), max: f.num(tpl.duration_max_months) })}</span>],
              [t('m20.rot.programme.plan'), t('m20.rot.common.placements', { n: f.num(steps.length), m: f.num(totalMonths(steps)) })],
              [t('m20.rot.programme.eligible'), (tpl.eligible_families ?? []).length ? (tpl.eligible_families ?? []).map(lab.family).join(' · ') : t('m20.rot.programme.allFamilies')],
              [t('m20.rot.programme.sources'), sources.length ? <span className="flex flex-wrap gap-x-3">{sources.map((x) => <SourceLink key={x.id} href={x.url} date="2026-10-08">{x.label}</SourceLink>)}</span> : t('m20.rot.programme.noSources')],
            ]} />
          </div>
          <div className="mt-4"><PlacementRail lab={lab} steps={steps.map((x) => ({ key: `${tpl.id}-${x.seq}`, family_id: x.family_id, months: x.months, title: pick(x as unknown as Record<string, unknown>, 'host_team') }))} /></div>
        </Card>
        <Section title={t('m20.rot.programme.placementsTitle')} description={t('m20.rot.programme.placementsSub')}>
          <ol className="space-y-3" data-testid="m20-rot-steps">
            {steps.map((x) => (
              <li key={x.seq} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="caps">{t('m20.rot.my.placementN', { n: f.num(x.seq) })} · {lab.family(x.family_id)} · {t('m20.rot.common.months', { n: f.num(x.months) })}</div>
                    <h3 className="text-[15px] font-semibold">{pick(x as unknown as Record<string, unknown>, 'host_team')}</h3>
                    <div className="text-[12.5px] text-ink-3">{t('m20.rot.programme.hostCard', { name: pick(x as unknown as Record<string, unknown>, 'host_name') || t('m20.rot.common.hostManager') })}{x.host_role_id ? ` · ${lab.role(x.host_role_id)}` : ''}</div>
                  </div>
                  {x.site_induction && <SiteChip />}
                </div>
                <div className="mt-3"><ObjectiveList objectives={x.objectives} lab={lab} myLevel={(sk) => lv.get(sk) ?? 0} /></div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
      <aside className="space-y-4">
        <Card title={t('m20.rot.programme.fit')} actions={<EngineBadge engine={eng} />}>
          <div className="flex items-center gap-3">
            <MatchRing score={r?.score ?? 0} size={64} />
            <div className="text-[13px] text-ink-2">{t('m20.rot.programme.fitSub', { n: f.num(r?.item?.gaps ?? 0), total: f.num(r?.item?.objectives ?? 0) })}</div>
          </div>
          {r && <div className="mt-3"><WhyThis reasons={r.reasons} testId="m20-rot-why" /></div>}
          <p className="mt-3 text-[12.5px] text-ink-3">{target ? t('m20.rot.programme.target', { role: lab.role(target) }) : t('m20.rot.hub.noTarget')} <L to="/my/career">{t('m20.rot.programme.navigator')}</L></p>
        </Card>
        <Card title={t('m20.rot.programme.how')}>
          <Stepper current={0} steps={[
            { id: 'enrol', label: t('m20.rot.programme.howEnrol') }, { id: 'checkin', label: t('m20.rot.programme.howCheckin') },
            { id: 'signoff', label: t('m20.rot.programme.howSignoff') }, { id: 'passport', label: t('m20.rot.programme.howPassport') },
          ]} />
          <p className="mt-3 text-[12.5px] text-ink-2">{t('m20.rot.programme.howBody')}</p>
        </Card>
        <Card title={t('m20.rot.programme.cohorts')}>
          {cohorts.length === 0 ? <p className="text-[13px] text-ink-3">{t('m20.rot.programme.noCohorts')}</p> : (
            <ul className="space-y-1.5" data-testid="m20-rot-tpl-cohorts">{cohorts.map((c) => <li key={c.id} className="flex justify-between gap-2 text-[13px]"><span>{pick(c, 'name')}</span><span className="text-ink-3">{f.date(c.intake_on)}</span></li>)}</ul>
          )}
        </Card>
        {owner && <EnrolForm d={d} tpl={tpl} lab={lab} />}
        <Callout tone="sim" title={t('m20.rot.common.mirrorTitle')}>{t('m20.rot.common.mirrorBody')}</Callout>
      </aside>
    </div>
  );
}
