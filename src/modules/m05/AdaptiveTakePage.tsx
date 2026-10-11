// FS21 /my/assessments/adaptive/:bank (skills_profile Own): take an adaptive future-skills assessment. Items come one at a time from the
// server without their key (rpc.startAdaptive / rpc.answerAdaptive); the FS01 staircase picks the level, the stop rule ends the attempt
// at a stable estimate or 20 items. The result shows the estimate with benchmark lines (the standard or the ENEC average, and the
// adaptive-test length line), meets-the-standard for safety-related banks (never a percentile) or a percentile for developmental banks,
// the staircase path, the reasons, the F01 evidence it wrote and, for a bank that gates a credential, the integrity report.
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Page, Section, Card, Async, Callout, EmptyState, WhyThis, BenchmarkChips, BenchmarkLine, ProgressBar, StatusPill, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import type { AdBankCard, AdResult, AdStepView } from './backend/rpc';
import { GateChips, IntegritySummary, LevelPill, ModeChip, SkillLinks, StaircasePath, useFsRef, type FsRef, type Row } from './fsui';
import { ResultText } from './AdaptivePage';

export const resultFromRow = (a: Row): AdResult => ({
  attempt_id: a.id, bank_id: a.bank_id, estimate: Number(a.estimate), stop: a.stop, criterion: a.mode === 'criterion', meets: a.meets ?? null, percentile: a.percentile ?? null,
  norm_n: a.norm_n ?? null, evidence: a.evidence ?? [], reasons: a.reasons ?? [], item_count: Number(a.item_count),
  path: (a.responses ?? []).map((r: Row) => ({ level: Number(r.level), correct: !!r.correct })), integrity_id: a.integrity_id ?? null,
});

