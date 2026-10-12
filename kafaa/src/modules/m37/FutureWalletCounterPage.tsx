// FS74 /national/future-wallet (national_alignment Agg/W/A: HR analyst, HR director, platform admins): the organisation counter toward the
// dated Future Skills Wallet target. The counter shows its definition (the core five, from evidence only), the target value and date as
// a leadership parameter with who set it and when (and every earlier setting), the share of active staff holding each item, how many
// items people hold, and the families (security, safeguards and cyber never broken out). Every count under 10 is suppressed. The HR
// director (workforce_strategy A) changes the target in one confirmed, audited and ledgered step.
import { useState } from 'react';
import { Page, Section, Async, BarChart, BenchmarkChips, BenchmarkLine, Callout, ConfirmDialog, EmptyState, Heatmap, Icon, StatTile, TextArea, TextField } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { WALLET_ITEMS, targetProblem, type TargetView, type WalletCounter } from './wallet';
import { TargetCard } from './FutureWalletPage';
import type { Row } from './ui';

export default function FutureWalletCounterPage() {
  const t = useT();
  const repo = useRepo();
  const c = useQuery(['wallet_targets', 'person_skills', 'microcred_awards', 'people'], () => repo.rpc.futureWalletCounter(), []);
  const fams = useQuery(['job_families'], () => repo.list('job_families') as Promise<Row[]>, []);
  return (
    <Page title={t('m37.routes.national-future-wallet.title')} intro={t('m37.fwc.intro')} wide eyebrow={<BenchmarkChips feature="FS74" />}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/my/future-wallet" className="btn-outline btn-sm no-underline" data-testid="m37-fwc-mine">{t('m37.fwc.toMine')}</L>
        <L to="/national/alignment/nt-jahiz" className="btn-ghost btn-sm no-underline">{t('m37.fwc.toTag')}</L>
      </div>}>
      <Async state={fams}>{(families) => (
        <Async state={c} isEmpty={(x) => !x} empty={<EmptyState title={t('m37.fwc.none')} />}>{(d) => (d ? <Counter d={d} families={families} /> : null)}</Async>
      )}</Async>
    </Page>
  );
}

function Sup() {
  const t = useT();
  return <span className="text-ink-3" title={t('common.suppressed')} data-suppressed="true">{t('common.suppressedShort')}</span>;
}

