// /knowledge/review (M24 · F21): the two-person review. Interviewers and the KM owner (knowledge W/A) do a technical review
// (accuracy, and a decision on every enrichment suggestion) or a security and content check (de-identified, no security,
// safeguards or cyber details; the server re-runs the posting blocker). Two different people, never the author or the SME. The KM
// owner publishes once both passes are in (maker-checker).
import { useEffect, useState } from 'react';
import { Page, Card, Async, EmptyState, Callout, CheckboxField, ConfirmDialog, RadioGroup, TextArea, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { reviewState } from './capture';
import type { QueueAsset, ReviewQueue } from './backend/rpc';
import { Chips, useKcLabels, useKcRefs, type KcRefs } from './ui';
import { SuggestionList } from './AssetEditor';

export default function ReviewPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const refs = useKcRefs();
  const q = useQuery(['knowledge_assets', 'asset_reviews'], () => repo.rpc.reviewQueue(), [s.identity.personId]);
  return (
    <Page title={t('m24.routes.knowledge-review.title')} intro={t('m24.review.intro')} wide eyebrow={<L to="/knowledge" className="link">{t('m24.kb.back')}</L>}
      actions={s.can('knowledge', ['A']) ? <L to="/knowledge/contributions" className="btn-outline btn-sm" data-testid="m24-review-to-contributions">{t('m24.routes.knowledge-contributions.title')}</L> : undefined}>
      <Async state={refs}>
        {(r) => (
          <Async state={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon="check" title={t('m24.review.empty')}>{t('m24.review.emptyBody')}</EmptyState>}>
            {(d) => <Queue d={d} refs={r} />}
          </Async>
        )}
      </Async>
    </Page>
  );
}

