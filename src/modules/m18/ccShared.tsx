/**
 * F12 Career conversations: presentation pieces shared by the employee page (/my/career/conversations), the line manager's
 * workspace (/team/conversations) and the talent-review signal (AspirationSignal.tsx): the pre-filled agenda, the preparation
 * summary, the agreed actions, cadence and status pills, and the bilingual refusal messages.
 */
import type { ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { CheckboxField, Icon, StatusPill, WhyThis, useToast, type PillTone } from '../../ui';
import { L, useFormat, usePick, useT, hasKey } from '../../i18n';
import type { Result } from '../../data';
import { BandPill, ReadinessRing } from './shared';
import type { Agenda, AgendaTarget, Action, Cadence, CadenceState, ConvRow, Prep } from './conversations';
import type { ConceptBand } from './futureRoles';
import type { CareerReadiness } from './career';
import { ConceptBandPill, ConceptChip, ConceptRing } from './futureUi';

/** Catalogue labels the conversation screens need (public or staff reads). */
export function useCcCatalogue() {
  const repo = useRepo();
  return useQuery(['job_roles', 'skills', 'competencies', 'qual_standards', 'courses'], async () => {
    const [roles, skills, competencies, standards, courses] = await Promise.all([
      repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('skills'), repo.list('competencies'), repo.list('qual_standards'), repo.list('courses'),
    ]);
    return {
      roles, courses,
      roleById: new Map(roles.map((r) => [r.id, r])), skillById: new Map(skills.map((s) => [s.id, s])), compById: new Map(competencies.map((c) => [c.id, c])),
      stdById: new Map(standards.map((s) => [s.id, s])), courseById: new Map(courses.map((c) => [c.id, c])),
    };
  }, []);
}
export type CcCatalogue = NonNullable<ReturnType<typeof useCcCatalogue>['data']>;

/** Refusal message in the current language (falls back to the server's English message). */
export function useRefusal() {
  const t = useT();
  return (r: Result<unknown>) => (hasKey(`m18.cc.refuse.${r.code}`) ? t(`m18.cc.refuse.${r.code}`) : r.message);
}

export const CADENCE_TONE: Record<CadenceState, PillTone> = { ok: 'ok', due_soon: 'sim', overdue: 'bad' };
export function CadencePill({ c }: { c: Pick<Cadence, 'state' | 'due_on'> }) {
  const t = useT();
  const f = useFormat();
  return (
    <span data-testid="m18-cc-cadence" data-state={c.state}>
      <StatusPill tone={CADENCE_TONE[c.state]}>{c.due_on ? t(`m18.cc.cadence.${c.state}`, { date: f.date(c.due_on) }) : t('m18.cc.cadence.never')}</StatusPill>
    </span>
  );
}
export function statusKey(r: Pick<ConvRow, 'status' | 'prep_submitted_at' | 'employee_agrees'>) {
  if (r.status === 'acknowledged') return r.employee_agrees === false ? 'ack_comment' : 'acknowledged';
  if (r.status === 'held') return 'held';
  return r.prep_submitted_at ? 'shared' : 'draft';
}
const STATUS_TONE: Record<string, PillTone> = { draft: 'neutral', shared: 'info', held: 'sim', acknowledged: 'ok', ack_comment: 'accent' };
export function ConvStatusPill({ r }: { r: Pick<ConvRow, 'status' | 'prep_submitted_at' | 'employee_agrees'> }) {
  const t = useT();
  const k = statusKey(r);
  return <span data-testid="m18-cc-status" data-status={k}><StatusPill tone={STATUS_TONE[k]}>{t(`m18.cc.status.${k}`)}</StatusPill></span>;
}

function Block({ title, icon, toggle, children, testId }: { title: ReactNode; icon: string; toggle?: ReactNode; children: ReactNode; testId: string }) {
  return (
    <section className="rounded-card border border-line bg-panel p-3" data-testid={testId}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold"><Icon name={icon} size={15} className="text-eyebrow" />{title}</h3>
        {toggle}
      </div>
      {children}
    </section>
  );
}

/**
 * The pre-filled agenda. `include` + `onInclude` (employee mode) show the share toggles for the shortlist, roadmap and coach
 * progress; `mine` adds links to the person's own pages. In the manager's view the agenda only holds what the person shares.
 */
export function AgendaView({ a, cat, include, onInclude, mine }: { a: Agenda; cat: CcCatalogue; include?: Prep['include']; onInclude?: (k: keyof Prep['include'], v: boolean) => void; mine?: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const tog = (k: keyof Prep['include']) => include && onInclude ? <CheckboxField label={t('m18.cc.agenda.include')} checked={include[k]} onChange={(v) => onInclude(k, v)} /> : null;
  const off = (k: keyof Prep['include']) => !!include && !include[k];
  return (
    <div className="space-y-3" data-testid="m18-cc-agenda">
      <p className="text-[12.5px] text-ink-3">{a.shared_only ? t('m18.cc.agenda.sharedOnly', { date: f.date(a.built_on) }) : t('m18.cc.agenda.builtOn', { date: f.date(a.built_on) })}</p>
      <Block title={t('m18.cc.agenda.passport')} icon="sparkle" testId="m18-cc-ag-passport">
        {a.passport.length === 0 ? <p className="text-[13px] text-ink-3">{t('m18.cc.agenda.passportNone')}</p> : (
          <ul className="flex flex-wrap gap-1.5">
            {a.passport.map((s) => (
              <li key={s.skill_id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[12.5px]">
                <span className="font-medium">{pick(cat.skillById.get(s.skill_id), 'name') || s.skill_id}</span>
                <span className="num text-ink-3">{t('m18.cc.agenda.level', { n: f.num(s.level) })}</span>
                <StatusPill tone={s.basis === 'verified' ? 'ok' : s.basis === 'evidenced' || s.basis === 'validated' ? 'info' : 'neutral'}>{t(`common.skills.basis.${s.basis}`)}</StatusPill>
              </li>
            ))}
          </ul>
        )}
        {mine && <L to="/my/skills" className="mt-2 inline-block text-[12.5px]">{t('m18.cc.agenda.openPassport')}</L>}
      </Block>
      <Block title={t('m18.cc.agenda.targets')} icon="briefcase" toggle={tog('targets')} testId="m18-cc-ag-targets">
        {off('targets') || !a.included.targets ? <p className="text-[13px] text-ink-3">{t('m18.cc.agenda.notIncluded')}</p>
          : a.targets.length === 0 ? <p className="text-[13px] text-ink-3">{a.shared_only ? t('m18.cc.agenda.targetsNoneShared') : t('m18.cc.agenda.targetsNone')}</p> : (
          <ul className="space-y-2">
            {a.targets.map((x) => {
              const r = { pct: x.pct, band: x.band, months: x.months, path_only: x.band === 'path_only' } as Pick<CareerReadiness, 'pct' | 'band' | 'months' | 'path_only'>;
              // FS wave B: a shortlisted concept role shows its FS05-profile readiness (FS15), with the concept chip and band
              const cr = x.concept ? { pct: x.pct ?? 0, band: x.band as ConceptBand, months: x.months ?? 0 } : null;
              const gapName = (g: AgendaTarget['gaps'][number]) => ('kind' in g ? (g.kind === 'skill' ? pick(cat.skillById.get(g.ref_id), 'name') || g.ref_id : pick(cat.compById.get(g.ref_id), 'name') || g.ref_id) : pick(cat.compById.get(g.competency_id), 'name'));
              return (
                <li key={x.role_id} className="flex flex-wrap items-center gap-3" data-testid="m18-cc-ag-target" data-concept={x.concept ? 'true' : undefined}>
                  {cr ? <ConceptRing r={cr} size={44} /> : <ReadinessRing r={r} size={44} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{f.num(x.rank)}. {pick(cat.roleById.get(x.role_id), 'title')}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {cr ? <><ConceptChip /><ConceptBandPill r={cr} /></> : <BandPill r={r} />}
                      {x.gaps.slice(0, 2).map((g) => <StatusPill key={'kind' in g ? `${g.kind}:${g.ref_id}` : g.competency_id} tone="neutral">{gapName(g)} {f.num(g.have)}→{f.num(g.need)}</StatusPill>)}
                      <WhyThis reasons={x.reasons} testId="m18-cc-ag-why" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {mine && <L to="/my/career" className="mt-2 inline-block text-[12.5px]">{t('m18.cc.agenda.openNavigator')}</L>}
      </Block>
      <Block title={t('m18.cc.agenda.roadmap')} icon="calendar" toggle={tog('roadmap')} testId="m18-cc-ag-roadmap">
        {off('roadmap') || !a.included.roadmap ? <p className="text-[13px] text-ink-3">{t('m18.cc.agenda.notIncluded')}</p>
          : !a.roadmap ? <p className="text-[13px] text-ink-3">{t('m18.cc.agenda.roadmapNone')}</p> : (
          <div className="text-[13px]">
            <div className="font-semibold">{a.roadmap.name || pick(cat.roleById.get(a.roadmap.target_role_id), 'title')}</div>
            <div className="text-ink-2">{t('m18.cc.agenda.roadmapLine', { role: pick(cat.roleById.get(a.roadmap.target_role_id), 'title'), date: a.roadmap.end_on ? f.date(a.roadmap.end_on) : '—', n: f.num(a.roadmap.dev_blocks) })}</div>
            {mine && <L to={`/my/career/roadmap?role=${a.roadmap.target_role_id}`} className="mt-1 inline-block text-[12.5px]">{t('m18.cc.agenda.openRoadmap')}</L>}
          </div>
        )}
      </Block>
      <Block title={t('m18.cc.agenda.quals')} icon="shield" testId="m18-cc-ag-quals">
        {a.quals.length === 0 ? <p className="text-[13px] text-ink-3">{t('m18.cc.agenda.qualsNone')}</p> : (
          <ul className="space-y-1 text-[13px]">
            {a.quals.map((q) => (
              <li key={q.record_id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{pick(cat.stdById.get(q.standard_id), 'title') || q.standard_id}</span>
                <StatusPill tone={q.days < 0 ? 'bad' : q.days <= 90 ? 'sim' : 'neutral'}>{q.days < 0 ? t('m18.cc.agenda.expired', { date: f.date(q.expires_on) }) : t('m18.cc.agenda.expires', { date: f.date(q.expires_on), n: f.num(q.days) })}</StatusPill>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-[11.5px] text-ink-3">{t('m18.cc.agenda.mirror')}</p>
      </Block>
      {!a.shared_only && (
        <Block title={t('m18.cc.agenda.coach')} icon="book" toggle={tog('coach')} testId="m18-cc-ag-coach">
          {off('coach') || !a.coach ? <p className="text-[13px] text-ink-3">{t('m18.cc.agenda.notIncluded')}</p> : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="num text-[18px] font-semibold">{f.num(a.coach.hours_per_week)}</div><div className="text-[11.5px] text-ink-3">{t('m18.cc.agenda.hours')}</div></div>
              <div><div className="num text-[18px] font-semibold">{f.num(a.coach.enrolled)}</div><div className="text-[11.5px] text-ink-3">{t('m18.cc.agenda.enrolled')}</div></div>
              <div><div className="num text-[18px] font-semibold">{f.num(a.coach.passed)}</div><div className="text-[11.5px] text-ink-3">{t('m18.cc.agenda.passed')}</div></div>
              {a.coach.focus_role_ids.length > 0 && <div className="col-span-3 text-start text-[12.5px] text-ink-2">{t('m18.cc.agenda.focus', { roles: a.coach.focus_role_ids.map((id) => pick(cat.roleById.get(id), 'title')).join(' · ') })}</div>}
            </div>
          )}
          {mine && <L to="/my/coach" className="mt-2 inline-block text-[12.5px]">{t('m18.cc.agenda.openCoach')}</L>}
        </Block>
      )}
      <p className="text-[12.5px] text-ink-2" data-testid="m18-cc-ag-last">{a.last ? t('m18.cc.agenda.last', { date: f.date(a.last.held_on) }) : t('m18.cc.agenda.lastNone')}</p>
    </div>
  );
}

/** The employee's preparation, read-only (manager's view and history). */
export function PrepSummary({ p }: { p: Partial<Prep> }) {
  const t = useT();
  if (!p || !Array.isArray(p.aspirations)) return <p className="text-[13px] text-ink-3">{t('m18.cc.prep.none')}</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2" data-testid="m18-cc-prep-summary">
      <div className="sm:col-span-2">
        <dt className="caps">{t('m18.cc.prep.aspirations')}</dt>
        <dd className="mt-1 flex flex-wrap gap-1.5">{p.aspirations.length ? p.aspirations.map((a, i) => <StatusPill key={a} tone={i === 0 ? 'accent' : 'neutral'}>{t(`m18.cc.asp.${a}`)}</StatusPill>) : '—'}</dd>
      </div>
      <div><dt className="caps">{t('m18.cc.prep.mobility')}</dt><dd>{p.mobility ? t(`m18.cc.mob.${p.mobility}`) : '—'}{p.shift_ok ? ` · ${t('m18.cc.prep.shiftOk')}` : ''}{p.rotation_ok ? ` · ${t('m18.cc.prep.rotationOk')}` : ''}</dd></div>
      <div><dt className="caps">{t('m18.cc.prep.leadership')}</dt><dd>{p.leadership ? t(`m18.cc.lead.${p.leadership}`) : '—'}</dd></div>
      <div><dt className="caps">{t('m18.cc.prep.goal12')}</dt><dd className="whitespace-pre-line">{p.goal_12m || '—'}</dd></div>
      <div><dt className="caps">{t('m18.cc.prep.goal3')}</dt><dd className="whitespace-pre-line">{p.goal_3y || '—'}</dd></div>
      <div className="sm:col-span-2"><dt className="caps">{t('m18.cc.prep.support')}</dt>
        <dd className="mt-1 flex flex-wrap gap-1.5">{(p.support ?? []).length ? (p.support ?? []).map((s) => <StatusPill key={s} tone="info">{t(`m18.cc.support.${s}`)}</StatusPill>) : '—'}{p.support_note ? <span className="ms-1 text-ink-2">{p.support_note}</span> : null}</dd></div>
      {p.topics ? <div className="sm:col-span-2"><dt className="caps">{t('m18.cc.prep.topics')}</dt><dd className="whitespace-pre-line">{p.topics}</dd></div> : null}
    </dl>
  );
}

const KIND_ICON: Record<string, string> = { course: 'book', ojt: 'users', mentoring: 'chat', project: 'briefcase', assessment: 'shield', reading: 'book' };
/** Agreed actions, with the course link and the owner. */
export function ActionList({ actions, cat, planLink }: { actions: Action[]; cat: CcCatalogue; planLink?: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!actions.length) return <p className="text-[13px] text-ink-3">{t('m18.cc.actions.none')}</p>;
  return (
    <div>
      <ol className="space-y-1.5" data-testid="m18-cc-actions">
        {actions.map((a) => (
          <li key={a.id} className="flex flex-wrap items-start gap-2 rounded-card border border-line bg-raised p-2 text-[13px]" data-testid="m18-cc-action">
            <Icon name={KIND_ICON[a.kind] ?? 'check'} size={15} className="mt-0.5 shrink-0 text-eyebrow" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{pick({ t_en: a.title.en, t_ar: a.title.ar }, 't')}</div>
              <div className="text-[12px] text-ink-3">
                {t(`m18.cc.kind.${a.kind}`)} · {t(`m18.cc.owner.${a.owner}`)}{a.due_on ? ` · ${t('m18.cc.actions.due', { date: f.date(a.due_on) })}` : ''}
                {a.course_id && cat.courseById.get(a.course_id) && <> · <L to={`/learn/course/${a.course_id}`}>{pick(cat.courseById.get(a.course_id), 'title')}</L></>}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {planLink && <L to="/my/plan" className="mt-2 inline-block text-[12.5px]" data-testid="m18-cc-plan-link">{t('m18.cc.actions.inPlan')}</L>}
    </div>
  );
}
export const asActions = (x: unknown): Action[] => (Array.isArray(x) ? (x as Action[]) : []);
export const asPrep = (x: unknown): Partial<Prep> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Partial<Prep>) : {});
export const asAgenda = (x: unknown): Agenda | null => (x && typeof x === 'object' && !Array.isArray(x) && 'passport' in (x as object) ? (x as Agenda) : null);

/** Runs an F12 RPC with a toast: the given success text, or the refusal in the current language. */
export function useCcAction() {
  const toast = useToast();
  const refusal = useRefusal();
  return async <T,>(fn: () => Promise<Result<T>>, success: string): Promise<Result<T>> => {
    try {
      const r = await fn();
      if (r.ok) toast.push({ tone: 'ok', title: success });
      else toast.push({ tone: 'bad', title: refusal(r as Result<unknown>), detail: r.code });
      return r;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.push({ tone: 'bad', title: message });
      return { ok: false, code: 'error', message } as Result<T>;
    }
  };
}
