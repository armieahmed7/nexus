// /knowledge/capture/:sessionId (M24 · F21): one structured capture interview. Plan -> hold -> transcribe (text upload only; no
// audio processing) -> draft the knowledge asset with deterministic enrichment -> two-person review -> publish. Only the SME, the
// interviewer and the KM owner see a session (its transcript stays out of staff view until a reviewed asset is published).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, Callout, Stepper, ConfirmDialog, KeyValue, CheckboxField } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { hasContactDetails, postGuard } from '../m22/domain';
import { LIMITS, TEMPLATES, type TemplateId } from './capture';
import type { CaptureSessionView } from './backend/rpc';
import { AssetPill, Chips, SessionPill, useKcLabels, useKcRefs, type KcRefs } from './ui';
import { AssetEditor } from './AssetEditor';

export default function SessionPage() {
  const { sessionId = '' } = useParams();
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const refs = useKcRefs();
  const q = useQuery(['capture_sessions', 'knowledge_assets'], async () => {
    const b = await repo.rpc.captureBoard();
    const x = b.sessions.find((y) => y.id === sessionId) ?? null;
    const asset = x?.asset_id ? await repo.get('knowledge_assets', x.asset_id).catch(() => null) : null;
    return { x, asset };
  }, [sessionId, s.identity.personId]);
  return (
    <Page title={t('m24.routes.knowledge-capture-session.title')} eyebrow={<L to="/knowledge/capture" className="link">{t('m24.capture.back')}</L>} wide>
      <Async state={refs}>
        {(r) => (
          <Async state={q} isEmpty={(d) => !d.x} empty={<EmptyState icon="lock" title={t('m24.session.notFound')}>{t('m24.session.notFoundBody')}</EmptyState>}>
            {(d) => <Session x={d.x!} asset={d.asset} refs={r} />}
          </Async>
        )}
      </Async>
    </Page>
  );
}

