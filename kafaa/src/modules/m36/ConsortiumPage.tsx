// FS83 /ecosystem/consortium (public): the UAE energy consortium trainee cohort. ENEC and synthetic partner organisations (labelled) grow
// one graduate pool: the partners and their sites, shared three-day modules hosted in turn (Nordic NNTP pattern), the joint project in
// mixed-employer teams, mentors from another employer (role cards, never people), the skills the cohort builds, the SIMULATED shared
// budget and the sources (a secondary source is flagged). Signed-in ecosystem readers also see the suppressed figures (rpc.consortiumStats).
import { useState } from 'react';
import { useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, Card, Callout, Donut, StatTile, StatusPill, SourceLink, Tabs, BenchmarkChips, EmptyState } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { cohortPhase, mentorsOf, partnersOf, type ConsortiumStats, type Partner } from './consortium';
import { CohortPill, ConsortiumLabels, ModuleTimeline, useMoney, usePartnerName } from './fs82ui';
import { CellView, useSkillName, useSkills, type Row } from './ui';

export default function ConsortiumPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const reader = s.status === 'signed_in' && s.can('ecosystem', ['R', 'Own', 'OwnOrg', 'OrgW', 'Agg', 'W', 'A']);
  const q = useQuery(['consortium_cohorts', 'consortium_members', 'consortium_visits'] as unknown as Table[], async () => {
    const cohorts = ((await (repo.list('consortium_cohorts' as never) as unknown as Promise<Row[]>)) ?? []).filter((c) => c.listed !== false)
      .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0));
    let stats: ConsortiumStats | null = null;
    if (reader) { const r = await repo.rpc.consortiumStats(); stats = r.ok && r.data ? r.data : null; }
    return { cohorts, stats };
  }, [reader]);
  return (
    <Page title={t('m36.routes.ecosystem-consortium.title')} intro={t('m36.cc.intro')} wide eyebrow={<BenchmarkChips feature="FS83" />}
      actions={<div className="flex flex-wrap gap-2">
        {s.status === 'signed_in' && s.can('ecosystem', ['Own']) && <L to="/my/consortium" className="btn-primary btn-sm no-underline" data-testid="m36-cc-to-my">{t('m36.cc.toMy')}</L>}
      </div>}>
      <Async state={q} isEmpty={(d) => d.cohorts.length === 0} empty={<EmptyState title={t('m36.cc.none')} />}>{(d) => <Cohorts cohorts={d.cohorts} stats={d.stats} reader={reader} />}</Async>
    </Page>
  );
}

function Cohorts({ cohorts, stats, reader }: { cohorts: Row[]; stats: ConsortiumStats | null; reader: boolean }) {
  const t = useT();
  const today = todayIso();
  const running = cohorts.find((c) => cohortPhase(c, today) === 'running') ?? cohorts[0];
  const [tab, setTab] = useState(String(running.id));
  return (
    <div className="space-y-6" data-testid="m36-cc">
      <ConsortiumLabels />
      <Tabs value={tab} onChange={setTab} tabs={cohorts.map((c) => ({
        id: String(c.id), label: <span className="inline-flex items-center gap-1.5">{c.code}<CohortPill phase={cohortPhase(c, today)} /></span>,
        content: <Cohort c={c} stat={stats?.cohorts.find((x) => x.cohort_id === c.id) ?? null} reader={reader} />,
      }))} />
      <Callout tone="sim" title={t('m36.cc.disclaimerTitle')}>{t('m36.cc.disclaimer')}</Callout>
    </div>
  );
}

