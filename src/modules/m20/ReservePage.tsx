// /opportunities/reserve (M20 · F23): the alumni and expert reserve. What it is and how it works (with sources), the experts who
// opted into the expert finder (staff read only those rows: RLS on kafaa_alumni.finder_visible), consented synthetic alumni stories,
// and the entry points for members, managers and HR. No contact details anywhere: HR arranges every contact outside Kafa'a.
import { useMemo, useState } from 'react';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, StatTile, Icon, SourceLink, SimChip } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Can } from '../../auth/guards';
import { useSession } from '../../auth/session';
import type { AlumniRow, AlumniStoriesRow } from '../../data/types';
import { HR_ROLES } from './reserve';
import { AvailChip, BandChip, EngChip, HandoffNote, IAEA_KLRM, ENEC_SR, MemberKindChip, SnapshotSkills, todayIso, useRefData, useResLabels, type RefData } from './reserveUi';

export default function ReservePage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const ref = useRefData();
  const q = useQuery(['alumni', 'alumni_stories'], async () => {
    const [members, stories] = await Promise.all([
      repo.list('alumni', { order: [['name', 'asc']] }),
      repo.list('alumni_stories', { order: [['sort', 'asc']] }),
    ]);
    return { members, stories };
  }, [me]);
  const hr = s.roles.some((r) => (HR_ROLES as readonly string[]).includes(r));
  return (
    <Page
      title={t('m20.routes.reserve.title')}
      eyebrow={t('m20.res.hub.eyebrow')}
      intro={t('m20.res.hub.intro')}
      wide
      actions={
        <>
          <Can res="opportunities" levels={['Own']}><L to="/opportunities/reserve/me" className="btn-outline btn-sm" data-testid="m20-res-me-link"><Icon name="user" size={14} />{t('m20.res.hub.myMembership')}</L></Can>
          <Can res="opportunities" levels={['W']}><L to="/opportunities/reserve/request" className="btn-outline btn-sm" data-testid="m20-res-request-link"><Icon name="plus" size={14} />{t('m20.res.hub.request')}</L></Can>
          {hr && <L to="/opportunities/reserve/hr" className="btn-primary btn-sm" data-testid="m20-res-desk-link"><Icon name="shield" size={14} />{t('m20.res.hub.desk')}</L>}
        </>
      }
    >
      <Async state={ref} isEmpty={() => false}>
        {(d) => <Async state={q} isEmpty={() => false}>{(x) => <Hub refd={d} members={x.members} stories={x.stories} me={me} />}</Async>}
      </Async>
    </Page>
  );
}

