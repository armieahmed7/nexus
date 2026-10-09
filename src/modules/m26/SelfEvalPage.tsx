// /training/accreditation/:selfEvalId (M26 · F29): one self-evaluation. Every criterion grouped by area with last cycle's rating,
// the current rating and its evidence links; rating a criterion shows the evidence Kafa'a holds for the programme (F27
// traceability, F25 effectiveness, M05 item analysis, F31/M02 instructor qualifications, M02 sign-off timeliness, M04 records),
// suggested per criterion, or "no evidence found". A gap (1 or 2) needs an owner and a due date. The training manager finalises,
// never as the sole author (maker-checker). Finalised self-evaluations are read-only.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, StatTile, ProgressRing, WhyThis, Modal, ConfirmDialog, RadioGroup, SelectField, TextArea, TextField, CheckboxField } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { AREAS, DEMO_NOTICE, OWNER_ROLES, addDaysIso, factLabel, isGap, readinessReasons, selfEvalState, soleAuthor, suggestFor, toLink, type EvidenceFact, type EvidenceLink } from './accr';
import { RatingPill, SelfEvalPill, useAccrData, type AccrData } from './ui';
import { useAccrModel } from './AccrPage';

export default function SelfEvalPage() {
  const t = useT();
  const { selfEvalId = '' } = useParams();
  const q = useAccrData();
  return (
    <Page title={t('m26.routes.training-accreditation-selfeval.title')} wide>
      <Async state={q}>{(d) => (d.selfevals.some((s) => s.id === selfEvalId) ? <SelfEval d={d} id={selfEvalId} /> : <EmptyState title={t('m26.se.notFound')} action={<L to="/training/accreditation" className="btn-outline no-underline">{t('m26.common.back')}</L>} />)}</Async>
    </Page>
  );
}

