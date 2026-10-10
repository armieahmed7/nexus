// FS03 /my/skills/confidence · "How sure are we": every skill with its band and interval, the multi-source record behind it (self,
// peers, manager or expert validation, assessment, work, qualification, training, credential, each dated with its provenance), how
// confidence would decay if nothing new were recorded (by the skill's decay class), and what would raise it. Own skills only
// (skills_profile Own); the numbers are the stored person_skills rows, the projection re-runs the same rule in the browser.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, Drawer, EmptyState, FilterBar, useFilters, LineChart, Donut, WhyThis, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useT, usePick, useFormat, L } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { decayModelFrom, skillReasons, type ConfidenceBand, type DecayClass, type Evidence } from '../../domain/skills';
import { usePassportData, LevelMeter, Stat, type PassportData } from './ui';
import { useEvidenceLabel } from './PassportView';
import { isSecuritySkill, refresherFor, securityComps } from './passport';
import { BANDS, classOfSkill, nextDrop, projectSkill, raiseActions, sourceRecord, type PeerRating, type RecordRow } from './decay';
import { BandChip, ClassChip, DecayClassCards, Fs03Benchmarks, IntervalBar, MethodBanner, MethodCard, SourceRecordView } from './confidenceUi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const MONTHS = [0, 1, 2, 3, 4, 5, 6, 9, 12, 18, 24, 30, 36];

function useConfidenceExtras(personId: string | null) {
  const repo = useRepo();
  return useQuery(['skill_ratings', 'microcred_defs', 'microcred_awards', 'engine_settings', 'skill_decay_classes'], async () => {
    const safe = (p: Promise<unknown>) => (p as Promise<Row[]>).catch(() => [] as Row[]);
    const [ratings, defs, awards, settings, classes] = await Promise.all([
      safe(repo.list('skill_ratings', { filter: { subject_id: personId ?? '__none__' } })),
      safe(repo.list('microcred_defs', { filter: { status: 'current' } })),
      safe(repo.list('microcred_awards', { filter: { person_id: personId ?? '__none__' } })),
      safe(repo.list('engine_settings')),
      safe(repo.list('skill_decay_classes', { order: [['sort', 'asc']] })),
    ]);
    return { ratings: ratings as PeerRating[], defs, awards, settings, classes };
  }, [personId]);
}
type Extras = NonNullable<ReturnType<typeof useConfidenceExtras>['data']>;

