// M27 (F30) shared pieces: statement sentence, result chips, provenance ("Why is this here?"), the xAPI 2.0 JSON view, the learning
// mix summary, the statement timeline and the emitter registry. Every label comes from m27.* in both languages.
import { useMemo, useState, type ReactNode } from 'react';
import { Card, Donut, BarChart, Drawer, Grid, KeyValue, StatTile, StatusPill, Timeline, WhyThis, Icon, type PillTone } from '../../ui';
import { useT, useLang, useFormat, L } from '../../i18n';
import type { Reason } from '../../domain/engines/types';
import { EMITTERS, isoTs, summarise, toXapi, durationMinutes, type Source, type StatementRow } from './xapi';
import type { PersonLabel } from './backend/rpc';

export const SOURCE_TONE: Record<Source, PillTone> = {
  m04_course: 'accent', f14_refresher: 'info', f08_opportunity: 'ok', f15_rotation: 'ok', f15_shadowing: 'ok', m05_jpm: 'reserved',
  f13_mentoring: 'sim', f21_knowledge: 'neutral', f28_simulator: 'accent', f38_ojt: 'reserved', console: 'bad',
};
const VERB_TONE: Record<string, PillTone> = { completed: 'ok', passed: 'ok', failed: 'bad', answered: 'info', attended: 'accent', experienced: 'accent', attempted: 'neutral', progressed: 'neutral' };

/** Rows from SQL carry "+00:00" timestamps, rows from the LocalBackend "Z": normalise once. */
export function normRow(r: StatementRow): StatementRow {
  return { ...r, occurred_at: isoTs(r.occurred_at), stored_at: isoTs(r.stored_at) };
}

export function useObjectName() {
  const lang = useLang();
  return (r: Pick<StatementRow, 'object_name' | 'object_id'>) => {
    const n = (r.object_name ?? {}) as Record<string, string>;
    return (lang === 'ar' ? n.ar || n.en : n.en || n.ar) || r.object_id;
  };
}
export function usePersonName(people: PersonLabel[] | undefined) {
  const lang = useLang();
  const map = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);
  return (id: string) => {
    const p = map.get(id);
    return p ? (lang === 'ar' && p.name_ar ? p.name_ar : p.name) : id;
  };
}

export function VerbChip({ verb }: { verb: string }) {
  const t = useT();
  return <StatusPill tone={VERB_TONE[verb] ?? 'neutral'}>{t(`m27.verb.${verb}`)}</StatusPill>;
}
export function SourceChip({ source }: { source: Source }) {
  const t = useT();
  return <StatusPill tone={SOURCE_TONE[source] ?? 'neutral'}>{t(`m27.source.${source}`)}</StatusPill>;
}

/** Success / score / duration chips for a statement result. */
export function ResultBits({ result }: { result: StatementRow['result'] }) {
  const t = useT();
  const f = useFormat();
  if (!result) return <span className="text-[12px] text-ink-3">{t('m27.result.none')}</span>;
  const r = result as { success?: boolean; completion?: boolean; score?: { scaled?: number; raw?: number; max?: number }; duration?: string };
  const mins = durationMinutes(r.duration);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {r.success === true && <StatusPill tone="ok">{t('m27.result.success')}</StatusPill>}
      {r.success === false && <StatusPill tone="bad">{t('m27.result.notSuccess')}</StatusPill>}
      {r.success === undefined && r.completion && <StatusPill tone="neutral">{t('m27.result.completion')}</StatusPill>}
      {r.score?.scaled != null && <span className="chip border-line text-ink-2"><bdi dir="ltr">{f.pct(r.score.scaled * 100, 0)}</bdi></span>}
      {mins > 0 && <span className="chip border-line text-ink-2">{mins >= 60 ? t('m27.result.hours', { n: f.num(Math.round((mins / 60) * 10) / 10) }) : t('m27.result.minutes', { n: f.num(mins) })}</span>}
    </span>
  );
}

/** "Completed · Course · General Employee Training" */
export function StatementSentence({ row, who }: { row: StatementRow; who?: ReactNode }) {
  const t = useT();
  const name = useObjectName();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {who && <span className="font-semibold">{who}</span>}
      <VerbChip verb={row.verb} />
      <span className="text-[12px] text-ink-3">{t(`m27.type.${row.object_type}`)}</span>
      <span className="font-semibold">{name(row)}</span>
    </span>
  );
}

