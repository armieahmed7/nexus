// FS80 /workforce/ai-automations/:id (ai_literacy R): one gallery entry. Purpose, data used, the accountable owner, the human check on
// its output and how to use it (plain text: metadata only, nothing runs in Kafa'a), the AI-system register row it runs on, the adoption
// counter and "I use this" (rpc.adoptAutomation behind a ConfirmDialog: never the builder, once, FS09 rung at least the entry's minimum),
// the builder's credit with why, and the decision history. Builders also open their own unlisted entries; AI governance and auditors all.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, Callout, EmptyState, KeyValue, BenchmarkChips, ConfirmDialog, TextField, Timeline, Icon } from '../../ui';
import { useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { LIMITS } from './automations';
import { AdoptHint, AtmStatus, Counter, CreditPanel, DataClassChips, KindChip, MetadataNotice, Plain, SystemLink, adoptBlock, useActor, useAtmRun, useGallery, type GalleryData } from './fs80ui';
import { RungPill, type Row } from './ui';

export default function AutomationPage() {
  const t = useT();
  const pick = usePick();
  const { id = '' } = useParams();
  const q = useGallery();
  return (
    <Async state={q} isEmpty={() => false}>{(d) => {
      const a = d.entries.find((x: Row) => x.id === id);
      return (
        <Page title={a ? pick(a, 'title') : t('m29.routes.workforce-ai-automation.title')} intro={a ? t('m29.atm.one.intro') : t('m29.atm.one.notFound')} wide eyebrow={<BenchmarkChips feature="FS80" />}
          actions={<L to="/workforce/ai-automations" className="btn-outline btn-sm no-underline" data-testid="m29-atm-back">{t('m29.atm.one.back')}</L>}>
          {a ? <Body d={d} a={a} reload={q.reload} /> : <EmptyState title={t('m29.atm.one.notFound')} />}
        </Page>
      );
    }}</Async>
  );
}

function Body({ d, a, reload }: { d: GalleryData; a: Row; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAtmRun();
  const actor = useActor();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const sys = d.systems.find((s: Row) => s.id === a.system_id);
  const block = adoptBlock(a, d);
  const adopted = d.mine.find((x: Row) => x.automation_id === a.id);
  const hist = [...(a.history ?? [])].reverse();
  return (
    <div className="space-y-6" data-testid="m29-atm-one" data-id={a.id} data-status={a.status}>
      <div className="flex flex-wrap items-center gap-1.5"><AtmStatus status={a.status} /><KindChip kind={a.kind} /><DataClassChips classes={a.data_classes} /></div>
      {a.status === 'returned' && a.decision_note && <Callout tone="sim" title={t('m29.atm.one.returned')}><span data-testid="m29-atm-returned-note">{a.decision_note}</span></Callout>}
      {a.status === 'rejected' && a.decision_note && <Callout tone="bad" title={t('m29.atm.one.rejected')}>{a.decision_note}</Callout>}
      {a.status === 'retired' && <Callout tone="info" title={t('m29.atm.one.retired')}>{a.decision_note}</Callout>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={t('m29.atm.one.purpose')}><Plain testId="m29-atm-purpose">{pick(a, 'purpose')}</Plain></Card>
          <Card title={t('m29.atm.one.data')} eyebrow={t('m29.atm.one.dataEyebrow')}><Plain testId="m29-atm-data">{pick(a, 'data_used')}</Plain></Card>
          <Callout tone="info" title={t('m29.atm.one.oversight')}><span data-testid="m29-atm-oversight">{pick(a, 'oversight')}</span></Callout>
          <Card title={t('m29.atm.one.how')} eyebrow={t('m29.atm.one.howEyebrow')}><Plain testId="m29-atm-how-text">{pick(a, 'how')}</Plain></Card>
          <Card title={t('m29.atm.one.benefit')}><Plain>{pick(a, 'benefit')}</Plain></Card>
          <MetadataNotice />
        </div>
        <div className="space-y-4">
          <Card title={t('m29.atm.one.adoption')} eyebrow={t('m29.atm.one.adoptionEyebrow')}>
            <div className="space-y-3">
              <Counter n={Number(a.adoption_count)} big />
              {a.first_adopted_on && <p className="text-[12.5px] text-ink-3">{t('m29.atm.one.firstOn', { date: f.date(String(a.first_adopted_on)) })}</p>}
              {adopted
                ? <p className="text-[13px] text-ok" data-testid="m29-atm-adopted">{t('m29.atm.one.youOn', { date: f.date(String(adopted.adopted_on)) })}</p>
                : block
                  ? <AdoptHint code={block} a={a} me={d.me} />
                  : <button type="button" className="btn-primary btn-sm" data-testid="m29-atm-adopt" onClick={() => setOpen(true)}><Icon name="check" size={14} /> {t('m29.atm.one.adopt')}</button>}
            </div>
          </Card>
          <Card title={t('m29.atm.one.credit')} eyebrow={t('m29.atm.one.creditEyebrow')}><CreditPanel a={a} /></Card>
          <Card title={t('m29.atm.one.facts')}>
            <KeyValue items={[
              [t('m29.atm.one.builder'), pick(a, 'builder')],
              [t('m29.atm.one.owner'), pick(a, 'owner')],
              [t('m29.atm.one.minRung'), <RungPill key="r" rung={Number(a.min_rung)} />],
              [t('m29.atm.one.version'), f.num(Number(a.version))],
              [t('m29.atm.one.decided'), a.decided_at ? f.date(String(a.decided_at)) : '—'],
            ]} />
          </Card>
          <Card title={t('m29.atm.one.register')} eyebrow={t('m29.atm.one.registerEyebrow')}>
            <SystemLink sys={sys} />
            {sys && <p className="mt-2 text-[12.5px] text-ink-2">{pick(sys, 'oversight')}</p>}
          </Card>
        </div>
      </div>
      {hist.length > 0 && (
        <Section title={t('m29.atm.one.history')}>
          <div data-testid="m29-atm-history">
            <Timeline items={hist.map((h: Row, i: number) => ({
              id: `${i}`, when: f.date(String(h.at)), title: t(`m29.atm.act.${h.action}`, { v: f.num(Number(h.version ?? 1)) }),
              detail: [actor(a, h), h.note].filter(Boolean).join(' · ') || undefined,
              tone: h.action === 'approve' ? 'ok' : h.action === 'reject' ? 'bad' : h.action === 'return' ? 'sim' : 'accent',
            }))} />
          </div>
        </Section>
      )}
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={t('m29.atm.one.confirm.title')} consequence={t('m29.atm.one.confirm.body')}
        onConfirm={async () => { const r = await run(() => repo.rpc.adoptAutomation({ id: a.id, note }), 'm29.atm.ok.adopted'); setOpen(false); if (r.ok) { setNote(''); reload?.(); } }}>
        <TextField label={t('m29.atm.one.note')} name="note" value={note} onChange={(x) => setNote(x.slice(0, LIMITS.adopt_note))} hint={t('m29.atm.one.noteHint')} />
      </ConfirmDialog>
    </div>
  );
}
