// FS36 /workspace/ai-literacy-pack (admin / AI governance, auditors, HR): the exportable compliance-style pack of the AI-literacy register.
// Built from the rows the caller may read and rpc.aiLiteracyCoverage (buildPack in register.ts). The pack itself states that Kafa'a is
// not a regulator and that the alignment with the EU AI Act Article 4 practice repository is voluntary; it never claims compliance.
// Downloads: JSON (the pack), CSV (one row per user group) and a print view.
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, Icon, SourceLink, downloadText, toCsv, type Column } from '../../ui';
import { useBenchmarks } from '../../data/useBenchmarks';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { buildPack, packRows, type Pack } from './register';
import { CoverageBar, MaturityPill, RoleChip, useRegister, type RegisterData } from './fs36ui';
import type { Row } from './ui';

export default function PackPage() {
  const t = useT();
  const q = useRegister();
  const b = useBenchmarks();
  return (
    <Page title={t('m29.routes.workforce-ai-pack.title')} intro={t('m29.pack.intro')} wide eyebrow={<BenchmarkChips feature="FS36" />}>
      <Async state={q}>{(d) => (d.systems.length ? <Body d={d} bench={(b.data ?? []) as unknown as Row[]} /> : <EmptyState title={t('m29.reg.none')} />)}</Async>
    </Page>
  );
}

function makePack(d: RegisterData, bench: Row[]): Pack {
  const systems = d.systems.filter((s) => s.status !== 'retired').map((s) => ({
    id: s.id, name_en: s.name_en, name_ar: s.name_ar, ai_role: s.ai_role, use_class: s.use_class, maturity: s.maturity, simulated: !!s.simulated, owner_en: s.owner_en, owner_ar: s.owner_ar,
    measures: s.measures ?? [], review_due: s.review_due ? String(s.review_due).slice(0, 10) : null, version: Number(s.version),
    groups: d.groups.filter((g) => g.system_id === s.id).map((g) => ({ id: g.id, label_en: g.label_en, label_ar: g.label_ar, side: g.side, required_rung: Number(g.required_rung), required_cells: [...(g.required_cells ?? [])] })),
  }));
  const aligned = ['AI-LIT', 'UAE-AI'].map((id) => ({ id, url: String((bench.find((x) => x.id === id)?.urls ?? [])[0] ?? '') })).filter((x) => x.url);
  return buildPack(systems, d.cov ?? null, todayIso(), aligned);
}

function Body({ d, bench }: { d: RegisterData; bench: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const pack = makePack(d, bench);
  const rows = packRows(pack);
  const cols: Column<Record<string, string | number | null>>[] = Object.keys(rows[0] ?? {}).map((k) => ({ key: k, header: k, value: (r) => r[k] ?? '' }));
  return (
    <div className="space-y-6" data-testid="m29-pack">
      <Callout tone="sim" title={t('m29.pack.statementTitle')}>
        <span data-testid="m29-pack-statement" data-not-regulator={String(pack.not_a_regulator)} data-voluntary={String(pack.voluntary_alignment)}>{lang === 'ar' ? pack.statement_ar : pack.statement_en}</span>
      </Callout>
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" className="btn-primary btn-sm" data-testid="m29-pack-json" onClick={() => downloadText(`kafaa-ai-literacy-pack-${pack.generated_on}.json`, JSON.stringify(pack, null, 2), 'application/json')}><Icon name="download" size={14} /> {t('m29.pack.json')}</button>
        <button type="button" className="btn-outline btn-sm" data-testid="m29-pack-csv" onClick={() => downloadText(`kafaa-ai-literacy-pack-${pack.generated_on}.csv`, toCsv(rows, cols))}><Icon name="download" size={14} /> {t('m29.pack.csv')}</button>
        <button type="button" className="btn-outline btn-sm" data-testid="m29-pack-print" onClick={() => window.print()}>{t('m29.pack.print')}</button>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label={t('m29.pack.generated')} value={f.date(pack.generated_on)} />
        <StatTile label={t('m29.pack.systems')} value={f.num(pack.systems.length)} />
        <StatTile label={t('m29.pack.groups')} value={f.num(rows.length)} />
        <StatTile label={t('m29.reg.tile.overall')} value={pack.overall ? (pack.overall.pct == null ? t('common.suppressedShort') : f.pct(pack.overall.pct)) : '—'} tone="info" />
      </div>
      <Card title={t('m29.pack.aligned')} eyebrow={t('m29.pack.alignedEyebrow')}>
        <ul className="space-y-1 text-[13px]" data-testid="m29-pack-aligned">
          {pack.aligned_with.map((a) => { const r = bench.find((x) => x.id === a.id); return <li key={a.id}><SourceLink href={a.url} date={r?.as_of ? String(r.as_of) : null}>{r ? pick(r, 'name') : a.id}</SourceLink></li>; })}
        </ul>
      </Card>
      <Section title={t('m29.pack.entries')}>
        <ol className="space-y-3" data-testid="m29-pack-systems">
          {pack.systems.map((s, i) => (
            <li key={s.id} className="card p-4 break-inside-avoid">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold"><span className="num text-ink-3">{f.num(i + 1)}.</span> {pick(s as unknown as Row, 'name')}</span>
                <span className="flex flex-wrap gap-1.5"><RoleChip role={s.ai_role} /><MaturityPill maturity={s.maturity} /></span>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-3">{t('m29.reg.owner')}: {pick(s as unknown as Row, 'owner')} · {t(`m29.reg.use.${s.use_class}`)} · {t('m29.sys.version')} {f.num(s.version)}{s.simulated ? ` · ${t('m29.reg.simulated')}` : ''}</p>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <h3 className="caps mb-1">{t('m29.pack.groupsCov')}</h3>
                  <ul className="space-y-2 text-[13px]">
                    {s.groups.map((g) => { const gc = s.coverage?.groups.find((x) => x.group_id === g.id); return (
                      <li key={g.id}><span className="font-semibold">{pick(g as unknown as Row, 'label')}</span> <span className="text-ink-3">· {t(`m29.reg.side.${g.side}`)} · {t('m29.pack.rung', { n: f.num(g.required_rung) })}</span>
                        <CoverageBar c={s.coverage ? gc ?? null : undefined} label={pick(g as unknown as Row, 'label')} compact /></li>
                    ); })}
                  </ul>
                </div>
                <div>
                  <h3 className="caps mb-1">{t('m29.sys.measures')}</h3>
                  <ul className="list-disc space-y-0.5 ps-4 text-[13px]">{s.measures.map((m, k) => <li key={k}>{pick(m as unknown as Row, 'title')}</li>)}</ul>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
