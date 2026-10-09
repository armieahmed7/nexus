// /talent/succession/:slateId (M23 · F19): one succession slate. Successors with readiness (computed from F05 skills and the
// role's hard gates, confirmed by HR), gate chips (licence route, qualification, entry condition), gap actions (training,
// rotation, mentoring) and risk flags. The HR director proposes candidates (people in the role and in feeder roles, ranked with
// reasons), names external emergency cover as a role card, withdraws successors with a reason and confirms the slate.
// A person can never be "ready now" with a hard gate not met (the RPC refuses: gate_not_met).
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, ConfirmDialog, Modal, TextArea, TextField, SelectField, CheckboxField, ProgressBar, Icon, WhyThis, StatusPill } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { NOTE_MIN, READINESS, READY_RANK, type DevAction, type Readiness } from './domain';
import { ActionKindPill, ConfidentialNote, FlagPills, GateChips, ReadinessPill, unwrap, useCatalogue, useLabels, type Labels } from './ui';
import type { Candidate, SlateView, SuccessionBoard, SuccessorView } from './backend/rpc';

export default function SlatePage() {
  const t = useT();
  const repo = useRepo();
  const { slateId = '' } = useParams();
  const q = useQuery(['succession_slates', 'successors', 'bench_rollups'], () => unwrap<SuccessionBoard>(repo.rpc.successionBoard()), []);
  const cat = useCatalogue();
  const lab = useLabels(cat.data);
  return (
    <Page title={t('m23.routes.talent-succession-slate.title')} eyebrow={<L to="/talent/succession">{t('m23.sx.back')}</L>} wide>
      <ConfidentialNote />
      <Async state={q}>
        {(b) => {
          const s = b.slates.find((x) => x.id === slateId);
          if (!s) return <EmptyState icon="alert" title={t('m23.sx.notFound')} />;
          return <Slate s={s} canEdit={b.can.edit} lab={lab} />;
        }}
      </Async>
    </Page>
  );
}

