// M24 · F20 forms shared by the KLRA register and the position page: assess a position (proposal with reasons, adjust with a
// note), plan a mitigation action (kind, owner, due date) and the per-kind links to the features that carry it out.
import { useEffect, useState } from 'react';
import { Modal, Callout, WhyThis, SelectField, TextArea, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { ACTION_KINDS, OWNER_ROLES, addDaysIso, bandOf, quarterEndIso, type Thresholds } from './klra';
import { BandPill, FactorDots, useRouteExists } from './ui';

export function AssessModal({ positionId, title, onClose }: { positionId: string | null; title: string; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const d = useQuery(['klra_assessments', 'klra_positions', 'knowledge_assets'], () => (positionId ? repo.rpc.klraPosition(positionId) : Promise.resolve(null)), [positionId]);
  const [a, setA] = useState(0);
  const [p, setP] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const prop = d.data?.proposal;
  useEffect(() => { if (prop) { setA(prop.attrition); setP(prop.position); setNote(''); } }, [prop?.attrition, prop?.position, positionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const th: Thresholds = d.data?.thresholds ?? { high: 16, medium: 8 };
  const adjusted = !!prop && (a !== prop.attrition || p !== prop.position);
  const opts = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: t(`m24.factor.scale${n}`, { n: f.num(n) }) }));
  return (
    <Modal open={!!positionId} onClose={() => !busy && onClose()} size="lg" title={t('m24.klra.assessTitle', { title })}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" data-testid="m24-assess-save" disabled={busy || !prop || (adjusted && note.trim().length < 10)} onClick={async () => {
          setBusy(true);
          try { const r = await run(() => repo.rpc.assessPosition({ position_id: positionId!, attrition_factor: a, position_factor: p, note: note.trim() })); if (r.ok) onClose(); } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m24.klra.saveAssessment')}</button>
      </>}>
      {!prop ? <p className="text-[13px] text-ink-2">{t('m24.common.loading')}</p> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="caps">{t('m24.klra.proposal')}</span>
            <FactorDots value={prop.attrition} label={t('m24.klra.attritionN', { n: prop.attrition })} />
            <span aria-hidden>×</span>
            <FactorDots value={prop.position} label={t('m24.klra.positionN', { n: prop.position })} />
            <span className="num font-semibold">= {f.num(prop.total)}</span>
            <BandPill band={bandOf(prop.total, th)} />
            <WhyThis reasons={prop.reasons} testId="m24-assess-why" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField name="attrition" label={t('m24.klra.attrition')} options={opts} value={String(a)} onChange={(v) => setA(Number(v))} />
            <SelectField name="position" label={t('m24.klra.position')} options={opts} value={String(p)} onChange={(v) => setP(Number(v))} />
          </div>
          <p className="text-[13px]">{t('m24.klra.resulting', { total: f.num(a * p) })} <BandPill band={bandOf(a * p, th)} /></p>
          <TextArea name="note" label={adjusted ? t('m24.klra.noteRequired') : t('m24.klra.noteOptional')} rows={3} value={note} onChange={setNote} />
          {adjusted && note.trim().length < 10 && <p className="text-[12px] text-bad">{t('m24.klra.noteHint')}</p>}
          <Callout tone="sim">{t('m24.klra.bandsOnly')}</Callout>
        </div>
      )}
    </Modal>
  );
}

export function MitigationModal({ assessment, period, onClose }: { assessment: { id: string; title: string } | null; period: string; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const today = todayIso();
  const qEnd = quarterEndIso(period);
  const [kind, setKind] = useState<string>('capture');
  const [owner, setOwner] = useState<string>('km_owner');
  const [due, setDue] = useState(qEnd >= today ? qEnd : addDaysIso(today, 30));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDue(qEnd >= today ? qEnd : addDaysIso(today, 30)); setNote(''); }, [assessment?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={!!assessment} onClose={() => !busy && onClose()} title={t('m24.klra.planTitle', { title: assessment?.title ?? '' })}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" data-testid="m24-mitigation-save" disabled={busy || !due} onClick={async () => {
          setBusy(true);
          try { const r = await run(() => repo.rpc.planMitigation({ assessment_id: assessment!.id, kind, owner_role: owner, due_on: due, note: note.trim() })); if (r.ok) onClose(); } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m24.klra.planSave')}</button>
      </>}>
      <div className="space-y-3">
        <SelectField name="kind" label={t('m24.klra.kind')} options={ACTION_KINDS.map((k) => ({ value: k, label: t(`m24.kind.${k}`) }))} value={kind} onChange={(v) => { setKind(v); setOwner(v === 'capture' ? 'km_owner' : v === 'mentoring' ? 'line_manager' : v === 'successor' ? 'hr' : v === 'documentation' ? 'sme' : 'training'); }} />
        <p className="text-[12.5px] text-ink-2">{t(`m24.kindHelp.${kind}`)}</p>
        <SelectField name="owner" label={t('m24.klra.owner')} options={OWNER_ROLES.map((k) => ({ value: k, label: t(`m24.owner.${k}`) }))} value={owner} onChange={setOwner} />
        <label className="block"><span className="caps">{t('m24.klra.due')}</span><input type="date" className="input mt-1" min={today} max={addDaysIso(today, 365)} value={due} onChange={(e) => setDue(e.target.value)} data-testid="m24-mitigation-due" /></label>
        {due > qEnd && <p className="text-[12px] text-sim">{t('m24.klra.afterQuarter')}</p>}
        <TextArea name="note" label={t('m24.klra.noteOptional')} rows={2} value={note} onChange={setNote} />
      </div>
    </Modal>
  );
}

/** Where a mitigation kind is carried out. Links to other waves' features appear only when that route exists in this build. */
export function MitigationLink({ kind, personId, skillId, positionId, actionId }: { kind: string; personId: string | null; skillId?: string | null; positionId: string; actionId?: string }) {
  const t = useT();
  const succession = useRouteExists('/talent/succession');
  const q = (o: Record<string, string | null | undefined>) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  if (kind === 'capture' || kind === 'documentation') return <L className="link inline-flex items-center gap-1 text-[12.5px]" to={`/knowledge/capture?${q({ sme: personId, position: positionId, action: actionId })}`}><Icon name="chevron" size={12} className="rtl:-scale-x-100" />{t('m24.link.capture')}</L>;
  if (kind === 'mentoring') return <L className="link inline-flex items-center gap-1 text-[12.5px]" to={`/my/mentoring${skillId ? `?skill=${encodeURIComponent(skillId)}` : ''}`}><Icon name="chevron" size={12} className="rtl:-scale-x-100" />{t('m24.link.mentoring')}</L>;
  if (kind === 'cross_training') return <L className="link inline-flex items-center gap-1 text-[12.5px]" to="/opportunities/rotations"><Icon name="chevron" size={12} className="rtl:-scale-x-100" />{t('m24.link.rotations')}</L>;
  if (kind === 'successor') return succession ? <L className="link inline-flex items-center gap-1 text-[12.5px]" to="/talent/succession"><Icon name="chevron" size={12} className="rtl:-scale-x-100" />{t('m24.link.succession')}</L> : <span className="text-[12px] text-ink-3">{t('m24.link.successionLater')}</span>;
  return null;
}
