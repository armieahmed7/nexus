// FS31 /training/credentials/strategic: the strategic tier. Report (training manager, HR, auditors): holders of each strategic
// credential against internal moves in the last 365 days (completed gigs, rotation placements), next to the staff baseline:
// a correlation, never a cause; groups under 10 suppressed. Framework owners (frameworks W/A) move a credential into or out of the
// tier (with a reason; ledger) and name it on the gigs and rotations it unlocks (security placements refused).
import { useState } from 'react';
import { Page, Async, BenchmarkChips, Callout, Card, ConfirmDialog, DataTable, EmptyState, Grid, Section, SelectField, StatTile, TextField, StatusPill, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat } from '../../i18n';
import { useSession } from '../../auth/session';
import type { StrategicReport } from './backend/rpc';
import type { ReportRow, UnlockRow } from './futureCreds';
import { FC_RULES } from './futureCreds';
import type { DefRow } from './microcred';
import { StrategicChip } from './fcUi';
import { McMedal } from './mcUi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function StrategicTierPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const owner = s.can('frameworks', ['W', 'A']);
  const q = useQuery(['microcred_defs', 'microcred_unlocks', 'microcred_awards', 'opportunities', 'rotation_templates'], async () => {
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const [report, defs, unlocks, opportunities, rotations] = await Promise.all([
      repo.rpc.strategicReport(), repo.list('microcred_defs', { filter: { status: 'current' }, order: [['sort', 'asc']] }), safe(repo.list('microcred_unlocks')), safe(repo.list('opportunities')), safe(repo.list('rotation_templates')),
    ]);
    return { report, defs: defs as unknown as DefRow[], unlocks: unlocks as unknown as UnlockRow[], opportunities, rotations };
  }, []);
  return (
    <Page title={t('m17.routes.training-credentials-strategic.title')} eyebrow={<BenchmarkChips feature="FS31" />} intro={t('m17.fc.adm.intro')} wide>
      <Callout tone="sim" title={t('m17.fc.adm.corrTitle')}>{t('m17.fc.adm.corrBody', { days: FC_RULES.reportWindowDays })}</Callout>
      <Async state={q}>{(d) => (
        <div className="space-y-6">
          {d.report.allowed ? <Report r={d.report} /> : <EmptyState title={t('m17.fc.adm.reportForbidden')}>{t('m17.fc.adm.reportForbiddenBody')}</EmptyState>}
          <Tier defs={d.defs} owner={owner} />
          <Unlocks d={d} owner={owner} />
        </div>
      )}</Async>
    </Page>
  );
}

