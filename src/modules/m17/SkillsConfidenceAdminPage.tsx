// FS03 /admin/skills-confidence · skill decay and confidence for engine owners. Current half-lives per decay class and the curves,
// the bands across the workforce by class and area (aggregate; cells naming fewer than 10 people suppressed), a what-if preview of
// other half-lives, the change (platform admins: rpc.setSkillHalfLives, confirmed, logged, ledgered, every state recomputed), the
// training manager's "recompute everyone", the micro-credential evidence back-fill status and the published method.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, ConfirmDialog, LineChart, StatTile, TextField, TextArea, StatusPill, WhyThis, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useT, useFormat, L } from '../../i18n';
import { DEFAULT_HALF_LIFE_MONTHS, type DecayClass } from '../../domain/skills';
import { BANDS, FS03_MSG, checkHalfLives, toWeights, type ConfidenceStats } from './decay';
import { BandChip, DecayClassCards, Fs03Benchmarks, MethodBanner, MethodCard } from './confidenceUi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const CLASSES: DecayClass[] = ['fast', 'standard', 'slow'];

export default function SkillsConfidenceAdminPage() {
  const t = useT();
  const repo = useRepo();
  const [preview, setPreview] = useState<Record<DecayClass, number> | null>(null);
  const stats = useQuery(['person_skills', 'engine_settings', 'engine_changes', 'skill_evidence', 'microcred_awards'],
    () => repo.rpc.skillConfidenceStats(preview ? toWeights(preview) : null), [JSON.stringify(preview)]);
  const ref = useQuery(['skill_decay_classes', 'engine_settings'], async () => {
    const [classes, settings] = await Promise.all([repo.list('skill_decay_classes', { order: [['sort', 'asc']] }), repo.list('engine_settings')]);
    return { classes, settings };
  });
  return (
    <Page title={t('m17.routes.admin-skills-confidence.title')} intro={t('m17.dk.admin.intro')} wide>
      <Async state={ref}>{(r) => (
        <Async state={stats}>{(s) => <AdminView s={s} classes={r.classes} settings={r.settings.find((x: Row) => x.id === 'skills') ?? null} preview={preview} setPreview={setPreview} />}</Async>
      )}</Async>
    </Page>
  );
}