/** Provenance reasons for <WhyThis>: which emitter wrote it, from which record, the profile check, append-only storage. */
export function provenance(row: StatementRow): Reason[] {
  const ext = ((row.context ?? {}) as { extensions?: Record<string, unknown> }).extensions ?? {};
  const rec = Object.entries(ext).find(([k]) => k.endsWith('/ext/record'))?.[1];
  const out: Reason[] = [{ code: 'source', key: `m27.reasons.src.${row.source}` }];
  if (typeof rec === 'string') out.push({ code: 'record', key: 'm27.reasons.record', vars: { ref: rec }, ref: { table: rec.split('/')[0], id: rec.split('/').slice(1).join('/') } });
  if (row.source === 'f14_refresher') out.push({ code: 'no_item', key: 'm27.reasons.noItem' });
  out.push({ code: 'profile', key: 'm27.reasons.profile' });
  out.push({ code: 'stored', key: 'm27.reasons.stored', vars: { date: isoTs(row.stored_at).slice(0, 10) } });
  return out;
}

export function StatementDetail({ row, who }: { row: StatementRow; who?: string }) {
  const t = useT();
  const f = useFormat();
  const name = useObjectName();
  const json = useMemo(() => JSON.stringify(toXapi(row), null, 2), [row]);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4" data-testid="m27-statement">
      <div className="text-[15px]"><StatementSentence row={row} who={who} /></div>
      <KeyValue
        items={[
          [t('m27.detail.when'), f.dateTime(row.occurred_at)],
          [t('m27.detail.stored'), f.dateTime(row.stored_at)],
          [t('m27.detail.activity'), <span key="a">{name(row)} <span className="text-[12px] text-ink-3">({t(`m27.type.${row.object_type}`)})</span></span>],
          [t('m27.detail.result'), <ResultBits key="r" result={row.result} />],
          [t('m27.detail.source'), <SourceChip key="s" source={row.source} />],
          [t('m27.detail.id'), <bdi key="i" dir="ltr" className="font-mono text-[12px]">{row.id}</bdi>],
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <WhyThis reasons={provenance(row)} label={t('m27.detail.why')} testId="m27-why" />
        <StatusPill tone="neutral">{t('m27.detail.immutable')}</StatusPill>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="caps">{t('m27.detail.json')}</span>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(json).then(() => setCopied(true), () => setCopied(false));
            }}
          >
            {copied ? t('m27.detail.copied') : t('m27.detail.copy')}
          </button>
        </div>
        <pre dir="ltr" className="max-h-96 overflow-auto rounded-card border border-line bg-sunken p-3 text-start font-mono text-[11.5px] leading-5 text-ink-2" data-testid="m27-json">{json}</pre>
        <p className="mt-1 text-[12px] text-ink-3">{t('m27.detail.jsonNote')}</p>
      </div>
    </div>
  );
}

export function StatementDrawer({ row, who, onClose }: { row: StatementRow | null; who?: string; onClose: () => void }) {
  const t = useT();
  return (
    <Drawer open={!!row} onClose={onClose} title={t('m27.detail.title')} footer={row ? <L to={`/training/lrs/statements/${row.id}`} className="btn-outline btn-sm no-underline">{t('m27.detail.permalink')}</L> : null}>
      {row && <StatementDetail row={row} who={who} />}
    </Drawer>
  );
}

/** Statements, completions, learning time and the learning mix by source and by month. */
export function LearningMix({ rows }: { rows: StatementRow[] }) {
  const t = useT();
  const f = useFormat();
  const s = useMemo(() => summarise(rows), [rows]);
  const months = Object.keys(s.byMonth).sort().slice(-12);
  const sources = Object.entries(s.bySource).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m27.mix.statements')} value={f.num(s.statements)} sub={t('m27.mix.statementsSub')} />
        <StatTile label={t('m27.mix.completions')} value={f.num(s.completions)} sub={t('m27.mix.completionsSub')} tone="ok" />
        <StatTile label={t('m27.mix.hours')} value={f.num(Math.round(s.minutes / 6) / 10)} sub={t('m27.mix.hoursSub')} />
        <StatTile label={t('m27.mix.span')} value={s.first ? f.date(s.first, 'short') : '—'} sub={s.last ? t('m27.mix.spanSub', { date: f.date(s.last, 'short') }) : t('m27.mix.noData')} />
      </Grid>
      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Card title={t('m27.mix.bySource')}>
            <Donut title={t('m27.mix.bySource')} data={sources.map(([k, v]) => ({ label: t(`m27.source.${k}`), value: v }))} center={<span className="num text-[18px] font-semibold">{f.num(s.statements)}</span>} />
          </Card>
          <Card title={t('m27.mix.byMonth')}>
            <BarChart title={t('m27.mix.byMonth')} data={months.map((m) => ({ label: f.date(`${m}-01`, 'short').replace(/^\d+\s*/, ''), value: s.byMonth[m], tone: 'sky' }))} />
          </Card>
        </div>
      )}
    </>
  );
}

