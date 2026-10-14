// FS13 readiness v2 UI: the readiness hero with its two ceilings, "what raises it" with +points per action, the before/after
// preview for any course, track or skill, my planned learning and the ADVANCE learning tracks I can work through. Every index
// keeps the SIMULATED chip and the no-decision line; numbers come from rpc.futureReadiness (TS = SQL), previews from previewEvidence.
import { useMemo, useState, type ReactNode } from 'react';
import { Card, Section, EmptyState, WhyThis, SimChip, Modal, Icon, StatusPill, BenchmarkChips } from '../../ui';
import { useT, usePick, useFormat, useLang, L } from '../../i18n';
import { useAction, useRepo } from '../../data';
import type { BiText, Ranked } from '../../domain/engines/types';
import { Radar } from '../m11/shared';
import { deltaOf, normSteps, previewEvidence, type EvidenceChange, type RV2 } from './readiness';
import { familyReasonsV2, rankRaises, type RaiseAction, type RaiseLabels } from './raises';
import { IndexBadge, techSlug, type FutureMeData, type Labels } from './shared';

export const PLANNED = ['requested', 'waitlisted', 'assigned', 'enrolled', 'in_progress'];

/** Labels the v2 reasons and actions need (skills, ADVANCE skills, families, resources, courses, tracks). */
export function useRaiseLabels(d: FutureMeData, labels: Labels): RaiseLabels {
  return useMemo(() => ({
    skills: labels.skills, adv: labels.adv, techs: labels.techs,
    resources: Object.fromEntries(d.resources.map((r) => [r.id, { en: r.title_en, ar: r.title_ar }])),
    courses: Object.fromEntries(d.courses.map((c) => [c.id, { en: c.title_en, ar: c.title_ar }])),
    tracks: Object.fromEntries(d.tracks.map((x) => [x.id, { en: x.title_en, ar: x.title_ar }])),
  }), [d, labels]);
}

/** Meter 0-100: my index (accent), today's-skills ceiling (dashed), catalogue-learning ceiling (dotted); 100 = recorded practice. */
export function ReadinessMeter({ value, carry, learn, preview, label, testId = 'm21-v2-meter' }: { value: number; carry: number; learn: number; preview?: number; label: string; testId?: string }) {
  const c = (x: number) => Math.max(0, Math.min(100, x));
  return (
    <div className="relative h-3 w-full rounded-full bg-sunken" role="img" aria-label={label} data-testid={testId}>
      <div className="absolute inset-y-0 start-0 rounded-full bg-sim-bg" style={{ width: `${c(learn)}%` }} />
      {preview != null && preview > value && <div className="absolute inset-y-0 start-0 rounded-full bg-accent/35" style={{ width: `${c(preview)}%` }} />}
      <div className="absolute inset-y-0 start-0 rounded-full bg-accent transition-[width] duration-700" style={{ width: `${c(value)}%` }} />
      <div className="absolute -inset-y-1 w-0 border-s-2 border-dashed border-sim" style={{ insetInlineStart: `${c(carry)}%` }} />
      <div className="absolute -inset-y-1 w-0 border-s-2 border-dotted border-info" style={{ insetInlineStart: `${c(learn)}%` }} />
    </div>
  );
}

function Legend() {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-accent" />{t('m21.v2.legendMine')}</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-0 border-s-2 border-dashed border-sim" />{t('m21.v2.legendCarry')}</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-0 border-s-2 border-dotted border-info" />{t('m21.v2.legendLearn')}</span>
      <span className="inline-flex items-center gap-1.5"><span className="num font-semibold">{t('m21.v2.legendFull')}</span></span>
    </div>
  );
}