function AdminView({ s, classes, settings, preview, setPreview }: { s: ConfidenceStats; classes: Row[]; settings: Row | null; preview: Record<DecayClass, number> | null; setPreview: (p: Record<DecayClass, number> | null) => void }) {
  const t = useT();
  const f = useFormat();
  const ses = useSession();
  const canChange = ses.can('integrations', ['A']);
  const canRecompute = ses.can('skills_profile', ['A']);
  const band = (b: string) => s.bands.find((x) => x.band === b);
  const counts = Object.fromEntries(s.classes.map((c) => [c.id, c.skills])) as Record<DecayClass, number>;
  const curve = (m: number) => Array.from({ length: 13 }, (_, i) => ({ x: f.num(i * 6), y: Math.round(Math.pow(0.5, (i * 6) / m) * 100) }));
  const series = [
    ...CLASSES.map((c) => ({ name: t('m17.dk.admin.curve', { cls: t(`m17.dk.class.${c}`), n: f.num(s.months[c]) }), points: curve(s.months[c]), tone: c === 'fast' ? 'bad' : c === 'slow' ? 'ok' : 'accent' })),
    ...(preview ? CLASSES.filter((c) => preview[c] !== s.months[c]).map((c) => ({ name: t('m17.dk.admin.curvePreview', { cls: t(`m17.dk.class.${c}`), n: f.num(preview[c]) }), points: curve(preview[c]), tone: 'sky', dashed: true })) : []),
  ];
  return (
    <div className="space-y-6">
      <MethodBanner settings={settings} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6" data-testid="m17-adm-tiles">
        {CLASSES.map((c) => (
          <StatTile key={c} label={t('m17.dk.admin.hlTile', { cls: t(`m17.dk.class.${c}`) })} value={t('m17.dk.months', { n: f.num(s.months[c]) })}
            sub={s.months[c] === DEFAULT_HALF_LIFE_MONTHS[c] ? t('m17.dk.admin.atDefault') : t('m17.dk.admin.default', { n: f.num(DEFAULT_HALF_LIFE_MONTHS[c]) })} tone={c === 'fast' ? 'sim' : undefined} />
        ))}
        <StatTile label={t('m17.dk.band.high')} value={band('high')?.states == null ? t('m17.dk.suppressed') : f.num(band('high')!.states)} tone="ok" sub={t('m17.dk.admin.statesOf', { n: band('high')?.people == null ? '—' : f.num(band('high')!.people) })} />
        <StatTile label={t('m17.dk.band.low')} value={band('low')?.states == null ? t('m17.dk.suppressed') : f.num(band('low')!.states)} tone="sim" sub={t('m17.dk.admin.statesOf', { n: band('low')?.people == null ? '—' : f.num(band('low')!.people) })} />
        <StatTile label={t('m17.dk.admin.ageing')} value={s.ageing.states == null ? t('m17.dk.suppressed') : f.num(s.ageing.states)} sub={t('m17.dk.admin.ageingSub')} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title={t('m17.dk.admin.curvesTitle')} eyebrow={t('m17.dk.admin.curvesEyebrow')}>
          <div data-testid="m17-adm-curves"><LineChart title={t('m17.dk.admin.curvesTitle')} height={200} yMin={0} yMax={100} unit="%" series={series} /></div>
          <ul className="mt-2 flex flex-wrap gap-3 text-[12px] text-ink-2">{series.map((x) => <li key={x.name}>{x.name}</li>)}</ul>
          <p className="mt-1 text-[12px] text-ink-3">{t('m17.dk.admin.curvesNote')}</p>
        </Card>
        <HalfLifeEditor s={s} canChange={canChange} preview={preview} setPreview={setPreview} />
      </div>

      {s.preview && <PreviewCard p={s.preview} />}

      <Section title={t('m17.dk.admin.distTitle')} description={t('m17.dk.admin.distIntro')}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title={t('m17.dk.admin.byClass')}>
            <BandTable rows={CLASSES.map((c) => ({ key: c, label: t(`m17.dk.class.${c}`), cells: s.by_class.filter((x) => x.cls === c) }))} testId="m17-adm-by-class" />
          </Card>
          <Card title={t('m17.dk.admin.byArea')}>
            <BandTable rows={[...new Set(s.by_area.map((x) => x.area))].map((a) => ({ key: a, label: t(`m17.dk.area.${a}`), cells: s.by_area.filter((x) => x.area === a) }))} testId="m17-adm-by-area" />
          </Card>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={t('m17.dk.admin.backfillTitle')} eyebrow={t('m17.dk.admin.backfillEyebrow')}>
          <div data-testid="m17-adm-backfill" data-missing={s.backfill.awards - s.backfill.with_evidence}>
            <p className="text-[13px] text-ink-2">{t('m17.dk.admin.backfillBody', { with: f.num(s.backfill.with_evidence), all: f.num(s.backfill.awards), rows: f.num(s.backfill.evidence_rows) })}</p>
            <div className="mt-2">{s.backfill.with_evidence === s.backfill.awards ? <StatusPill tone="ok">{t('m17.dk.admin.backfillDone')}</StatusPill> : <StatusPill tone="sim">{t('m17.dk.admin.backfillMissing', { n: f.num(s.backfill.awards - s.backfill.with_evidence) })}</StatusPill>}</div>
          </div>
          {canRecompute && <RecomputeAll />}
        </Card>
        <Card title={t('m17.dk.admin.lastTitle')} eyebrow={t('m17.dk.admin.lastEyebrow')}>
          {s.last_change ? (
            <div className="space-y-1 text-[13px]" data-testid="m17-adm-last">
              <div><span className="font-mono text-[12px]" dir="ltr">{s.last_change.id}</span> · {f.dateTime(s.last_change.changed_at)}</div>
              {s.last_change.rationale && <p className="text-ink-2">{s.last_change.rationale}</p>}
              <L to="/admin/ai-transparency">{t('m17.dk.admin.toLog')}</L>
            </div>
          ) : <p className="text-[13px] text-ink-3">{t('m17.dk.admin.noChange')}</p>}
        </Card>
      </div>

      <Section title={t('m17.dk.how.title')} description={t('m17.dk.admin.howIntro')}>
        <DecayClassCards classes={classes} months={s.months} counts={counts} />
        <Card title={t('m17.dk.methodCard.title')} eyebrow={t('m17.dk.methodCard.eyebrow')}><MethodCard /></Card>
        <Fs03Benchmarks />
      </Section>
    </div>
  );
}

