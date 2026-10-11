// /opportunities/rotations (M20 · F15): the rotations and job-shadowing hub. My current rotation at a glance, the programme
// catalogue ranked by how much each closes my gaps (useEngine('match') + <WhyThis>), and suggested shadowing hosts.
import { useMemo } from 'react';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, StatTile, WhyThis, EngineBadge, Icon, SourceLink, ProgressRing } from '../../ui';
import { useEngine } from '../../data/useEngine';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Can } from '../../auth/guards';
import { useSession } from '../../auth/session';
import { MatchRing } from './ui';
import { rankHosts, rankProgrammes } from './rotationMatch';
import { useRotations, useRotLabels, targetOf, ProgrammeChip, PlacementRail, SiteChip, PhasePill, ShadowPill, stepsOf, objectivesOf, checkinOf, midOf, todayIso, type RotData, type Placement } from './rotUi';
import { OWNER_ROLES, phaseOf, totalMonths } from './rotation';

export default function RotationsPage() {
  const t = useT();
  const { q, me, person } = useRotations();
  const s = useSession();
  const owner = s.roles.some((r) => (OWNER_ROLES as readonly string[]).includes(r));
  return (
    <Page
      title={t('m20.routes.rotations.title')}
      eyebrow={t('m20.rot.hub.eyebrow')}
      intro={t('m20.rot.hub.intro')}
      wide
      actions={
        <>
          <L to="/opportunities/rotations/my" className="btn-outline btn-sm" data-testid="m20-rot-my-link"><Icon name="user" size={14} />{t('m20.rot.hub.myRotation')}</L>
          <L to="/opportunities/rotations/shadow" className="btn-outline btn-sm"><Icon name="users" size={14} />{t('m20.rot.hub.shadow')}</L>
          <L to="/opportunities/rotations/host" className="btn-outline btn-sm"><Icon name="check" size={14} />{t('m20.rot.hub.host')}</L>
          <L to="/opportunities/rotations/future" className="btn-outline btn-sm" data-testid="m20-rot-future-link"><Icon name="sparkle" size={14} />{t('m20.fs.link.futureRotations')}</L>
          <Can res="opportunities" levels={['Agg', 'A']}><L to="/opportunities/rotations/board" className="btn-outline btn-sm"><Icon name="chart" size={14} />{t('m20.rot.hub.board')}</L></Can>
          {owner && <L to="/opportunities/rotations/design" className="btn-primary btn-sm"><Icon name="plus" size={14} />{t('m20.rot.hub.design')}</L>}
        </>
      }
    >
      <Async state={q} isEmpty={() => false}>{(d) => <Hub d={d} me={me} currentRole={person?.job_role_id ?? null} family={person?.job_family_id ?? null} />}</Async>
    </Page>
  );
}