function Report({ r }: { r: StrategicReport }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const max = Math.max(1, ...r.rows.map((x) => x.rate ?? 0), r.baseline.rate ?? 0);
  return (
    <Section title={t('m17.fc.adm.reportTitle')} description={t('m17.fc.adm.reportBody')}>
      <Grid cols={3}>
        <StatTile label={t('m17.fc.adm.baseline')} value={r.baseline.suppressed ? '—' : f.pct(r.baseline.rate)} sub={r.baseline.suppressed ? t('m17.fc.adm.suppressed') : t('m17.fc.adm.baselineSub', { moved: f.num(r.baseline.moved), people: f.num(r.baseline.people) })} />
        <StatTile label={t('m17.fc.adm.tierN')} value={f.num(r.rows.length)} sub={t('m17.fc.adm.tierNSub')} />
        <StatTile label={t('m17.fc.adm.shown')} value={f.num(r.rows.filter((x) => !x.suppressed).length)} sub={t('m17.fc.adm.shownSub')} tone="info" />
      </Grid>
      <Card className="mt-3">
        <ul className="space-y-3" data-testid="m17-fc-report">
          {[...r.rows, null].map((x) => {
            const row = x as ReportRow | null;
            const rate = row ? row.rate : r.baseline.rate;
            const sup = row ? row.suppressed : r.baseline.suppressed;
            return (
              <li key={row?.code ?? 'baseline'} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,16rem)_1fr_auto]" data-code={row?.code ?? 'baseline'} data-suppressed={sup ? 'yes' : 'no'}>
                <span className="text-[13px] font-semibold">{row ? <>{pick(row, 'title')} <span className="num text-[11.5px] text-ink-3">{row.code}</span></> : t('m17.fc.adm.baselineRow')}</span>
                <span className="h-3 rounded-full bg-sunken" aria-hidden>{!sup && rate != null && <span className={`block h-3 rounded-full ${row ? 'bg-accent' : 'bg-ink-3'}`} style={{ width: `${(100 * rate) / max}%` }} />}</span>
                <span className="text-end text-[12.5px] text-ink-2">{sup ? <StatusPill tone="neutral" status="suppressed">{t('m17.fc.adm.suppressedN')}</StatusPill> : t('m17.fc.adm.rateLine', { rate: f.pct(rate), moved: f.num(row ? row.moved : r.baseline.moved), n: f.num(row ? row.holders : r.baseline.people) })}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[12px] text-ink-3">{t('m17.fc.adm.reportNote')}</p>
      </Card>
    </Section>
  );
}

function Tier({ defs, owner }: { defs: DefRow[]; owner: boolean }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [sel, setSel] = useState<DefRow | null>(null);
  const micro = defs.filter((x) => x.kind === 'micro').sort((a, b) => Number(!!b.strategic) - Number(!!a.strategic) || a.code.localeCompare(b.code));
  return (
    <Section title={t('m17.fc.adm.tierTitle')} description={t(owner ? 'm17.fc.adm.tierBodyOwner' : 'm17.fc.adm.tierBody')}>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" data-testid="m17-fc-adm-tier">
        {micro.map((x) => (
          <Card key={x.id}>
            <div className="flex items-start gap-3" data-code={x.code} data-strategic={x.strategic ? 'yes' : 'no'}>
              <McMedal code={x.code} status={x.strategic ? 'active' : 'none'} size={44} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-[13.5px] font-semibold leading-snug">{pick(x, 'title')}</div>
                <div className="flex flex-wrap items-center gap-1.5">{x.strategic ? <StrategicChip /> : <span className="chip border-line text-ink-3">{t('m17.fc.adm.standard')}</span>}{x.strategic_since && <span className="text-[11.5px] text-ink-3">{t('m17.fc.tierSince', { date: f.date(x.strategic_since) })}</span>}</div>
                {x.strategic_note && <p className="text-[12px] italic text-ink-3">“{x.strategic_note}”</p>}
              </div>
              {owner && <button type="button" className="btn-ghost btn-sm" onClick={() => setSel(x)} data-testid="m17-fc-adm-toggle">{t(x.strategic ? 'm17.fc.adm.remove' : 'm17.fc.adm.addTier')}</button>}
            </div>
          </Card>
        ))}
      </div>
      <ConfirmDialog open={!!sel} onClose={() => setSel(null)} danger={!!sel?.strategic} requireReason reasonLabel={t('m17.fc.adm.reason')}
        title={t(sel?.strategic ? 'm17.fc.adm.removeTitle' : 'm17.fc.adm.addTitle', { code: sel?.code ?? '' })} consequence={t(sel?.strategic ? 'm17.fc.adm.removeBody' : 'm17.fc.adm.addBody')}
        onConfirm={async (reason) => { if (sel) await act(() => repo.rpc.setMicrocredStrategic(sel.code, !sel.strategic, reason)); }} />
    </Section>
  );
}

function Unlocks({ d, owner }: { d: { defs: DefRow[]; unlocks: UnlockRow[]; opportunities: Row[]; rotations: Row[] }; owner: boolean }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [flip, setFlip] = useState<UnlockRow | null>(null);
  const [form, setForm] = useState({ def_code: '', target_kind: 'opportunity', target_id: '', note_en: '', note_ar: '' });
  const [ask, setAsk] = useState(false);
  const title = (u: { target_kind: string; target_id: string }) => { const x = (u.target_kind === 'opportunity' ? d.opportunities : d.rotations).find((y) => y.id === u.target_id); return x ? pick(x, 'title') : u.target_id; };
  const defTitle = (code: string) => { const x = d.defs.find((y) => y.code === code); return x ? pick(x, 'title') : code; };
  const cols: Column<UnlockRow>[] = [
    { key: 'def', header: t('m17.fc.adm.col.credential'), value: (u) => u.def_code, sortable: true, render: (u) => <span><span className="font-semibold">{defTitle(u.def_code)}</span> <span className="num text-[11.5px] text-ink-3">{u.def_code}</span></span> },
    { key: 'kind', header: t('m17.fc.adm.col.kind'), value: (u) => u.target_kind, sortable: true, render: (u) => t(`m17.fc.kind.${u.target_kind}`) },
    { key: 'target', header: t('m17.fc.adm.col.target'), value: (u) => u.target_id, sortable: true, render: (u) => title(u) },
    { key: 'note', header: t('m17.fc.adm.col.note'), value: (u) => u.note_en, render: (u) => <span className="text-[12.5px] text-ink-2">{pick(u, 'note')}</span> },
    { key: 'active', header: t('m17.fc.adm.col.state'), value: (u) => (u.active ? 1 : 0), sortable: true, render: (u) => <StatusPill tone={u.active ? 'ok' : 'neutral'} status={u.active ? 'active' : 'off'}>{t(u.active ? 'm17.fc.adm.on' : 'm17.fc.adm.off')}</StatusPill> },
    ...(owner ? [{ key: 'act', header: '', value: () => '', render: (u: UnlockRow) => <button type="button" className="btn-ghost btn-sm" onClick={() => setFlip(u)} data-testid="m17-fc-adm-flip">{t(u.active ? 'm17.fc.adm.switchOff' : 'm17.fc.adm.switchOn')}</button> } as Column<UnlockRow>] : []),
  ];
  const strategic = d.defs.filter((x) => x.kind === 'micro' && x.strategic);
  const targets = form.target_kind === 'opportunity' ? d.opportunities.filter((o) => o.status === 'open') : d.rotations;
  const valid = form.def_code && form.target_id && form.note_en.trim().length >= FC_RULES.noteMin && form.note_ar.trim().length >= FC_RULES.noteMin;
  return (
    <Section title={t('m17.fc.adm.unlocksTitle')} description={t('m17.fc.adm.unlocksBody')}>
      {d.unlocks.length ? <div data-testid="m17-fc-adm-unlocks"><DataTable rows={d.unlocks} columns={cols} rowKey={(u) => u.id} searchable={false} csvName="strategic-credential-unlocks.csv" /></div> : <EmptyState title={t('m17.fc.adm.unlocksEmpty')} />}
      {owner && (
        <Card title={t('m17.fc.adm.addUnlock')} className="mt-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m17-fc-adm-form">
            <SelectField label={t('m17.fc.adm.col.credential')} name="def" value={form.def_code} onChange={(v) => setForm({ ...form, def_code: v })} placeholder={t('common.choose')} options={strategic.map((x) => ({ value: x.code, label: `${x.code} · ${pick(x, 'title')}` }))} required />
            <SelectField label={t('m17.fc.adm.col.kind')} name="kind" value={form.target_kind} onChange={(v) => setForm({ ...form, target_kind: v, target_id: '' })} options={[{ value: 'opportunity', label: t('m17.fc.kind.opportunity') }, { value: 'rotation', label: t('m17.fc.kind.rotation') }]} required />
            <SelectField label={t('m17.fc.adm.col.target')} name="target" value={form.target_id} onChange={(v) => setForm({ ...form, target_id: v })} placeholder={t('common.choose')} options={targets.map((x) => ({ value: x.id, label: pick(x, 'title') }))} required />
            <div className="md:col-span-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField label={t('m17.fc.adm.noteEn')} name="note_en" value={form.note_en} onChange={(v) => setForm({ ...form, note_en: v })} required />
              <TextField label={t('m17.fc.adm.noteAr')} name="note_ar" value={form.note_ar} onChange={(v) => setForm({ ...form, note_ar: v })} required />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2"><p className="text-[12px] text-ink-3">{t('m17.fc.adm.addNote')}</p><button type="button" className="btn-primary" disabled={!valid} onClick={() => setAsk(true)} data-testid="m17-fc-adm-save">{t('m17.fc.adm.save')}</button></div>
        </Card>
      )}
      <ConfirmDialog open={ask} onClose={() => setAsk(false)} title={t('m17.fc.adm.saveTitle')} consequence={t('m17.fc.adm.saveBody', { code: form.def_code, target: form.target_id ? title(form) : '' })}
        onConfirm={async () => { const r = await act(() => repo.rpc.setCredentialUnlock({ ...form, active: true })); if (r.ok) setForm({ def_code: '', target_kind: 'opportunity', target_id: '', note_en: '', note_ar: '' }); }} />
      <ConfirmDialog open={!!flip} onClose={() => setFlip(null)} danger={!!flip?.active} title={t(flip?.active ? 'm17.fc.adm.offTitle' : 'm17.fc.adm.onTitle')} consequence={t(flip?.active ? 'm17.fc.adm.offBody' : 'm17.fc.adm.onBody')}
        onConfirm={async () => { if (flip) await act(() => repo.rpc.setCredentialUnlock({ id: flip.id, def_code: flip.def_code, target_kind: flip.target_kind, target_id: flip.target_id, note_en: flip.note_en, note_ar: flip.note_ar, active: !flip.active })); }} />
    </Section>
  );
}