/** Hero: overall readiness v2 with the two ceilings, what the evidence covers, and the radar against the ceilings. */
export function ReadinessHero({ d, r, top }: { d: FutureMeData; r: RV2; top?: Ranked<RaiseAction> }) {
  const t = useT();
  const bi = useBi();
  const pick = usePick();
  const f = useFormat();
  const role = d.jobRoles.find((x) => x.id === d.person?.job_role_id);
  const items = r.families.flatMap((x) => x.items);
  const cover = { carry: items.filter((i) => i.c6 > 0).length, direct: items.filter((i) => i.d3 > 0).length, learn: items.filter((i) => i.l3 > 0).length, open: items.filter((i) => i.bp === 0).length };
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]" aria-labelledby="m21-hero">
      <Card className="relative overflow-hidden">
        <div className="frame-line absolute inset-x-0 top-0 h-1" aria-hidden />
        <h2 id="m21-hero" className="sr-only">{t('m21.hero.title')}</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-2">
            <span className="inline-flex items-center gap-2"><Icon name="user" size={14} />{role ? t('m21.hero.asRole', { role: pick(role, 'title') }) : t('m21.hero.noRole')}</span>
            <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m21.v2.rule')}</span>
          </div>
          <IndexBadge size="lg" value={r.overall} label={t('m21.hero.overall')} sub={t('m21.v2.ceilings', { c: f.num(r.carry_ceiling, { maximumFractionDigits: 1 }), l: f.num(r.learn_ceiling, { maximumFractionDigits: 1 }) })} testId="m21-index-overall" />
          <ReadinessMeter value={r.overall} carry={r.carry_ceiling} learn={r.learn_ceiling} preview={top?.item?.after.overall} label={t('m21.v2.meter', { v: f.num(r.overall), c: f.num(r.carry_ceiling), l: f.num(r.learn_ceiling) })} />
          <Legend />
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="m21-v2-cover">
            {(['carry', 'direct', 'learn', 'open'] as const).map((k) => (
              <div key={k} className="rounded-btn border border-line bg-sunken/50 p-2.5">
                <dt className="caps">{t(`m21.v2.cover.${k}`)}</dt>
                <dd className="num text-[20px] font-semibold leading-tight">{f.num(cover[k])}<span className="text-[12px] font-normal text-ink-3"> / {f.num(items.length)}</span></dd>
              </div>
            ))}
          </dl>
          {top?.item && (
            <div className="rounded-btn border border-accent/30 bg-accent-soft/60 p-3 text-[13px]" data-testid="m21-v2-next">
              <div className="caps text-eyebrow">{t('m21.v2.nextBest')}</div>
              <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{bi(top.item.title)}</span>
                <span className="num font-semibold text-eyebrow">{t('m21.v2.plus', { n: f.num(top.item.delta, { maximumFractionDigits: 1 }) })}</span>
              </div>
            </div>
          )}
          <p className="text-[13px] text-ink-2">{t('m21.v2.explain')}</p>
        </div>
      </Card>
      <Card>
        <Radar
          title={t('m21.hero.radar')}
          axes={r.families.map((x) => pick(d.techs.find((y) => y.id === x.tech_id), 'family'))}
          series={[
            { name: t('m21.v2.legendMine'), values: r.families.map((x) => x.index), tone: 'accent' },
            { name: t('m21.v2.legendLearn'), values: r.families.map((x) => x.learn_ceiling), tone: 'info', dashed: true },
            { name: t('m21.v2.legendCarry'), values: r.families.map((x) => x.carry_ceiling), tone: 'sim', dashed: true },
          ]}
        />
        <p className="mt-1 text-center text-[11.5px] text-sim" data-testid="m21-no-decision">{t('m11.common.noDecision')}</p>
      </Card>
    </section>
  );
}

/** The current-language text of a bilingual label. */
export function useBi() {
  const lang = useLang();
  return (b: BiText) => (lang === 'ar' ? b.ar || b.en : b.en);
}

