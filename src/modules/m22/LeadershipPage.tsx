// /leadership (M22 · F16): the Enterprise Nuclear Leadership Academy as a pathway. The ladder (individual contributor → first-line
// leader → manager → director → executive) with each step's programmes and published facts (CNS report, as-of date), my leadership
// readiness on the framework's leadership competencies with a self check-in (F03 claimSkill), programmes ranked for me with
// reasons, my nominations, and the link to the safety-culture traits (M08, INPO 12-012).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, WhyThis, EngineBadge, Modal, ProgressRing, ProgressBar, Icon, Timeline } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { L, useFormat, usePick, useT } from '../../i18n';
import { LEAD_TARGETS, STEPS, isShiftTrack, leadershipReadiness, rankProgrammes, requiredFor, stepOf, targetStep, BEHAVIOURS } from './domain';
import { useLeadership, useLabels, StepName, NomPill, Sources, Fact, LevelDots, type LeadData, type Programme } from './ui';

export default function LeadershipPage() {
  const t = useT();
  const { q, me, person, session } = useLeadership();
  return (
    <Page title={t('m22.routes.leadership.title')} intro={t('m22.leadership.intro')} wide
      actions={<div className="flex flex-wrap gap-2">
        {session.can('skills_profile', ['Own']) && <L to="/leadership/360" className="btn-outline btn-sm"><Icon name="users" size={14} />{t('m22.leadership.go360')}</L>}
        {session.hasRole('manager', 'hr_director', 'training_manager') && <L to="/leadership/nominations" className="btn-outline btn-sm"><Icon name="check" size={14} />{t('m22.leadership.goNominations')}</L>}
        {(session.can('skills_profile', ['Agg', 'A']) || session.can('talent_review', ['Agg', 'A'])) && <L to="/leadership/insights" className="btn-ghost btn-sm"><Icon name="chart" size={14} />{t('m22.leadership.goInsights')}</L>}
      </div>}>
      <Async state={q} isEmpty={(d) => d.programmes.length === 0} empty={<EmptyState icon="grad" title={t('m22.leadership.empty')} />}>
        {(d) => <Body d={d} me={me} person={person} canSelf={session.can('skills_profile', ['Own'])} />}
      </Async>
    </Page>
  );
}

