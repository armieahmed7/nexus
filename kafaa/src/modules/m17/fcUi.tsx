// FS31 shared UI (FS wave D · E3): data for the future-skills credentials pages (definitions, my awards and eligibility, the
// gigs and rotations that name a strategic credential, and the content routes that can satisfy each criterion), the strategic-tier
// chip, the unlock line with its reasons (<WhyThis>) and "Where this credential takes you".
import { Icon, StatusPill, WhyThis } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, L } from '../../i18n';
import type { Reason } from '../../domain/engines/types';
import type { DefRow } from './microcred';
import type { McData } from './mcUi';
import { routesFor, takesYou, type ContentWorld, type Route, type UnlockRow, type UnlockView } from './futureCreds';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export interface FcData extends McData {
  unlocks: UnlockRow[];
  mine: UnlockView[];
  opportunities: Row[];
  rotation_templates: Row[];
  content: ContentWorld;
}
export function useFcData(me: string | null) {
  const repo = useRepo();
  return useQuery(['microcred_defs', 'microcred_awards', 'microcred_unlocks', 'person_skills', 'job_roles', 'skills', 'opportunities', 'rotation_templates'], async (): Promise<FcData> => {
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const [defs, awards, el, roles, skills, unlocks, mine, opportunities, rotation_templates, courses, course_skill_links, adaptive_banks, performance_tasks, twin_scenarios] = await Promise.all([
      repo.list('microcred_defs', { order: [['sort', 'asc']] }), repo.list('microcred_awards', { filter: { person_id: me ?? '' } }), repo.rpc.microcredEligibility(null),
      repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('skills'), safe(repo.list('microcred_unlocks')), repo.rpc.credentialUnlocks(null),
      safe(repo.list('opportunities')), safe(repo.list('rotation_templates')), safe(repo.list('courses')), safe(repo.list('course_skill_links')), safe(repo.list('adaptive_banks')), safe(repo.list('performance_tasks')),
      safe(repo.list('twin_scenarios', { filter: { status: 'published' } })), // FS wave E integration (FS40 -> FS31)
    ]);
    return {
      today: new Date().toISOString().slice(0, 10), me: me ?? '', defs: defs as unknown as DefRow[], awards: awards as never, items: el.allowed ? el.items : [], roles, skills,
      unlocks: unlocks as unknown as UnlockRow[], mine: mine.allowed ? mine.items : [], opportunities, rotation_templates,
      content: { courses, course_skill_links, adaptive_banks, performance_tasks, opportunities, skills, twin_scenarios },
    };
  }, [me]);
}

export function StrategicChip({ on = true }: { on?: boolean }) {
  const t = useT();
  if (!on) return null;
  return <span className="chip border-accent/50 bg-accent/10 font-semibold text-accent" data-testid="m17-fc-strategic"><Icon name="sparkle" size={12} /> {t('m17.fc.strategic')}</span>;
}

/** One gig or rotation that names a credential: open or locked for me, with the reasons. */
export function UnlockLine({ u }: { u: UnlockView }) {
  const t = useT();
  const pick = usePick();
  const href = u.target_kind === 'opportunity' ? `/opportunities/${u.target_id}` : '/opportunities/rotations';
  return (
    <li className={`flex items-start gap-2 rounded-card border px-3 py-2 ${u.unlocked ? 'border-ok/40 bg-ok/5' : 'border-line'}`} data-testid="m17-fc-unlock" data-target={u.target_id} data-unlocked={u.unlocked ? 'yes' : 'no'}>
      <Icon name={u.unlocked ? 'check' : 'lock'} size={14} className={`mt-1 ${u.unlocked ? 'text-ok' : 'text-ink-3'}`} />
      <span className="min-w-0 flex-1">
        <span className="caps me-1.5">{t(`m17.fc.kind.${u.target_kind}`)}</span>
        <L to={href} className="text-[13.5px] font-semibold">{pick(u, 'title')}</L>
        <span className="block text-[12px] text-ink-3">{t(u.unlocked ? 'm17.fc.openToYou' : !u.strategic ? 'm17.fc.tierOff' : 'm17.fc.lockedNeed', { code: u.def_code })}</span>
      </span>
      <WhyThis reasons={u.reasons as Reason[]} testId="m17-fc-why" />
    </li>
  );
}