function SelfEval({ d, id }: { d: AccrData; id: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const lang = useLang();
  const m = useAccrModel(d);
  const se = d.selfevals.find((x) => x.id === id)!;
  const ev = useQuery(['jta_tasks', 'task_objectives', 'training_records', 'evaluations', 'attempts'], () => repo.rpc.accrEvidence(se.programme_id), [se.programme_id]);
  const xs = d.assessments.filter((a) => a.selfeval_id === id);
  const byCrit = new Map(xs.map((a) => [a.criterion_id, a]));
  const prevSe = d.selfevals.filter((x) => x.programme_id === se.programme_id && x.status === 'finalised' && x.cycle < se.cycle).sort((a, b) => (a.cycle < b.cycle ? 1 : -1))[0];
  const prevBy = new Map(d.assessments.filter((a) => a.selfeval_id === prevSe?.id).map((a) => [a.criterion_id, a.rating]));
  const st = selfEvalState(xs as never, m.total);
  const draft = se.status === 'draft';
  const canW = s.can('sat', ['W', 'A']) && draft;
  const canA = s.can('sat', ['A']) && draft;
  const me = s.identity.personId ?? '';
  const blockers = [!st.complete && t('m26.se.blockIncomplete', { n: f.num(st.total - st.rated) }), st.unowned > 0 && t('m26.se.blockUnowned'), soleAuthor(st.authors, me) && t('m26.se.blockSole')].filter(Boolean) as string[];
  const [rate, setRate] = useState<string | null>(null);
  const [fin, setFin] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[18px] font-semibold">{m.name(se.programme_id)}</span>
        <span className="num text-ink-2">{m.code(se.programme_id)} · {se.cycle}</span>
        <SelfEvalPill status={se.status} />
        <span className="flex-1" />
        <L to={`/training/accreditation/${id}/report`} className="btn-outline btn-sm no-underline" data-testid="m26-ser-link">{t('m26.se.report')}</L>
        {canA && <button className="btn-primary btn-sm" disabled={blockers.length > 0} onClick={() => setFin(true)} title={blockers.join(' · ')} data-testid="m26-finalise">{t('m26.se.finalise')}</button>}
      </div>
      <Callout tone="sim"><b>{DEMO_NOTICE[lang]}</b> · {t('m26.se.mirror')}</Callout>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="m26-se-tiles">
        <div className="card flex items-center gap-3 p-4">
          <ProgressRing value={st.readiness} size={64} tone={st.readiness >= 75 ? 'ok' : st.readiness >= 50 ? 'accent' : 'sim'} />
          <div><div className="caps">{t('m26.se.readiness')}</div><WhyThis reasons={readinessReasons(st)} testId="m26-se-why" /></div>
        </div>
        <StatTile label={t('m26.se.rated')} value={`${f.num(st.rated)} / ${f.num(st.total)}`} />
        <StatTile label={t('m26.se.gaps')} value={f.num(st.gaps)} tone={st.gaps ? 'sim' : 'ok'} sub={st.unowned ? t('m26.se.unowned', { n: f.num(st.unowned) }) : undefined} />
        <StatTile label={t('m26.se.previous')} value={prevSe ? f.pct(m.stateOf(prevSe.id).readiness, 0) : '—'} sub={prevSe?.cycle} />
        <StatTile label={t('m26.se.authors')} value={f.num(st.authors.length)} sub={se.status === 'finalised' ? t('m26.se.finalisedBy', { who: pick({ n_en: se.finalised_by_name, n_ar: se.finalised_by_name_ar }, 'n'), date: f.date(se.finalised_at) }) : t('m26.se.makerChecker')} />
      </div>
      {canA && blockers.length > 0 && <Callout tone="info" title={t('m26.se.cannotFinalise')}><ul className="list-disc ps-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul></Callout>}
      {AREAS.map((area) => (
        <Section key={area} title={t(`m26.area.${area}`)}>
          <ul className="space-y-2" data-testid="m26-se-criteria">
            {d.criteria.filter((c) => c.area === area).map((c) => {
              const a = byCrit.get(c.id);
              const evidence = (a?.evidence ?? []) as EvidenceLink[];
              return (
                <li key={c.id}>
                  <Card>
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2"><span className="num font-semibold">{c.code}</span><span className="font-semibold">{pick(c, 'title')}</span>{c.phase && <span className="chip border-line bg-sunken text-ink-2">{t(`m26.phase.${c.phase}`)}</span>}</div>
                        <p className="mt-0.5 text-[12.5px] text-ink-2">{pick(c, 'guidance')}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {prevBy.has(c.id) && <span className="text-[11.5px] text-ink-3">{t('m26.se.prevRating', { r: f.num(prevBy.get(c.id)!) })}</span>}
                        <RatingPill rating={a?.rating} />
                        {canW && <button className="btn-outline btn-sm" onClick={() => setRate(c.id)} data-testid="m26-rate-criterion">{a ? t('m26.se.edit') : t('m26.se.rate')}</button>}
                      </div>
                    </div>
                    {a && (
                      <div className="mt-2 grid grid-cols-1 gap-2 text-[12.5px] md:grid-cols-2">
                        <div>
                          <div className="caps mb-0.5">{t('m26.se.evidence')}</div>
                          {evidence.length ? <ul className="space-y-0.5">{evidence.map((e) => <li key={`${e.kind}:${e.ref}`}><L to={e.route} className="link">{pick(e, 'label')}</L></li>)}</ul> : <span className="text-ink-3">{t('m26.se.noEvidence')}</span>}
                        </div>
                        {isGap(a.rating) && (
                          <div className="rounded-card border border-sim-line bg-sim-bg p-2">
                            <div className="caps mb-0.5">{t('m26.se.gap')}</div>
                            <div>{a.gap_en || '—'}</div>
                            <div className="text-ink-2">{a.owner_role ? t(`m26.owner.${a.owner_role}`) : '—'} · {f.date(a.due_on)}</div>
                          </div>
                        )}
                        <div className="text-[11.5px] text-ink-3 md:col-span-2">{t('m26.se.ratedBy', { who: pick({ n_en: a.rated_by_name, n_ar: a.rated_by_name_ar }, 'n'), date: f.date(a.rated_at) })}</div>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </Section>
      ))}
      <RateModal d={d} se={se} criterionId={rate} facts={ev.data?.facts ?? []} loading={ev.loading} onClose={() => setRate(null)} />
      <ConfirmDialog open={fin} onClose={() => setFin(false)} title={t('m26.se.finalise')} consequence={t('m26.se.finaliseBody', { pct: f.num(st.readiness), g: f.num(st.gaps) })}
        actingAs={t('m26.common.asTm')} confirmLabel={t('m26.se.finalise')} onConfirm={async () => { await run(() => repo.rpc.finaliseSelfEval(id)); }} />
    </div>
  );
}

function RateModal({ d, se, criterionId, facts, loading, onClose }: { d: AccrData; se: AccrData['selfevals'][number]; criterionId: string | null; facts: EvidenceFact[]; loading: boolean; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const c = d.criteria.find((x) => x.id === criterionId);
  const cur = d.assessments.find((a) => a.selfeval_id === se.id && a.criterion_id === criterionId);
  const sugg = useMemo(() => (c ? suggestFor(c.evidence_kinds, facts) : []), [c, facts]);
  const today = todayIso();
  const [v, setV] = useState<{ rating: string; picked: Record<string, boolean>; gap: string; owner: string; due: string; note: string } | null>(null);
  const key = (x: { kind: string; ref: string }) => `${x.kind}:${x.ref}`;
  const state = v ?? {
    rating: cur ? String(cur.rating) : '', gap: cur?.gap_en ?? '', owner: cur?.owner_role ?? '', due: cur?.due_on ? String(cur.due_on).slice(0, 10) : addDaysIso(today, 90), note: cur?.note ?? '',
    picked: Object.fromEntries([...((cur?.evidence ?? []) as EvidenceLink[]).map((e) => [key(e), true]), ...(cur ? [] : sugg.filter((x) => x.kind !== 'none').map((x) => [key(x), true]))]),
  };
  const set = (p: Partial<typeof state>) => setV({ ...state, ...p });
  const gap = state.rating !== '' && isGap(Number(state.rating));
  const valid = state.rating !== '' && (!gap || (state.owner && state.due >= today && state.due <= addDaysIso(today, 365)));
  const close = () => { setV(null); onClose(); };
  const save = async () => {
    if (!c) return;
    const kept = ((cur?.evidence ?? []) as EvidenceLink[]).filter((e) => state.picked[key(e)] && !sugg.some((x) => key(x) === key(e)));
    const fresh = sugg.filter((x): x is EvidenceFact => x.kind !== 'none' && !!state.picked[key(x)]).map(toLink);
    const r = await run(() => repo.rpc.rateCriterion({ selfeval_id: se.id, criterion_id: c.id, rating: Number(state.rating), evidence: [...fresh, ...kept].slice(0, 8), gap_en: gap ? state.gap : '', owner_role: gap ? state.owner : null, due_on: gap ? state.due : null, note: state.note }));
    if (r.ok) close();
  };
  return (
    <Modal open={!!c} onClose={close} size="lg" title={c ? `${c.code} · ${pick(c, 'title')}` : ''} footer={<>
      <button className="btn-outline" onClick={close}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={!valid} onClick={save} data-testid="m26-rate-save-criterion">{t('m26.common.save')}</button>
    </>}>
      {c && (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-2">{pick(c, 'guidance')}</p>
          <RadioGroup label={t('m26.se.rating')} name="rating" value={state.rating} onChange={(x) => set({ rating: x })} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: <span><b className="num">{n}</b> · {t(`m26.rating.r${n}`)} <span className="text-ink-3">— {t(`m26.rating.hint${n}`)}</span></span> }))} />
          <fieldset>
            <legend className="mb-1 text-[13px] font-semibold">{t('m26.se.suggested')}</legend>
            {loading ? <p className="text-[12.5px] text-ink-3">{t('m26.se.loadingEvidence')}</p> : (
              <ul className="space-y-1" data-testid="m26-suggestions">
                {sugg.map((x) => x.kind === 'none'
                  ? <li key="none" className="text-[12.5px] text-ink-3" data-testid="m26-no-evidence">{t('m26.se.noEvidenceFound')}</li>
                  : <li key={key(x)}><CheckboxField label={<span>{factLabel(x as EvidenceFact)[lang]} <L to={x.route} className="link text-[12px]">{t('m26.se.open')}</L></span>} checked={!!state.picked[key(x)]} onChange={(on) => set({ picked: { ...state.picked, [key(x)]: on } })} /></li>)}
                {((cur?.evidence ?? []) as EvidenceLink[]).filter((e) => !sugg.some((x) => key(x) === key(e))).map((e) => (
                  <li key={key(e)}><CheckboxField label={<span>{pick(e, 'label')} <span className="text-ink-3">({t('m26.se.earlier')})</span></span>} checked={!!state.picked[key(e)]} onChange={(on) => set({ picked: { ...state.picked, [key(e)]: on } })} /></li>
                ))}
              </ul>
            )}
          </fieldset>
          {gap && (
            <div className="space-y-3 rounded-card border border-sim-line bg-sim-bg p-3">
              <TextArea label={t('m26.se.gapText')} name="gap" rows={2} value={state.gap} onChange={(x) => set({ gap: x })} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField label={t('m26.se.owner')} name="owner" value={state.owner} onChange={(x) => set({ owner: x })} options={OWNER_ROLES.map((o) => ({ value: o, label: t(`m26.owner.${o}`) }))} required />
                <TextField label={t('m26.se.due')} name="due" type="date" value={state.due} onChange={(x) => set({ due: x })} required />
              </div>
            </div>
          )}
          <TextArea label={t('m26.se.note')} name="note" rows={2} value={state.note} onChange={(x) => set({ note: x })} />
        </div>
      )}
    </Modal>
  );
}