function Hub({ d, me, currentRole, family }: { d: RotData; me: string | null; currentRole: string | null; family: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const eng = useEngine('match');
  const today = todayIso();
  const target = targetOf(d, currentRole);
  const ctx = { states: d.states, skills: d.skills, roleComps: d.roleComps, targetRole: target, family, roleLabels: lab.roleLabels, familyLabels: lab.familyLabels };
  const programmes = useMemo(() => rankProgrammes(d.templates.filter((x) => x.status === 'active'), ctx), [d, target, family]); // eslint-disable-line react-hooks/exhaustive-deps
  const hosts = useMemo(() => rankHosts(d.hosts.filter((h) => h.active && h.listed), me, ctx).slice(0, 3), [d, me, target, family]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = d.placements.filter((p) => p.person_id === me);
  const enrolments = [...new Set(mine.map((p) => p.enrolment_id))];
  const myShadow = d.shadows.filter((r) => r.person_id === me);
  const openShadow = myShadow.filter((r) => r.status === 'requested' || r.status === 'approved');
  const signed = mine.filter((p) => p.status === 'signed_off').length;
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.rot.hub.statProgrammes')} value={f.num(d.templates.filter((x) => x.status === 'active').length)} sub={t('m20.rot.hub.statProgrammesSub', { n: f.num(d.cohorts.length) })} />
        <StatTile label={t('m20.rot.hub.statMine')} value={mine.length ? `${f.num(signed)}/${f.num(mine.length)}` : '—'} tone={mine.length ? 'ok' : undefined} sub={mine.length ? t('m20.rot.hub.statMineSub') : t('m20.rot.hub.statMineNone')} />
        <StatTile label={t('m20.rot.hub.statHosts')} value={f.num(d.hosts.filter((h) => h.listed).length)} sub={t('m20.rot.hub.statHostsSub')} />
        <StatTile label={t('m20.rot.hub.statShadow')} value={f.num(openShadow.length)} sub={<L to="/opportunities/rotations/my?tab=shadow">{t('m20.rot.hub.statShadowSub', { n: f.num(myShadow.filter((r) => r.status === 'completed').length) })}</L>} />
      </Grid>

      {enrolments.length > 0 && (
        <Section title={t('m20.rot.hub.yourRotation')}>
          <div className="space-y-4">{enrolments.map((e) => <CurrentCard key={e} d={d} rows={mine.filter((p) => p.enrolment_id === e)} today={today} />)}</div>
        </Section>
      )}

      <Section title={t('m20.rot.hub.programmes')} description={t('m20.rot.hub.programmesSub', { role: target ? lab.role(target) : t('m20.rot.hub.noTarget') })} actions={<EngineBadge engine={eng} />}>
        {programmes.length === 0 ? <EmptyState icon="grad" title={t('m20.rot.hub.noProgrammes')} /> : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m20-rot-programmes">
            {programmes.map((r) => {
              const p = r.item!.programme;
              const steps = stepsOf(p);
              return (
                <Card as="article" key={p.id} className="flex flex-col">
                  <div className="flex items-start gap-3" data-testid="m20-rot-programme">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap gap-1.5"><ProgrammeChip programme={p.programme} />{!r.item!.eligible && <span className="chip border-line bg-sunken text-ink-3">{t('m20.rot.hub.otherFamilies')}</span>}</div>
                      <h3 className="text-[15.5px] font-semibold leading-snug"><L to={`/opportunities/rotations/programmes/${p.id}`} className="link-plain hover:underline">{pick(p, 'title')}</L></h3>
                      <div className="mt-0.5 text-[12.5px] text-ink-2">{t('m20.rot.common.duration', { min: f.num(p.duration_min_months), max: f.num(p.duration_max_months) })} · {t('m20.rot.common.placements', { n: f.num(steps.length), m: f.num(totalMonths(steps)) })}</div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5"><MatchRing score={r.score} /><span className="caps">{t('m20.rot.common.fit')}</span></div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13.5px] text-ink-2">{pick(p, 'summary')}</p>
                  <div className="mt-3"><PlacementRail lab={lab} steps={steps.map((s) => ({ key: `${p.id}-${s.seq}`, family_id: s.family_id, months: s.months, title: pick(s as unknown as Record<string, unknown>, 'host_team') }))} /></div>
                  {(p.sources as unknown as { id: string; label: string; url: string }[]).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-3 text-[12px]">{(p.sources as unknown as { id: string; label: string; url: string }[]).map((s) => <SourceLink key={s.id} href={s.url} date="2026-10-08">{s.label}</SourceLink>)}</div>
                  )}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 mt-3">
                    <WhyThis reasons={r.reasons} testId="m20-rot-why" />
                    <L to={`/opportunities/rotations/programmes/${p.id}`} className="btn-primary btn-sm">{t('m20.rot.hub.viewProgramme')}<Icon name="chevron" size={13} /></L>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-ink-3">{t('m20.rot.hub.enrolNote')}</p>
      </Section>

      <Section title={t('m20.rot.hub.shadowTitle')} description={t('m20.rot.hub.shadowSub')}
        actions={<><L to="/opportunities?kind=shadowing" className="btn-ghost btn-sm">{t('m20.rot.hub.marketShadow')}</L><L to="/opportunities/rotations/shadow" className="btn-primary btn-sm" data-testid="m20-rot-shadow-link"><Icon name="plus" size={14} />{t('m20.rot.hub.requestShadow')}</L></>}>
        {hosts.length === 0 ? <EmptyState icon="users" title={t('m20.rot.shadow.noHosts')} /> : (
          <Grid cols={3}>
            {hosts.map((r) => {
              const h = r.item!.host;
              return (
                <Card key={h.id} as="article">
                  <div className="flex items-start justify-between gap-2" data-testid="m20-rot-host">
                    <div className="min-w-0">
                      <div className="font-semibold">{pick({ name_en: h.name, name_ar: h.name_ar }, 'name')}</div>
                      <div className="text-[12.5px] text-ink-3">{lab.role(h.role_id)} · {lab.family(h.family_id)}</div>
                    </div>
                    <MatchRing score={r.score} size={44} />
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">{h.skill_ids.map((s) => <li key={s} className="chip border-accent/30 bg-accent-soft text-eyebrow">{lab.skill(s)}</li>)}</ul>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <WhyThis reasons={r.reasons} />
                    {h.site_induction && <SiteChip />}
                  </div>
                </Card>
              );
            })}
          </Grid>
        )}
      </Section>
      <Callout tone="sim" title={t('m20.rot.common.mirrorTitle')}>{t('m20.rot.common.mirrorBody')}</Callout>
    </div>
  );
}

function CurrentCard({ d, rows, today }: { d: RotData; rows: Placement[]; today: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  const tpl = d.templates.find((x) => x.id === sorted[0]?.template_id);
  const cur = sorted.find((p) => ['in_progress', 'overdue'].includes(phaseOf(p, today))) ?? sorted.find((p) => phaseOf(p, today) === 'upcoming') ?? sorted[sorted.length - 1];
  const done = sorted.filter((p) => p.status === 'signed_off').length;
  const ck = cur ? checkinOf(cur) : null;
  const daysLeft = cur ? Math.max(0, Math.round((Date.parse(`${cur.ends_on}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)) : 0;
  return (
    <Card className="border-accent/40 shadow-card">
      <div className="flex flex-wrap items-start gap-4" data-testid="m20-rot-current">
        <ProgressRing value={Math.round((100 * done) / Math.max(1, sorted.length))} size={64} label={`${f.num(done)}/${f.num(sorted.length)}`} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1.5">{tpl && <ProgrammeChip programme={tpl.programme} />}<span className="chip border-line bg-sunken text-ink-2">{lab.cohort(sorted[0]?.cohort_id)}</span></div>
          <div className="text-[15.5px] font-semibold">{tpl ? pick(tpl, 'title') : lab.template(sorted[0]?.template_id)}</div>
          {cur && (
            <div className="mt-1 text-[13px] text-ink-2">
              {t('m20.rot.hub.now', { seq: f.num(cur.seq), team: pick(cur, 'host_team') })} · {f.date(cur.starts_on)} – {f.date(cur.ends_on)}
              {phaseOf(cur, today) === 'in_progress' && <> · {t('m20.rot.hub.daysLeft', { n: f.num(daysLeft) })}</>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {cur && <PhasePill p={cur} today={today} />}
          {cur?.site_induction && <SiteChip />}
        </div>
      </div>
      <div className="mt-3"><PlacementRail lab={lab} today={today} steps={sorted.map((p) => ({ key: p.id, family_id: p.family_id, months: Math.max(1, Math.round((Date.parse(p.ends_on) - Date.parse(p.starts_on)) / (30.4 * 86_400_000))), title: pick(p, 'host_team'), starts_on: p.starts_on, ends_on: p.ends_on, status: p.status }))} /></div>
      {cur && cur.status !== 'signed_off' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-btn bg-sunken/60 px-3 py-2 text-[13px]">
          <span>{ck ? t('m20.rot.hub.checkinDone', { d: f.date(ck.at) }) : t('m20.rot.hub.checkinDue', { d: f.date(midOf(cur)) })} · {t('m20.rot.hub.objectives', { n: f.num(objectivesOf(cur).length) })}</span>
          <L to="/opportunities/rotations/my" className="btn-outline btn-sm">{t('m20.rot.hub.openPlan')}</L>
        </div>
      )}
      {d.shadows.some((r) => r.status === 'approved' && r.person_id === rows[0]?.person_id) && (
        <div className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-2"><ShadowPill status="approved" />{t('m20.rot.hub.shadowApproved')}</div>
      )}
    </Card>
  );
}
