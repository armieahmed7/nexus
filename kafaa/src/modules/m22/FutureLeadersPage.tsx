// /leadership/future-leaders (M22 · FS47): the Future Leaders track. A nuclear-management competency model on the IAEA INMA pattern
// (five competencies, each with descriptors at four levels and a learning route), the cohort track (nomination by HR, selection by
// the HR authority or the training manager, six modules, a policy project with an executive sponsor role), the external programmes
// it points to (sources and dates from research only, no endorsement implied), my readiness with "Why this?" and, for a selected
// participant, my modules and policy project. Concept track for the demo; Kafa'a claims no regulatory or accreditation authority.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, WhyThis, BenchmarkChips, ProgressRing, ProgressBar, Icon, SourceLink, StatusPill, TextField, TextArea, ConfirmDialog } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { FL_PROGRAMME_ID, flReasons, type FlReadiness } from './future';
import { FL_LEVEL_NAMES } from './fs54data';
import { useBi, CohortPill, ProjectPill } from './fsui';
import { useLabels, NomPill, Sources, LevelDots, type Source } from './ui';

type Comp = RowOf<'fl_competencies'>;
type Ext = RowOf<'fl_external'>;
type Cohort = RowOf<'fl_cohorts'>;
type Part = RowOf<'fl_participants'>;

export function useFutureLeaders() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  return useQuery(['leadership_programmes', 'fl_competencies', 'fl_external', 'fl_cohorts', 'fl_participants', 'leadership_nominations', 'skills'], async () => {
    const [programmes, comps, external, cohorts, parts, noms, skills] = await Promise.all([
      repo.list('leadership_programmes', { filter: { id: FL_PROGRAMME_ID } }),
      repo.list('fl_competencies', { order: [['sort', 'asc']] }),
      repo.list('fl_external', { order: [['sort', 'asc']] }),
      repo.list('fl_cohorts', { order: [['sort', 'asc']] }).catch(() => [] as Cohort[]),
      repo.list('fl_participants').catch(() => [] as Part[]),
      repo.list('leadership_nominations', { filter: { programme_id: FL_PROGRAMME_ID }, order: [['updated_at', 'desc']] }).catch(() => [] as RowOf<'leadership_nominations'>[]),
      repo.list('skills', { order: [['sort', 'asc']] }),
    ]);
    return { programme: programmes[0] ?? null, comps, external, cohorts, parts, noms, skills };
  }, [me]);
}
export type FlData = NonNullable<ReturnType<typeof useFutureLeaders>['data']>;

export default function FutureLeadersPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const me = s.identity.personId;
  const q = useFutureLeaders();
  const ready = useQuery(['person_skills'], () => (me && s.can('skills_profile', ['Own']) ? repo.rpc.flReadiness([me]) : Promise.resolve([] as FlReadiness[])), [me]);
  const hr = s.hasRole('hr_analyst', 'hr_director', 'training_manager', 'auditor');
  return (
    <Page title={t('m22.routes.leadership-future-leaders.title')} intro={t('m22.fl.intro')} eyebrow={<L to="/leadership">{t('m22.programme.back')}</L>} wide
      actions={hr ? <L to="/leadership/future-leaders/manage" className="btn-outline btn-sm" data-testid="m22-fl-manage-link"><Icon name="check" size={14} />{t('m22.fl.manageLink')}</L> : undefined}>
      <div className="space-y-8">
        <BenchmarkChips feature="FS47" />
        <Async state={q} isEmpty={(d) => d.comps.length === 0} empty={<EmptyState icon="grad" title={t('m22.fl.empty')} />}>
          {(d) => {
            const mine = d.parts.find((p) => p.person_id === me) ?? null;
            const myNom = d.noms.find((n) => n.person_id === me) ?? null;
            return (
              <>
                <Overview d={d} />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {ready.data && ready.data[0] && <Readiness x={ready.data[0]} d={d} />}
                  <Card title={t('m22.fl.myStatus')}>
                    {myNom ? (
                      <div className="space-y-1 text-[13.5px]" data-testid="m22-fl-my-nom">
                        <div className="flex flex-wrap items-center gap-2"><NomPill status={myNom.status} /><span className="text-ink-2">{t('m22.fl.cycle', { cycle: myNom.cycle })}</span></div>
                        {mine && <div className="text-ink-2">{t('m22.fl.inCohort', { cohort: d.cohorts.find((c) => c.id === mine.cohort_id)?.code ?? mine.cohort_id })}</div>}
                      </div>
                    ) : <p className="text-[13.5px] text-ink-2">{t('m22.fl.notNominated')}</p>}
                  </Card>
                </div>
                {mine && <MyTrack part={mine} d={d} />}
                <Competencies d={d} />
                <Cohorts d={d} />
                <External d={d} />
              </>
            );
          }}
        </Async>
        <Callout title={t('m22.fl.noticeTitle')}>{t('m22.fl.noticeBody')}</Callout>
      </div>
    </Page>
  );
}

