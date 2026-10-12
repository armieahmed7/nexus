// FS58/FS59 shared UI (M33 Human Skills Studio, FS wave F · E5): the practice-scale card with the PIAAC context line, band pills, dimension
// bars, role-play kind labels, the published rubric (what each criterion looks for, in the reader's language) and the per-turn ticks.
// Module-local; FS58/FS59 pages import from here.
import { useEffect, useState } from 'react';
import { useLang, useFormat, usePick, useT } from '../../i18n';
import { BenchmarkLine, Icon, Modal, StatusPill } from '../../ui';
import { APS_BANDS, APS_DIMS, type ApsBand, type ApsDim, type ApsDimScore } from './aps';
import type { CriterionResult, RpCriterion } from './roleplay';
import type { Row } from './ui';

export const FS58_IDS = ['OECD-PIAAC', 'IAEA-1917'];
export const FS59_IDS = ['SKILLS-TECH', 'IAEA-1917'];
export const BAND_TONE: Record<ApsBand, 'neutral' | 'info' | 'ok' | 'sim'> = { emerging: 'sim', developing: 'info', adaptive: 'ok', strategic: 'ok' };
export const KIND_ICON: Record<string, string> = {
  pre_job_brief: 'check', shift_turnover: 'users', raise_concern: 'alert', regulator_interview: 'book', knowledge_transfer: 'sparkle', ai_peer_coaching: 'chat',
};

export function BandPill({ band, testId }: { band: ApsBand | string | null | undefined; testId?: string }) {
  const t = useT();
  if (!band) return null;
  return <span data-testid={testId} data-band={band}><StatusPill tone={BAND_TONE[band as ApsBand] ?? 'neutral'}>{t(`m33.aps.band.${band}`)}</StatusPill></span>;
}

/** The practice scale (0-100, four bands), why it is not the PIAAC scale, and the PIAAC line as context only. */
export function ScaleCard({ score, testId = 'm33-aps-scale' }: { score?: number | null; testId?: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="space-y-3" data-testid={testId}>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t('m33.aps.scale.title')}>
        {APS_BANDS.map((b) => {
          const on = score != null && score >= b.min && score <= b.max;
          return (
            <li key={b.id} className={`rounded-card border p-2 text-[12.5px] ${on ? 'border-accent bg-accent-soft' : 'border-line bg-panel'}`} data-band={b.id} data-on={on ? 'yes' : 'no'}>
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold">{t(`m33.aps.band.${b.id}`)}</span>
                <span className="num text-[11px] text-ink-3">{f.num(b.min)}–{f.num(b.max)}</span>
              </div>
              <p className="mt-1 text-ink-2">{t(`m33.aps.bandSub.${b.id}`)}</p>
            </li>
          );
        })}
      </ol>
      <p className="text-[12px] text-ink-3">{t('m33.aps.scale.note')}</p>
      <div className="rounded-card border border-dashed border-line p-3" data-testid="m33-aps-piaac">
        <BenchmarkLine max={500} label={t('m33.aps.scale.piaacLine')} benchmark={{ id: 'OECD-PIAAC', figure: 'aps_oecd_average' }} />
        <p className="mt-1 text-[12px] text-ink-3">{t('m33.aps.scale.piaacNote')}</p>
      </div>
    </div>
  );
}

