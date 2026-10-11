// /knowledge/assets/:assetId (M24 · F21): a published knowledge asset: summary, key points, the captured text, skills, standards,
// related OE lessons and courses (citations), provenance (SME, author, interview template, the two reviews) and "used by" (shown
// from 10 people). The KM owner attaches it to qualification standards as "read before requalification" and can withdraw it;
// the author can withdraw it too.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, Callout, KeyValue, ConfirmDialog, Modal, Icon } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { showUsedBy, LIMITS } from './capture';
import { AssetPill, Chips, MultiPick, useKcLabels, useKcRefs, type KcRefs } from './ui';

export default function AssetPage() {
  const { assetId = '' } = useParams();
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const refs = useKcRefs();
  const q = useQuery(['knowledge_assets', 'asset_uses'], async () => {
    const [a, uses] = await Promise.all([repo.get('knowledge_assets', assetId).catch(() => null), s.identity.personId ? repo.list('asset_uses', { filter: { asset_id: assetId, person_id: s.identity.personId } }).catch(() => []) : Promise.resolve([])]);
    return { a, used: uses.length > 0 };
  }, [assetId, s.identity.personId]);
  return (
    <Page title={t('m24.routes.knowledge-asset.title')} eyebrow={<L to="/knowledge" className="link">{t('m24.kb.back')}</L>} wide>
      <Async state={refs}>
        {(r) => (
          <Async state={q} isEmpty={(d) => !d.a} empty={<EmptyState icon="book" title={t('m24.asset.notFound')}>{t('m24.asset.notFoundBody')}</EmptyState>}>
            {(d) => <Asset a={d.a!} used={d.used} refs={r} />}
          </Async>
        )}
      </Async>
    </Page>
  );
}

