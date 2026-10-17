// FS32 /my/skills/record: my learner record, CLR-shaped (1EdTech Comprehensive Learner Record 2.0 structure): micro-credentials and
// badges (the signed Open Badges 3.0 credentials, embedded), the qualification mirror (qualified or not only) and skills with their
// provenance. Sharing is curated and consented in three steps (choose, preview, share) and produces a link with an expiry; the
// public verify page shows only the chosen items and the holder's initials. Security and medical detail is never in the record.
import { useMemo, useState } from 'react';
import { Page, Async, BenchmarkChips, Callout, Card, ConfirmDialog, DataTable, EmptyState, Grid, Icon, Section, StatTile, StatusPill, TextField, CheckboxField, WhyThis, downloadText, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import type { Reason } from '../../domain/engines/types';
import { ITEM_KINDS, SHARE_RULES, shareProblem, shareView, type ItemKind, type RecordItem, type ShareRow } from './learnerRecord';
import { addDays, todayIso } from './goalsUi';
import { ItemStatus, XTIER_AR, XTIER_EN } from './xcUi'; // FS79 -> FS32 (wave I integration)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
export const recordShareUrl = (token: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}${import.meta.env.BASE_URL ?? '/kafaa/'}verify/record/${token}`;
const SHARE_TONE = { active: 'ok', expired: 'neutral', revoked: 'bad' } as const;
const KIND_ICON: Record<ItemKind, string> = { mc: 'shield', badge: 'sparkle', xcert: 'grad', qual: 'check', skill: 'chart' };

export function itemReasons(i: RecordItem): Reason[] {
  const out: Reason[] = [{ code: `lr_${i.kind}`, key: `m17.reasons.lr_${i.kind}`, vars: { title: { en: i.title_en, ar: i.title_ar } }, ref: { table: i.kind === 'mc' ? 'microcred_awards' : i.kind === 'badge' ? 'badges' : i.kind === 'xcert' ? 'external_certs' : i.kind === 'qual' ? 'qual_records' : 'person_skills', id: i.id } }];
  if (i.kind === 'xcert') out.push({ code: 'lr_tier', key: 'm17.reasons.lr_tier', vars: { tier: { en: XTIER_EN[i.status] ?? i.status, ar: XTIER_AR[i.status] ?? i.status } } }); // FS79 (wave I integration)
  if (i.kind === 'skill') out.push({ code: 'lr_provenance', key: 'm17.reasons.lr_provenance', vars: { basis: i.status, level: i.level ?? 0 } });
  out.push({ code: 'lr_never', key: 'm17.reasons.lr_never' });
  return out;
}

export function ItemLine({ i, checked, onToggle }: { i: RecordItem; checked?: boolean; onToggle?: (v: boolean) => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  return (
    <li className={`flex items-start gap-2 rounded-card border px-3 py-2 ${checked ? 'border-accent/50 bg-accent-soft/40' : 'border-line'}`} data-testid="m17-lr-item" data-kind={i.kind} data-ref={i.ref}>
      {onToggle && <input type="checkbox" className="mt-1" checked={!!checked} onChange={(e) => onToggle(e.target.checked)} aria-label={pick(i, 'title')} />}
      <Icon name={KIND_ICON[i.kind]} size={14} className="mt-1 text-ink-3" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold">{pick(i, 'title')}</span>
        <span className="block text-[12px] text-ink-3">
          <span className="num">{i.code}</span>
          {' · '}<ItemStatus i={i} />
          {i.level != null && <> · {t('common.skills.level', { level: f.num(i.level) })}</>}
          {i.band && <> · {t(`m17.lr.band.${i.band}`)}</>}
          {i.date && <> · {f.date(i.date)}</>}
        </span>
      </span>
      <WhyThis reasons={itemReasons(i)} testId="m17-lr-why" />
    </li>
  );
}

export default function MyRecordPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const me = s.identity.personId ?? '';
  const q = useQuery(['microcred_awards', 'badges', 'qual_records', 'person_skills', 'record_shares'], async () => {
    const [lr, shares] = await Promise.all([repo.rpc.learnerRecord(null), repo.list('record_shares', { filter: { person_id: me }, order: [['created_at', 'desc']] })]);
    return { lr, shares: shares as unknown as ShareRow[] };
  }, [me]);
  return (
    <Page title={t('m17.routes.my-skills-record.title')} eyebrow={<BenchmarkChips feature="FS32" />} intro={t('m17.lr.intro')} wide
      actions={<div className="flex flex-wrap gap-2"><L to="/my/skills/wallet" className="btn-outline btn-sm no-underline">{t('m17.mc.toWallet')}</L><L to="/my/skills" className="btn-ghost btn-sm no-underline">{t('m17.wallet.toPassport')}</L></div>}>
      <Callout tone="info" title={t('m17.lr.neverTitle')}>{t('m17.lr.neverBody')}</Callout>
      <Async state={q}>{(d) => d.lr.allowed ? <Record items={d.lr.items} bundle={d.lr.bundle} shares={d.shares} /> : <EmptyState title={t('m17.lr.forbidden')}>{t('m17.lr.forbiddenBody')}</EmptyState>}</Async>
    </Page>
  );
}

function Record({ items, bundle, shares }: { items: RecordItem[]; bundle: Record<string, unknown> | null; shares: ShareRow[] }) {
  const t = useT();
  const f = useFormat();
  const today = todayIso();
  const n = (k: ItemKind) => items.filter((i) => i.kind === k).length;
  const active = shares.filter((s) => shareView(s, today) === 'active').length;
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m17.lr.tile.mc')} value={f.num(n('mc'))} sub={t('m17.lr.tile.mcSub', { n: f.num(n('badge')) })} tone="ok" />
        <StatTile label={t('m17.lr.tile.qual')} value={f.num(n('qual'))} sub={t('m17.lr.tile.qualSub')} />
        <StatTile label={t('m17.lr.tile.skill')} value={f.num(n('skill'))} sub={t('m17.lr.tile.skillSub')} tone="info" />
        <StatTile label={t('m17.lr.tile.links')} value={f.num(active)} sub={t('m17.lr.tile.linksSub', { max: f.num(SHARE_RULES.maxActive) })} tone={active ? 'sim' : undefined} />
      </Grid>
      <ShareWizard items={items} />
      <Section title={t('m17.lr.recordTitle')} description={t('m17.lr.recordBody')}
        actions={bundle ? <button type="button" className="btn-outline btn-sm" onClick={() => downloadText('learner-record-clr.json', JSON.stringify(bundle, null, 2), 'application/json')} data-testid="m17-lr-download"><Icon name="download" size={12} /> {t('m17.lr.download')}</button> : undefined}>
        {items.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m17-lr-record">
            {ITEM_KINDS.map((k) => {
              const xs = items.filter((i) => i.kind === k);
              return (
                <Card key={k} title={t(`m17.lr.kind.${k}`)} eyebrow={t('m17.lr.countN', { n: f.num(xs.length) })}>
                  {xs.length ? <ul className="space-y-1.5">{xs.map((i) => <ItemLine key={i.ref} i={i} />)}</ul> : <p className="text-[12.5px] text-ink-3">{t(`m17.lr.kindEmpty.${k}`)}</p>}
                </Card>
              );
            })}
          </div>
        ) : <EmptyState title={t('m17.lr.empty')}>{t('m17.lr.emptyBody')}</EmptyState>}
      </Section>
      <Links shares={shares} items={items} />
    </div>
  );
}

/** The three consent gates: choose the items, review exactly what a verifier will see, then create a link with an expiry. */
function ShareWizard({ items }: { items: RecordItem[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const today = todayIso();
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [c, setC] = useState({ items: false, preview: false, share: false });
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(30);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [ask, setAsk] = useState(false);
  const [made, setMade] = useState<{ token: string; expires_on: string } | null>(null);
  const expires = addDays(today, days);
  const input = { items: sel, label, expires_on: expires, consents: c };
  const problem = shareProblem(input, items, today);
  const chosen = items.filter((i) => sel.includes(i.ref));
  const toggle = (ref: string, v: boolean) => { setSel((xs) => (v ? (xs.length >= SHARE_RULES.maxItems ? xs : [...xs, ref]) : xs.filter((x) => x !== ref))); setC({ items: false, preview: false, share: false }); setPreview(null); };
  const reset = () => { setStep(0); setSel([]); setC({ items: false, preview: false, share: false }); setLabel(''); setDays(30); setPreview(null); setMade(null); };
  const loadPreview = async () => { const r = await repo.rpc.learnerRecord(sel); setPreview(r.bundle); };
  const steps = ['choose', 'preview', 'share'] as const;
  return (
    <Card title={t('m17.lr.wizard.title')} eyebrow={t('m17.lr.wizard.eyebrow')}>
      <div className="space-y-4" data-testid="m17-lr-wizard" data-step={steps[step]}>
        <ol className="flex flex-wrap items-center gap-2" aria-label={t('m17.lr.wizard.title')}>
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2" aria-current={i === step ? 'step' : undefined}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[12.5px] font-semibold ${i < step ? 'border-ok bg-ok/10 text-ok' : i === step ? 'border-accent bg-accent text-white' : 'border-line text-ink-3'}`}>{i < step ? <Icon name="check" size={13} /> : f.num(i + 1)}</span>
              <span className={`text-[13px] ${i === step ? 'font-semibold text-ink' : 'text-ink-3'}`}>{t(`m17.lr.wizard.step.${s}`)}</span>
              {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line" aria-hidden />}
            </li>
          ))}
        </ol>

        {made ? (
          <div className="space-y-2" data-testid="m17-lr-made">
            <Callout tone="ok" title={t('m17.lr.wizard.madeTitle')}>{t('m17.lr.wizard.madeBody', { date: f.date(made.expires_on) })}</Callout>
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full break-all rounded bg-sunken px-2 py-1 text-[12px]" dir="ltr">{recordShareUrl(made.token)}</code>
              <button type="button" className="btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(recordShareUrl(made.token))}><Icon name="link" size={12} /> {t('m17.lr.copy')}</button>
              <a className="btn-ghost btn-sm" href={recordShareUrl(made.token)} target="_blank" rel="noopener noreferrer"><Icon name="external" size={12} /> {t('m17.lr.open')}</a>
              <button type="button" className="btn-ghost btn-sm" onClick={reset}>{t('m17.lr.wizard.another')}</button>
            </div>
          </div>
        ) : step === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-2">{t('m17.lr.wizard.chooseBody', { max: f.num(SHARE_RULES.maxItems) })}</p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {ITEM_KINDS.map((k) => {
                const xs = items.filter((i) => i.kind === k);
                if (!xs.length) return null;
                const all = xs.every((i) => sel.includes(i.ref));
                return (
                  <div key={k} className="space-y-1.5">
                    <div className="flex items-center justify-between"><h3 className="caps">{t(`m17.lr.kind.${k}`)}</h3><button type="button" className="text-[12px] text-accent hover:underline" onClick={() => xs.forEach((i) => toggle(i.ref, !all))}>{t(all ? 'm17.lr.wizard.none' : 'm17.lr.wizard.all')}</button></div>
                    <ul className="space-y-1.5" data-testid={`m17-lr-pick-${k}`}>{xs.map((i) => <ItemLine key={i.ref} i={i} checked={sel.includes(i.ref)} onToggle={(v) => toggle(i.ref, v)} />)}</ul>
                  </div>
                );
              })}
            </div>
            <CheckboxField label={t('m17.lr.wizard.consentItems', { n: f.num(sel.length) })} hint={t('m17.lr.wizard.consentItemsHint')} checked={c.items} disabled={!sel.length} onChange={(v) => setC({ ...c, items: v })} />
            <div className="flex justify-end"><button type="button" className="btn-primary" disabled={!sel.length || !c.items} onClick={() => { setStep(1); void loadPreview(); }} data-testid="m17-lr-next-1">{t('m17.lr.wizard.next')}</button></div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-2">{t('m17.lr.wizard.previewBody')}</p>
            <div className="rounded-card border border-line p-3" data-testid="m17-lr-preview">
              <div className="mb-2 flex flex-wrap items-center gap-2"><span className="caps">{t('m17.lr.verify.holder')}</span><span className="chip border-line text-ink-2">{String(((preview?.credentialSubject as Row)?.holderInitials) ?? '…')}</span><span className="text-[12px] text-ink-3">{t('m17.lr.wizard.previewNoName')}</span></div>
              <ul className="space-y-1.5">{chosen.map((i) => <ItemLine key={i.ref} i={i} />)}</ul>
            </div>
            {preview && <button type="button" className="btn-ghost btn-sm" onClick={() => downloadText('learner-record-preview.json', JSON.stringify(preview, null, 2), 'application/json')}><Icon name="download" size={12} /> {t('m17.lr.wizard.previewJson')}</button>}
            <CheckboxField label={t('m17.lr.wizard.consentPreview')} checked={c.preview} disabled={!preview} onChange={(v) => setC({ ...c, preview: v })} />
            <div className="flex justify-between"><button type="button" className="btn-ghost" onClick={() => setStep(0)}>{t('m17.lr.wizard.back')}</button><button type="button" className="btn-primary" disabled={!c.preview} onClick={() => setStep(2)} data-testid="m17-lr-next-2">{t('m17.lr.wizard.next')}</button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <TextField label={t('m17.lr.wizard.label')} name="label" value={label} onChange={setLabel} required hint={t('m17.lr.wizard.labelHint')} />
            <div className="space-y-1">
              <div className="text-[13px] font-semibold">{t('m17.lr.wizard.expiry')}</div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('m17.lr.wizard.expiry')}>
                {[7, 14, 30, 60, 90].map((n) => <button key={n} type="button" role="radio" aria-checked={days === n} className={`chip ${days === n ? 'border-accent bg-accent/10 text-eyebrow' : 'border-line text-ink-2'}`} onClick={() => setDays(n)}>{t('m17.lr.wizard.days', { n: f.num(n) })}</button>)}
              </div>
              <p className="text-[12px] text-ink-3">{t('m17.lr.wizard.expiresOn', { date: f.date(expires) })}</p>
            </div>
            <CheckboxField label={t('m17.lr.wizard.consentShare')} hint={t('m17.lr.wizard.consentShareHint')} checked={c.share} onChange={(v) => setC({ ...c, share: v })} />
            {problem !== 'ok' && c.share && <p className="text-[12.5px] text-bad" role="alert">{t(`m17.lr.problem.${problem}`)}</p>}
            <div className="flex justify-between"><button type="button" className="btn-ghost" onClick={() => setStep(1)}>{t('m17.lr.wizard.back')}</button><button type="button" className="btn-primary" disabled={problem !== 'ok'} onClick={() => setAsk(true)} data-testid="m17-lr-create">{t('m17.lr.wizard.create')}</button></div>
          </div>
        )}
        <ConfirmDialog open={ask} onClose={() => setAsk(false)} title={t('m17.lr.wizard.confirmTitle')} consequence={t('m17.lr.wizard.confirmBody', { n: f.num(sel.length), date: f.date(expires), items: chosen.slice(0, 4).map((i) => pick(i, 'title')).join(' · ') })}
          onConfirm={async () => { const r = await act(() => repo.rpc.createRecordShare(input)); if (r.ok && r.data) setMade({ token: r.data.token, expires_on: r.data.expires_on }); }} />
      </div>
    </Card>
  );
}