function Cohort({ c, stat, reader }: { c: Row; stat: ConsortiumStats['cohorts'][number] | null; reader: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const money = useMoney();
  const partnerName = usePartnerName();
  const skills = useSkills();
  const skillName = useSkillName(skills.data);
  const today = todayIso();
  const phase = cohortPhase(c, today);
  const partners = partnersOf(c);
  const budget = (Array.isArray(c.budget) ? c.budget : []) as { org_id: string; amount: number }[];
  const total = budget.reduce((m, b) => m + Number(b.amount), 0);
  const sources = (Array.isArray(c.sources) ? c.sources : []) as Row[];
  return (
    <div className="space-y-6" data-testid="m36-cc-cohort" data-id={c.id} data-phase={phase}>
      <Card>
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 basis-72 flex-1">
              <div className="caps">{c.code}</div>
              <h2 className="break-words text-[18px] font-semibold">{pick(c, 'title')}</h2>
              <p className="mt-1 text-[13.5px] text-ink-2">{pick(c, 'summary')}</p>
            </div>
            <CohortPill phase={phase} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label={t('m36.cc.runs')} value={<span className="text-[15px]">{t('m36.gr.range', { a: f.date(c.starts_on), b: f.date(c.ends_on) })}</span>} />
            <StatTile label={t('m36.cc.nominationsClose')} value={<span className="text-[15px]">{f.date(c.nominations_close_on)}</span>} sub={phase === 'nominating' ? t('m36.cc.nominationsOpen') : t('m36.cc.nominationsClosed')} />
            <StatTile label={t('m36.cc.partners')} value={<span className="num">{f.num(partners.length)}</span>} sub={t('m36.cc.seats', { n: f.num(partners.reduce((m, p) => m + Number(p.seats), 0)) })} />
          </div>
          {reader && <L to={`/ecosystem/consortium/${c.id}`} className="btn-outline btn-sm no-underline" data-testid="m36-cc-to-cohort">{t('m36.cc.toCohort')}</L>}
        </div>
      </Card>

      <Section title={t('m36.cc.partnersTitle')} description={t('m36.cc.partnersIntro')}>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="m36-cc-partners">
          {partners.map((p: Partner) => (
            <li key={p.org_id} className="card p-3" data-testid="m36-cc-partner" data-org={p.org_id} data-synthetic={p.synthetic ? 'yes' : 'no'}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="caps">{p.code}</span>
                <span className="flex flex-wrap gap-1">
                  {p.role === 'lead' && <StatusPill tone="accent">{t('m36.cc.lead')}</StatusPill>}
                  {p.synthetic && <StatusPill tone="sim">{t('m36.cc.syntheticChip')}</StatusPill>}
                </span>
              </div>
              <div className="mt-1 break-words font-semibold">{pick(p as unknown as Row, 'name')}</div>
              <div className="text-[12.5px] text-ink-2">{pick(p as unknown as Row, 'site')}</div>
              <div className="mt-1 text-[12.5px]"><span className="text-ink-3">{t('m36.cc.visitSkill')}</span> <L to={`/skills/${p.visit_skill}`}>{skillName(p.visit_skill)}</L></div>
              <div className="text-[12.5px] text-ink-3">{t('m36.cc.seats', { n: f.num(Number(p.seats)) })}</div>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Section title={t('m36.cc.modulesTitle')} description={t('m36.cc.modulesIntro')}>
          <ModuleTimeline cohort={c} today={today} />
        </Section>
        <div className="space-y-4">
          <Card title={t('m36.cc.projectTitle')}>
            <p className="text-[13px]" data-testid="m36-cc-project">{pick(c, 'project')}</p>
            <p className="mt-2 text-[12.5px] text-ink-2"><span className="font-semibold">{t('m36.cc.deliverable')}</span> {pick(c, 'deliverable')}</p>
          </Card>
          <Card title={t('m36.cc.mentorsTitle')}>
            <p className="mb-2 text-[12.5px] text-ink-2">{t('m36.cc.mentorsIntro')}</p>
            <ul className="space-y-1 text-[13px]" data-testid="m36-cc-mentors">
              {mentorsOf(c).map((m) => <li key={m.id} className="flex flex-wrap justify-between gap-2"><span>{pick(m as unknown as Row, 'label')}</span><span className="text-ink-3">{partnerName(c, m.org_id)}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m36.cc.skillsTitle')}>
          <ul className="flex flex-wrap gap-2" data-testid="m36-cc-skills">
            {(c.skills as string[] ?? []).map((id) => <li key={id}><L to={`/skills/${id}`} className="chip whitespace-normal border-line text-ink-2 no-underline">{skillName(id)}</L></li>)}
          </ul>
          <p className="mt-2 text-[12.5px] text-ink-2">{t('m36.cc.evidenceRule')}</p>
        </Section>
        <Section title={t('m36.cc.budgetTitle')} description={t('m36.cc.budgetIntro')}>
          <div className="flex flex-wrap items-center gap-4" data-testid="m36-cc-budget" data-simulated={c.simulated ? 'yes' : 'no'}>
            <Donut title={t('m36.cc.budgetTitle')} data={budget.map((b) => ({ label: partnerName(c, b.org_id), value: Number(b.amount) }))} center={<span className="num text-[12px]">{money(total)}</span>} />
            <StatusPill tone="sim">{t('common.simulated')}</StatusPill>
          </div>
        </Section>
      </div>

      {reader && stat && (
        <Section title={t('m36.cc.figuresTitle')} description={t('m36.cc.figuresIntro', { n: f.num(10) })}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m36-cc-figures">
            <StatTile label={t('m36.cc.trainees')} value={<CellView c={stat.trainees} testId="m36-cc-fig-trainees" />} />
            <StatTile label={t('m36.cc.nominated')} value={<CellView c={stat.nominated} testId="m36-cc-fig-nominated" />} />
            <StatTile label={t('m36.cc.visitsConfirmed')} value={<CellView c={stat.visits_confirmed} testId="m36-cc-fig-visits" />} tone="ok" />
            <StatTile label={t('m36.cc.hours')} value={stat.hours_confirmed == null ? <span className="text-ink-3" data-suppressed="true">{t('common.suppressedShort')}</span> : <span className="num">{f.num(stat.hours_confirmed)}</span>} />
          </div>
        </Section>
      )}

      <Section title={t('m36.cc.sourcesTitle')}>
        <ul className="space-y-1 text-[13px]" data-testid="m36-cc-sources">
          {sources.map((s) => (
            <li key={String(s.url)} className="flex flex-wrap items-center gap-2" data-secondary={s.secondary ? 'yes' : 'no'}>
              <SourceLink href={String(s.url)} date={s.as_of ? f.date(s.as_of) : null}>{s.label}</SourceLink>
              {s.secondary && <StatusPill tone="reserved">{t('m36.cc.secondary')}</StatusPill>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-ink-3">{t('m36.cc.sourcesNote')}</p>
      </Section>
    </div>
  );
}