function Hub({ refd, members, stories, me }: { refd: RefData; members: AlumniRow[]; stories: AlumniStoriesRow[]; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const lab = useResLabels(refd);
  const today = todayIso();
  const mine = members.find((m) => m.person_id === me);
  const experts = members.filter((m) => m.finder_visible && m.status === 'active');
  const storyBy = new Map(members.map((m) => [m.id, m]));
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.res.hub.statExperts')} value={f.num(experts.length)} sub={t('m20.res.hub.statExpertsSub')} />
        <StatTile label={t('m20.res.hub.statSkills')} value={f.num(new Set(experts.flatMap((m) => ((m.skill_snapshot as { skill_id: string }[]) ?? []).map((x) => x.skill_id))).size)} sub={t('m20.res.hub.statSkillsSub')} />
        <StatTile label={t('m20.res.hub.statStories')} value={f.num(stories.length)} sub={t('m20.res.hub.statStoriesSub')} tone="sim" />
        <StatTile label={t('m20.res.hub.statMe')} value={mine ? t(`m20.res.memberStatus.${mine.status}`) : t('m20.res.hub.notMember')} tone={mine?.status === 'active' ? 'ok' : undefined}
          sub={<L to="/opportunities/reserve/me">{mine ? t('m20.res.hub.openMembership') : t('m20.res.hub.join')}</L>} />
      </Grid>

      <Section title={t('m20.res.hub.howTitle')} description={t('m20.res.hub.howSub')}>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m20-res-how">
          {(['optin', 'request', 'handoff'] as const).map((k, i) => (
            <li key={k} className="rounded-card border border-line bg-panel p-4">
              <div className="mb-1 flex items-center gap-2"><span className="num inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[12px] font-semibold text-eyebrow">{f.num(i + 1)}</span><span className="font-semibold">{t(`m20.res.hub.step.${k}.title`)}</span></div>
              <p className="text-[13px] text-ink-2">{t(`m20.res.hub.step.${k}.body`)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]"><SourceLink href={IAEA_KLRM.href} date="2026-10-08">{IAEA_KLRM.label}</SourceLink><SourceLink href={ENEC_SR.href} date="2026-10-08">{ENEC_SR.label}</SourceLink></div>
      </Section>

      <Section title={t('m20.res.hub.expertsTitle')} description={t('m20.res.hub.expertsSub')}>
        <ExpertFinder experts={experts} lab={lab} today={today} />
      </Section>

      <Section title={t('m20.res.hub.storiesTitle')} description={t('m20.res.hub.storiesSub')}>
        {stories.length === 0 ? <EmptyState icon="book" title={t('m20.res.hub.noStories')} /> : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m20-res-stories">
            {stories.map((st) => <StoryCard key={st.id} st={st} member={storyBy.get(st.alumni_id)} />)}
          </div>
        )}
      </Section>
      <Callout tone="sim" title={t('m20.res.hub.privacyTitle')}>{t('m20.res.hub.privacyBody')}</Callout>
    </div>
  );
}

function ExpertFinder({ experts, lab, today }: { experts: AlumniRow[]; lab: ReturnType<typeof useResLabels>; today: string }) {
  const t = useT();
  const pick = usePick();
  const [term, setTerm] = useState('');
  const shown = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return experts;
    return experts.filter((m) => [m.name, m.name_ar, lab.role(m.former_role_id), lab.family(m.former_family_id), m.headline_en ?? '', m.headline_ar ?? '', ...((m.skill_snapshot as { skill_id: string }[]) ?? []).map((s) => lab.skill(s.skill_id))].join(' ').toLowerCase().includes(q));
  }, [experts, term, lab]);
  if (!experts.length) return <EmptyState icon="users" title={t('m20.res.hub.noExperts')}>{t('m20.res.hub.noExpertsBody')}</EmptyState>;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input max-w-sm" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('m20.res.hub.searchExperts')} aria-label={t('m20.res.hub.searchExperts')} data-testid="m20-res-expert-search" />
        <span className="text-[12.5px] text-ink-3">{t('m20.res.hub.shown', { n: shown.length, total: experts.length })}</span>
      </div>
      {shown.length === 0 ? <EmptyState icon="search" title={t('m20.res.hub.noMatch')} /> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="m20-res-experts">
          {shown.map((m) => (
            <Card key={m.id} as="article" className="flex flex-col">
              <div className="flex items-start justify-between gap-2" data-testid="m20-res-expert">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{pick({ name_en: m.name, name_ar: m.name_ar }, 'name')}</div>
                  <div className="text-[12.5px] text-ink-3">{lab.role(m.former_role_id)}{m.former_org ? ` · ${lab.org(m.former_org)}` : ''}</div>
                </div>
                <MemberKindChip kind={m.kind} />
              </div>
              {pick(m, 'headline') && <p className="mt-2 text-[13px] text-ink-2">{pick(m, 'headline')}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5"><BandChip departedOn={m.departed_on} today={today} /><AvailChip availability={m.availability} hours={m.hours_month} /></div>
              <div className="mt-3"><SnapshotSkills snapshot={m.skill_snapshot} lab={lab} max={5} testId="m20-res-expert-skills" /></div>
              <div className="mt-auto pt-3">
                <div className="mb-2 flex flex-wrap gap-1">{m.engagement_prefs.map((k) => <EngChip key={k} kind={k} />)}</div>
                <HandoffNote>{t('m20.res.hub.contactViaHr')}</HandoffNote>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Can res="opportunities" levels={['W']}>
        <p className="mt-3 text-[13px]"><L to="/opportunities/reserve/request" className="link">{t('m20.res.hub.askReserve')}</L></p>
      </Can>
    </>
  );
}

function StoryCard({ st, member }: { st: AlumniStoriesRow; member: AlumniRow | undefined }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <Card as="article" className="flex flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-1.5"><EngChip kind={st.engagement} /><SimChip label={t('m20.res.hub.syntheticStory')} />{member && <MemberKindChip kind={member.kind} />}</div>
      <h3 className="text-[15.5px] font-semibold leading-snug">{pick(st, 'title')}</h3>
      <p className="mt-1 text-[13.5px] text-ink-2">{pick(st, 'body')}</p>
      {pick(st, 'quote') && <blockquote className="mt-3 border-s-2 border-accent ps-3 text-[14px] italic text-ink">“{pick(st, 'quote')}”</blockquote>}
      <div className="mt-auto pt-3 text-[12px] text-ink-3">{pick(st, 'author')} · {t('m20.res.hub.consented', { date: f.date(st.consent_on) })}</div>
    </Card>
  );
}
