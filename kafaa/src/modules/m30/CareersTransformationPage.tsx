// /careers/roles/:slug/transformation (M30 · FS11, public summary). How a current role is expected to change: the published public
// summary, the technology drivers, the role archetype and what it means for learning, the skills that come in by 2030 and 2035 (names
// only, from the published FS05 profiles), and the dated timeline. No numbers: no headcount, shares, levels or months (those are on the
// signed-in /my/role-2030). Security, safeguards and cyber roles show the career path only. Planning assumption, no deployment
// decision implied.
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, SourceLink } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { usePick, useT, L } from '../../i18n';
import { useCrumbLabel } from '../../shell/crumbs';
import { isPathOnly, transformRole } from './transform';
import { ArchetypeCard, BenchTies, DriverChip, FS11, MilestoneTimeline, NoDeployNote, RefGaps, useRefData, useRefLabel, type RefData } from './ui';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function CareersTransformationPage() {
  const t = useT();
  const { slug = '' } = useParams();
  const ref = useRefData();
  return (
    <Async state={ref}>{(d) => {
      const role = d.roleById.get(slug);
      if (!role || (role.lifecycle ?? 'current') !== 'current') {
        return <Page title={t('m30.routes.careers-role-transformation.title')}><EmptyState title={t('m30.pub.notFound')}><L to="/careers">{t('m30.pub.toCareers')}</L></EmptyState></Page>;
      }
      return <View d={d} role={role} reload={ref.reload} />;
    }}</Async>
  );
}

function View({ d, role, reload }: { d: RefData; role: Row; reload: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const label = useRefLabel(d);
  const title = pick(role, 'title');
  useCrumbLabel(t('m30.pub.crumb', { role: title }));
  const map = d.mapByRole.get(role.id);
  const path = isPathOnly(role as never);
  const versions = useQuery(['role_profile_versions'], () => repo.list('role_profile_versions', { filter: { role_id: role.id } }).catch(() => []), [role.id]);
  return (
    <Page title={t('m30.pub.title', { role: title })} intro={t('m30.pub.intro')}
      eyebrow={<BenchTies feature={FS11} />}
      actions={<L to={`/my/role-2030?role=${role.id}`} className="btn-primary no-underline" data-testid="m30-pub-signin">{t('m30.pub.mine')}</L>}>
      <div className="space-y-6" data-testid="m30-public">
        <RefGaps d={d} onRetry={reload} />
        {!map ? <EmptyState title={t('m30.pub.noMap')} /> : path ? (
          <Callout tone="info" title={t('m30.pathOnly.title')}><span data-testid="m30-path-only">{pick(map, 'public_summary')}</span></Callout>
        ) : (
          <>
            <Card className="border-accent/40">
              <p className="text-[15px]" data-testid="m30-pub-summary">{pick(map, 'public_summary')}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{(map.drivers as string[]).map((x) => <DriverChip key={x} driver={x} />)}</div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">{(map.sources as Row[]).map((s) => <SourceLink key={s.url} href={s.url} date={s.as_of}>{s.label}</SourceLink>)}</div>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ArchetypeCard id={map.archetype} d={d} />
              <Card title={t('m30.pub.skillsTitle')} eyebrow={t('m30.pub.skillsEyebrow')}>
                <Async state={versions}>{(vs) => {
                  const m = transformRole({ role: role as never, map: null, versions: vs as never, tasks: [], taskSkills: [], levels: [], skills: [...d.skillById.values()] as never, courses: [], mine: null });
                  const names = (h: string) => [...new Set(m.added.filter((a) => a.horizon === h).map((a) => label(a.kind, a.ref_id)))];
                  return (
                    <div className="space-y-3" data-testid="m30-pub-skills">
                      {(['2030', '2035'] as const).map((h) => (
                        <div key={h}>
                          <div className="caps mb-1">{t(`m30.pub.by.${h}`)}</div>
                          {names(h).length ? <ul className="flex flex-wrap gap-1.5">{names(h).map((n) => <li key={n} className="chip border-accent/30 bg-accent-soft text-eyebrow">{n}</li>)}</ul> : <p className="text-[12.5px] text-ink-3">{t('m30.pub.none')}</p>}
                        </div>
                      ))}
                    </div>
                  );
                }}</Async>
              </Card>
            </div>
          </>
        )}
        <Section title={t('m30.timeline.title')} description={t('m30.timeline.desc')}><MilestoneTimeline d={d} /></Section>
        <NoDeployNote />
      </div>
    </Page>
  );
}