function Session({ x, asset, refs }: { x: CaptureSessionView; asset: import('../../data').RowOf<'knowledge_assets'> | null; refs: KcRefs }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const lab = useKcLabels(refs);
  const me = s.identity.personId;
  const participant = x.sme_id === me || x.interviewer_id === me || s.can('knowledge', ['A']);
  const [act, setAct] = useState<'held' | 'cancelled' | null>(null);
  const [tr, setTr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const prompts = TEMPLATES[x.template as TemplateId]?.prompts ?? [];
  const step = x.status === 'planned' ? 0 : x.status === 'held' ? 1 : !asset ? 2 : asset.status === 'published' ? 4 : 3;
  const policies = refs.policies as unknown as { category: string; patterns: string[]; enabled: boolean }[];
  const cat = tr ? postGuard(tr, policies) : null;
  const contact = tr ? hasContactDetails(tr) : false;
  const canEditAsset = x.status === 'transcribed' && (!asset || (asset.status === 'draft' && asset.author_id === me)) && (x.sme_id === me || x.interviewer_id === me);
  const upload = async () => {
    setBusy(true);
    try { const r = await run(() => repo.rpc.recordCapture(x.id, { status: 'transcribed', transcript: tr })); if (r.ok) setTr(''); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-5">
      <div className="card p-5" data-testid="m24-session-head">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold" dir={x.lang === 'ar' ? 'rtl' : undefined}>{x.title}</h2>
            <p className="text-[13px] text-ink-2">{t('m24.capture.smeWith', { sme: pick({ n_en: x.sme_name, n_ar: x.sme_name_ar }, 'n'), iv: pick({ n_en: x.interviewer_name, n_ar: x.interviewer_name_ar }, 'n') })}</p>
          </div>
          <span className="flex flex-wrap gap-2"><SessionPill status={x.status} />{asset && <AssetPill status={asset.status} />}</span>
        </div>
        <div className="mt-4">
          {x.status === 'cancelled' ? <Callout>{t('m24.session.cancelledBody')}</Callout> : (
            <Stepper current={step} steps={[
              { id: 'plan', label: t('m24.session.stepPlan') }, { id: 'hold', label: t('m24.session.stepHold') }, { id: 'transcribe', label: t('m24.session.stepTranscribe') },
              { id: 'review', label: t('m24.session.stepReview') }, { id: 'publish', label: t('m24.session.stepPublish') },
            ]} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title={t('m24.session.guide', { name: t(`m24.template.${x.template}.name`) })}>
          <p className="mb-2 text-[12.5px] text-ink-2">{t(`m24.template.${x.template}.purpose`)}</p>
          <ul className="space-y-1" data-testid="m24-session-prompts">
            {prompts.map((p, i) => <li key={i}><CheckboxField label={pick({ x_en: p.en, x_ar: p.ar }, 'x')} checked={!!done[i]} onChange={(v) => setDone((d) => ({ ...d, [i]: v }))} /></li>)}
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">{t('m24.session.guideNote')}</p>
        </Card>
        <Card title={t('m24.session.details')}>
          <KeyValue items={[
            [t('m24.capture.date'), f.date(x.held_on ?? x.planned_on)],
            [t('m24.asset.skills'), <Chips key="s" items={x.skill_ids.map(lab.skill)} />],
            [t('m24.asset.standards'), <Chips key="q" items={x.standard_ids.map(lab.standard)} />],
            [t('m24.session.klra'), x.position_id ? (s.can('knowledge', ['A', 'Scope']) ? <L key="k" to={`/knowledge/klra/${x.position_id}`} className="link">{t('m24.session.openKlra')}</L> : t('m24.session.linkedKlra')) : '—'],
            ...(x.transcript_words ? [[t('m24.session.transcript'), t('m24.capture.words', { n: f.num(x.transcript_words) })] as [string, string]] : []),
          ]} />
          {participant && (x.status === 'planned' || x.status === 'held') && (
            <div className="mt-3 flex flex-wrap gap-2">
              {x.status === 'planned' && <button className="btn-outline btn-sm" onClick={() => setAct('held')} data-testid="m24-session-held">{t('m24.session.markHeld')}</button>}
              <button className="btn-ghost btn-sm" onClick={() => setAct('cancelled')}>{t('m24.session.cancel')}</button>
            </div>
          )}
        </Card>
      </div>

      {participant && (x.status === 'planned' || x.status === 'held') && (
        <Card title={t('m24.session.uploadTitle')}>
          <p className="mb-2 text-[12.5px] text-ink-2">{t('m24.session.uploadBody', { min: f.num(LIMITS.TRANSCRIPT[0]), max: f.num(LIMITS.TRANSCRIPT[1]) })}</p>
          <label className="block"><span className="caps">{t('m24.session.file')}</span>
            <input type="file" accept=".txt,text/plain" className="mt-1 block text-[13px]" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setTr((await file.text()).slice(0, LIMITS.TRANSCRIPT[1])); }} data-testid="m24-session-file" />
          </label>
          <label className="mt-2 block"><span className="caps">{t('m24.session.paste')}</span>
            <textarea className="input mt-1" rows={8} dir={x.lang === 'ar' ? 'rtl' : undefined} value={tr} onChange={(e) => setTr(e.target.value)} maxLength={LIMITS.TRANSCRIPT[1]} data-testid="m24-session-transcript" /></label>
          <p className="mt-1 text-[12px] text-ink-3">{t('m24.session.chars', { n: f.num(tr.trim().length) })}</p>
          {cat && <Callout tone="bad" title={t('m24.editor.blockedTitle', { category: t(`m24.guard.${cat}`) })}>{t('m24.editor.blockedBody')}</Callout>}
          {!cat && contact && <Callout tone="bad" title={t('m24.editor.contactTitle')}>{t('m24.editor.contactBody')}</Callout>}
          <button className="btn-primary btn-sm mt-2" disabled={busy || tr.trim().length < LIMITS.TRANSCRIPT[0] || !!cat || contact} onClick={upload} data-testid="m24-session-upload">{t('m24.session.upload')}</button>
        </Card>
      )}

      {x.status === 'transcribed' && (
        <Card title={t('m24.session.transcriptTitle')}>
          <div className="max-h-64 overflow-y-auto whitespace-pre-line rounded-md bg-sunken p-3 text-[13.5px] leading-relaxed" dir={x.lang === 'ar' ? 'rtl' : 'ltr'} lang={x.lang} data-testid="m24-session-text">{x.transcript}</div>
        </Card>
      )}

      {x.status === 'transcribed' && (canEditAsset ? (
        <Card title={asset ? t('m24.session.editDraft') : t('m24.session.draftAsset')}>
          {asset && asset.status === 'draft' && asset.submitted_at && <Callout tone="sim" title={t('m24.session.changesTitle')}>{t('m24.session.changesBody')}</Callout>}
          <AssetEditor key={asset?.id ?? 'new'} refs={refs} source={x.transcript}
            seed={asset ? { id: asset.id, session_id: x.id, title_en: asset.title_en, title_ar: asset.title_ar, summary_en: asset.summary_en, summary_ar: asset.summary_ar, body: asset.body, body_lang: asset.body_lang as 'en' | 'ar', key_points: asset.key_points as never, skill_ids: asset.skill_ids, standard_ids: asset.standard_ids, system_family: asset.system_family }
              : { session_id: x.id, title_en: x.lang === 'en' ? x.title : '', title_ar: x.lang === 'ar' ? x.title : '', body: x.transcript, body_lang: x.lang as 'en' | 'ar', skill_ids: x.skill_ids, standard_ids: x.standard_ids }} />
        </Card>
      ) : asset ? (
        <Callout title={t('m24.session.assetStatus')}>
          <span className="inline-flex flex-wrap items-center gap-2"><AssetPill status={asset.status} />{asset.status === 'published' ? <L to={`/knowledge/assets/${asset.id}`} className="link">{pick(asset, 'title')}</L> : <span>{pick(asset, 'title')}</span>}</span>
        </Callout>
      ) : null)}

      <ConfirmDialog open={!!act} onClose={() => setAct(null)} title={act === 'held' ? t('m24.session.markHeld') : t('m24.session.cancel')} consequence={act === 'held' ? t('m24.session.heldBody') : t('m24.session.cancelBody')} danger={act === 'cancelled'}
        onConfirm={async () => { if (act) await run(() => repo.rpc.recordCapture(x.id, { status: act })); }} />
    </div>
  );
}
