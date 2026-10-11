// M20 · F15 dialogs shared by My rotation and the host desk: mid-point check-in, host sign-off (levels per objective, writes ojt
// evidence) and shadowing completion. Every action goes through the repository RPC (audited; ledger for sign-off and completion).
import { useState } from 'react';
import { Modal, Callout } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useT, usePick } from '../../i18n';
import { PROGRESS, ROT_LEVEL_CAP } from './rotation';
import { objectivesOf, type Placement, type RotLabels, type ShadowReq } from './rotUi';

export function CheckinModal({ p, lab, onClose }: { p: Placement; lab: RotLabels; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const objs = objectivesOf(p);
  const [prog, setProg] = useState<Record<string, string>>(Object.fromEntries(objs.map((o) => [o.id, 'on_track'])));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={() => !busy && onClose()} size="lg" title={t('m20.rot.checkin.title', { team: pick(p, 'host_team') })}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={busy || note.trim().length < 5} data-testid="m20-rot-checkin-confirm" onClick={async () => {
          setBusy(true);
          try { const r = await run(() => repo.rpc.placementCheckin(p.id, prog, note.trim())); if (r.ok) onClose(); } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m20.rot.checkin.confirm')}</button>
      </>}>
      <div className="space-y-4">
        <p className="text-[13.5px] text-ink-2">{t('m20.rot.checkin.body')}</p>
        <fieldset className="space-y-2">
          <legend className="caps mb-1">{t('m20.rot.checkin.objectives')}</legend>
          {objs.map((o) => (
            <div key={o.id} className="rounded-btn border border-line p-2">
              <div className="text-[13.5px] font-semibold">{pick(o as unknown as Record<string, unknown>, 'text')}</div>
              <div className="mb-1.5 text-[12px] text-ink-3">{lab.skill(o.skill_id)}</div>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={pick(o as unknown as Record<string, unknown>, 'text')}>
                {PROGRESS.map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={prog[o.id] === v} className={`btn-sm ${prog[o.id] === v ? 'btn-primary' : 'btn-outline'}`} onClick={() => setProg((c) => ({ ...c, [o.id]: v }))}>{t(`m20.rot.progress.${v}`)}</button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <label className="block">
          <span className="caps">{t('m20.rot.checkin.note')}</span>
          <textarea className="input mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="m20-rot-checkin-note" />
        </label>
      </div>
    </Modal>
  );
}

export function SignoffPlacementModal({ p, lab, onClose }: { p: Placement; lab: RotLabels; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const objs = objectivesOf(p);
  const [levels, setLevels] = useState<Record<string, number>>(Object.fromEntries(objs.map((o) => [o.id, o.level])));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const any = Object.values(levels).some((v) => v > 0);
  const met = objs.filter((o) => (levels[o.id] ?? 0) >= o.level).length;
  return (
    <Modal open onClose={() => !busy && onClose()} size="lg" title={t('m20.rot.signoff.title', { name: pick({ name_en: p.person_name, name_ar: p.person_name_ar }, 'name') })}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={busy || !any || note.trim().length < 5} data-testid="m20-rot-signoff-confirm" onClick={async () => {
          setBusy(true);
          try { const r = await run(() => repo.rpc.signoffPlacement(p.id, levels, note.trim())); if (r.ok) onClose(); } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m20.rot.signoff.confirm')}</button>
      </>}>
      <div className="space-y-4">
        <p className="text-[13.5px] text-ink-2">{t('m20.rot.signoff.body', { team: pick(p, 'host_team') })}</p>
        <fieldset className="space-y-2">
          <legend className="caps mb-1">{t('m20.rot.signoff.levels', { met, total: objs.length })}</legend>
          {objs.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{pick(o as unknown as Record<string, unknown>, 'text')}</div>
                <div className="text-[12px] text-ink-3">{lab.skill(o.skill_id)} · {t('m20.rot.common.target', { n: o.level })}</div>
              </div>
              <div className="flex gap-1" role="radiogroup" aria-label={lab.skill(o.skill_id)}>
                {Array.from({ length: ROT_LEVEL_CAP + 1 }, (_, i) => i).map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={levels[o.id] === l} className={`btn-sm ${levels[o.id] === l ? 'btn-primary' : 'btn-outline'}`} onClick={() => setLevels((c) => ({ ...c, [o.id]: l }))}>
                    {l === 0 ? t('m20.signoff.notShown') : t(`m20.signoff.level${l}`)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <label className="block">
          <span className="caps">{t('m20.rot.signoff.note')}</span>
          <textarea className="input mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="m20-rot-signoff-note" />
        </label>
        <Callout tone="sim" title={t('m20.signoff.mirrorTitle')}>{t('m20.rot.signoff.mirror')}</Callout>
      </div>
    </Modal>
  );
}

export function CompleteShadowModal({ r, onClose }: { r: ShadowReq; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={() => !busy && onClose()} title={t('m20.rot.host.completeTitle', { name: pick({ name_en: r.person_name, name_ar: r.person_name_ar }, 'name') })}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={busy || note.trim().length < 5} data-testid="m20-rot-complete-confirm" onClick={async () => {
          setBusy(true);
          try { const x = await run(() => repo.rpc.decideShadow(r.id, 'complete', note.trim())); if (x.ok) onClose(); } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m20.rot.host.complete')}</button>
      </>}>
      <div className="space-y-3">
        <p className="text-[13.5px] text-ink-2">{t('m20.rot.host.completeBody')}</p>
        <label className="block">
          <span className="caps">{t('m20.rot.host.completeNote')}</span>
          <textarea className="input mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
