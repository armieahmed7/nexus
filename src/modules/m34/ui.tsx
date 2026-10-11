// M34 shared UI (FS wave D · E2): the "not an authority" and "indicative" notices, status pills, the evidence pack, and RplDetail, the
// one view of an RPL request used by the person (/my/recognition/rpl/:id) and by assessors (/recognition/review/:id). Every action goes
// through rpc.submitRpl / attestRpl / decideRpl / exportRpl; the page never decides what the backend allows (it only avoids dead ends).
import { useMemo, useState, type ReactNode } from 'react';
import {
  Async, BenchmarkChips, Callout, Card, ConfirmDialog, Drawer, EmptyState, Icon, KeyValue, ProgressBar, RadioGroup, Section, SelectField, StatusPill, Stepper,
  TextArea, Timeline, WhyThis, downloadText, type PillTone,
} from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { PERSONAS, useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import type { Reason } from '../../domain/engines/types';
import { HOURS_MAX, LEVEL_NAMES, MAX_EVIDENCE, checkDecide, countedEvidence, rplAdvice, rplStatement, type RplOption } from './rpl';
import { nqfForLevel } from './credits';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function NotAuthority() {
  const t = useT();
  return <div data-testid="m34-not-authority"><Callout tone="sim" title={t('m34.ui.notAuthTitle')}>{t('m34.ui.notAuthBody')}</Callout></div>;
}
export function IndicativeNote({ inline }: { inline?: boolean }) {
  const t = useT();
  if (inline) return <span className="text-[12px] text-sim" data-testid="m34-indicative">{t('m34.ui.indicative')}</span>;
  return <div data-testid="m34-indicative"><Callout tone="info" title={t('m34.ui.indicativeTitle')}>{t('m34.ui.indicative')}</Callout></div>;
}
const STATUS_TONE: Record<string, PillTone> = { draft: 'neutral', submitted: 'info', recommended: 'accent', decided: 'ok', withdrawn: 'neutral' };
export function ReqStatus({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={STATUS_TONE[status] ?? 'neutral'}>{t(`m34.status.${status}`)}</StatusPill>;
}
export function OutcomePill({ outcome }: { outcome?: string | null }) {
  const t = useT();
  if (!outcome) return null;
  return <StatusPill tone={outcome === 'full' ? 'ok' : outcome === 'partial' ? 'info' : 'sim'}>{t(`m34.outcome.${outcome}`)}</StatusPill>;
}
export const KIND_ICON: Record<string, string> = { ojt: 'briefcase', simulator: 'chart', qualification: 'shield', engagement: 'users', attestation: 'user' };
/** Credits from whole notional hours, always one decimal, in the reader's digits. */
export function useCredits() {
  const f = useFormat();
  return (hours: number | null | undefined) => f.num(Math.trunc(Number(hours) || 0) / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
export function NqfBadge({ level }: { level?: number | null }) {
  const t = useT();
  const f = useFormat();
  if (!level) return <span className="text-ink-3">—</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[12px]" title={t('m34.ui.indicative')}><span className="caps">{t('m34.ui.nqf')}</span><span className="num font-semibold">{f.num(level)}</span><span className="text-sim">*</span></span>;
}
export function downloadJson(name: string, data: unknown) {
  downloadText(name, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}
export function levelName(lang: string, l: number | null | undefined) {
  return l && LEVEL_NAMES[l] ? (lang === 'ar' ? LEVEL_NAMES[l].ar : LEVEL_NAMES[l].en) : '';
}
export const STEPS = ['draft', 'submitted', 'recommended', 'decided'];

export function RplStepper({ row }: { row: Row }) {
  const t = useT();
  const cur = row.status === 'withdrawn' ? 0 : STEPS.indexOf(row.status);
  return <Stepper steps={STEPS.map((s) => ({ id: s, label: t(`m34.step.${s}`) }))} current={row.status === 'decided' ? 4 : cur} failedAt={row.status === 'withdrawn' ? 0 : undefined} />;
}

export function EvidenceItem({ e, actions, target }: { e: Row; actions?: ReactNode; target: string[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const direct = e.kind === 'attestation' || (e.skill_ids ?? []).some((x: string) => target.includes(x));
  return (
    <li className={`card flex flex-wrap items-start gap-3 p-3 ${e.active === false ? 'opacity-50' : ''}`} data-testid={`m34-ev-${e.id ?? e.ref_id}`}>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sunken text-ink-2" aria-hidden><Icon name={KIND_ICON[e.kind] ?? 'info'} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="caps">{t(`m34.kind.${e.kind}`)}</span>
          {e.mirror && <StatusPill tone="sim">{t('m34.ui.mirror')}</StatusPill>}
          {e.mirror_status && <StatusPill tone={e.mirror_status === 'qualified' ? 'ok' : 'neutral'}>{t(`m34.mirror.${e.mirror_status}`)}</StatusPill>}
          {e.kind === 'attestation' && <StatusPill tone={e.attestation_status === 'confirmed' ? 'ok' : e.attestation_status === 'declined' ? 'bad' : 'info'}>{t(`m34.attest.${e.attestation_status ?? 'requested'}`)}</StatusPill>}
          {e.kind !== 'attestation' && <StatusPill tone={direct ? 'accent' : 'neutral'}>{t(direct ? 'm34.ui.direct' : 'm34.ui.related')}</StatusPill>}
        </div>
        <div className="mt-1 font-semibold">{pick(e, 'title')}</div>
        <div className="text-[13px] text-ink-2">{e.kind === 'attestation' ? pick({ r_en: e.attester_role_en, r_ar: e.attester_role_ar }, 'r') : pick(e, 'detail')}</div>
        {e.kind === 'attestation' && e.attestation_status === 'confirmed' && <blockquote className="mt-1 border-s-2 border-line ps-2 text-[13px] text-ink-2">{pick({ x_en: e.attestation_en, x_ar: e.attestation_ar || e.attestation_en }, 'x')}</blockquote>}
        {e.kind === 'attestation' && e.request_note && <div className="mt-1 text-[12px] text-ink-3">{t('m34.ui.asked', { note: e.request_note })}</div>}
        {e.observed_on && <div className="mt-1 text-[12px] text-ink-3">{f.date(String(e.observed_on).slice(0, 10))}</div>}
      </div>
      {actions}
    </li>
  );
}

/** Everything one request page needs. */
export function useRequestData(id: string) {
  const repo = useRepo();
  return useQuery(['rpl_requests', 'rpl_evidence', 'skills', 'credit_ledger'], async () => {
    const row = (await repo.get('rpl_requests', id).catch(() => null)) as Row | null;
    if (!row) return null;
    const [evidence, skills, defs, ranges] = await Promise.all([
      repo.list('rpl_evidence', { filter: { request_id: id } }).catch(() => []) as Promise<Row[]>,
      repo.list('skills', { order: [['sort', 'asc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('microcred_defs' as never, {}).catch(() => []) as Promise<Row[]>,
      repo.list('skill_level_ranges', {}).catch(() => []) as Promise<Row[]>,
    ]);
    return { row, evidence: evidence.sort((a, b) => (a.id < b.id ? -1 : 1)), skill: new Map(skills.map((s) => [s.id as string, s])), def: new Map(defs.map((d) => [d.id as string, d])), ranges };
  }, [id]);
}
type ReqData = NonNullable<ReturnType<typeof useRequestData>['data']>;

/** The request: header, stepper, evidence pack, advisory reasons, actions for the opener (draft) or the assessor (review), decision. */
export function RplDetail({ id, mode }: { id: string; mode: 'person' | 'review' }) {
  const t = useT();
  const q = useRequestData(id);
  return (
    <Async state={q} isEmpty={(d) => !d} empty={<EmptyState title={t('m34.detail.notFound')}><L to={mode === 'review' ? '/recognition/review' : '/my/recognition'}>{t('m34.detail.back')}</L></EmptyState>}>
      {(d) => <DetailBody d={d!} mode={mode} />}
    </Async>
  );
}

function DetailBody({ d, mode }: { d: ReqData; mode: 'person' | 'review' }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const credits = useCredits();
  const s = useSession();
  const me = s.identity.personId;
  const r = d.row;
  const target: string[] = r.target_skill_ids ?? [];
  const reqLevel = r.target_kind === 'skill' ? Number(r.level) : Math.max(1, ...(((d.def.get(r.microcred_def_id)?.alignment as Row[]) ?? []).map((a) => Number(a.level) || 1)));
  const advice = useMemo(() => rplAdvice(reqLevel, d.evidence as never, target, todayIso()), [d.evidence, reqLevel, target]);
  const isOpener = r.opened_by === me;
  const assessor = s.can('recognition', ['A']);
  const counted = countedEvidence(d.evidence as never).length;
  const timeline = [
    { id: 'o', when: f.date(String(r.created_at).slice(0, 10)), title: t('m34.tl.opened'), detail: r.opened_by !== r.person_id ? t('m34.tl.behalf') : undefined, tone: 'neutral' as PillTone },
    r.submitted_on && { id: 's', when: f.date(String(r.submitted_on).slice(0, 10)), title: t('m34.tl.submitted', { n: f.num(d.evidence.filter((e) => e.active).length) }), tone: 'info' as PillTone },
    r.return_count > 0 && { id: 'rt', when: '', title: t('m34.tl.returned', { n: f.num(r.return_count) }), detail: r.return_note, tone: 'sim' as PillTone },
    r.recommended_on && { id: 'r', when: f.date(String(r.recommended_on).slice(0, 10)), title: t('m34.tl.recommended', { role: t(`m34.role.${r.recommended_role ?? 'instructor'}`) }), tone: 'accent' as PillTone },
    r.decided_on && { id: 'd', when: f.date(String(r.decided_on).slice(0, 10)), title: t('m34.tl.decided', { role: t(`m34.role.${r.decided_role ?? 'instructor'}`) }), tone: 'ok' as PillTone },
    r.withdrawn_on && { id: 'w', when: f.date(String(r.withdrawn_on).slice(0, 10)), title: t('m34.tl.withdrawn'), tone: 'neutral' as PillTone },
  ].filter(Boolean) as { id: string; when: string; title: string; detail?: string; tone: PillTone }[];
  const why: Reason[] = advice.reasons.map((x) => ({ code: x.code, key: x.key, vars: x.vars }));
  return (
    <div className="space-y-6" data-testid="m34-detail">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="caps">{t(`m34.target.${r.target_kind}`)}</span>
          <ReqStatus status={r.status} />
          <OutcomePill outcome={r.status === 'decided' || mode === 'review' ? r.outcome : null} />
          {r.person_kind === 'contractor' && <StatusPill tone="reserved">{t('m34.ui.contractor')}</StatusPill>}
        </div>
        <h2 className="mt-1 text-[20px] font-semibold">{pick(r, 'target_title')}{r.level ? <span className="text-ink-2"> · {t('m34.ui.levelN', { n: f.num(r.level), name: levelName(lang, r.level) })}</span> : null}</h2>
        {mode === 'review' && <p className="text-[13px] text-ink-2">{pick({ n_en: r.person_name, n_ar: r.person_name_ar }, 'n')}</p>}
        <p className="mt-2 text-[14px] text-ink-2">{pick({ x_en: r.narrative_en, x_ar: r.narrative_ar || r.narrative_en }, 'x')}</p>
        <div className="mt-3"><RplStepper row={r} /></div>
      </div>

      {r.status === 'decided' && <DecisionCard r={r} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title={t('m34.detail.packTitle', { n: f.num(d.evidence.filter((e) => e.active).length), max: f.num(MAX_EVIDENCE) })} description={t('m34.detail.packDesc')}>
            {d.evidence.filter((e) => e.active).length === 0 ? <EmptyState title={t('m34.detail.packEmpty')}>{t('m34.detail.packEmptyBody')}</EmptyState> : (
              <ul className="space-y-2" data-testid="m34-pack">
                {d.evidence.filter((e) => e.active).map((e) => <EvidenceItem key={e.id} e={e} target={target} actions={isOpener && r.status === 'draft' ? <DetachButton r={r} e={e} /> : undefined} />)}
              </ul>
            )}
          </Section>
          {isOpener && r.status === 'draft' && <EvidencePicker r={r} evidence={d.evidence} target={target} />}
        </div>
        <div className="space-y-4">
          <Card title={t('m34.detail.adviceTitle')} eyebrow={t('m34.detail.adviceEyebrow')}>
            <div className="flex items-baseline justify-between gap-2"><span className="text-[13px] text-ink-2">{t('m34.detail.adviceScore')}</span><span className="num font-semibold">{f.num(advice.score)} / {f.num(advice.need)}</span></div>
            <ProgressBar value={Math.min(100, Math.round((advice.score / advice.need) * 100))} label={t('m34.detail.adviceScore')} />
            <p className="mt-2 text-[13px]">{t(`m34.advice.${advice.outcome}`, { level: f.num(advice.level ?? 0) })}</p>
            <div className="mt-1 flex items-center gap-2"><WhyThis reasons={why} testId="m34-advice-why" /><span className="text-[12px] text-ink-3">{t('m34.detail.adviceNote')}</span></div>
            <p className="mt-2 text-[12px] text-ink-3">{t('m34.detail.counted', { n: f.num(counted) })}</p>
          </Card>
          <Card title={t('m34.detail.historyTitle')}><Timeline items={timeline} /></Card>
          {isOpener && <OpenerActions r={r} evidence={d.evidence} />}
        </div>
      </div>

      {mode === 'review' && <ReviewPanel r={r} evidence={d.evidence} advice={advice} me={me ?? ''} assessor={assessor} def={d.def.get(r.microcred_def_id)} />}
      <NotAuthority />
      {r.status === 'decided' && <p className="text-[12px] text-ink-3">{t('m34.detail.creditsNote', { c: credits(r.hours) })}</p>}
    </div>
  );
}

function DecisionCard({ r }: { r: Row }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const credits = useCredits();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const canExport = r.person_id === s.identity.personId || s.can('recognition', ['R', 'W', 'A']);
  return (
    <Card title={t('m34.decision.title')} eyebrow={t('m34.decision.eyebrow')}>
      <div data-testid="m34-decision">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><div className="caps">{t('m34.decision.outcome')}</div><OutcomePill outcome={r.outcome} /></div>
          <div><div className="caps">{t('m34.decision.level')}</div><div className="font-semibold">{r.credited_level ? t('m34.ui.levelN', { n: f.num(r.credited_level), name: levelName(lang, r.credited_level) }) : '—'}</div></div>
          <div><div className="caps">{t('m34.decision.credits')}</div><div className="num font-semibold">{credits(r.hours)}</div><IndicativeNote inline /></div>
          <div><div className="caps">{t('m34.decision.nqf')}</div><NqfBadge level={r.nqf_level} /></div>
        </div>
        <p className="mt-3 rounded-card border border-line bg-sunken p-3 text-[13.5px]" data-testid="m34-statement">{pick({ s_en: r.rpl_statement_en, s_ar: r.rpl_statement_ar }, 's')}</p>
        <p className="mt-2 text-[13px] text-ink-2"><span className="font-semibold">{t('m34.decision.rationale')}:</span> {pick(r, 'rationale')}</p>
        <p className="mt-1 text-[12px] text-ink-3">{t('m34.decision.twoPeople', { a: t(`m34.role.${r.recommended_role ?? 'instructor'}`), b: t(`m34.role.${r.decided_role ?? 'instructor'}`) })}</p>
        {canExport && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline btn-sm" data-testid="m34-export" onClick={async () => { const x = await act(() => repo.rpc.exportRpl(r.id)); if (x.ok) downloadJson(`kafaa-rpl-pack-${r.id}.json`, x.data); }}>
              <Icon name="download" /> {t('m34.decision.export')}
            </button>
            <span className="text-[12px] text-ink-3">{t('m34.decision.exportNote')}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function DetachButton({ r, e }: { r: Row; e: Row }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  return <button type="button" className="btn-ghost btn-sm" data-testid={`m34-detach-${e.id}`} onClick={() => act(() => repo.rpc.submitRpl({ action: 'detach', id: r.id, evidence_id: e.id }))}>{t('m34.detail.detach')}</button>;
}

function EvidencePicker({ r, evidence, target }: { r: Row; evidence: Row[]; target: string[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const opts = useQuery(['rpl_evidence'], () => repo.rpc.rplEvidenceOptions(r.person_id), [r.person_id]);
  const [attest, setAttest] = useState(false);
  const attached = new Set(evidence.filter((e) => e.active && e.ref_id).map((e) => `${e.ref_table}|${e.ref_id}`));
  return (
    <Section title={t('m34.picker.title')} description={t('m34.picker.desc')} actions={<button type="button" className="btn-outline btn-sm" onClick={() => setAttest(true)} data-testid="m34-ask-attest"><Icon name="user" /> {t('m34.picker.askAttest')}</button>}>
      <Async state={opts} isEmpty={(o) => o.length === 0} empty={<EmptyState title={t('m34.picker.empty')}>{t('m34.picker.emptyBody')}</EmptyState>}>
        {(o: RplOption[]) => (
          <ul className="space-y-2" data-testid="m34-options">
            {o.map((x) => {
              const done = attached.has(`${x.ref_table}|${x.ref_id}`);
              return (
                <EvidenceItem key={`${x.ref_table}:${x.ref_id}`} e={x as unknown as Row} target={target} actions={x.restricted
                  ? <span className="inline-flex items-center gap-1 text-[12px] text-ink-3" data-testid={`m34-restricted-${x.ref_id}`}><Icon name="lock" /> {t('m34.picker.restricted')}</span>
                  : <button type="button" className="btn-outline btn-sm" disabled={done} data-testid={`m34-attach-${x.ref_id}`}
                      onClick={() => act(() => repo.rpc.submitRpl({ action: 'attach', id: r.id, kind: x.kind, ref_table: x.ref_table, ref_id: x.ref_id }))}>{done ? t('m34.picker.attached') : t('m34.picker.attach')}</button>} />
              );
            })}
          </ul>
        )}
      </Async>
      <p className="mt-2 text-[12px] text-ink-3">{t('m34.picker.secNote')}</p>
      {attest && <AttestDrawer r={r} onClose={() => setAttest(false)} />}
      <span className="hidden">{pick(r, 'target_title')}</span>
    </Section>
  );
}

function AttestDrawer({ r, onClose }: { r: Row; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const people = useQuery(['people'], async () => {
    const mine = (await repo.list('people', { filter: { kind: 'staff', status: 'active' } }).catch(() => [])) as Row[];
    const cards = PERSONAS.filter((p) => p.kind === 'staff' && p.roles.some((x) => ['manager', 'instructor', 'training_manager', 'hr_director'].includes(x)))
      .map((p) => ({ id: p.person_id, display_name: p.title_en, display_name_ar: p.title_ar }));
    const all = new Map<string, Row>();
    for (const p of [...mine, ...cards]) if (p.id !== r.person_id && p.id !== r.opened_by && p.id !== s.identity.personId) all.set(p.id, p);
    return [...all.values()].sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)));
  }, [r.person_id]);
  const okNote = note.trim().length >= 10 && note.trim().length <= 400;
  return (
    <Drawer open onClose={onClose} title={t('m34.attestDrawer.title')}>
      <div className="space-y-3" data-testid="m34-attest-drawer">
        <p className="text-[13px] text-ink-2">{t('m34.attestDrawer.body')}</p>
        <Async state={people}>{(ps) => (
          <SelectField name="attester" label={t('m34.attestDrawer.who')} value={who} onChange={setWho} placeholder={t('m34.attestDrawer.pick')}
            options={ps.map((p) => ({ value: p.id, label: pick({ n_en: p.display_name, n_ar: p.display_name_ar }, 'n') }))} />
        )}</Async>
        <TextArea name="note" label={t('m34.attestDrawer.note')} rows={3} value={note} onChange={setNote} />
        <button type="button" className="btn-primary" disabled={!who || !okNote} data-testid="m34-attest-send"
          onClick={async () => { const x = await act(() => repo.rpc.submitRpl({ action: 'attach', id: r.id, kind: 'attestation', attester_id: who, note })); if (x.ok) onClose(); }}>{t('m34.attestDrawer.send')}</button>
      </div>
    </Drawer>
  );
}

function OpenerActions({ r, evidence }: { r: Row; evidence: Row[] }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [dlg, setDlg] = useState<'submit' | 'withdraw' | null>(null);
  const act2 = evidence.filter((e) => e.active && !(e.kind === 'attestation' && e.attestation_status === 'declined'));
  const ready = act2.length >= 2 && act2.some((e) => e.kind !== 'attestation');
  if (!['draft', 'submitted', 'recommended'].includes(r.status)) return null;
  return (
    <Card title={t('m34.actions.title')}>
      <div className="space-y-2">
        {r.status === 'draft' && (
          <>
            <p className="text-[13px] text-ink-2">{ready ? t('m34.actions.ready') : t('m34.actions.notReady', { n: f.num(act2.length) })}</p>
            <button type="button" className="btn-primary w-full" disabled={!ready} onClick={() => setDlg('submit')} data-testid="m34-submit">{t('m34.actions.submit')}</button>
          </>
        )}
        <button type="button" className="btn-ghost btn-sm" onClick={() => setDlg('withdraw')} data-testid="m34-withdraw">{t('m34.actions.withdraw')}</button>
      </div>
      <ConfirmDialog open={dlg === 'submit'} onClose={() => setDlg(null)} title={t('m34.actions.submitTitle')} consequence={t('m34.actions.submitBody')}
        onConfirm={async () => { await act(() => repo.rpc.submitRpl({ action: 'submit', id: r.id })); setDlg(null); }} />
      <ConfirmDialog open={dlg === 'withdraw'} onClose={() => setDlg(null)} title={t('m34.actions.withdrawTitle')} consequence={t('m34.actions.withdrawBody')} danger
        onConfirm={async () => { await act(() => repo.rpc.submitRpl({ action: 'withdraw', id: r.id })); setDlg(null); }} />
    </Card>
  );
}

function ReviewPanel({ r, evidence, advice, me, assessor, def }: { r: Row; evidence: Row[]; advice: ReturnType<typeof rplAdvice>; me: string; assessor: boolean; def?: Row }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const act = useAction();
  const credits = useCredits();
  const maxAlign = Math.max(0, ...(((def?.alignment as Row[]) ?? []).map((a) => Number(a.level) || 1)));
  const [outcome, setOutcome] = useState<string>(advice.outcome);
  const [level, setLevel] = useState<string>(String(advice.level ?? ''));
  const [hours, setHours] = useState<string>(String(advice.hours));
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [dlg, setDlg] = useState<'recommend' | 'confirm' | 'return' | null>(null);
  const isSkill = r.target_kind === 'skill';
  const input = {
    action: 'recommend', outcome, credited_level: isSkill && outcome !== 'not_yet' ? Number(level) : null, hours: outcome === 'not_yet' ? 0 : Number(hours), rationale_en: en, rationale_ar: ar,
  };
  const check = checkDecide(input, { status: r.status, person_id: r.person_id, opened_by: r.opened_by, recommended_by: r.recommended_by, target_kind: r.target_kind, level: r.level }, me, maxAlign);
  const confirmCheck = checkDecide({ action: 'confirm' }, { status: r.status, person_id: r.person_id, opened_by: r.opened_by, recommended_by: r.recommended_by, target_kind: r.target_kind, level: r.level }, me);
  const preview = useMemo(() => (r.status === 'recommended' ? rplStatement({ id: r.id, outcome: r.outcome, credited_level: r.credited_level, hours: r.hours, nqf_level: r.nqf_level, target_title_en: r.target_title_en, target_title_ar: r.target_title_ar, decided_on: todayIso() }, evidence as never) : null), [r, evidence]);
  if (!assessor || !['submitted', 'recommended'].includes(r.status)) return null;
  const nqf = outcome === 'not_yet' ? null : isSkill ? nqfForLevel(Number(level) || null) : null;
  return (
    <Section title={t('m34.review.title')} description={t('m34.review.desc')}>
      <div data-testid="m34-review">
        {r.status === 'submitted' && (
          <Card title={t('m34.review.recommendTitle')} eyebrow={t('m34.review.maker')}>
            {r.return_note && <Callout tone="sim" title={t('m34.review.returnedTitle')}>{r.return_note}</Callout>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <RadioGroup label={t('m34.review.outcome')} name="outcome" value={outcome} onChange={setOutcome}
                options={['full', 'partial', 'not_yet'].map((o) => ({ value: o, label: t(`m34.outcome.${o}`) }))} />
              {isSkill && outcome !== 'not_yet' && (
                <SelectField name="level" label={t('m34.review.level')} value={level} onChange={setLevel}
                  options={[1, 2, 3, 4].filter((l) => (outcome === 'full' ? l === Number(r.level) : l < Number(r.level))).map((l) => ({ value: String(l), label: t('m34.ui.levelN', { n: f.num(l), name: levelName(lang, l) }) }))} />
              )}
              {outcome !== 'not_yet' && (
                <div>
                  <label className="block text-[13px] font-semibold" htmlFor="m34-hours">{t('m34.review.hours')}</label>
                  <input id="m34-hours" className="input mt-1 w-full" type="number" min={1} max={HOURS_MAX} value={hours} onChange={(e) => setHours(e.target.value)} />
                  <p className="mt-1 text-[12px] text-ink-3">{t('m34.review.hoursNote', { c: credits(Number(hours)) })}{nqf ? <> · <NqfBadge level={nqf} /></> : null}</p>
                </div>
              )}
            </div>
            <TextArea name="rat_en" label={t('m34.review.rationaleEn')} rows={3} value={en} onChange={setEn} />
            <div dir="rtl" lang="ar"><TextArea name="rat_ar" label={t('m34.review.rationaleAr')} rows={3} value={ar} onChange={setAr} /></div>
            <div aria-live="polite" className="mt-2" data-testid="m34-review-check">
              {check === 'ok' ? <Callout tone="ok" title={t('m34.review.checkOk')}>{t('m34.review.checkOkBody')}</Callout> : <Callout tone="bad" title={t('m34.review.checkFail')}>{t(`m34.msg.${check === 'level' ? 'level_decide' : check}`)}</Callout>}
            </div>
            <button type="button" className="btn-primary mt-2" disabled={check !== 'ok'} onClick={() => setDlg('recommend')} data-testid="m34-recommend">{t('m34.review.recommend')}</button>
          </Card>
        )}
        {r.status === 'recommended' && (
          <Card title={t('m34.review.confirmTitle')} eyebrow={t('m34.review.checker')}>
            <KeyValue items={[
              [t('m34.decision.outcome'), <OutcomePill key="o" outcome={r.outcome} />],
              [t('m34.decision.level'), r.credited_level ? t('m34.ui.levelN', { n: f.num(r.credited_level), name: levelName(lang, r.credited_level) }) : '—'],
              [t('m34.decision.credits'), credits(r.hours)],
              [t('m34.decision.nqf'), <NqfBadge key="n" level={r.nqf_level} />],
              [t('m34.review.recommendedBy'), t(`m34.role.${r.recommended_role ?? 'instructor'}`)],
            ]} />
            <p className="mt-2 text-[13px] text-ink-2">{lang === 'ar' ? r.rationale_ar : r.rationale_en}</p>
            {preview && <p className="mt-2 rounded-card border border-line bg-sunken p-3 text-[13px]" data-testid="m34-statement-preview">{lang === 'ar' ? preview.ar : preview.en}</p>}
            {confirmCheck === 'maker_checker' && <p className="mt-2 text-[12px] text-sim" data-testid="m34-mc">{t('m34.msg.maker_checker')}</p>}
            {confirmCheck === 'self' && <p className="mt-2 text-[12px] text-sim">{t('m34.msg.self')}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={confirmCheck !== 'ok'} onClick={() => setDlg('confirm')} data-testid="m34-confirm">{t('m34.review.confirm')}</button>
              <button type="button" className="btn-outline" disabled={confirmCheck !== 'ok'} onClick={() => setDlg('return')} data-testid="m34-return">{t('m34.review.return')}</button>
            </div>
          </Card>
        )}
      </div>
      <ConfirmDialog open={dlg === 'recommend'} onClose={() => setDlg(null)} title={t('m34.review.recommendTitle')} consequence={t('m34.review.recommendBody')}
        onConfirm={async () => { await act(() => repo.rpc.decideRpl({ id: r.id, ...input } as never)); setDlg(null); }} />
      <ConfirmDialog open={dlg === 'confirm'} onClose={() => setDlg(null)} title={t('m34.review.confirmTitle')} consequence={t('m34.review.confirmBody')}
        onConfirm={async () => { await act(() => repo.rpc.decideRpl({ id: r.id, action: 'confirm' })); setDlg(null); }} />
      <ConfirmDialog open={dlg === 'return'} onClose={() => setDlg(null)} title={t('m34.review.return')} consequence={t('m34.review.returnBody')} requireReason reasonLabel={t('m34.review.returnNote')}
        onConfirm={async (note) => { await act(() => repo.rpc.decideRpl({ id: r.id, action: 'return', note })); setDlg(null); }} />
    </Section>
  );
}

export function Bench() {
  return <div className="flex flex-wrap gap-3" data-testid="m34-bench"><BenchmarkChips feature="FS29" /><BenchmarkChips feature="FS30" /></div>;
}