export function DimBars({ dims, testId = 'm33-aps-dims' }: { dims: Record<ApsDim, ApsDimScore> | Record<string, ApsDimScore>; testId?: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <ul className="space-y-2" data-testid={testId}>
      {APS_DIMS.map((d) => {
        const v = (dims as Record<string, ApsDimScore>)[d];
        const pct = v?.pct ?? null;
        return (
          <li key={d} data-dim={d}>
            <div className="flex items-center justify-between text-[12.5px]"><span>{t(`m33.aps.dim.${d}`)}</span><span className="num font-semibold">{pct == null ? '—' : `${f.num(pct)}%`}</span></div>
            <div className="mt-1 h-2 rounded-full bg-sunken" aria-hidden="true"><div className="h-2 rounded-full bg-[rgb(var(--accent))]" style={{ width: `${pct ?? 0}%` }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

/** The cue words a criterion looks for, in the reader's script ("escalat*" shown as "escalat…"). */
export function cueList(c: RpCriterion, lang: string): string[] {
  const cues = c.check.type === 'cues' ? c.check.cues ?? [] : [];
  const ar = (s: string) => /[؀-ۿ]/.test(s);
  const mine = cues.filter((q) => (lang === 'ar' ? ar(q) : !ar(q)));
  return (mine.length ? mine : cues).map((q) => q.replace(/\*\s*$/, '…'));
}

export function CheckText({ c }: { c: RpCriterion }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  if (c.check.type === 'cues') {
    const list = cueList(c, lang);
    return (
      <span className="text-[12px] text-ink-3">
        {t(Number(c.check.min ?? 1) > 1 ? 'm33.rp.check.cuesMin' : 'm33.rp.check.cues', { n: f.num(Number(c.check.min ?? 1)) })}{' '}
        <span className="inline-flex flex-wrap gap-1 align-middle">{list.slice(0, 8).map((q) => <span key={q} className="chip border-line bg-sunken normal-case tracking-normal text-ink-2">{q}</span>)}{list.length > 8 && <span>…</span>}</span>
      </span>
    );
  }
  if (c.check.type === 'length') return <span className="text-[12px] text-ink-3">{t('m33.rp.check.length', { min: f.num(Number(c.check.min)), max: f.num(Number(c.check.max)) })}</span>;
  return <span className="text-[12px] text-ink-3">{t(`m33.rp.check.${c.check.type}`)}</span>;
}

/** The published rubric of a scenario, in the reader's language. */
export function RubricList({ rubric, testId = 'm33-rp-rubric', compact }: { rubric: RpCriterion[]; testId?: string; compact?: boolean }) {
  const pick = usePick();
  return (
    <ol className="space-y-2" data-testid={testId}>
      {rubric.map((c, i) => (
        <li key={c.id} className="rounded-card border border-line bg-panel p-2.5" data-criterion={c.id}>
          <div className="flex items-start gap-2">
            <span className="num mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] text-eyebrow">{i + 1}</span>
            <div className="min-w-0 space-y-0.5">
              <div className="text-[13px] font-semibold">{pick(c as unknown as Row, 'label')}</div>
              {!compact && <p className="text-[12.5px] text-ink-2">{pick(c as unknown as Row, 'desc')}</p>}
              <CheckText c={c} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The ticks for one answer: every criterion met or not, with the tip when it is not. */
export function Ticks({ results, rubric, testId = 'm33-rp-ticks' }: { results: CriterionResult[]; rubric: RpCriterion[]; testId?: string }) {
  const t = useT();
  const pick = usePick();
  return (
    <ul className="space-y-1.5" data-testid={testId}>
      {results.map((r) => {
        const c = rubric.find((x) => x.id === r.id);
        return (
          <li key={r.id} className="flex items-start gap-2 text-[13px]" data-testid="m33-rp-tick" data-pass={r.pass ? 'yes' : 'no'}>
            <Icon name={r.pass ? 'check' : 'alert'} size={14} className={`mt-0.5 shrink-0 ${r.pass ? 'text-ok' : 'text-sim'}`} />
            <span className="min-w-0">
              <span className="font-semibold">{c ? pick(c as unknown as Row, 'label') : r.id}</span>
              <span className="sr-only"> · {r.pass ? t('m33.rp.met') : t('m33.rp.notMet')}</span>
              {!r.pass && c && <span className="block text-ink-3">{pick(c as unknown as Row, 'tip')}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function KindTag({ kind }: { kind: string }) {
  const t = useT();
  return (
    <span className="chip max-w-full border-line bg-panel normal-case tracking-normal text-ink-2" data-kind={kind}>
      <Icon name={KIND_ICON[kind] ?? 'chat'} size={12} className="text-accent" /> {t(`m33.rp.kind.${kind}`)}
    </span>
  );
}

export function ReviewTag({ status }: { status: string }) {
  const t = useT();
  if (!status || status === 'none') return null;
  const tone = status === 'validated' ? 'ok' : status === 'requested' ? 'info' : status === 'declined' ? 'sim' : 'neutral';
  return <span data-testid="m33-rp-review" data-status={status}><StatusPill tone={tone}>{t(`m33.rp.review.${status}`)}</StatusPill></span>;
}

/** Training manager's scenario editor (FS58/FS59 banks): the scenario as structured JSON (every text in EN and AR), re-checked here with
 *  the same rule function the server runs, so a problem shows before saving. The server re-checks and audits every save. */
export function ScenarioEditor({ open, title, initial, problemOf, onClose, onSave, testId }: {
  open: boolean; title: string; initial: Record<string, unknown> | null; problemOf: (x: Record<string, unknown>) => string | null;
  onClose: () => void; onSave: (x: Record<string, unknown>) => Promise<boolean>; testId: string;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && initial) setText(JSON.stringify(initial, null, 2)); }, [open, initial]);
  let parsed: Record<string, unknown> | null = null;
  let problem: string | null = null;
  try { const v = JSON.parse(text); if (v && typeof v === 'object' && !Array.isArray(v)) parsed = v as Record<string, unknown>; else problem = t('m33.edit.json'); } catch { problem = t('m33.edit.json'); }
  if (parsed && !problem) problem = problemOf(parsed);
  return (
    <Modal open={open} onClose={onClose} size="lg" title={title}
      footer={<div className="flex flex-wrap items-center justify-end gap-2">
        {problem && <span className="me-auto text-[12.5px] text-bad" data-testid={`${testId}-problem`}>{problem}</span>}
        <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary" disabled={!!problem || busy} onClick={async () => { if (!parsed) return; setBusy(true); try { if (await onSave(parsed)) onClose(); } finally { setBusy(false); } }} data-testid={`${testId}-save`}>{t('m33.edit.save')}</button>
      </div>}>
      <div className="space-y-2" data-testid={testId}>
        <p className="text-[12.5px] text-ink-2">{t('m33.edit.help')}</p>
        <label htmlFor={`${testId}-json`} className="sr-only">{title}</label>
        <textarea id={`${testId}-json`} dir="ltr" className="input min-h-[420px] font-mono text-[12px]" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} data-testid={`${testId}-json`} />
      </div>
    </Modal>
  );
}