/** "Where this credential takes you": roles in the career catalogue, gigs and rotations that ask for it (with my state). */
export function TakesYou({ d, def }: { d: FcData; def: DefRow }) {
  const t = useT();
  const pick = usePick();
  const tk = takesYou(def, { unlocks: d.unlocks, opportunities: d.opportunities, rotation_templates: d.rotation_templates, job_roles: d.roles });
  const mine = d.mine.filter((u) => u.def_code === def.code);
  const none = !tk.roles.length && !mine.length;
  return (
    <div className="space-y-3" data-testid="m17-fc-takes">
      {tk.roles.length > 0 && (
        <div>
          <h3 className="caps mb-1.5">{t('m17.fc.takes.roles')}</h3>
          <ul className="flex flex-wrap gap-1.5">{tk.roles.map((r) => <li key={r.id}><L to={`/careers/roles/${r.id}`} className="chip max-w-full whitespace-normal border-line text-ink-2 no-underline hover:border-accent">{pick(r, 'title')}</L></li>)}</ul>
        </div>
      )}
      {mine.length > 0 && (
        <div>
          <h3 className="caps mb-1.5">{t('m17.fc.takes.gigs')}</h3>
          <ul className="space-y-1.5">{mine.map((u) => <UnlockLine key={u.id} u={u} />)}</ul>
        </div>
      )}
      {none && <p className="text-[13px] text-ink-3">{t('m17.fc.takes.none')}</p>}
    </div>
  );
}

const ROUTE_ICON: Record<Route['kind'], string> = { course: 'book', adaptive: 'chart', task: 'briefcase', opportunity: 'users', manual: 'user', twin: 'chart' };
/** How each criterion can be met: the courses (FS19 marked), adaptive banks, performance tasks or opportunities that evidence it. */
export function HowToEarn({ d, def }: { d: FcData; def: DefRow }) {
  const t = useT();
  const pick = usePick();
  const title = (r: Route): string => {
    const x = r.kind === 'course' ? d.content.courses.find((c) => c.id === r.id) : r.kind === 'adaptive' ? d.content.adaptive_banks.find((b) => b.id === r.id) : r.kind === 'task' ? d.content.performance_tasks.find((p) => p.id === r.id) : r.kind === 'opportunity' ? d.opportunities.find((o) => o.id === r.id) : r.kind === 'twin' ? (d.content.twin_scenarios ?? []).find((x) => x.id === r.id) : null;
    if (!x) return r.kind === 'manual' ? t('m17.fc.route.manual') : r.id;
    return x.title_en ? pick(x, 'title') : x.name_en ? pick(x, 'name') : r.id;
  };
  const href = (r: Route) => (r.kind === 'course' ? `/learn/course/${r.id}` : r.kind === 'adaptive' ? `/my/assessments/adaptive/${r.id}` : r.kind === 'task' ? `/my/assessments/tasks/${r.id}` : r.kind === 'opportunity' ? `/opportunities/${r.id}` : r.kind === 'twin' ? `/my/twin-drills/${r.id}` : null);
  return (
    <ul className="space-y-2" data-testid="m17-fc-routes">
      {(def.criteria ?? []).map((c) => {
        const all = routesFor(c, d.content);
        const rs = [...all.filter((r) => r.kind !== 'twin').slice(0, 4), ...all.filter((r) => r.kind === 'twin').slice(0, 2)]; // FS wave E: twin drills always shown
        return (
          <li key={c.key} className="rounded-card border border-line p-2.5" data-key={c.key} data-routes={rs.length}>
            <div className="text-[13px] font-semibold">{pick(c, 'label')}</div>
            {rs.length ? (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {rs.map((r) => { const h = href(r); const body = <><Icon name={ROUTE_ICON[r.kind]} size={12} /> {title(r)}{r.level != null && <span className="text-ink-3"> · L{r.level}</span>}{r.fs19 && <StatusPill tone="accent" status="fs19">{t('m17.fc.route.fs19')}</StatusPill>}{r.kind === 'twin' && <span className="text-ink-3" data-testid="m17-fc-route-twin"> · {t('m17.fc.route.twin')}</span>}</>; return (
                  <li key={`${r.kind}:${r.id}`}>{h ? <L to={h} className="chip max-w-full whitespace-normal border-line text-ink-2 no-underline hover:border-accent">{body}</L> : <span className="chip border-line text-ink-2">{body}</span>}</li>
                ); })}
              </ul>
            ) : <p className="mt-1 text-[12px] text-bad">{t('m17.fc.route.none')}</p>}
          </li>
        );
      })}
    </ul>
  );
}
