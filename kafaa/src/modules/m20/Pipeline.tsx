// M20 (F08) decision components shared by the detail page and the manage page: release (line manager, maker-checker),
// selection and outcome sign-off (poster). Every action goes through a ConfirmDialog and an RPC (audited; ledger for
// selection and completion).
import { useState } from 'react';
import { ConfirmDialog, Modal, Icon, Callout } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useFormat, useT, usePick } from '../../i18n';
import { OJT_LEVEL_CAP } from './domain';
import { AppPill, AppStepper, AppTimeline, usePersonName, type App, type Opp } from './ui';

type Labels = { skill: (id: string) => string; role: (id: string | null | undefined) => string; family: (id: string | null | undefined) => string };

export function ApplicantName({ app }: { app: App }) {
  const name = usePersonName();
  return <>{name(app, app.person_id)}</>;
}

/** A pending or decided release request, seen by the person who must release. */
export function ReleaseCard({ app, opp, lab, me }: { app: App; opp: Opp | undefined; lab: Labels; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [act, setAct] = useState<'release' | 'decline' | null>(null);
  const pending = app.status === 'applied' && app.releaser_id === me;
  return (
    <li className="rounded-card border border-line bg-panel p-3" data-testid="m20-release-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold"><ApplicantName app={app} /> <span className="font-normal text-ink-3">· {lab.role(app.applicant_role_id)}</span></div>
          <div className="text-[13px] text-ink-2">{opp ? pick(opp, 'title') : app.opportunity_id}</div>
          <div className="mt-0.5 text-[12px] text-ink-3">{t('m20.manage.appliedOn', { d: f.date(app.created_at) })}{opp ? <> · {t('m20.common.hoursWeek', { n: f.num(opp.hours_week) })} · {f.date(opp.start_on)} – {f.date(opp.end_on)}</> : null}</div>
          {app.note && <p className="mt-1 text-[13px] text-ink-2">“{app.note}”</p>}
          {app.skip_level && <div className="mt-1 chip border-info-line bg-info-bg text-info">{t('m20.manage.skipLevel')}</div>}
        </div>
        <div className="flex items-center gap-2">
          <AppPill status={app.status} />
          {pending && (
            <>
              <button className="btn-primary btn-sm" onClick={() => setAct('release')} data-testid="m20-release">{t('m20.manage.release')}</button>
              <button className="btn-outline btn-sm" onClick={() => setAct('decline')} data-testid="m20-decline">{t('m20.manage.decline')}</button>
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!act}
        onClose={() => setAct(null)}
        title={act === 'decline' ? t('m20.manage.declineTitle') : t('m20.manage.releaseTitle')}
        consequence={act === 'decline' ? t('m20.manage.declineBody') : t('m20.manage.releaseBody', { h: f.num(opp?.hours_week ?? 0) })}
        actingAs={t('m20.common.lineManager')}
        requireReason={act === 'decline'}
        reasonLabel={t('m20.manage.declineReason')}
        danger={act === 'decline'}
        confirmLabel={act === 'decline' ? t('m20.manage.decline') : t('m20.manage.release')}
        onConfirm={async (reason) => { if (act) await run(() => repo.rpc.releaseDecision(app.id, act, reason)); }}
      />
    </li>
  );
}

/** One applicant on the poster's pipeline: select / not select after release, then outcome sign-off. */
export function ApplicantCard({ app, opp, lab }: { app: App; opp: Opp; lab: Labels }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const name = usePersonName();
  const [act, setAct] = useState<'selected' | 'not_selected' | null>(null);
  const [signoff, setSignoff] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-card border border-line bg-panel p-3" data-testid="m20-applicant">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{name(app, app.person_id)} <span className="font-normal text-ink-3">· {lab.role(app.applicant_role_id)} · {lab.family(app.applicant_family_id)}</span></div>
          <div className="text-[12px] text-ink-3">{t('m20.manage.appliedOn', { d: f.date(app.created_at) })}</div>
          {app.note && <p className="mt-1 text-[13px] text-ink-2">“{app.note}”</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppPill status={app.status} />
          {app.status === 'applied' && <span className="text-[12px] text-ink-3" data-testid="m20-awaiting-release">{t('m20.manage.awaitingRelease')}</span>}
          {(app.status === 'released' || app.status === 'applied') && (
            <>
              <button className="btn-primary btn-sm" onClick={() => setAct('selected')} data-testid="m20-select" title={app.status === 'applied' ? t('m20.manage.releaseFirst') : undefined}>{t('m20.manage.select')}</button>
              <button className="btn-ghost btn-sm" onClick={() => setAct('not_selected')}>{t('m20.manage.notSelect')}</button>
            </>
          )}
          {app.status === 'selected' && <button className="btn-primary btn-sm" onClick={() => setSignoff(true)} data-testid="m20-signoff"><Icon name="check" size={14} />{t('m20.manage.signoff')}</button>}
          <button className="btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen((x) => !x)}>{open ? t('m20.common.hideHistory') : t('m20.common.history')}</button>
        </div>
      </div>
      {open && <div className="mt-3 space-y-3"><AppStepper status={app.status} /><AppTimeline app={app} name={(id) => name(app, id)} /></div>}
      {app.status === 'completed' && app.evidence_ids?.length > 0 && (
        <div className="mt-2 text-[12.5px] text-ok">{t('m20.manage.evidenceWritten', { n: f.num(app.evidence_ids.length) })}</div>
      )}
      <ConfirmDialog
        open={!!act}
        onClose={() => setAct(null)}
        title={act === 'selected' ? t('m20.manage.selectTitle') : t('m20.manage.notSelectTitle')}
        consequence={act === 'selected' ? t('m20.manage.selectBody') : t('m20.manage.notSelectBody')}
        actingAs={t('m20.common.poster')}
        confirmLabel={act === 'selected' ? t('m20.manage.select') : t('m20.manage.notSelect')}
        onConfirm={async () => { if (act) await run(() => repo.rpc.selectApplicant(app.id, act, '')); }}
      />
      {signoff && <SignOffModal app={app} opp={opp} lab={lab} onClose={() => setSignoff(false)} />}
    </li>
  );
}

function SignOffModal({ app, opp, lab, onClose }: { app: App; opp: Opp; lab: Labels; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const name = usePersonName();
  const [levels, setLevels] = useState<Record<string, number>>(Object.fromEntries(opp.skills_gained.map((s) => [s, 2])));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const any = Object.values(levels).some((v) => v > 0);
  return (
    <Modal open onClose={() => !busy && onClose()} size="lg" title={t('m20.signoff.title', { name: name(app, app.person_id) })}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={busy || !any || note.trim().length < 5} data-testid="m20-signoff-confirm" onClick={async () => {
          setBusy(true);
          try { const r = await run(() => repo.rpc.completeOpportunity(app.id, levels, note.trim())); if (r.ok) onClose(); } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m20.signoff.confirm')}</button>
      </>}>
      <div className="space-y-4">
        <p className="text-[13.5px] text-ink-2">{t('m20.signoff.body')}</p>
        <fieldset className="space-y-2">
          <legend className="caps mb-1">{t('m20.signoff.levels')}</legend>
          {opp.skills_gained.map((s) => (
            <div key={s} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2">
              <span className="text-[13.5px] font-semibold">{lab.skill(s)}</span>
              <div className="flex gap-1" role="radiogroup" aria-label={lab.skill(s)}>
                {Array.from({ length: OJT_LEVEL_CAP + 1 }, (_, i) => i).map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={levels[s] === l} className={`btn-sm ${levels[s] === l ? 'btn-primary' : 'btn-outline'}`} onClick={() => setLevels((c) => ({ ...c, [s]: l }))}>
                    {l === 0 ? t('m20.signoff.notShown') : t(`m20.signoff.level${l}`)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <label className="block">
          <span className="caps">{t('m20.signoff.note')}</span>
          <textarea className="input mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="m20-signoff-note" />
        </label>
        <Callout tone="sim" title={t('m20.signoff.mirrorTitle')}>{t('m20.signoff.mirrorBody')}</Callout>
      </div>
    </Modal>
  );
}