function Slate({ s, canEdit, lab }: { s: SlateView; canEdit: boolean; lab: Labels }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const [withdraw, setWithdraw] = useState<SuccessorView | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [propose, setPropose] = useState<Candidate | null>(null);
  const [cover, setCover] = useState(false);
  const open = s.status !== 'confirmed';
  const internal = s.successors.filter((x) => x.cover_source === 'internal');
  const ext = s.successors.filter((x) => x.cover_source !== 'internal');
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-[19px] font-semibold" data-testid="m23-slate-role">{lab.role(s.role_id)}</h2>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2"><Icon name="user" size={13} />{pick({ name_en: s.incumbent_en, name_ar: s.incumbent_ar }, 'name')} · <span className="num">{s.period}</span> · {t('m23.sx.bench', { n: f.num(internal.length), target: f.num(s.target_bench) })}</div>
          <FlagPills flags={s.flags} />
        </div>
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill tone={s.status === 'confirmed' ? 'ok' : 'info'}>{t(`m23.slateStatus.${s.status}`)}</StatusPill>
          {canEdit && open && <button className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m23-confirm-slate"><Icon name="check" size={14} />{t('m23.sx.confirmSlate')}</button>}
        </span>
      </div>
      {s.status === 'confirmed' && <Callout tone="ok" title={t('m23.sx.confirmedTitle', { date: f.date(s.confirmed_at), name: s.confirmed_name ?? '' })}>{t('m23.sx.confirmedBody')}</Callout>}
      {s.flags.map((x) => <Callout key={x} tone={x === 'no_emergency' ? 'sim' : 'bad'} title={t(`m23.flag.${x}`)}>{t(`m23.flagHelp.${x}`)}</Callout>)}
      <Section title={t('m23.sx.successorsTitle')} description={t('m23.sx.successorsDesc')}>
        {internal.length === 0 ? <EmptyState icon="users" title={t('m23.sx.noSuccessors')} /> : (
          <ul className="space-y-3" data-testid="m23-successors">
            {internal.map((x) => (
              <li key={x.id} className="card p-3" data-testid="m23-successor" data-readiness={x.readiness ?? ''}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{lang === 'ar' ? x.person_name_ar : x.person_name} <span className="font-normal text-ink-3">· {lab.roleShort(x.person_role_id)}</span></div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ReadinessPill r={x.readiness} />
                      {x.computed_readiness && x.computed_readiness !== x.readiness && <span className="text-[12px] text-ink-3">{t('m23.sx.computedWas', { r: t(`m23.readiness.${x.computed_readiness}`) })}</span>}
                      {x.emergency && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m23.sx.emergency')}</span>}
                      {x.slates > 2 && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m23.sx.onSlates', { n: f.num(x.slates) })}</span>}
                      <span className="chip border-line bg-sunken text-ink-2">{t(`m23.successorStatus.${x.status}`)}</span>
                    </div>
                  </div>
                  {canEdit && open && <button className="btn-ghost btn-sm" onClick={() => setWithdraw(x)} data-testid="m23-withdraw">{t('m23.sx.withdraw')}</button>}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <div className="caps mb-1">{t('m23.sx.readinessPct')}</div>
                    <ProgressBar value={x.readiness_pct ?? 0} tone={(x.readiness_pct ?? 0) >= 85 ? 'ok' : 'accent'} label={t('m23.sx.readinessPct')} />
                    <div className="num mt-1 text-[12px] text-ink-3">{f.num(x.readiness_pct)}%{x.months ? ` · ${t('m23.sx.months', { n: f.num(x.months) })}` : ''}</div>
                  </div>
                  <div><div className="caps mb-1">{t('m23.sx.gates')}</div><GateChips gates={x.gates} /></div>
                  <div>
                    <div className="caps mb-1">{t('m23.sx.gaps')}</div>
                    {x.gaps.length === 0 ? <span className="text-[12px] text-ink-3">{t('m23.sx.noGaps')}</span> : (
                      <ul className="text-[12.5px]">{x.gaps.slice(0, 3).map((g) => <li key={g.competency_id}>{lab.comp(g.competency_id)} <span className="num text-ink-3">{g.have}→{g.need}</span></li>)}</ul>
                    )}
                  </div>
                </div>
                {x.actions.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2 text-[12.5px]">{x.actions.map((a, i) => <li key={i} className="flex items-center gap-1.5 rounded-btn border border-line px-2 py-1"><ActionKindPill kind={a.kind} />{lang === 'ar' ? a.title_ar : a.title_en}</li>)}</ul>
                )}
                {x.note && <p className="mt-2 text-[12.5px] text-ink-2">“{x.note}”</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t('m23.sx.coverTitle')} description={t('m23.sx.coverDesc')} actions={canEdit && open ? <button className="btn-outline btn-sm" onClick={() => setCover(true)} data-testid="m23-add-cover"><Icon name="plus" size={14} />{t('m23.sx.addCover')}</button> : undefined}>
        {ext.length === 0 ? <p className="text-[13px] text-ink-3">{t('m23.sx.noCover')}</p> : (
          <ul className="space-y-2">{ext.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2 text-[13px]" data-testid="m23-cover">
              <span className="flex flex-wrap items-center gap-1.5"><ReadinessPill r={null} /><span className="chip border-reserved-line bg-reserved-bg text-reserved">{t(`m23.cover.${x.cover_source}`)}</span>{pick({ name_en: x.cover_label_en, name_ar: x.cover_label_ar }, 'name')}{x.emergency && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m23.sx.emergency')}</span>}</span>
              {canEdit && open && <button className="btn-ghost btn-sm" onClick={() => setWithdraw(x)}>{t('m23.sx.withdraw')}</button>}
            </li>
          ))}</ul>
        )}
      </Section>
      {canEdit && open && <Candidates s={s} onPropose={setPropose} lab={lab} />}
      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} danger requireReason reasonLabel={t('m23.sx.withdrawReason')} title={t('m23.sx.withdrawTitle')} consequence={t('m23.sx.withdrawBody')} confirmLabel={t('m23.sx.withdraw')}
        onConfirm={async (reason) => { if (withdraw) await run(() => repo.rpc.withdrawSuccessor(withdraw.id, reason)); }} />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m23.sx.confirmSlate')} consequence={t('m23.sx.confirmBody', { n: f.num(s.successors.length) })} confirmLabel={t('m23.sx.confirmSlate')}
        onConfirm={async (reason) => { await run(() => repo.rpc.confirmSlate(s.id, reason)); }} />
      {propose && <ProposeModal s={s} c={propose} onClose={() => setPropose(null)} lab={lab} />}
      {cover && <CoverModal s={s} onClose={() => setCover(false)} />}
    </>
  );
}

function Candidates({ s, onPropose, lab }: { s: SlateView; onPropose: (c: Candidate) => void; lab: Labels }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const q = useQuery(['successors'], () => unwrap<Candidate[]>(repo.rpc.successionCandidates(s.id)), [s.id]);
  return (
    <Section title={t('m23.sx.candidatesTitle')} description={t('m23.sx.candidatesDesc')}>
      <Async state={q} empty={<EmptyState title={t('m23.sx.noCandidates')} />} isEmpty={(d) => d.length === 0}>
        {(cands) => (
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2" data-testid="m23-candidates">
            {cands.map((c) => (
              <li key={c.person_id} className="card flex flex-col gap-2 p-3" data-testid="m23-candidate" data-readiness={c.readiness}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{lang === 'ar' ? c.name_ar : c.name}</div>
                    <div className="text-[12px] text-ink-3">{lab.roleShort(c.role_id)} · {t(`m23.relation.${c.relation}`)}</div>
                  </div>
                  <ReadinessPill r={c.readiness} />
                </div>
                <div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={c.pct ?? 0} tone={(c.pct ?? 0) >= 85 ? 'ok' : 'accent'} label={t('m23.sx.readinessPct')} /></div><span className="num text-[12px]">{f.num(c.pct)}%</span></div>
                <GateChips gates={c.gates} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1"><WhyThis reasons={c.reasons} testId="m23-why-candidate" />{c.slates > 0 && <span className="text-[12px] text-ink-3">{t('m23.sx.alsoOn', { n: f.num(c.slates) })}</span>}</span>
                  {c.on_slate ? <span className="text-[12px] text-ink-3">{t('m23.sx.onSlate')}</span> : <button className="btn-primary btn-sm" onClick={() => onPropose(c)} data-testid="m23-propose">{t('m23.sx.propose')}</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </Section>
  );
}

function ProposeModal({ s, c, onClose, lab }: { s: SlateView; c: Candidate; onClose: () => void; lab: Labels }) {
  const t = useT();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const courses = useQuery('courses', () => repo.list('courses').catch(() => [] as RowOf<'courses'>[]), []);
  const [ready, setReady] = useState<Readiness>(c.readiness);
  const [emergency, setEmergency] = useState(false);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const suggestions = useMemo<DevAction[]>(() => {
    const out: DevAction[] = [];
    for (const g of c.gaps.slice(0, 2)) {
      const course = (courses.data ?? []).find((x) => x.audience !== 'supplier' && ((x.competency_ids as string[] | null) ?? []).includes(g.competency_id));
      if (course && !out.some((a) => a.ref_id === course.id)) out.push({ kind: 'training', title_en: course.title_en, title_ar: course.title_ar, ref_table: 'courses', ref_id: course.id });
    }
    const role = lab.roleShort(s.role_id);
    if (c.readiness !== 'ready_now') out.push({ kind: 'rotation', title_en: `Rotation into ${role} duties (3 months)`, title_ar: `تدوير في مهام ${role} (3 أشهر)`, ref_table: null, ref_id: null });
    out.push({ kind: 'mentoring', title_en: 'Knowledge-transfer mentoring with the incumbent', title_ar: 'إرشاد لنقل المعرفة مع شاغل المنصب', ref_table: null, ref_id: null });
    return out;
  }, [c, courses.data, lab, s.role_id]);
  const [picked, setPicked] = useState<string[]>([]);
  const earlier = READY_RANK[ready] < READY_RANK[c.readiness];
  const noteMissing = earlier && note.trim().length < NOTE_MIN;
  return (
    <Modal open onClose={onClose} size="lg" title={t('m23.sx.proposeTitle', { name: lang === 'ar' ? c.name_ar : c.name })}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={noteMissing} onClick={() => setConfirm(true)} data-testid="m23-propose-save">{t('m23.sx.propose')}</button></>}>
      <div className="space-y-3 text-[13px]">
        <p className="text-ink-2">{t('m23.sx.proposeBody', { r: t(`m23.readiness.${c.readiness}`) })}</p>
        <GateChips gates={c.gates} />
        <fieldset>
          <legend className="mb-1 font-semibold">{t('m23.sx.readiness')}</legend>
          <div className="flex flex-wrap gap-1.5" data-testid="m23-propose-readiness">
            {READINESS.map((r) => {
              const blocked = r === 'ready_now' && !c.gates_met;
              return <button key={r} type="button" disabled={blocked} aria-pressed={ready === r} title={blocked ? t('m23.sx.gateBlocked') : undefined} className={`btn-sm ${ready === r ? 'btn-primary' : 'btn-outline'}`} onClick={() => setReady(r)}>{t(`m23.readiness.${r}`)}</button>;
            })}
          </div>
          {!c.gates_met && <p className="mt-1 text-[12px] text-bad">{t('m23.sx.gateBlocked')}</p>}
        </fieldset>
        <CheckboxField label={t('m23.sx.emergencyCover')} checked={emergency} onChange={setEmergency} hint={t('m23.sx.emergencyHint')} />
        <TextArea label={t('m23.sx.note')} name="note" value={note} onChange={setNote} rows={2} hint={earlier ? t('m23.sx.noteEarlier') : t('m23.sx.noteHint')} />
        <fieldset>
          <legend className="mb-1 font-semibold">{t('m23.sx.gapActions')}</legend>
          <ul className="space-y-1">
            {suggestions.map((a) => (
              <li key={a.title_en}><label className="flex items-center gap-2"><input type="checkbox" checked={picked.includes(a.title_en)} onChange={() => setPicked((p) => (p.includes(a.title_en) ? p.filter((x) => x !== a.title_en) : [...p, a.title_en]))} className="accent-[rgb(var(--accent))]" /><ActionKindPill kind={a.kind} />{lang === 'ar' ? a.title_ar : a.title_en}</label></li>
            ))}
          </ul>
        </fieldset>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m23.sx.propose')} consequence={t('m23.sx.proposeConfirm', { name: lang === 'ar' ? c.name_ar : c.name, r: t(`m23.readiness.${ready}`) })} confirmLabel={t('m23.sx.propose')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.proposeSuccessor({ slate_id: s.id, person_id: c.person_id, readiness: ready, emergency, note: note.trim() || null, actions: suggestions.filter((a) => picked.includes(a.title_en)) }));
          if (r.ok) onClose();
        }} />
    </Modal>
  );
}

function CoverModal({ s, onClose }: { s: SlateView; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [src, setSrc] = useState<'khnp' | 'contractor'>('khnp');
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [emergency, setEmergency] = useState(true);
  const ok = en.trim().length >= 3 && ar.trim().length >= 3;
  return (
    <Modal open onClose={onClose} title={t('m23.sx.addCover')}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={!ok} data-testid="m23-cover-save"
        onClick={async () => { const r = await run(() => repo.rpc.proposeSuccessor({ slate_id: s.id, cover_source: src, cover_label_en: en.trim(), cover_label_ar: ar.trim(), emergency })); if (r.ok) onClose(); }}>{t('m23.sx.addCover')}</button></>}>
      <div className="space-y-3">
        <Callout>{t('m23.sx.coverHint')}</Callout>
        <SelectField label={t('m23.sx.coverSource')} name="src" value={src} onChange={(v) => setSrc(v as 'khnp' | 'contractor')} options={[{ value: 'khnp', label: t('m23.cover.khnp') }, { value: 'contractor', label: t('m23.cover.contractor') }]} />
        <TextField label={t('m23.sx.coverLabelEn')} name="en" value={en} onChange={setEn} placeholder={t('m23.sx.coverPhEn')} />
        <TextField label={t('m23.sx.coverLabelAr')} name="ar" value={ar} onChange={setAr} placeholder={t('m23.sx.coverPhAr')} />
        <CheckboxField label={t('m23.sx.emergencyCover')} checked={emergency} onChange={setEmergency} />
      </div>
    </Modal>
  );
}
