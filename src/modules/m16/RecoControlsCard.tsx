// F24 (W3 · E5): the "Recommendations and your data" card on /my/settings (M14's settings page renders it). Per-surface opt-out
// of ranked recommendations (rpc.setRecoOptout, confirmed, audited, ledgered), "How this works" (the engine card), "Download
// what Kafa'a infers about me" (JSON) and "Ask for a correction" (a data_requests correction, reusing M14's data rights flow).
import { lazy, Suspense, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import { Callout, Card, Drawer, Icon, Modal, RadioGroup, StatusPill, TextArea, minLen, required, useForm } from '../../ui';
import type { EngineCardsRow } from '../../data/types';
import { GatedConfirm } from './parts';
import { EngineCardView } from './EngineCardView';
import { OPTOUT_SURFACES, type OptoutSurface } from './fairness';

const InferenceExport = lazy(() => import('./InferenceExport'));

export function RecoControlsCard() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const staff = !!me && s.can('skills_profile', ['Own']);
  const q = useQuery(['engine_cards', 'reco_optouts', 'engine_settings'], async () => {
    if (!me) return null;
    const [cards, optouts, settings] = await Promise.all([
      repo.list('engine_cards', { order: [['sort', 'asc']] }).catch(() => []),
      repo.list('reco_optouts', { filter: { person_id: me } }).catch(() => []),
      repo.list('engine_settings').catch(() => []),
    ]);
    return { cards, optouts, settings };
  }, [me]);
  const [pending, setPending] = useState<{ surface: OptoutSurface; off: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [howCard, setHowCard] = useState<EngineCardsRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  if (!staff) return null;
  const d = q.data;
  const cards = d?.cards ?? [];
  const off = (surface: string) => !!d?.optouts.find((o) => o.surface === surface && o.opted_out);
  const card = (id: string) => cards.find((c) => c.id === id) ?? null;
  const others = cards.filter((c) => !c.opt_out);
  return (
    <Card title={t('m16.ai.settings.title')} eyebrow={t('m16.ai.settings.eyebrow')}>
      <div id="recommendations" className="space-y-4" data-testid="m16-reco-card">
        <p className="text-[13.5px] text-ink-2">{t('m16.ai.settings.intro')}</p>
        <ul className="divide-y divide-line rounded-btn border border-line" data-testid="m16-reco-surfaces">
          {OPTOUT_SURFACES.map((surface) => {
            const c = card(surface);
            const isOff = off(surface);
            return (
              <li key={surface} className="flex flex-wrap items-center gap-3 p-3" data-testid={`m16-reco-${surface}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {c ? pick(c, 'title') : t(`m16.ai.surface.${surface}`)}
                    {isOff ? <StatusPill tone="neutral">{t('m16.ai.settings.off')}</StatusPill> : <StatusPill tone="ok">{t('m16.ai.settings.on')}</StatusPill>}
                  </div>
                  <div className="text-[12.5px] text-ink-2">{isOff ? t(`m16.ai.settings.offBody.${surface}`) : c ? pick(c, 'purpose') : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c && <button type="button" className="btn-ghost btn-sm" onClick={() => setHowCard(c)} data-testid={`m16-how-${surface}`}><Icon name="info" size={13} />{t('m16.ai.settings.how')}</button>}
                  <button type="button" role="switch" aria-checked={!isOff} aria-label={t('m16.ai.settings.switchLabel', { surface: c ? pick(c, 'title') : surface })}
                    className={isOff ? 'btn-outline btn-sm' : 'btn-primary btn-sm'} onClick={() => { setReason(''); setPending({ surface, off: !isOff }); }} data-testid={`m16-optout-${surface}`}>
                    {isOff ? t('m16.ai.settings.turnOn') : t('m16.ai.settings.turnOff')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {others.length > 0 && (
          <details className="text-[13px]">
            <summary className="cursor-pointer font-semibold text-ink-2">{t('m16.ai.settings.others', { n: f.num(others.length) })}</summary>
            <p className="mt-1 text-[12.5px] text-ink-3">{t('m16.ai.settings.othersBody')}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {others.map((c) => <li key={c.id}><button type="button" className="chip border-line bg-panel" onClick={() => setHowCard(c)} data-testid={`m16-how-${c.id}`}>{pick(c, 'title')}</button></li>)}
            </ul>
          </details>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button type="button" className="btn-outline btn-sm" disabled={exporting} onClick={() => setExporting(true)} data-testid="m16-export-inferences"><Icon name="download" size={14} />{exporting ? t('common.working') : t('m16.ai.settings.export')}</button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setCorrecting(true)} data-testid="m16-correction"><Icon name="chat" size={14} />{t('m16.ai.settings.correct')}</button>
          {exporting && <Suspense fallback={null}><InferenceExport onDone={() => setExporting(false)} /></Suspense>}
        </div>
        <p className="text-[12px] text-ink-3">{t('m16.ai.settings.never')}</p>
      </div>

      <GatedConfirm
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? t(pending.off ? 'm16.ai.settings.confirmOff' : 'm16.ai.settings.confirmOn', { surface: card(pending.surface) ? pick(card(pending.surface), 'title') : pending.surface }) : ''}
        consequence={pending ? t(pending.off ? `m16.ai.settings.consequenceOff.${pending.surface}` : 'm16.ai.settings.consequenceOn') : ''}
        actingAs={t('m16.ai.settings.asYou')}
        onConfirm={() => pending && run(() => repo.rpc.setRecoOptout(pending.surface, pending.off, pending.off ? reason : null), { success: t(pending.off ? 'm16.ai.settings.savedOff' : 'm16.ai.settings.savedOn') })}
      >
        {pending?.off && (
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold">{t('m16.ai.settings.reason')}</span>
            <textarea className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="m16-optout-reason" />
            <span className="text-[12px] text-ink-3">{t('m16.ai.settings.reasonHint')}</span>
          </label>
        )}
      </GatedConfirm>
      <Drawer open={!!howCard} onClose={() => setHowCard(null)} title={howCard ? pick(howCard, 'title') : ''}>
        {howCard && <EngineCardView card={howCard} setting={d?.settings.find((x) => x.id === howCard.engine_surface) ?? null} compact />}
      </Drawer>
      <CorrectionModal open={correcting} onClose={() => setCorrecting(false)} personId={me!} cards={cards} />
    </Card>
  );
}

function CorrectionModal({ open, onClose, personId, cards }: { open: boolean; onClose: () => void; personId: string; cards: EngineCardsRow[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ card: cards[0]?.id ?? 'navigator', note: '' }, { card: [required()], note: [required(), minLen(10)] });
  return (
    <Modal open={open} onClose={onClose} title={t('m16.ai.correct.title')} footer={
      <>
        <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={form.submitting} data-testid="m16-correction-send" onClick={form.handleSubmit(async (v) => {
          const c = cards.find((x) => x.id === v.card);
          const r = await run(() => repo.insert('data_requests', { person_id: personId, kind: 'correction', status: 'open', note: `[AI · ${c?.title_en ?? v.card}] ${v.note.trim()}` }), { success: t('m16.ai.correct.sent') });
          if (r.ok) { form.reset(); onClose(); }
        })}>{t('m16.ai.correct.send')}</button>
      </>
    }>
      <div className="space-y-3">
        <Callout tone="info">{t('m16.ai.correct.intro')}</Callout>
        <RadioGroup label={t('m16.ai.correct.which')} {...form.field('card')} options={cards.map((c) => ({ value: c.id, label: pick(c, 'title') }))} />
        <TextArea label={t('m16.ai.correct.what')} required rows={3} hint={t('m16.ai.correct.hint')} {...form.field('note')} />
        <p className="text-[12px] text-ink-3">{t('m16.ai.correct.sla')}</p>
      </div>
    </Modal>
  );
}