function Queue({ d, refs }: { d: ReviewQueue; refs: KcRefs }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [sel, setSel] = useState<string>(d.items[0]?.id ?? '');
  const cur = d.items.find((x) => x.id === sel) ?? d.items[0];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <ul className="space-y-2" data-testid="m24-review-queue">
        {d.items.map((x) => {
          const st = reviewState(x.reviews.map((r) => ({ ...r, asset_id: x.id })), x.author_id, x.sme_id);
          return (
            <li key={x.id}>
              <button className={`card w-full p-3 text-start ${x.id === cur?.id ? 'ring-2 ring-accent' : ''}`} onClick={() => setSel(x.id)} aria-pressed={x.id === cur?.id}>
                <span className="block font-semibold">{pick(x, 'title')}</span>
                <span className="block text-[12px] text-ink-2">{t('m24.review.by', { name: pick({ n_en: x.author_name, n_ar: x.author_name_ar }, 'n'), date: f.date(x.submitted_at) })}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  <span className={`chip ${st.technical ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-3'}`}>{t('m24.review.technical')}</span>
                  <span className={`chip ${st.security ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-3'}`}>{t('m24.review.security')}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {cur && <Item key={cur.id} x={cur} canPublish={d.can_publish} refs={refs} />}
    </div>
  );
}

function Item({ x, canPublish, refs }: { x: QueueAsset; canPublish: boolean; refs: KcRefs }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const lab = useKcLabels(refs);
  const me = s.identity.personId;
  const own = x.author_id === me || x.sme_id === me;
  const current = x.reviews.filter((r) => !r.superseded);
  const mine = current.find((r) => r.reviewer_id === me);
  const st = reviewState(x.reviews.map((r) => ({ ...r, asset_id: x.id })), x.author_id, x.sme_id);
  const [kind, setKind] = useState<'technical' | 'security'>(st.technical && !st.security ? 'security' : 'technical');
  const [outcome, setOutcome] = useState<'pass' | 'changes'>('pass');
  const [note, setNote] = useState('');
  const [checks, setChecks] = useState({ accurate: false, deidentified: false, no_security: false });
  const [dec, setDec] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const [confirm, setConfirm] = useState<'review' | 'publish' | null>(null);
  useEffect(() => { setDec(Object.fromEntries(x.suggestions.filter((s2) => s2.decision !== 'pending').map((s2) => [`${s2.kind}:${s2.ref}`, s2.decision as 'accepted' | 'rejected']))); }, [x.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const allDecided = x.suggestions.every((s2) => dec[`${s2.kind}:${s2.ref}`]);
  const ready = outcome === 'changes' ? note.trim().length >= 10 : kind === 'technical' ? checks.accurate && allDecided : checks.deidentified && checks.no_security;
  return (
    <div className="space-y-4" data-testid="m24-review-item">
      <Card title={pick(x, 'title')} actions={<span className="text-[12px] text-ink-3">{t('m24.review.version', { v: f.num(x.version) })}</span>}>
        <p className="text-[13.5px] text-ink-2">{pick(x, 'summary')}</p>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-[13px]">{x.key_points.map((k, i) => <li key={i}>{pick({ x_en: k.en, x_ar: k.ar }, 'x')}</li>)}</ul>
        <details className="mt-3"><summary className="cursor-pointer text-[13px] font-semibold">{t('m24.review.body')}</summary>
          <div className="mt-2 max-h-72 overflow-y-auto whitespace-pre-line rounded-md bg-sunken p-3 text-[13px]" dir={x.body_lang === 'ar' ? 'rtl' : 'ltr'}>{x.body}</div></details>
        <div className="mt-3 grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-2">
          <div><span className="caps">{t('m24.asset.skills')}</span><div className="mt-1"><Chips items={x.skill_ids.map(lab.skill)} /></div></div>
          <div><span className="caps">{t('m24.asset.standards')}</span><div className="mt-1"><Chips items={x.standard_ids.map(lab.standard)} /></div></div>
        </div>
        <p className="mt-3 text-[12px] text-ink-3">{t('m24.review.provenance', { sme: pick({ n_en: x.sme_name, n_ar: x.sme_name_ar }, 'n'), author: pick({ n_en: x.author_name, n_ar: x.author_name_ar }, 'n') })}{x.source_session_id ? <> · <L to={`/knowledge/capture/${x.source_session_id}`} className="link">{t('m24.review.session')}</L></> : null}</p>
      </Card>

      <Card title={t('m24.review.stateTitle')}>
        <ul className="space-y-1 text-[13px]" data-testid="m24-review-state">
          {(['technical', 'security'] as const).map((k) => {
            const r = st[k];
            return <li key={k} className="flex flex-wrap items-center gap-2"><Icon name={r ? 'check' : 'info'} size={14} className={r ? 'text-ok' : 'text-ink-3'} />{t(`m24.review.${k}`)}: {r ? t('m24.review.passedBy', { name: pick({ n_en: x.reviews.find((y) => y.id === r.id)?.reviewer_name ?? '', n_ar: x.reviews.find((y) => y.id === r.id)?.reviewer_name_ar ?? '' }, 'n') }) : t('m24.review.missing')}</li>;
          })}
        </ul>
        {current.filter((r) => r.outcome === 'changes').map((r) => <Callout key={r.id} tone="sim" title={t('m24.review.changesBy', { name: pick({ n_en: r.reviewer_name, n_ar: r.reviewer_name_ar }, 'n') })}>{r.note}</Callout>)}
        {canPublish && (
          <div className="mt-3">
            <button className="btn-primary" disabled={!st.ready || own} onClick={() => setConfirm('publish')} data-testid="m24-review-publish">{t('m24.review.publish')}</button>
            {!st.ready && <p className="mt-1 text-[12px] text-ink-3">{t('m24.review.publishNeeds')}</p>}
          </div>
        )}
      </Card>

      {own ? <Callout tone="sim" title={t('m24.review.ownTitle')}>{t('m24.review.ownBody')}</Callout> : mine ? <Callout title={t('m24.review.doneTitle')}>{t('m24.review.doneBody', { kind: t(`m24.review.${mine.kind}`) })}</Callout> : (
        <Card title={t('m24.review.yourReview')}>
          <div className="space-y-3" data-testid="m24-review-form">
            <RadioGroup label={t('m24.review.kind')} name="kind" value={kind} onChange={(v) => setKind(v as never)} options={[{ value: 'technical', label: t('m24.review.technical') }, { value: 'security', label: t('m24.review.security') }]} />
            {kind === 'technical' ? (
              <>
                <CheckboxField label={t('m24.review.checkAccurate')} checked={checks.accurate} onChange={(v) => setChecks((c) => ({ ...c, accurate: v }))} />
                <div><div className="caps mb-1">{t('m24.enrich.suggestions')}</div><SuggestionList list={x.suggestions} refs={refs} decisions={dec} onDecide={(k, v) => setDec((o) => ({ ...o, [k]: v }))} /></div>
              </>
            ) : (
              <>
                <CheckboxField label={t('m24.review.checkDeid')} checked={checks.deidentified} onChange={(v) => setChecks((c) => ({ ...c, deidentified: v }))} />
                <CheckboxField label={t('m24.review.checkNoSec')} checked={checks.no_security} onChange={(v) => setChecks((c) => ({ ...c, no_security: v }))} hint={t('m24.review.checkNoSecHint')} />
              </>
            )}
            <RadioGroup label={t('m24.review.outcome')} name="outcome" value={outcome} onChange={(v) => setOutcome(v as never)} options={[{ value: 'pass', label: t('m24.review.pass') }, { value: 'changes', label: t('m24.review.changes') }]} />
            <TextArea name="note" label={outcome === 'changes' ? t('m24.review.noteRequired') : t('m24.klra.noteOptional')} rows={3} value={note} onChange={setNote} />
            <button className="btn-primary btn-sm" disabled={!ready} onClick={() => setConfirm('review')} data-testid="m24-review-submit">{t('m24.review.submit')}</button>
          </div>
        </Card>
      )}

      <ConfirmDialog open={confirm === 'review'} onClose={() => setConfirm(null)} title={t('m24.review.submit')} consequence={outcome === 'pass' ? t('m24.review.confirmPass', { kind: t(`m24.review.${kind}`) }) : t('m24.review.confirmChanges')}
        onConfirm={async () => { await run(() => repo.rpc.reviewAsset({ asset_id: x.id, kind, outcome, note: note.trim(), checks, decisions: kind === 'technical' ? dec : {} })); }} />
      <ConfirmDialog open={confirm === 'publish'} onClose={() => setConfirm(null)} title={t('m24.review.publish')} consequence={t('m24.review.confirmPublish')} actingAs={t('m24.klra.actingOwner')}
        onConfirm={async () => { await run(() => repo.rpc.publishAsset(x.id)); }} />
    </div>
  );
}