function Counter({ d, families }: { d: WalletCounter; families: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const fam = (id: string) => { const x = families.find((y) => y.id === id); return x ? pick(x, 'name') : id; };
  const tv = d.target;
  return (
    <div className="space-y-6" data-testid="m37-fwc">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m37-fwc-tiles">
        <StatTile label={t('m37.fwc.tile.complete')} value={d.complete == null ? <Sup /> : f.num(d.complete)} sub={t('m37.fwc.tile.completeSub', { n: d.staff == null ? t('common.suppressedShort') : f.num(d.staff) })} tone="info" />
        <StatTile label={t('m37.fwc.tile.share')} value={d.pct == null ? <Sup /> : f.pct(d.pct)} sub={t('m37.fwc.tile.shareSub')} />
        <StatTile label={t('m37.fwc.tile.target')} value={tv ? f.pct(tv.pct, 0) : '—'} sub={tv ? t('m37.fwc.tile.targetSub', { date: f.date(tv.due_on) }) : t('m37.fwc.noTarget')} tone="ok" />
        <StatTile label={t('m37.fwc.tile.gap')} value={d.gap == null ? <Sup /> : t('m37.fwc.points', { n: f.num(d.gap) })} sub={t('m37.fwc.tile.gapSub')} tone="sim" />
      </div>

      <Section title={t('m37.fwc.counterTitle')} description={t('m37.fwc.counterIntro')}>
        <div className="space-y-3" data-testid="m37-fwc-counter" data-pct={d.pct ?? ''}>
          <BenchmarkLine value={d.pct} max={100} unit="pct" label={t('m37.fwc.counterLine')}
            lines={tv ? [{ kind: 'target', label: t('m37.fwc.targetMark', { date: f.date(tv.due_on) }), value: tv.pct }] : []} />
          {d.pct == null && <Callout tone="info" title={t('m37.fwc.supTitle')}><span data-testid="m37-fwc-suppressed">{t('m37.fwc.supBody', { min: 10 })}</span></Callout>}
          <div className="rounded-card bg-sunken p-3" data-testid="m37-fwc-definition">
            <p className="caps mb-1.5 text-[10.5px] text-ink-3">{t('m37.fwc.definition')}</p>
            <ol className="list-decimal space-y-1 ps-5 text-[13px] text-ink-2">
              {WALLET_ITEMS.map((k) => <li key={k}><span className="font-semibold">{t(`m37.fw.item.${k}.title`)}</span>: {t(`m37.fw.item.${k}.rule`)}</li>)}
            </ol>
            <p className="mt-2 text-[12.5px] text-ink-3">{t('m37.fwc.definitionNote')}</p>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m37.fwc.itemsTitle')} description={t('m37.fwc.itemsIntro')}>
          <div data-testid="m37-fwc-items">
            <BarChart title={t('m37.fwc.itemsTitle')} unit="%" max={100} target={tv?.pct}
              data={d.items.map((i) => ({ label: t(`m37.fw.item.${i.key}.title`), value: i.pct, suppressed: i.pct == null }))} />
          </div>
        </Section>
        <Section title={t('m37.fwc.distTitle')} description={t('m37.fwc.distIntro')}>
          <div data-testid="m37-fwc-dist">
            <BarChart title={t('m37.fwc.distTitle')} data={d.distribution.map((x) => ({ label: t('m37.fwc.itemsHeld', { n: f.num(x.met) }), value: x.n, suppressed: x.n == null }))} />
          </div>
        </Section>
      </div>

      <Section title={t('m37.fwc.famTitle')} description={t('m37.fwc.famIntro', { min: 10 })}>
        <div data-testid="m37-fwc-families">
          {d.families.length ? (
            <Heatmap title={t('m37.fwc.famTitle')} rows={d.families.map((x) => x.family_id)} cols={[...WALLET_ITEMS]}
              rowLabel={(id) => fam(id)} colLabel={(k) => t(`m37.fw.item.${k}.short`)}
              value={(row, col) => { const x = d.families.find((y) => y.family_id === row)!; const v = x.items[col as keyof typeof x.items]; return v == null ? { v: null, suppressed: true } : { v, tone: v >= (tv?.pct ?? 60) ? 'ok' : 'info', label: f.pct(v) }; }} />
          ) : <EmptyState title={t('m37.fwc.famNone')} />}
        </div>
      </Section>

      {tv && <TargetCard tv={tv}><History tv={tv} /></TargetCard>}
      {s.can('workforce_strategy', ['A']) && <SetTarget tv={tv} />}
      {!s.can('workforce_strategy', ['A']) && <p className="text-[12.5px] text-ink-3" data-testid="m37-fwc-who-sets"><Icon name="lock" size={12} /> {t('m37.fwc.whoSets')}</p>}
    </div>
  );
}

function History({ tv }: { tv: TargetView }) {
  const t = useT();
  const f = useFormat();
  if (!tv.history.length) return <p className="text-[12.5px] text-ink-3" data-testid="m37-fwc-history">{t('m37.fwc.historyNone')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]" data-testid="m37-fwc-history">
        <caption className="caps text-start text-[10.5px] text-ink-3">{t('m37.fwc.historyTitle')}</caption>
        <thead><tr className="text-ink-3"><th className="text-start">{t('m37.fwc.col.version')}</th><th className="text-end">{t('m37.fwc.col.value')}</th><th className="text-start">{t('m37.fwc.col.due')}</th><th className="text-start">{t('m37.fwc.col.setAt')}</th></tr></thead>
        <tbody>{[...tv.history].reverse().map((h: Row) => (
          <tr key={h.version} className="border-t border-line">
            <td className="num">{f.num(h.version)}</td><td className="num text-end">{f.pct(Number(h.pct), 0)}</td><td>{f.date(h.due_on)}</td><td>{f.date(String(h.set_at).slice(0, 10))}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}

function SetTarget({ tv }: { tv: TargetView | null }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [x, setX] = useState({ pct: String(tv?.pct ?? 60), due_on: tv?.due_on ?? '2027-12-31', note_en: '', note_ar: '' });
  const [confirm, setConfirm] = useState(false);
  const input = { pct: Number(x.pct), due_on: x.due_on, note_en: x.note_en, note_ar: x.note_ar };
  const problem = targetProblem(input, todayIso());
  const unchanged = !!tv && tv.pct === input.pct && tv.due_on === input.due_on;
  return (
    <Section title={t('m37.fwc.setTitle')} description={t('m37.fwc.setIntro')}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m37-fwc-set" data-problem={problem ?? ''}>
        <TextField name="m37-fwc-pct" label={t('m37.fwc.pct')} type="number" value={x.pct} onChange={(v) => setX({ ...x, pct: v })} />
        <TextField name="m37-fwc-due" label={t('m37.fwc.due')} type="date" value={x.due_on} onChange={(v) => setX({ ...x, due_on: v })} />
        <TextArea name="m37-fwc-note-en" label={t('m37.fwc.noteEn')} value={x.note_en} onChange={(v) => setX({ ...x, note_en: v })} rows={3} />
        <TextArea name="m37-fwc-note-ar" label={t('m37.fwc.noteAr')} value={x.note_ar} onChange={(v) => setX({ ...x, note_ar: v })} rows={3} />
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <button type="button" className="btn-primary btn-sm" disabled={!!problem || unchanged} onClick={() => setConfirm(true)} data-testid="m37-fwc-save">{t('m37.fwc.save')}</button>
          {problem && (x.note_en || x.note_ar) && <span className="text-[12.5px] text-bad" data-testid="m37-fwc-problem">{t(`m37.fwc.problem.${problem}`)}</span>}
          {unchanged && <span className="text-[12.5px] text-ink-3">{t('m37.fwc.unchanged')}</span>}
        </div>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m37.fwc.confirmTitle')}
        consequence={t('m37.fwc.confirmBody', { pct: x.pct, date: x.due_on })}
        onConfirm={async () => { const r = await run(() => repo.rpc.setWalletTarget(input)); setConfirm(false); if (r.ok) setX({ ...x, note_en: '', note_ar: '' }); }} />
    </Section>
  );
}