function Links({ shares, items }: { shares: ShareRow[]; items: RecordItem[] }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const today = todayIso();
  const [rv, setRv] = useState<ShareRow | null>(null);
  const known = useMemo(() => new Set(items.map((i) => i.ref)), [items]);
  const cols: Column<ShareRow>[] = [
    { key: 'label', header: t('m17.lr.col.label'), value: (s) => s.label, sortable: true, render: (s) => <span className="font-semibold">{s.label}</span> },
    { key: 'items', header: t('m17.lr.col.items'), value: (s) => s.items.length, sortable: true, render: (s) => <span>{f.num(s.items.length)}{s.items.some((r) => !known.has(r)) && <span className="ms-1 text-[11.5px] text-sim">{t('m17.lr.col.changed')}</span>}</span> },
    { key: 'status', header: t('m17.lr.col.status'), value: (s) => shareView(s, today), render: (s) => { const v = shareView(s, today); return <StatusPill tone={SHARE_TONE[v]} status={v}>{t(`m17.lr.share.${v}`)}</StatusPill>; } },
    { key: 'expires', header: t('m17.lr.col.expires'), value: (s) => s.expires_on, sortable: true, render: (s) => f.date(s.expires_on) },
    { key: 'views', header: t('m17.lr.col.views'), value: (s) => s.views ?? 0, sortable: true, render: (s) => <span>{f.num(s.views ?? 0)}{s.last_viewed_at && <span className="block text-[11.5px] text-ink-3">{t('m17.lr.col.lastViewed', { date: f.date(String(s.last_viewed_at).slice(0, 10)) })}</span>}</span> },
    { key: 'act', header: '', value: () => '', render: (s) => shareView(s, today) === 'active' ? (
      <div className="flex flex-wrap gap-1">
        <button type="button" className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(recordShareUrl(s.token))} data-testid="m17-lr-copy">{t('m17.lr.copy')}</button>
        <button type="button" className="btn-ghost btn-sm text-bad" onClick={() => setRv(s)} data-testid="m17-lr-revoke">{t('m17.lr.revoke')}</button>
      </div>) : (s as Row).revoke_reason ? <span className="text-[12px] text-ink-3">{String((s as Row).revoke_reason)}</span> : null },
  ];
  return (
    <Section title={t('m17.lr.linksTitle')} description={t('m17.lr.linksBody')}>
      {shares.length ? <div data-testid="m17-lr-links"><DataTable rows={shares} columns={cols} rowKey={(s) => s.id} searchable={false} /></div> : <EmptyState title={t('m17.lr.linksEmpty')}>{t('m17.lr.linksEmptyBody')}</EmptyState>}
      <ConfirmDialog open={!!rv} onClose={() => setRv(null)} danger title={t('m17.lr.revokeTitle', { label: rv?.label ?? '' })} consequence={t('m17.lr.revokeBody')} requireReason reasonLabel={t('m17.lr.revokeReason')}
        onConfirm={async (reason) => { if (rv) await act(() => repo.rpc.revokeRecordShare(rv.id, reason)); }} />
    </Section>
  );
}