/** Statements grouped by month, newest first, each with its provenance and a JSON view. */
export function StatementTimeline({ rows, whoOf, onOpen, pageSize = 40 }: { rows: StatementRow[]; whoOf?: (id: string) => string; onOpen: (r: StatementRow) => void; pageSize?: number }) {
  const t = useT();
  const f = useFormat();
  const [n, setN] = useState(pageSize);
  const shown = rows.slice(0, n);
  const groups: [string, StatementRow[]][] = [];
  for (const r of shown) {
    const m = isoTs(r.occurred_at).slice(0, 7);
    const g = groups[groups.length - 1];
    if (g && g[0] === m) g[1].push(r);
    else groups.push([m, [r]]);
  }
  return (
    <div className="space-y-5" data-testid="m27-timeline">
      {groups.map(([m, list]) => (
        <section key={m} aria-label={f.date(`${m}-01`, 'long')}>
          <h3 className="caps mb-2">{new Intl.DateTimeFormat(f.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`))}</h3>
          <Timeline
            items={list.map((r) => ({
              id: r.id,
              tone: VERB_TONE[r.verb] ?? 'accent',
              when: f.dateTime(r.occurred_at),
              title: <StatementSentence row={r} who={whoOf ? whoOf(r.actor_person_id) : undefined} />,
              detail: (
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <ResultBits result={r.result} />
                  <SourceChip source={r.source} />
                  <WhyThis reasons={provenance(r)} label={t('m27.detail.whyShort')} testId="m27-why" />
                  <button type="button" className="btn-ghost btn-sm" onClick={() => onOpen(r)} data-testid="m27-open">
                    <Icon name="book" size={13} /> {t('m27.detail.open')}
                  </button>
                </span>
              ),
            }))}
          />
        </section>
      ))}
      {rows.length > n && (
        <button type="button" className="btn-outline btn-sm" onClick={() => setN(n + pageSize)} data-testid="m27-more">
          {t('m27.timeline.more', { n: f.num(rows.length - n) })}
        </button>
      )}
    </div>
  );
}

/** The emitter registry: which Kafa'a events write which statements; live, planned (F38) or the admin console. */
export function EmittersTable({ counts }: { counts?: Record<string, number | null> }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="overflow-x-auto" data-testid="m27-emitters">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-start">
            <th className="caps py-2 text-start">{t('m27.emit.col.event')}</th>
            <th className="caps py-2 text-start">{t('m27.emit.col.verbs')}</th>
            <th className="caps py-2 text-start">{t('m27.emit.col.object')}</th>
            <th className="caps py-2 text-start">{t('m27.emit.col.status')}</th>
            {counts && <th className="caps py-2 text-end">{t('m27.emit.col.count')}</th>}
          </tr>
        </thead>
        <tbody>
          {EMITTERS.map((e) => (
            <tr key={e.source} className="border-b border-line/60 align-top">
              <td className="py-2 pe-3">
                <div className="font-semibold">{t(`m27.source.${e.source}`)}</div>
                <div className="text-[12px] text-ink-3">{t(`m27.emit.event.${e.source}`)} · <bdi dir="ltr">{e.feature}</bdi></div>
              </td>
              <td className="py-2 pe-3"><span className="flex flex-wrap gap-1">{e.verbs.slice(0, 4).map((v) => <VerbChip key={v} verb={v} />)}{e.verbs.length > 4 && <span className="text-[12px] text-ink-3">+{f.num(e.verbs.length - 4)}</span>}</span></td>
              <td className="py-2 pe-3">{t(`m27.type.${e.object_type}`)}</td>
              <td className="py-2 pe-3"><StatusPill tone={e.status === 'live' ? 'ok' : e.status === 'planned' ? 'reserved' : 'sim'}>{t(`m27.emit.status.${e.status}`)}</StatusPill></td>
              {counts && <td className="num py-2 text-end">{counts[e.source] === undefined ? '—' : counts[e.source] === null ? t('common.suppressedShort') : f.num(counts[e.source] as number)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Small note shown on every LRS screen: a mirror of learning experiences, never a qualification decision. */
export function LrsMirrorNote() {
  const t = useT();
  return <p className="text-[12px] text-ink-3" data-testid="m27-mirror">{t('m27.common.mirror')}</p>;
}