function Overview({ d }: { d: FlData }) {
  const t = useT();
  const pick = usePick();
  const g = d.programme;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card title={g ? pick(g, 'title') : t('m22.fl.track')}>
        {g && <div className="space-y-2 text-[13.5px]" data-testid="m22-fl-overview">
          <p>{pick(g, 'summary')}</p>
          <p className="text-ink-2"><span className="caps me-1">{t('m22.fl.audience')}</span>{pick(g, 'audience')}</p>
          <p className="text-ink-2"><span className="caps me-1">{t('m22.fl.duration')}</span>{pick(g, 'duration')}</p>
          <p className="text-[12.5px] text-ink-3">{pick(g, 'fact')}</p>
          <Sources sources={g.sources} />
        </div>}
      </Card>
      <Card title={t('m22.fl.howTitle')}>
        <ol className="space-y-2 text-[13px]" data-testid="m22-fl-how">
          {(['nominate', 'select', 'modules', 'project', 'complete'] as const).map((k, i) => (
            <li key={k} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sunken text-[11px] font-semibold">{i + 1}</span><span>{t(`m22.fl.how.${k}`)}</span></li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Readiness({ x, d }: { x: FlReadiness; d: FlData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels(d.skills);
  const reasons = useMemo(() => flReasons(x, d.comps, lab.skillBi), [x, d.comps, lab]);
  return (
    <Card title={t('m22.fl.readyTitle')}>
      <div className="flex flex-wrap items-center gap-5" data-testid="m22-fl-readiness">
        <ProgressRing value={x.score * 100} size={80} />
        <div className="min-w-0 flex-1 space-y-2">
          {x.comps.map((c) => {
            const comp = d.comps.find((y) => y.id === c.id);
            return (
              <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_100px_44px] items-center gap-2 text-[12.5px]">
                <span className="truncate">{comp ? pick(comp, 'title') : c.id}</span>
                <ProgressBar value={c.score * 100} label={comp ? pick(comp, 'title') : c.id} />
                <span className="num text-end">{f.pct(c.score, 0)}</span>
              </div>
            );
          })}
          <WhyThis reasons={reasons} testId="m22-why-fl" />
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">{t('m22.fl.readyNote')}</p>
    </Card>
  );
}

function MyTrack({ part, d }: { part: Part; d: FlData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const cohort = d.cohorts.find((c) => c.id === part.cohort_id);
  const modules = (cohort?.modules ?? []) as { id: string; title_en: string; title_ar: string; format_en: string; format_ar: string; weeks: number }[];
  const [form, setForm] = useState({ title: part.project_title ?? '', question: part.project_question ?? '', summary: part.project_summary ?? '', sponsor_role: part.project_sponsor_role ?? '' });
  const [confirm, setConfirm] = useState(false);
  const locked = part.project_status === 'accepted' || part.project_status === 'submitted';
  const valid = form.title.trim().length >= 5 && form.question.trim().length >= 10 && form.summary.trim().length >= 20 && form.sponsor_role.trim().length >= 3;
  const save = (submit: boolean) => run(() => repo.rpc.savePolicyProject({ nomination_id: part.nomination_id, ...form, submit }));
  return (
    <Section title={t('m22.fl.myTrack')} description={cohort ? t('m22.fl.myTrackSub', { cohort: pick(cohort, 'title') }) : undefined}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m22.fl.modules', { done: f.num(part.modules_done.length), total: f.num(modules.length) })}>
          <ul className="space-y-1.5" data-testid="m22-fl-my-modules">
            {modules.map((m) => {
              const done = part.modules_done.includes(m.id);
              return <li key={m.id} className="flex items-center gap-2 text-[13px]"><Icon name={done ? 'check' : 'calendar'} size={14} className={done ? 'text-ok' : 'text-ink-3'} />{pick(m, 'title')}<span className="text-ink-3">· {pick(m, 'format')}</span></li>;
            })}
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">{t('m22.fl.modulesNote')}</p>
        </Card>
        <Card title={t('m22.fl.projectTitle')} actions={<ProjectPill status={part.project_status} />}>
          <div className="space-y-3" data-testid="m22-fl-project">
            {part.project_review_note && <Callout tone={part.project_status === 'returned' ? 'sim' : 'info'} title={t('m22.fl.reviewNote')}>{part.project_review_note}</Callout>}
            <TextField label={t('m22.fl.pTitle')} name="fl-title" value={form.title} onChange={(v) => setForm((x) => ({ ...x, title: v }))} disabled={locked} />
            <TextField label={t('m22.fl.pQuestion')} name="fl-question" value={form.question} onChange={(v) => setForm((x) => ({ ...x, question: v }))} disabled={locked} />
            <TextArea label={t('m22.fl.pSummary')} name="fl-summary" rows={4} value={form.summary} onChange={(v) => setForm((x) => ({ ...x, summary: v }))} disabled={locked} />
            <TextField label={t('m22.fl.pSponsor')} name="fl-sponsor" value={form.sponsor_role} onChange={(v) => setForm((x) => ({ ...x, sponsor_role: v }))} disabled={locked} hint={t('m22.fl.pSponsorHint')} />
            {!locked && <div className="flex flex-wrap gap-2">
              <button className="btn-outline btn-sm" disabled={!valid} onClick={() => save(false)} data-testid="m22-fl-save">{t('m22.fl.saveDraft')}</button>
              <button className="btn-primary btn-sm" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m22-fl-submit"><Icon name="check" size={14} />{t('m22.fl.submit')}</button>
            </div>}
            <p className="text-[12px] text-ink-3">{t('m22.fl.projectNote')}</p>
          </div>
          <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m22.fl.submitTitle')} consequence={t('m22.fl.submitBody')} confirmLabel={t('m22.fl.submit')} onConfirm={() => save(true)} />
        </Card>
      </div>
    </Section>
  );
}

function Competencies({ d }: { d: FlData }) {
  const t = useT();
  const pick = usePick();
  const bi = useBi();
  const lab = useLabels(d.skills);
  return (
    <Section title={t('m22.fl.modelTitle')} description={t('m22.fl.modelSub')}>
      <ul className="space-y-4" data-testid="m22-fl-competencies">
        {d.comps.map((c: Comp) => {
          const desc = (c.descriptors ?? {}) as Record<string, { en: string; ar: string }>;
          const route = (Array.isArray(c.route) ? c.route : []) as { kind: string; ref: string; title_en: string; title_ar: string }[];
          const targets = Object.entries((c.skill_targets ?? {}) as Record<string, number>);
          return (
            <li key={c.id} className="card p-4" data-testid="m22-fl-comp" data-competency={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[15px] font-semibold"><span className="text-ink-3">{c.code}</span> · {pick(c, 'title')}</div>
                  <p className="text-[13px] text-ink-2">{pick(c, 'summary')}</p>
                </div>
                <StatusPill tone="neutral">{pick(c, 'area')}</StatusPill>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <table className="w-full text-[12.5px]" data-testid="m22-fl-descriptors">
                  <caption className="sr-only">{t('m22.fl.descriptorsOf', { comp: pick(c, 'title') })}</caption>
                  <tbody>
                    {(['1', '2', '3', '4'] as const).map((lv) => (
                      <tr key={lv} className="border-t border-line align-top">
                        <th scope="row" className="w-32 py-1.5 pe-2 text-start font-semibold">{bi(FL_LEVEL_NAMES[lv])}</th>
                        <td className="py-1.5">{bi(desc[lv])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="space-y-3">
                  <div>
                    <div className="caps mb-1">{t('m22.fl.route')}</div>
                    <ol className="space-y-1 text-[12.5px]" data-testid="m22-fl-route">
                      {route.map((r, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="chip border-line bg-sunken text-ink-3">{t(`m22.fl.routeKind.${r.kind}`)}</span>
                          {r.kind === 'route' ? <L to={r.ref}>{pick(r, 'title')}</L> : r.kind === 'programme' ? <L to={`/leadership/programmes/${r.ref}`}>{pick(r, 'title')}</L> : <span>{pick(r, 'title')}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <div className="caps mb-1">{t('m22.fl.targets')}</div>
                    <ul className="space-y-1 text-[12.5px]">
                      {targets.map(([sk, lv]) => <li key={sk} className="flex items-center justify-between gap-2"><span className="truncate">{lab.skill(sk)}</span><LevelDots level={lv} label={t('m22.fl.targetLevel', { n: lv })} /></li>)}
                    </ul>
                  </div>
                  <Sources sources={c.sources} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function Cohorts({ d }: { d: FlData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!d.cohorts.length) return null;
  return (
    <Section title={t('m22.fl.cohortsTitle')} description={t('m22.fl.cohortsSub')}>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="m22-fl-cohorts">
        {d.cohorts.map((c) => (
          <li key={c.id} className="card space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{pick(c, 'title')}</span><CohortPill status={c.status} /></div>
            <div className="text-[12.5px] text-ink-2">{t('m22.fl.cohortDates', { from: f.date(c.starts_on), to: f.date(c.ends_on), seats: f.num(c.seats) })}</div>
            <ul className="space-y-0.5 text-[12.5px]">
              {((c.modules ?? []) as { id: string; title_en: string; title_ar: string; weeks: number }[]).map((m) => <li key={m.id}>· {pick(m, 'title')}</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function External({ d }: { d: FlData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <Section title={t('m22.fl.extTitle')} description={t('m22.fl.extSub')}>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m22-fl-external">
        {d.external.map((x: Ext) => (
          <li key={x.id} className="card space-y-1.5 p-4" data-testid="m22-fl-ext" data-external={x.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="font-semibold">{pick(x, 'title')}</div>
              <StatusPill tone="neutral">{t(`m22.fl.extKind.${x.kind}`)}</StatusPill>
            </div>
            <div className="text-[12.5px] text-ink-2">{pick(x, 'owner')}</div>
            <p className="text-[13px]">{pick(x, 'summary')}</p>
            <p className="text-[12.5px]"><span className="caps me-1">{t('m22.fl.extDates')}</span>{pick(x, 'dates')}</p>
            <div className="flex flex-wrap gap-1.5">{x.competency_ids.map((c) => { const comp = d.comps.find((y) => y.id === c); return <span key={c} className="chip border-line bg-panel text-ink-2">{comp ? comp.code : c}</span>; })}</div>
            <div className="flex flex-wrap gap-2">{((x.sources ?? []) as Source[]).map((s, i) => <SourceLink key={i} href={s.url} date={s.as_of ? f.date(s.as_of) : null}>{s.label}</SourceLink>)}</div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