function Asset({ a, used, refs }: { a: RowOf<'knowledge_assets'>; used: boolean; refs: KcRefs }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const lab = useKcLabels(refs);
  const me = s.identity.personId;
  const owner = s.can('knowledge', ['A']);
  const [withdraw, setWithdraw] = useState(false);
  const [requal, setRequal] = useState(false);
  const [sel, setSel] = useState<string[]>(a.requal_standard_ids ?? []);
  const [busy, setBusy] = useState(false);
  const published = a.status === 'published';
  const kp = (a.key_points ?? []) as { en: string; ar: string }[];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <article className="space-y-4" data-testid="m24-asset">
        <header className="card p-5">
          <div className="flex flex-wrap items-center gap-2"><AssetPill status={a.status} /><span className="chip border-line bg-sunken text-ink-2">{t(`m24.family.${a.system_family}`)}</span>{a.template && <span className="chip border-line bg-sunken text-ink-2">{t(`m24.template.${a.template}.name`)}</span>}</div>
          <h2 className="mt-2 text-[22px] font-semibold">{pick(a, 'title')}</h2>
          <p className="mt-2 text-[14px] text-ink-2">{pick(a, 'summary')}</p>
          {!published && <Callout tone="sim">{t(`m24.asset.notPublished_${a.status}`)}</Callout>}
        </header>
        <Card title={t('m24.asset.keyPoints')}>
          <ul className="list-disc space-y-1.5 ps-5 text-[14px]">{kp.map((k, i) => <li key={i}>{pick({ x_en: k.en, x_ar: k.ar }, 'x')}</li>)}</ul>
        </Card>
        <Card title={t('m24.asset.captured')}>
          <div dir={a.body_lang === 'ar' ? 'rtl' : 'ltr'} lang={a.body_lang} className="whitespace-pre-line text-[14px] leading-relaxed">{a.body}</div>
          <p className="mt-3 text-[12px] text-ink-3">{t('m24.asset.bodyNote')}</p>
        </Card>
        <Card title={t('m24.asset.related')}>
          <KeyValue items={[
            [t('m24.asset.skills'), <Chips key="s" items={(a.skill_ids ?? []).map(lab.skill)} />],
            [t('m24.asset.standards'), <Chips key="q" items={(a.standard_ids ?? []).map(lab.standard)} />],
            [t('m24.asset.oe'), (a.oe_ids ?? []).length ? <ul key="o" className="space-y-1">{(a.oe_ids ?? []).map((id) => { const o = lab.oe(id); return <li key={id}><L to="/oe" className="link">{o ? pick(o, 'title') : id}</L>{o && <span className="block text-[12px] text-ink-3">{t('m24.kb.citeOe', { date: f.date(o.reviewed_on), body: o.reviewing_body })}</span>}</li>; })}</ul> : '—'],
            [t('m24.asset.courses'), (a.course_ids ?? []).length ? <ul key="c" className="space-y-1">{(a.course_ids ?? []).map((id) => { const c = lab.course(id); return <li key={id}><L to={`/learn/course/${id}`} className="link">{c ? `${c.code} · ${pick(c, 'title')}` : id}</L></li>; })}</ul> : '—'],
          ]} />
        </Card>
      </article>
      <aside className="space-y-4">
        <Card title={t('m24.asset.provenance')}>
          <KeyValue items={[
            [t('m24.asset.sme'), pick({ n_en: a.sme_name, n_ar: a.sme_name_ar }, 'n')],
            [t('m24.asset.author'), pick({ n_en: a.author_name, n_ar: a.author_name_ar }, 'n')],
            [t('m24.asset.reviews'), published ? t('m24.asset.reviewedTwo', { n: f.num((a.reviewers ?? []).length) }) : '—'],
            [t('m24.asset.published'), f.date(a.published_at)],
            [t('m24.asset.version'), f.num(a.version)],
            ...(a.status === 'withdrawn' ? [[t('m24.asset.withdrawn'), `${f.date(a.withdrawn_at)} · ${a.withdrawn_reason ?? ''}`] as [string, string]] : []),
          ]} />
        </Card>
        {published && (
          <Card title={t('m24.asset.useTitle')}>
            <p className="text-[13px] text-ink-2" data-testid="m24-asset-usedby">{showUsedBy(a.used_by) ? t('m24.kb.usedBy', { n: f.num(a.used_by) }) : t('m24.kb.usedByFew')}</p>
            <button className="btn-primary btn-sm mt-2" disabled={used || busy} data-testid="m24-asset-use" onClick={async () => { setBusy(true); try { await run(() => repo.rpc.markAssetUsed(a.id)); } finally { setBusy(false); } }}>
              <Icon name="check" size={14} />{used ? t('m24.asset.usedMine') : t('m24.asset.markUsed')}
            </button>
          </Card>
        )}
        <Card title={t('m24.asset.requalTitle')}>
          {(a.requal_standard_ids ?? []).length ? <Chips items={(a.requal_standard_ids ?? []).map(lab.standard)} /> : <p className="text-[13px] text-ink-3">{t('m24.asset.noRequal')}</p>}
          {owner && published && <button className="btn-outline btn-sm mt-2" onClick={() => { setSel(a.requal_standard_ids ?? []); setRequal(true); }} data-testid="m24-asset-requal">{t('m24.asset.requalEdit')}</button>}
          <p className="mt-2 text-[12px] text-ink-3">{t('m24.kb.mirrorNote')}</p>
        </Card>
        {published && (owner || a.author_id === me) && (
          <button className="btn-outline w-full text-bad" onClick={() => setWithdraw(true)} data-testid="m24-asset-withdraw">{t('m24.asset.withdraw')}</button>
        )}
      </aside>
      <ConfirmDialog open={withdraw} onClose={() => setWithdraw(false)} danger title={t('m24.asset.withdraw')} consequence={t('m24.asset.withdrawBody')} requireReason reasonLabel={t('m24.asset.withdrawReason')}
        actingAs={owner ? t('m24.klra.actingOwner') : t('m24.asset.actingAuthor')} onConfirm={async (reason) => { await run(() => repo.rpc.withdrawAsset(a.id, reason)); }} />
      <Modal open={requal} onClose={() => !busy && setRequal(false)} title={t('m24.asset.requalEdit')}
        footer={<><button className="btn-outline" onClick={() => setRequal(false)}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={busy} data-testid="m24-asset-requal-save" onClick={async () => { setBusy(true); try { const r = await run(() => repo.rpc.attachAssetRequal(a.id, sel)); if (r.ok) setRequal(false); } finally { setBusy(false); } }}>{t('common.save')}</button></>}>
        <p className="mb-2 text-[13px] text-ink-2">{t('m24.asset.requalHelp')}</p>
        <MultiPick label={t('m24.asset.standards')} options={refs.standards.map((q) => ({ id: q.id, label: lab.standard(q.id) }))} value={sel} onChange={setSel} max={LIMITS.REQUAL} />
      </Modal>
    </div>
  );
}