export default function AdaptiveTakePage() {
  const t = useT();
  const { bank = '' } = useParams();
  const [sp] = useSearchParams();
  const s = useSession();
  const repo = useRepo();
  const ref = useFsRef();
  const q = useQuery(['adaptive_attempts', 'integrity_reports'], async () => {
    const [ov, attempts, reports] = await Promise.all([
      repo.rpc.adaptiveOverview(),
      repo.list('adaptive_attempts' as never, { filter: { person_id: s.identity.personId ?? '__none__', bank_id: bank } } as never).catch(() => [] as Row[]),
      repo.list('integrity_reports' as never, { filter: { person_id: s.identity.personId ?? '__none__' } } as never).catch(() => [] as Row[]),
    ]);
    return { card: ov?.banks.find((c) => c.bank_id === bank) ?? null, attempts: attempts as Row[], reports: reports as Row[] };
  }, [s.identity.personId, bank]);
  return (
    <Page title={t('m05.routes.my-adaptive-take.title')} intro={t('m05.take.intro')} wide eyebrow={<BenchmarkChips feature="FS21" />}
      actions={<L to="/my/assessments/adaptive" className="btn-outline btn-sm no-underline" data-testid="m05-take-back"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m05.take.back')}</L>}>
      <Async state={ref}>{(d) => <Async state={q}>{(c) => {
        const b = d.banks.find((x: Row) => x.id === bank);
        if (!b || !c.card) return <EmptyState title={t('m05.take.noBank')} />;
        return <Take d={d} b={b} card={c.card} attempts={c.attempts} reports={c.reports} focus={sp.get('attempt')} reload={q.reload} />;
      }}</Async>}</Async>
    </Page>
  );
}

function Take({ d, b, card, attempts, reports, focus, reload }: { d: FsRef; b: Row; card: AdBankCard; attempts: Row[]; reports: Row[]; focus: string | null; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const [step, setStep] = useState<AdStepView | null>(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = attempts.filter((a) => a.status === 'completed').sort((x, y) => String(x.completed_at).localeCompare(String(y.completed_at)));
  const shown = (focus && done.find((a) => a.id === focus)) || done[done.length - 1];

  const start = async () => {
    setBusy(true); setError(null);
    try { const r = await repo.rpc.startAdaptive({ bank_id: b.id }); if (r.ok && r.data) { setStep(r.data); setChoice(''); } else setError(r.message); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const answer = async () => {
    if (!step?.item || choice === '') return;
    setBusy(true); setError(null);
    try {
      const r = await repo.rpc.answerAdaptive({ attempt_id: step.attempt_id, item_id: step.item.id, choice: Number(choice) });
      if (r.ok && r.data) { setStep(r.data); setChoice(''); if (r.data.done) reload?.(); } else setError(r.message);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  if (step && !step.done && step.item) {
    const it = step.item;
    const list = lang === 'ar' && it.options_ar?.length ? it.options_ar : it.options_en;
    return (
      <div className="mx-auto max-w-2xl space-y-4" data-testid="m05-take-question" data-item={it.id} data-level={step.level}>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-2">
            <span>{t('m05.take.progress', { n: f.num(step.answered + 1), max: f.num(step.max) })}</span>
            <span className="flex items-center gap-1.5"><span className="text-ink-3">{t('m05.take.levelNow')}</span><LevelPill level={step.level} testId="m05-take-level" /></span>
          </div>
          <ProgressBar value={Math.round((100 * step.answered) / Math.max(1, step.max))} label={t('m05.take.progressLabel')} />
        </div>
        <Card eyebrow={pick(b, 'name')}>
          <fieldset>
            <legend className="mb-3 text-[16px] font-semibold leading-snug">{pick(it as unknown as Row, 'stem')}</legend>
            <div className="space-y-2" role="radiogroup">
              {list.map((o, i) => (
                <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 text-[14px] ${choice === String(i) ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'}`}>
                  <input type="radio" name="m05-take-choice" value={String(i)} checked={choice === String(i)} onChange={() => setChoice(String(i))} className="mt-1" data-testid={`m05-take-opt-${i}`} />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-ink-3">{t('m05.take.noKey')}</span>
            <button type="button" className="btn-primary" disabled={choice === '' || busy} onClick={answer} data-testid="m05-take-next">{t('m05.take.next')}</button>
          </div>
        </Card>
        <div aria-live="polite">{error && <Callout tone="bad" title={t('m05.take.error')}>{error}</Callout>}</div>
      </div>
    );
  }

  const result: AdResult | null = step?.done && step.result ? step.result : shown ? resultFromRow(shown) : null;
  const report = result?.integrity_id ? reports.find((r) => r.id === result.integrity_id) : null;
  return (
    <div className="space-y-6">
      {step?.done && <Callout tone="ok" title={t('m05.take.doneTitle')}>{t('m05.take.doneBody', { n: f.num(step.answered) })}</Callout>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title={pick(b, 'name')} eyebrow={<ModeChip criterion={card.criterion} safety={card.safety} />}>
          <p className="text-[13.5px] text-ink-2">{pick(b, 'summary')}</p>
          <ul className="mt-3 space-y-1.5 text-[13px] text-ink-2" data-testid="m05-take-rules">
            {['r1', 'r2', card.criterion ? 'r3c' : 'r3n', 'r4'].map((k) => (
              <li key={k} className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />
                {t(`m05.take.${k}`, { max: f.num(b.max_items), min: f.num(b.min_items), w: f.num(b.stable_window), cut: f.num(b.cut_level), cap: f.num(b.evidence_cap), days: f.num(b.retake_days) })}</li>
            ))}
          </ul>
          <div className="mt-3 space-y-2"><SkillLinks ids={b.skill_ids ?? []} d={d} /><GateChips codes={b.gates} d={d} /></div>
          {(b.gates ?? []).length > 0 && <p className="mt-2 text-[12px] text-ink-3">{t('m05.take.gatingNote')}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {card.can_start ? <button type="button" className="btn-primary" onClick={start} disabled={busy} data-testid="m05-take-start">{card.in_progress ? t('m05.ad.resume') : done.length ? t('m05.ad.retake') : t('m05.ad.start')}</button>
              : <span className="text-[13px] text-ink-2" data-testid="m05-take-next-on">{t('m05.ad.nextOn', { date: f.date(card.next_on) })}</span>}
          </div>
          <div aria-live="polite" className="mt-3">{error && <Callout tone="bad" title={t('m05.take.error')}>{error}</Callout>}</div>
        </Card>
        <Card title={t('m05.take.attempts')} eyebrow={t('m05.take.attemptsEyebrow', { n: f.num(done.length) })}>
          {done.length ? (
            <ul className="space-y-2 text-[13px]" data-testid="m05-take-history">
              {[...done].reverse().map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                  <L to={`/my/assessments/adaptive/${b.id}?attempt=${a.id}`}>{f.date(a.completed_at)}</L>
                  <span className="flex items-center gap-2">{a.counts === false && <StatusPill tone="bad">{t('m05.ir.decision.voided')}</StatusPill>}<LevelPill level={a.estimate} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-[13px] text-ink-3">{t('m05.ad.notTaken')}</p>}
        </Card>
      </div>
      {result ? <Result d={d} b={b} card={card} r={result} report={report} voided={!!shown && shown.id === result.attempt_id && shown.counts === false} /> : null}
    </div>
  );
}

function Result({ d, b, card, r, report, voided }: { d: FsRef; b: Row; card: AdBankCard; r: AdResult; report: Row | null | undefined; voided: boolean }) {
  const t = useT();
  const f = useFormat();
  const lines = [
    ...(r.criterion ? [{ kind: 'target' as const, label: t('m05.ad.line.standard'), value: Number(b.cut_level) }] : []),
    ...(!r.criterion && card.enec_avg != null ? [{ kind: 'enec' as const, label: t('m05.ad.line.enec', { n: f.num(card.enec_n ?? 0) }), value: card.enec_avg }] : []),
  ];
  const evLevels = Object.fromEntries(r.evidence.map((e) => [e.skill_id, e.level]));
  return (
    <Section title={t('m05.take.res.title')} description={t('m05.take.res.intro')}>
      {voided && <Callout tone="bad" title={t('m05.take.res.voidedTitle')}>{t('m05.take.res.voidedBody')}</Callout>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={<span className="flex flex-wrap items-center gap-2" data-testid="m05-take-result" data-level={r.estimate} data-criterion={r.criterion ? 'yes' : 'no'} data-percentile={r.percentile ?? ''}>
          <LevelPill level={r.estimate} /><ResultText a={{ ...r, mode: r.criterion ? 'criterion' : 'normative' }} /></span>}
          actions={<WhyThis reasons={r.reasons} testId="m05-take-why" />}>
          <BenchmarkLine value={r.estimate} max={4} label={t('m05.ad.line.label')} lines={lines} />
          <div className="mt-3">
            <BenchmarkLine value={r.item_count} max={20} unit="count" label={t('m05.take.res.itemsLine')} benchmark={{ id: 'SKILLS-TECH', figure: 'adaptive_items' }} />
          </div>
          <p className="mt-3 text-[13px] text-ink-2">{t(`m05.ad.levelText.${r.estimate}`)}</p>
          {r.criterion && <p className="mt-1 text-[12.5px] text-ink-3" data-testid="m05-take-no-pct">{t('m05.take.res.criterionNote')}</p>}
          {!r.criterion && r.percentile == null && <p className="mt-1 text-[12.5px] text-ink-3">{t('m05.ad.pctSuppressedLong')}</p>}
        </Card>
        <Card title={t('m05.take.res.path')} eyebrow={t(`m05.ad.reason.stop.${r.stop}`, { n: f.num(r.item_count), max: f.num(b.max_items), window: f.num(b.stable_window) })}>
          <StaircasePath path={r.path} />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m05.take.res.evidence')} eyebrow={t('m05.take.res.evidenceEyebrow', { cap: f.num(b.evidence_cap) })}>
          {r.evidence.length ? <div data-testid="m05-take-evidence"><SkillLinks ids={r.evidence.map((e) => e.skill_id)} d={d} level={evLevels} /></div> : <p className="text-[13px] text-ink-3">{t('m05.take.res.noEvidence')}</p>}
          <p className="mt-2 text-[12px] text-ink-3">{t('m05.take.res.evidenceNote')}</p>
          <L to="/my/skills" className="mt-2 inline-block text-[13px]">{t('m05.take.res.toPassport')}</L>
        </Card>
        <Card title={t('m05.ir.title')} eyebrow={t('m05.ir.eyebrow')}>
          {report ? <IntegritySummary r={report} /> : <p className="text-[13px] text-ink-3">{(b.gates ?? []).length ? t('m05.ir.pending') : t('m05.ir.notGating')}</p>}
        </Card>
      </div>
    </Section>
  );
}