function Body({ d, me, person, canSelf }: { d: LeadData; me: string | null; person: ReturnType<typeof useLeadership>['person']; canSelf: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const eng = useEngine('recommend');
  const lab = useLabels(d.skills, d.roles);
  const step = stepOf(person);
  const tgt = targetStep(step);
  const levels = useMemo(() => new Map(d.states.map((s) => [s.skill_id, { level: s.level, basis: s.basis }])), [d.states]);
  const ready = leadershipReadiness(levels, tgt, lab.skillBi);
  const done = useMemo(() => new Set(d.records.filter((r) => r.result === 'completed' || r.result === 'passed').map((r) => r.course_id)), [d.records]);
  const mine = d.nominations.filter((n) => n.person_id === me);
  const ranked = useMemo(() => rankProgrammes(d.programmes as never, person, levels, d.nominations, done, lab.skillBi), [d.programmes, person, levels, d.nominations, done, lab]);
  const shift = isShiftTrack(person);
  const [checkin, setCheckin] = useState<string | null>(null);
  return (
    <div className="space-y-8">
      {canSelf && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card title={t('m22.leadership.journeyTitle')} actions={<EngineBadge engine={eng} />}>
            <div className="flex flex-wrap items-center gap-5" data-testid="m22-readiness">
              <ProgressRing value={ready.score * 100} size={88} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="caps">{t('m22.leadership.youAre')}</div>
                <div className="text-[18px] font-semibold"><StepName step={step} /></div>
                <div className="text-[13px] text-ink-2">{t('m22.leadership.readyFor', { pct: f.num(Math.round(ready.score * 100)), step: t(`m22.steps.${tgt}`) })}</div>
                {shift && <span className="chip border-accent/30 bg-accent-soft text-eyebrow" data-testid="m22-shift-track">{t('m22.leadership.shiftTrack')}</span>}
                <div className="pt-1"><WhyThis reasons={ready.reasons} testId="m22-why-ready" /></div>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-ink-3">{t('m22.leadership.readinessNote')}</p>
          </Card>
          <Card title={t('m22.leadership.competencies')} actions={<span className="text-[12px] text-ink-3">{t('m22.leadership.targetFor', { step: t(`m22.steps.${tgt}`) })}</span>}>
            <ul className="space-y-2" data-testid="m22-lead-skills">
              {ready.rows.map((r) => (
                <li key={r.skill_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 text-[13.5px]">{lab.skill(r.skill_id)}</span>
                  <LevelDots level={r.have} need={r.need} label={t('m22.common.levelOf', { have: r.have, need: r.need })} />
                  <span className={`chip ${r.met ? 'border-ok-line bg-ok-bg text-ok' : 'border-sim-line bg-sim-bg text-sim'}`}>{r.met ? t('m22.leadership.met') : t('m22.leadership.gapTo', { n: r.need })}</span>
                  {r.basis && <span className="text-[11.5px] text-ink-3">{t(`m22.basis.${r.basis}`)}</span>}
                  <button className="btn-ghost btn-sm" onClick={() => setCheckin(r.skill_id)} data-testid="m22-checkin">{t('m22.leadership.checkIn')}</button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-ink-3">{t('m22.leadership.checkInNote')}</p>
          </Card>
        </div>
      )}

      <Section title={t('m22.leadership.ladderTitle')} description={t('m22.leadership.ladderSub')}>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-5" data-testid="m22-ladder">
          {STEPS.map((s, i) => {
            const progs = d.programmes.filter((g) => g.steps.includes(s));
            const here = canSelf && s === step;
            const next = canSelf && s === tgt && s !== step;
            return (
              <li key={s} className={`relative rounded-card border p-3 ${here ? 'border-accent bg-accent-soft' : next ? 'border-accent/40 bg-panel' : 'border-line bg-panel'}`}>
                <div className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${here ? 'bg-accent text-accent-ink' : 'bg-sunken text-ink-2'}`}>{f.num(i + 1)}</span>
                  <span className="font-semibold"><StepName step={s} /></span>
                </div>
                {here && <div className="mt-1 text-[11.5px] font-semibold text-eyebrow">{t('m22.leadership.youAreHere')}</div>}
                {next && <div className="mt-1 text-[11.5px] font-semibold text-ink-2">{t('m22.leadership.nextStep')}</div>}
                <p className="mt-1 text-[12px] text-ink-2">{t(`m22.stepDesc.${s}`)}</p>
                <ul className="mt-2 space-y-1">
                  {progs.map((g) => {
                    const req = canSelf ? requiredFor(g as never, person) : null;
                    return (
                      <li key={g.id}>
                        <L to={`/leadership/programmes/${g.id}`} className="flex items-center justify-between gap-1 rounded border border-line bg-panel px-2 py-1 text-[12.5px] hover:border-accent">
                          <span className="truncate">{pick(g, 'title')}</span>
                          {req && <span className="chip shrink-0 border-bad-line bg-bad-bg text-bad" data-testid="m22-required">{t('m22.common.required')}</span>}
                        </L>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </Section>

      {canSelf && (
        <Section title={t('m22.leadership.recoTitle')} description={t('m22.leadership.recoSub')}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m22-reco">
            {ranked.slice(0, 6).map((r) => <ProgrammeCard key={r.id} g={r.item as unknown as Programme} reasons={r.reasons} required={requiredFor(r.item!, person)} nom={mine.find((n) => n.programme_id === r.id)?.status ?? null} />)}
          </ul>
        </Section>
      )}

      <Section title={t('m22.leadership.allTitle')} description={t('m22.leadership.allSub')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m22-programmes">
          {d.programmes.map((g) => <ProgrammeCard key={g.id} g={g} required={canSelf ? requiredFor(g as never, person) : null} nom={mine.find((n) => n.programme_id === g.id)?.status ?? null} />)}
        </ul>
      </Section>

      {canSelf && (
        <Section title={t('m22.leadership.myNominations')} description={t('m22.leadership.myNominationsSub')}>
          {mine.length === 0 ? <EmptyState icon="user" title={t('m22.leadership.noNominations')}>{t('m22.leadership.noNominationsBody')}</EmptyState> : (
            <ul className="space-y-3" data-testid="m22-my-nominations">
              {mine.map((n) => {
                const g = d.programmes.find((x) => x.id === n.programme_id);
                const hist = (Array.isArray(n.history) ? n.history : []) as { at: string; status: string; note?: string | null }[];
                return (
                  <li key={n.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <L to={`/leadership/programmes/${n.programme_id}`} className="font-semibold">{g ? pick(g, 'title') : n.programme_id}</L>
                      <NomPill status={n.status} />
                    </div>
                    <div className="mt-1 text-[12.5px] text-ink-2">{t('m22.leadership.nominatedBy', { name: pick({ name_en: n.nominator_name, name_ar: n.nominator_name_ar }, 'name'), cycle: n.cycle })}</div>
                    <p className="mt-1 text-[13px]">“{n.reason}”</p>
                    {n.decision_note && <p className="mt-1 text-[12.5px] text-ink-2">{t('m22.leadership.decisionNote', { note: n.decision_note })}</p>}
                    <div className="mt-2"><Timeline items={hist.map((h, i) => ({ id: String(i), when: f.date(h.at), title: t(`m22.nomStatus.${h.status}`), detail: h.note ?? undefined, tone: h.status === 'declined' ? 'bad' : h.status === 'nominated' ? 'info' : 'ok' }))} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      <Section title={t('m22.leadership.cultureTitle')} description={t('m22.leadership.cultureSub')}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="m22-behaviours">
          {BEHAVIOURS.map((b) => {
            const tr = d.traits.find((x) => x.id === b.trait);
            return (
              <li key={b.id} className="rounded-card border border-line bg-panel p-3">
                <div className="font-semibold text-[13.5px]">{t(`m22.behaviours.${b.id}.title`)}</div>
                <div className="mt-0.5 text-[12px] text-ink-2">{t(`m22.behaviours.${b.id}.statement`)}</div>
                {tr && <div className="mt-1 text-[11.5px] text-ink-3">{t('m22.leadership.trait', { trait: pick(tr, 'name') })}</div>}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <L to="/safety-culture" className="btn-outline btn-sm">{t('m22.leadership.cultureLink')}</L>
          {canSelf && <L to="/my/safety-culture" className="btn-ghost btn-sm">{t('m22.leadership.myCultureLink')}</L>}
          {canSelf && <L to="/my/mentoring" className="btn-ghost btn-sm">{t('m22.leadership.mentoringLink')}</L>}
        </div>
      </Section>

      <Callout title={t('m22.leadership.mirrorTitle')}>{t('m22.leadership.mirrorBody')}</Callout>
      <CheckInModal skillId={checkin} onClose={() => setCheckin(null)} label={checkin ? lab.skill(checkin) : ''} have={checkin ? levels.get(checkin)?.level ?? 0 : 0} need={checkin ? LEAD_TARGETS[tgt][checkin] ?? 2 : 2} />
    </div>
  );
}

export function ProgrammeCard({ g, reasons, required, nom }: { g: Programme; reasons?: import('../../domain/engines/types').Reason[]; required: 'track' | 'step' | null; nom: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <li className="card flex flex-col p-4" data-testid="m22-programme">
      <div className="flex items-start justify-between gap-2">
        <L to={`/leadership/programmes/${g.id}`} className="font-semibold leading-snug">{pick(g, 'title')}</L>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {required && <span className="chip border-bad-line bg-bad-bg text-bad" data-testid="m22-required">{t(required === 'track' ? 'm22.common.requiredTrack' : 'm22.common.required')}</span>}
          {nom && <NomPill status={nom} />}
        </div>
      </div>
      <p className="mt-1 line-clamp-3 text-[13px] text-ink-2">{pick(g, 'summary')}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <Fact icon="calendar">{pick(g, 'duration')}</Fact>
        {g.completions != null && <Fact icon="users">{g.completions_year ? t('m22.common.completions', { n: f.num(g.completions), year: f.num(g.completions_year, { useGrouping: false }) }) : t('m22.common.participants', { n: f.num(g.completions) })}</Fact>}
        <Fact icon="user">{g.nominable ? t('m22.common.byNomination') : t('m22.common.noNomination')}</Fact>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <Sources sources={g.sources} />
        {reasons && <WhyThis reasons={reasons} testId="m22-why" />}
      </div>
    </li>
  );
}

function CheckInModal({ skillId, onClose, label, have, need }: { skillId: string | null; onClose: () => void; label: string; have: number; need: number }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [level, setLevel] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const open = !!skillId;
  const valid = level >= 1 && level <= 4 && note.trim().length >= 3;
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={t('m22.checkin.title', { skill: label })}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={!valid || busy} data-testid="m22-checkin-save" onClick={async () => {
          setBusy(true);
          try {
            const r = await run(() => repo.rpc.claimSkill({ skill_id: skillId!, level, note: note.trim() }));
            if (r.ok) { onClose(); setLevel(0); setNote(''); }
          } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m22.checkin.save')}</button>
      </>}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-2">{t('m22.checkin.body', { have, need })}</p>
        <fieldset>
          <legend className="mb-1 text-[13px] font-semibold">{t('m22.checkin.level')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((l) => (
              <label key={l} className={`cursor-pointer rounded-card border p-2 text-[12.5px] ${level === l ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                <input type="radio" name="m22-level" className="sr-only" checked={level === l} onChange={() => setLevel(l)} />
                <span className="block font-semibold">{t('m22.checkin.levelN', { n: l })}</span>
                <span className="block text-ink-2">{t(`m22.checkin.levelDesc.${l}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="caps">{t('m22.checkin.note')}</span>
          <textarea className="input mt-1" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} data-testid="m22-checkin-note" />
          <span className="text-[12px] text-ink-3">{t('m22.checkin.noteHint')}</span>
        </label>
        <ProgressBar value={(Math.min(have, need) / Math.max(1, need)) * 100} label={label} />
        <Callout>{t('m22.checkin.claimed')}</Callout>
      </div>
    </Modal>
  );
}