/** Before/after preview of any evidence change, per family and overall (SIMULATED). */
export function PreviewModal({ open, onClose, r, change, title, d }: { open: boolean; onClose: () => void; r: RV2; change: EvidenceChange; title: ReactNode; d: FutureMeData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const after = useMemo(() => previewEvidence(r, change), [r, change]);
  const delta = deltaOf(r, after);
  return (
    <Modal open={open} onClose={onClose} title={t('m21.v2.preview.title')} size="lg">
      <div className="space-y-4" data-testid="m21-preview">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[15px] font-semibold">{title}</div>
          <SimChip />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <div className="flex items-end gap-3">
              <IndexBadge size="md" value={r.overall} label={t('m21.v2.preview.before')} testId="m21-index-before" />
              <Icon name="chevron" size={18} className="mb-6 text-ink-3 rtl:-scale-x-100" />
              <IndexBadge size="md" value={after.overall} label={t('m21.v2.preview.after')} testId="m21-index-after" />
            </div>
            <div className="num text-[13px] font-semibold text-eyebrow" data-testid="m21-preview-delta">{t('m21.v2.plus', { n: f.num(delta.overall, { maximumFractionDigits: 1 }) })}</div>
            <table className="table-base w-full text-[13px]">
              <caption className="sr-only">{t('m21.v2.preview.table')}</caption>
              <thead><tr><th scope="col">{t('m21.v2.preview.family')}</th><th scope="col" className="text-end">{t('m21.v2.preview.before')}</th><th scope="col" className="text-end">{t('m21.v2.preview.after')}</th><th scope="col" className="text-end">±</th></tr></thead>
              <tbody>
                {delta.families.map((x) => (
                  <tr key={x.tech_id}>
                    <th scope="row" className="text-start font-normal">{pick(d.techs.find((y) => y.id === x.tech_id), 'family')}</th>
                    <td className="num text-end">{f.num(x.before)}</td>
                    <td className="num text-end font-semibold">{f.num(x.after)}</td>
                    <td className={`num text-end ${x.delta > 0 ? 'text-ok' : 'text-ink-3'}`}>{x.delta > 0 ? `+${f.num(x.delta)}` : f.num(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Radar title={t('m21.v2.preview.radar')} axes={r.families.map((x) => pick(d.techs.find((y) => y.id === x.tech_id), 'family'))}
            series={[{ name: t('m21.v2.preview.before'), values: r.families.map((x) => x.index), tone: 'sim', dashed: true }, { name: t('m21.v2.preview.after'), values: after.families.map((x) => x.index), tone: 'accent' }]} />
        </div>
        <p className="text-[12px] text-ink-3">{t('m21.v2.preview.note')}</p>
        <p className="text-[11.5px] text-sim">{t('m11.common.noDecision')}</p>
      </div>
    </Modal>
  );
}

/** "What raises it": courses, tracks and new-capability practice ranked by the index points they would add. */
export function WhatRaisesIt({ d, r, ranked, onTrack }: { d: FutureMeData; r: RV2; ranked: Ranked<RaiseAction>[]; onTrack?: (id: string) => void }) {
  const t = useT();
  const bi = useBi();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [pv, setPv] = useState<RaiseAction | null>(null);
  const planned = new Set(d.enrolments.filter((e) => PLANNED.includes(e.status)).map((e) => e.course_id));
  const learning = ranked.filter((x) => x.item!.kind !== 'practice').slice(0, 6);
  const practice = ranked.filter((x) => x.item!.kind === 'practice');
  const Card1 = ({ x }: { x: Ranked<RaiseAction> }) => {
    const a = x.item!;
    const fam = a.families.filter((y) => y.delta > 0);
    return (
      <li className="card flex flex-col gap-2.5 p-4" data-testid="m21-raise">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={`chip ${a.kind === 'course' ? 'border-info-line bg-info-bg text-info' : a.kind === 'track' ? 'border-accent/30 bg-accent-soft text-eyebrow' : 'border-ok-line bg-ok-bg text-ok'}`}>{t(`m21.v2.kind.${a.kind}`)}</span>
            <div className="mt-1.5 text-[14px] font-semibold leading-snug">
              {a.kind === 'course' ? <L to={`/learn/course/${a.ref}`}>{bi(a.title)}</L> : bi(a.title)}
            </div>
            <div className="text-[12px] text-ink-3">{a.kind === 'practice' ? t('m21.v2.practiceLevel', { n: f.num(a.level) }) : t('m21.v2.recordsLevel', { n: f.num(a.level), k: f.num(a.adv_skill_ids.length) })}</div>
          </div>
          <div className="text-end">
            <div className="num text-[22px] font-semibold leading-none text-eyebrow" data-testid="m21-raise-delta">+{f.num(a.delta, { maximumFractionDigits: 1 })}</div>
            <div className="text-[11px] text-ink-3">{t('m21.v2.points')}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {fam.map((y) => <span key={y.tech_id} className="chip border-line bg-sunken text-ink-2"><span className="num">+{f.num(y.delta)}</span> · {pick(d.techs.find((z) => z.id === y.tech_id), 'family')}</span>)}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
          <WhyThis reasons={x.reasons} />
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn-outline btn-sm" onClick={() => setPv(a)} data-testid="m21-preview-open"><Icon name="chart" size={13} /> {t('m21.v2.preview.open')}</button>
            {a.kind === 'course' && (planned.has(a.ref)
              ? <StatusPill tone="info">{t('m21.v2.plannedPill')}</StatusPill>
              : <button type="button" className="btn-primary btn-sm" onClick={() => act(() => repo.rpc.enrolCourse(a.ref, null))} data-testid="m21-plan-course"><Icon name="plus" size={13} /> {t('m21.v2.plan')}</button>)}
            {a.kind === 'track' && onTrack && <button type="button" className="btn-primary btn-sm" onClick={() => onTrack(a.ref)}><Icon name="book" size={13} /> {t('m21.v2.openTrack')}</button>}
            {a.kind === 'practice' && <L to="/my/skills" className="btn-ghost btn-sm">{t('m21.v2.openPassport')}</L>}
          </div>
        </div>
      </li>
    );
  };
  return (
    <Section title={t('m21.v2.raise.title')} description={t('m21.v2.raise.desc')} id="m21-raises">
      {learning.length === 0 ? <EmptyState title={t('m21.v2.raise.empty')} /> : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m21-raises">{learning.map((x) => <Card1 key={x.id} x={x} />)}</ul>
      )}
      {practice.length > 0 && (
        <div className="space-y-2">
          <div className="caps">{t('m21.v2.raise.practice')}</div>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m21-practice">{practice.map((x) => <Card1 key={x.id} x={x} />)}</ul>
        </div>
      )}
      {pv && <PreviewModal open onClose={() => setPv(null)} r={r} change={pv.change} title={bi(pv.title)} d={d} />}
    </Section>
  );
}

/** My planned courses (enrolled, assigned, requested) with the readiness they would add once completed. */
export function PlannedLearning({ d, r }: { d: FutureMeData; r: RV2 }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const [pv, setPv] = useState<{ id: string; title: string } | null>(null);
  const covered = new Set(r.families.flatMap((x) => x.items.flatMap((i) => i.learn_opts.map((o) => o.course_id).filter(Boolean) as string[])));
  const rows = d.enrolments.filter((e) => PLANNED.includes(e.status)).map((e) => {
    const c = d.courses.find((x) => x.id === e.course_id);
    const after = previewEvidence(r, { courses: [e.course_id] });
    return { e, c, delta: deltaOf(r, after), counts: covered.has(e.course_id) };
  }).sort((a, b) => b.delta.overall - a.delta.overall || (a.e.course_id < b.e.course_id ? -1 : 1));
  return (
    <Section title={t('m21.v2.planned.title')} description={t('m21.v2.planned.desc')}>
      {rows.length === 0 ? <EmptyState title={t('m21.v2.planned.empty')}>{t('m21.v2.planned.emptyBody')}</EmptyState> : (
        <ul className="divide-y divide-line rounded-card border border-line bg-panel" data-testid="m21-planned">
          {rows.map(({ e, c, delta, counts }) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-3" data-testid="m21-planned-row">
              <div className="min-w-0">
                <L to={`/learn/course/${e.course_id}`} className="font-semibold">{c ? pick(c, 'title') : e.course_id}</L>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3"><StatusPill status={e.status} />{!counts && <span>{t('m21.v2.planned.noEffect')}</span>}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-[13px]">{f.num(r.overall)} <Icon name="chevron" size={12} className="inline text-ink-3 rtl:-scale-x-100" /> <b>{f.num(r.overall + delta.overall)}</b></span>
                <span className={`num chip ${delta.overall > 0 ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-3'}`}>+{f.num(delta.overall)}</span>
                <SimChip />
                <button type="button" className="btn-outline btn-sm" onClick={() => setPv({ id: e.course_id, title: c ? pick(c, 'title') : e.course_id })}>{t('m21.v2.preview.open')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pv && <PreviewModal open onClose={() => setPv(null)} r={r} change={{ courses: [pv.id] }} title={pv.title} d={d} />}
    </Section>
  );
}

/** ADVANCE learning tracks: my steps (rpc.recordTrackStep), progress and what completing each would add. */
export function TracksSection({ d, r, focus }: { d: FutureMeData; r: RV2; focus?: string | null }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [busy, setBusy] = useState<string | null>(null);
  const tracks = d.tracks.filter((x) => x.audience !== 'students');
  const step = async (tid: string, i: number, done: boolean) => {
    setBusy(`${tid}:${i}`);
    try { await act(() => repo.rpc.recordTrackStep(tid, i, done)); } finally { setBusy(null); }
  };
  return (
    <Section title={t('m21.v2.tracks.title')} description={t('m21.v2.tracks.desc')} id="m21-tracks">
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m21-tracks">
        {tracks.map((x) => {
          const mods = (Array.isArray(x.modules) ? x.modules : []) as { en: string; ar: string; minutes?: number }[];
          const p = d.progress.find((y) => y.track_id === x.id);
          const done = normSteps(p?.steps_done, mods.length);
          const complete = p?.status === 'completed';
          const gain = complete ? 0 : deltaOf(r, previewEvidence(r, { tracks: [x.id] })).overall;
          return (
            <li key={x.id} id={`m21-track-${x.id}`} className={`card flex flex-col gap-3 p-4 ${focus === x.id ? 'ring-2 ring-accent' : ''}`} data-testid="m21-track">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="caps">{t(`m21.v2.tracks.level.${x.level}`)} · <span className="num">{f.num(Number(x.hours), { maximumFractionDigits: 1 })}</span> {t('m21.v2.tracks.hours')}</div>
                  <h3 className="text-[15px] font-semibold leading-snug">{pick(x, 'title')}</h3>
                </div>
                {complete ? <StatusPill tone="ok">{t('m21.v2.tracks.done', { date: f.date(p?.completed_at) })}</StatusPill>
                  : <span className="num chip border-accent/30 bg-accent-soft text-eyebrow">{gain > 0 ? t('m21.v2.tracks.gain', { n: f.num(gain, { maximumFractionDigits: 1 }) }) : t('m21.v2.tracks.noGain')}</span>}
              </div>
              <p className="text-[13px] text-ink-2">{pick(x, 'summary')}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={mods.length} aria-valuenow={done.length} aria-label={t('m21.v2.tracks.progress', { n: f.num(done.length), k: f.num(mods.length) })}>
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${mods.length ? (100 * done.length) / mods.length : 0}%` }} />
              </div>
              <ol className="space-y-1.5">
                {mods.map((m, i) => {
                  const on = done.includes(i);
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span className={`num grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${on ? 'bg-accent text-white' : 'bg-sunken text-ink-3 ring-1 ring-line'}`}>{on ? <Icon name="check" size={11} /> : f.num(i + 1)}</span>
                        <span className={on ? 'text-ink' : 'text-ink-2'}>{pick({ t_en: m.en, t_ar: m.ar }, 't')}</span>
                        {m.minutes != null && <span className="num text-[11.5px] text-ink-3">{t('m21.v2.tracks.minutes', { n: f.num(m.minutes) })}</span>}
                      </span>
                      <button type="button" className={`btn-sm ${on ? 'btn-ghost' : 'btn-outline'}`} disabled={busy === `${x.id}:${i}`} aria-pressed={on} onClick={() => step(x.id, i, !on)} data-testid="m21-track-step">
                        {on ? t('m21.v2.tracks.undo') : t('m21.v2.tracks.mark')}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-ink-3">{t('m21.v2.tracks.foot')}</p>
    </Section>
  );
}

/** Family cards (v2): index, both ceilings, coverage chips and reasons. */
export function FamiliesV2({ d, r, extra }: { d: FutureMeData; r: RV2; extra?: (techId: string) => ReactNode }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  return (
    <Section title={t('m21.fam.title')} description={t('m21.v2.famDesc')}>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m21-families">
        {r.families.map((fr) => {
          const x = d.techs.find((y) => y.id === fr.tech_id);
          return (
            <li key={fr.tech_id} className="card flex flex-col gap-3 p-4" data-testid="m21-family">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="caps num">{x?.designs}</div>
                  <L to={`/my/future/${techSlug(fr.tech_id)}`} className="text-[15px] font-semibold leading-snug">{pick(x, 'family')}</L>
                </div>
                {extra?.(fr.tech_id)}
              </div>
              <IndexBadge size="sm" value={fr.index} label={t('m21.fam.index')} sub={t('m21.v2.ceilings', { c: f.num(fr.carry_ceiling, { maximumFractionDigits: 1 }), l: f.num(fr.learn_ceiling, { maximumFractionDigits: 1 }) })} />
              <ReadinessMeter testId="m21-v2-meter-family" value={fr.index} carry={fr.carry_ceiling} learn={fr.learn_ceiling} label={t('m21.v2.meter', { v: f.num(fr.index), c: f.num(fr.carry_ceiling), l: f.num(fr.learn_ceiling) })} />
              <div className="flex flex-wrap gap-1 text-[11.5px]">
                <span className="chip border-ok-line bg-ok-bg text-ok">{t('m21.v2.chip.carry', { n: f.num(fr.items.filter((i) => i.c6 > 0).length) })}</span>
                <span className="chip border-info-line bg-info-bg text-info">{t('m21.v2.chip.direct', { n: f.num(fr.items.filter((i) => i.d3 > 0).length) })}</span>
                <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m21.v2.chip.learn', { n: f.num(fr.items.filter((i) => i.l3 > 0).length) })}</span>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2">
                <WhyThis reasons={familyReasonsV2(fr)} />
                <L to={`/my/future/${techSlug(fr.tech_id)}`} className="text-[12.5px]">{t('m21.fam.open')}</L>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function useRaises(d: FutureMeData, r: RV2 | null, labels: Labels) {
  const L2 = useRaiseLabels(d, labels);
  return useMemo(() => (r ? rankRaises(r, L2) : []), [r, L2]);
}

export function FS13Chips() {
  const t = useT();
  return <div data-testid="m21-bench-fs13"><BenchmarkChips feature="FS13" label={t('m21.v2.bench')} /></div>;
}