export default function MyConfidencePage() {
  const t = useT();
  const s = useSession();
  const me = s.identity.personId;
  const q = usePassportData(me);
  const x = useConfidenceExtras(me);
  return (
    <Page title={t('m17.routes.my-skills-confidence.title')} intro={t('m17.dk.intro')}
      actions={<L to="/my/skills" className="btn-outline btn-sm no-underline" data-testid="m17-conf-to-passport"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m17.dk.toPassport')}</L>}>
      <Async state={q}>{(d) => <Async state={x}>{(e) => <ConfidenceView d={d} x={e} />}</Async>}</Async>
    </Page>
  );
}

interface Line { skill: Row; state: Row; cls: DecayClass; months: number; ev: Evidence[]; drop: ReturnType<typeof nextDrop>; points: ReturnType<typeof projectSkill> }

function ConfidenceView({ d, x }: { d: PassportData; x: Extras }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const today = todayIso();
  const [open, setOpen] = useState<string | null>(null);
  const [flt, setFlt] = useFilters({ q: '', band: '', cls: '', drop: '' }, true);
  const settings = x.settings.find((r: Row) => r.id === 'skills') ?? null;
  const model = useMemo(() => decayModelFrom(x.settings as never, d.skills as never), [x.settings, d.skills]);
  const sec = useMemo(() => securityComps(d.comps), [d.comps]);
  const lines: Line[] = useMemo(() => {
    const evBy = new Map<string, Evidence[]>();
    for (const e of d.evidence) (evBy.get(e.skill_id) ?? evBy.set(e.skill_id, []).get(e.skill_id)!).push({ ...e, observed_on: String(e.observed_on).slice(0, 10) });
    const out: Line[] = [];
    for (const st of d.states) {
      const skill = d.skills.find((k) => k.id === st.skill_id);
      if (!skill || st.level <= 0 || isSecuritySkill(skill, sec)) continue;
      const cls = classOfSkill(skill as Row);
      const ev = evBy.get(skill.id) ?? [];
      const points = projectSkill(ev, model, today, MONTHS);
      out.push({ skill, state: st, cls, months: model.months[cls], ev, points, drop: nextDrop(points.filter((p) => p.month <= 6)) });
    }
    return out.sort((a, b) => BANDS.indexOf(a.state.confidence_band) - BANDS.indexOf(b.state.confidence_band) || (a.skill.sort ?? 0) - (b.skill.sort ?? 0));
  }, [d, model, sec, today]);
  const secCount = d.states.filter((st) => { const k = d.skills.find((x2) => x2.id === st.skill_id); return k && isSecuritySkill(k, sec); }).length;
  const by = (b: ConfidenceBand) => lines.filter((l) => l.state.confidence_band === b).length;
  const ageing = lines.filter((l) => (l.state.reasons?.[0]?.ageing)).length;
  const dropping = lines.filter((l) => l.drop).length;
  const shown = lines
    .filter((l) => !flt.band || l.state.confidence_band === flt.band)
    .filter((l) => !flt.cls || l.cls === flt.cls)
    .filter((l) => !flt.drop || !!l.drop)
    .filter((l) => !flt.q || `${l.skill.code} ${pick(l.skill, 'name')}`.toLowerCase().includes(flt.q.toLowerCase()));
  const opened = open ? lines.find((l) => l.skill.id === open) : undefined;
  const counts = { fast: lines.filter((l) => l.cls === 'fast').length, standard: lines.filter((l) => l.cls === 'standard').length, slow: lines.filter((l) => l.cls === 'slow').length };

  if (!lines.length) return <EmptyState title={t('m17.dk.empty')}>{t('m17.dk.emptyBody')}</EmptyState>;
  return (
    <div className="space-y-6">
      <MethodBanner settings={settings} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" data-testid="m17-conf-stats">
        <Stat label={t('m17.dk.band.high')} value={f.num(by('high'))} tone="ok" sub={t('m17.dk.stat.highSub')} />
        <Stat label={t('m17.dk.band.medium')} value={f.num(by('medium'))} tone="info" sub={t('m17.dk.stat.mediumSub')} />
        <Stat label={t('m17.dk.band.low')} value={f.num(by('low'))} tone="sim" sub={t('m17.dk.stat.lowSub')} />
        <Stat label={t('m17.dk.stat.dropping')} value={f.num(dropping)} tone={dropping ? 'sim' : 'ok'} sub={t('m17.dk.stat.droppingSub')} />
        <Stat label={t('m17.dk.stat.ageing')} value={f.num(ageing)} tone={ageing ? 'sim' : 'ok'} sub={t('m17.dk.stat.ageingSub')} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card title={t('m17.dk.mix.title')} eyebrow={t('m17.dk.mix.eyebrow')}>
          <Donut title={t('m17.dk.mix.title')} data={[
            { label: t('m17.dk.band.high'), value: by('high'), tone: 'ok' },
            { label: t('m17.dk.band.medium'), value: by('medium'), tone: 'info' },
            { label: t('m17.dk.band.low'), value: by('low'), tone: 'sim' },
          ]} center={<span className="num text-[18px] font-semibold">{f.num(lines.length)}</span>} />
        </Card>
        <Card title={t('m17.dk.bandsExplained.title')} eyebrow={t('m17.dk.bandsExplained.eyebrow')}>
          <ul className="space-y-2 text-[13px]">
            {(['high', 'medium', 'low'] as const).map((b) => (
              <li key={b} className="flex items-start gap-2"><BandChip band={b} testId={`m17-band-legend-${b}`} /><span className="text-ink-2">{t(`m17.dk.bandsExplained.${b}`)}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-ink-3">{t('m17.dk.bandsExplained.note')}</p>
        </Card>
      </div>

      <Section title={t('m17.dk.list.title')} description={t('m17.dk.list.intro')}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'band', label: t('m17.dk.list.band'), options: BANDS.map((b) => ({ value: b, label: t(`m17.dk.band.${b}`) })) },
          { key: 'cls', label: t('m17.dk.list.class'), options: (['fast', 'standard', 'slow'] as const).map((c) => ({ value: c, label: t(`m17.dk.class.${c}`) })) },
          { key: 'drop', label: t('m17.dk.list.drop'), options: [{ value: 'yes', label: t('m17.dk.list.dropYes') }] },
        ]} />
        {shown.length === 0 ? <EmptyState title={t('m17.dk.list.none')} /> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-[13.5px]" data-testid="m17-conf-table">
              <caption className="sr-only">{t('m17.dk.list.title')}</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="caps px-3 py-2 text-start">{t('m17.list.skill')}</th>
                  <th scope="col" className="caps px-3 py-2 text-start">{t('m17.list.level')}</th>
                  <th scope="col" className="caps px-3 py-2 text-start">{t('m17.dk.list.howSure')}</th>
                  <th scope="col" className="caps hidden px-3 py-2 text-start md:table-cell">{t('m17.dk.list.sources')}</th>
                  <th scope="col" className="caps hidden px-3 py-2 text-start lg:table-cell">{t('m17.dk.list.class')}</th>
                  <th scope="col" className="caps px-3 py-2 text-end">{t('m17.dk.list.next')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => {
                  const rec = sourceRecord(l.state, d.evidence.filter((e) => e.skill_id === l.skill.id), x.ratings.filter((r) => r.skill_id === l.skill.id));
                  return (
                    <tr key={l.skill.id} className="border-b border-line/60 align-top" data-testid="m17-conf-row" data-skill={l.skill.id} data-band={l.state.confidence_band} data-class={l.cls}>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5"><span className="num text-[11.5px] text-ink-3">{l.skill.code}</span><span className="font-medium">{pick(l.skill, 'name')}</span></div>
                        <div className="text-[12px] text-ink-3">{t(`m17.area.${l.skill.area}`)}</div>
                      </td>
                      <td className="px-3 py-2"><LevelMeter level={l.state.level} size="sm" /></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <BandChip band={l.state.confidence_band} low={l.state.conf_low} high={l.state.conf_high} testId={`m17-conf-band-${l.skill.id}`} />
                          <IntervalBar low={Number(l.state.conf_low)} high={Number(l.state.conf_high)} point={Number(l.state.confidence)} />
                        </div>
                      </td>
                      <td className="hidden px-3 py-2 md:table-cell">
                        <span className="flex flex-wrap gap-1">
                          {rec.map((r) => <span key={r.source} className={`chip ${r.counted ? 'border-line bg-panel text-ink-2' : 'border-dashed border-line bg-sunken text-ink-3'}`} data-source={r.source}>{t(`m17.dk.source.${r.source}`)}</span>)}
                        </span>
                      </td>
                      <td className="hidden px-3 py-2 lg:table-cell"><ClassChip cls={l.cls} months={l.months} /></td>
                      <td className="px-3 py-2 text-end">
                        <div className="text-[12.5px] text-ink-2">{l.drop ? t('m17.dk.list.dropsOn', { band: t(`m17.dk.band.${l.drop.band}`), date: f.date(l.drop.date) }) : t('m17.dk.list.stable')}</div>
                        <button type="button" className="btn-ghost btn-sm mt-1" onClick={() => setOpen(l.skill.id)} data-testid={`m17-conf-open-${l.skill.id}`}>{t('m17.dk.list.details')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {secCount > 0 && <p className="text-[12.5px] text-ink-3">{t('m17.dk.list.security', { n: f.num(secCount) })}</p>}
      </Section>

      <Section title={t('m17.dk.how.title')} description={t('m17.dk.how.intro')}>
        <DecayClassCards classes={x.classes} months={model.months} counts={counts} />
        <Card title={t('m17.dk.methodCard.title')} eyebrow={t('m17.dk.methodCard.eyebrow')}>
          <MethodCard />
        </Card>
        <Fs03Benchmarks />
      </Section>

      <Callout tone="sim" title={t('m17.notAuthority.title')}>{t('m17.dk.notAuthority')}</Callout>
      <SkillDrawer line={opened} d={d} x={x} onClose={() => setOpen(null)} sec={sec} />
    </div>
  );
}

function SkillDrawer({ line, d, x, sec, onClose }: { line?: Line; d: PassportData; x: Extras; sec: Set<string>; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const label = useEvidenceLabel(d);
  if (!line) return <Drawer open={false} onClose={onClose} title="" />;
  const record = sourceRecord(line.state, d.evidence.filter((e) => e.skill_id === line.skill.id), x.ratings.filter((r) => r.skill_id === line.skill.id));
  const stdIds = new Set(d.standards.map((s) => s.id));
  const qualOnly = (line.skill.evidence_keys ?? []).some((k: string) => stdIds.has(k));
  const course = refresherFor(line.skill, d.courses, sec);
  const held = new Set(x.awards.filter((a: Row) => a.status === 'awarded').map((a: Row) => a.def_code));
  const mc = x.defs.find((def: Row) => (def.alignment ?? []).some((a: Row) => a.skill_id === line.skill.id) && !held.has(def.code));
  const actions = raiseActions({ skill: line.skill, record, qualificationOnly: qualOnly, security: false, drop: line.drop, ageing: !!line.state.reasons?.[0]?.ageing, refresher: course ? { id: course.id, code: course.code } : null, microcred: mc ? { code: mc.code } : null });
  const rowLabel = (r: RecordRow) => {
    if (r.kind === 'peer_rating') return { title: r.note ? t('m17.dk.record.peerRating', { note: r.note }) : t('m17.dk.source.peer'), system: t('m17.dk.record.peerSystem') };
    if (r.ref_table === 'microcred_awards') { const a = x.awards.find((w: Row) => w.id === r.ref_id); return { title: t('m17.dk.record.microcred', { code: a?.def_code ?? r.ref_id }), system: t('m17.evidence.sys.wallet') }; }
    const e = d.evidence.find((y) => y.id === r.id);
    return e ? label(e) : { title: r.kind, system: '' };
  };
  const pts = line.points;
  return (
    <Drawer open onClose={onClose} title={`${line.skill.code} · ${pick(line.skill, 'name')}`}>
      <div className="space-y-4" data-testid="m17-conf-drawer" data-skill={line.skill.id}>
        <div className="flex flex-wrap items-center gap-2">
          <LevelMeter level={line.state.level} />
          <BandChip band={line.state.confidence_band} low={line.state.conf_low} high={line.state.conf_high} testId="m17-conf-drawer-band" />
          <ClassChip cls={line.cls} months={line.months} />
        </div>
        <p className="text-[13px] text-ink-2">{t('m17.dk.drawer.summary', { pct: f.pct(Number(line.state.confidence) * 100, 0), n: f.num(record.filter((r) => r.counted).length) })}</p>
        <section>
          <h3 className="mb-2 font-semibold">{t('m17.dk.drawer.record')}</h3>
          <SourceRecordView record={record} label={rowLabel} />
        </section>
        <section data-testid="m17-conf-projection">
          <h3 className="mb-1 font-semibold">{t('m17.dk.drawer.projection')}</h3>
          <p className="mb-2 text-[12.5px] text-ink-2">{t('m17.dk.drawer.projectionIntro', { months: f.num(line.months) })}</p>
          {pts.length > 1 && (
            <LineChart title={t('m17.dk.drawer.projection')} height={170} yMin={0} yMax={100} unit="%" series={[
              { name: t('m17.dk.drawer.seriesConf'), points: pts.map((p) => ({ x: f.num(p.month), y: Math.round(p.confidence * 100) })), tone: 'accent' },
              { name: t('m17.dk.drawer.seriesLow'), points: pts.map((p) => ({ x: f.num(p.month), y: Math.round(p.low * 100) })), tone: 'sim', dashed: true },
            ]} />
          )}
          <div className="mt-1 text-[12px] text-ink-3">{t('m17.dk.drawer.axis')}</div>
          <div className="sr-only">
            <table><caption>{t('m17.dk.drawer.projection')}</caption><tbody>{pts.map((p) => <tr key={p.month}><th scope="row">{f.date(p.date)}</th><td>{f.pct(p.confidence * 100, 0)}</td><td>{t(`m17.dk.band.${p.band}`)}</td></tr>)}</tbody></table>
          </div>
          <p className="mt-2 text-[13px]">{line.drop ? t('m17.dk.drawer.dropsOn', { band: t(`m17.dk.band.${line.drop.band}`), date: f.date(line.drop.date), level: f.num(line.drop.level) }) : t('m17.dk.drawer.stable')}</p>
        </section>
        <section data-testid="m17-conf-raise">
          <h3 className="mb-2 font-semibold">{t('m17.dk.drawer.raise')}</h3>
          {actions.length === 0 ? <p className="text-[13px] text-ink-3">{t('m17.dk.drawer.raiseNone')}</p> : (
            <ul className="space-y-2">
              {actions.map((a) => (
                <li key={a.kind} className="flex items-start justify-between gap-2 rounded-card border border-line p-2.5" data-testid="m17-conf-action" data-kind={a.kind}>
                  <span className="min-w-0 text-[13px]">
                    <L to={a.to} className="font-semibold">{t(`m17.dk.raise.${a.kind}`)}</L>
                    <span className="block text-[12px] text-ink-3">{t(`m17.dk.raise.${a.kind}Body`)}</span>
                  </span>
                  <WhyThis reasons={a.reasons} testId={`m17-conf-why-${a.kind}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-1 font-semibold">{t('m17.dk.drawer.why')}</h3>
          <WhyThis reasons={skillReasons(line.state.reasons ?? [])} testId="m17-conf-why-state" />
        </section>
      </div>
    </Drawer>
  );
}