function BandTable({ rows, testId }: { rows: { key: string; label: string; cells: { band: string; states: number | null; suppressed: boolean }[] }[]; testId: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" data-testid={testId}>
        <thead><tr className="border-b border-line"><th scope="col" className="caps py-1.5 text-start">{t('m17.dk.admin.group')}</th>{BANDS.map((b) => <th key={b} scope="col" className="caps py-1.5 text-end">{t(`m17.dk.band.${b}`)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line/60">
              <th scope="row" className="py-1.5 text-start font-normal">{r.label}</th>
              {BANDS.map((b) => {
                const c = r.cells.find((x) => x.band === b);
                return <td key={b} className="num py-1.5 text-end" data-suppressed={c?.suppressed ? 'yes' : 'no'}>{!c ? '—' : c.suppressed ? <span className="text-ink-3">{t('m17.dk.suppressed')}</span> : f.num(c.states)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HalfLifeEditor({ s, canChange, preview, setPreview }: { s: ConfidenceStats; canChange: boolean; preview: Record<DecayClass, number> | null; setPreview: (p: Record<DecayClass, number> | null) => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [v, setV] = useState<Record<DecayClass, string>>({ fast: String(s.months.fast), standard: String(s.months.standard), slow: String(s.months.slow) });
  const [why, setWhy] = useState('');
  const [confirm, setConfirm] = useState(false);
  const nums = useMemo(() => ({ fast: Number(v.fast), standard: Number(v.standard), slow: Number(v.slow) }), [v]);
  const chk = checkHalfLives({ ...nums, rationale: why });
  const hlOk = chk !== 'invalid_hl';
  const changed = CLASSES.some((c) => nums[c] !== s.months[c]);
  return (
    <Card title={t('m17.dk.admin.editTitle')} eyebrow={canChange ? t('m17.dk.admin.editEyebrow') : t('m17.dk.admin.readOnly')}>
      <div className="space-y-3" data-testid="m17-adm-editor">
        <div className="grid grid-cols-3 gap-2">
          {CLASSES.map((c) => (
            <TextField key={c} label={t('m17.dk.admin.field', { cls: t(`m17.dk.class.${c}`) })} name={`hl-${c}`} type="number" value={v[c]} onChange={(x: string) => setV({ ...v, [c]: x })} />
          ))}
        </div>
        {!hlOk && <p className="text-[12.5px] text-bad" role="alert" data-testid="m17-adm-invalid">{FS03_MSG.invalid_hl}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" disabled={!hlOk || !changed} onClick={() => setPreview(nums)} data-testid="m17-adm-preview"><Icon name="chart" size={14} /> {t('m17.dk.admin.preview')}</button>
          {preview && <button type="button" className="btn-ghost btn-sm" onClick={() => setPreview(null)}>{t('m17.dk.admin.clearPreview')}</button>}
        </div>
        {canChange ? (
          <>
            <TextArea label={t('m17.dk.admin.rationale')} name="hl-why" value={why} onChange={(x: string) => setWhy(x)} rows={2} hint={t('m17.dk.admin.rationaleHint')} />
            <button type="button" className="btn-primary" disabled={chk !== 'ok' || !changed} onClick={() => setConfirm(true)} data-testid="m17-adm-save">{t('m17.dk.admin.save')}</button>
            <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m17.dk.admin.confirmTitle')}
              consequence={t('m17.dk.admin.confirmBody', { fast: f.num(nums.fast), standard: f.num(nums.standard), slow: f.num(nums.slow) })} actingAs={t('m17.dk.admin.asAdmin')}
              onConfirm={async () => {
                const r = await run(() => repo.rpc.setSkillHalfLives({ ...nums, rationale: why.trim() }), { success: t('m17.dk.admin.saved') });
                if (r.ok) { setWhy(''); setPreview(null); }
              }} />
          </>
        ) : <p className="text-[12.5px] text-ink-3">{t('m17.dk.admin.onlyAdmins')}</p>}
      </div>
    </Card>
  );
}

function PreviewCard({ p }: { p: NonNullable<ConfidenceStats['preview']> }) {
  const t = useT();
  const f = useFormat();
  const n = (x: number | null) => (x == null ? t('m17.dk.suppressed') : f.num(x));
  return (
    <Card title={t('m17.dk.admin.previewTitle', { fast: f.num(p.months.fast), standard: f.num(p.months.standard), slow: f.num(p.months.slow) })} eyebrow={t('m17.dk.admin.previewEyebrow')}>
      <div className="space-y-3" data-testid="m17-adm-preview-card">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatTile label={t('m17.dk.admin.pChanged')} value={n(p.changed)} />
          <StatTile label={t('m17.dk.admin.pPeople')} value={n(p.people)} />
          <StatTile label={t('m17.dk.admin.pDown')} value={n(p.level_down)} tone="sim" />
          <StatTile label={t('m17.dk.admin.pUp')} value={n(p.level_up)} tone="ok" />
        </div>
        {p.transitions.length === 0 ? <p className="text-[13px] text-ink-3">{t('m17.dk.admin.pNone')}</p> : (
          <ul className="flex flex-wrap gap-2" data-testid="m17-adm-transitions">
            {p.transitions.map((x) => (
              <li key={`${x.from}-${x.to}`} className="flex items-center gap-1.5 rounded-card border border-line px-2 py-1 text-[12.5px]">
                <BandChip band={x.from} testId="m17-tr-from" /><Icon name="chevron" size={12} className="rtl:-scale-x-100" /><BandChip band={x.to} testId="m17-tr-to" />
                <span className="num">{x.suppressed ? t('m17.dk.suppressed') : f.num(x.states)}</span>
              </li>
            ))}
          </ul>
        )}
        <WhyThis reasons={[{ code: 'preview', key: 'm17.dk.why.preview', vars: { n: p.changed ?? 0 } }]} testId="m17-adm-preview-why" />
      </div>
    </Card>
  );
}

function RecomputeAll() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<{ states: number; digest: string } | null>(null);
  return (
    <div className="mt-3 border-t border-line pt-3">
      <button type="button" className="btn-outline btn-sm" onClick={() => setOpen(true)} data-testid="m17-adm-recompute"><Icon name="reset" size={14} /> {t('m17.dk.admin.recompute')}</button>
      {last && <p className="mt-1 text-[12px] text-ink-3" data-testid="m17-adm-recomputed">{t('m17.dk.admin.recomputed', { n: f.num(last.states), digest: last.digest.slice(0, 12) })}</p>}
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={t('m17.dk.admin.recompute')} consequence={t('m17.dk.admin.recomputeBody')} actingAs={t('m17.dk.admin.asTm')}
        onConfirm={async () => { const r = await run(() => repo.rpc.recomputeSkills(null), { success: t('m17.dk.admin.recomputeDone') }); if (r.ok && r.data) setLast({ states: r.data.states, digest: r.data.digest }); }} />
    </div>
  );
}
