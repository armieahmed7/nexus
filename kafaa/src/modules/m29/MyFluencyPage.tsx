// FS09 /my/ai-fluency (ai_literacy Own): my AI fluency rung computed from my F01 skill evidence (rpc.aiFluency, the same rule as
// SQL kafaa_ai_rung), with "Why this?" reasons pointing at the evidence rows, the 16-cell ladder coloured by what I have shown, the
// next rung's gaps with the learning that closes them, my job family's target, my latest fitness check, and the AI-engineering
// skills I hold shown apart (they never raise the literacy rung). No points, streaks or leaderboards.
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, WhyThis, BenchmarkChips, Icon, StatusPill, ScrollRegion } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { DIMENSIONS, MAX_RUNG, type AiRungResult } from './fluency';
import { isAboveBasic } from './fitness';
import type { AiFluencyView } from './backend/rpc';
import { DimHead, LadderSteps, LearningList, RungPill, SkillChips, TargetLine, useM29Ref, useRungName, type M29Ref, type Row } from './ui';

function useMine(personId: string | null) {
  const repo = useRepo();
  return useQuery(['person_skills', 'skill_evidence', 'fitness_attempts'], async () => {
    const [view, attempts, evidence] = await Promise.all([
      repo.rpc.aiFluency(),
      repo.list('fitness_attempts' as never, { filter: { person_id: personId ?? '__none__' }, order: [['started_at', 'desc']] } as never).catch(() => [] as Row[]),
      repo.list('skill_evidence', { filter: { person_id: personId ?? '__none__' } } as never).catch(() => [] as Row[]),
    ]);
    return { view, attempts: attempts as Row[], evidence: evidence as Row[] };
  }, [personId]);
}

export default function MyFluencyPage() {
  const t = useT();
  const s = useSession();
  const ref = useM29Ref();
  const mine = useMine(s.identity.personId);
  return (
    <Page title={t('m29.routes.my-ai-fluency.title')} intro={t('m29.my.intro')} wide eyebrow={<BenchmarkChips feature="FS09" />}
      actions={<span className="flex flex-wrap gap-2">
        <L to="/my/ai-fluency/check" className="btn-primary btn-sm no-underline" data-testid="m29-my-to-check"><Icon name="check" size={14} /> {t('m29.my.toCheck')}</L>
        <L to="/learn/ai-fluency" className="btn-outline btn-sm no-underline" data-testid="m29-my-to-ladder">{t('m29.my.toLadder')}</L>
        <L to="/my/ai-fluency/drills" className="btn-outline btn-sm no-underline" data-testid="m29-my-to-drills">{t('m29.my.toDrills')}</L>{/* FS37 */}
        <L to="/workforce/ai-register" className="btn-outline btn-sm no-underline" data-testid="m29-my-to-register">{t('m29.my.toRegister')}</L>{/* FS36 */}
        <L to="/workforce/ai-automations" className="btn-outline btn-sm no-underline" data-testid="m29-my-to-automations">{t('m29.atm.fromFluency')}</L>{/* FS80 */}
        <L to="/my/future-wallet" className="btn-outline btn-sm no-underline" data-testid="m29-my-to-wallet">{t('m29.my.toWallet')}</L>{/* FS74 (wave-H integration) */}
        <L to={`/ask?mode=future&q=${encodeURIComponent(t('m29.my.askQ'))}`} className="btn-outline btn-sm no-underline" data-testid="m29-my-ask-dalil">{t('m29.my.askDalil')}</L>{/* FS76 (wave-H integration) */}
      </span>}>
      <Async state={ref}>{(d) => <Async state={mine}>{(m) => (m.view ? <Mine d={d} v={m.view} attempts={m.attempts} evidence={m.evidence} /> : <EmptyState title={t('m29.my.none')} />)}</Async>}</Async>
    </Page>
  );
}

function Mine({ d, v, attempts, evidence }: { d: M29Ref; v: AiFluencyView; attempts: Row[]; evidence: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const name = useRungName();
  const r: AiRungResult = v.result;
  const fam = d.families.find((x: Row) => x.id === v.family_id);
  const latest = attempts.filter((a) => a.status === 'completed').sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0];
  const next = r.next;
  const nextMet = next ? r.cells.filter((c) => c.rung === next.rung && c.met).length : DIMENSIONS.length;
  const cellOf = (id: string) => d.cells.find((c: Row) => c.id === id);
  const skillName = (id: string | null) => { const k = d.skills.find((x: Row) => x.id === id); return k ? pick(k, 'name') : id ?? ''; };
  const evLabel = (id: string | null) => {
    const e = evidence.find((x) => x.id === id);
    if (!e) return null;
    return t(e.ref_table === 'fitness_attempts' ? 'm29.my.ev.fitness' : e.ref_table === 'ai_drill_attempts' ? 'm29.my.ev.drill' : `m29.my.ev.${e.kind}`, { date: f.date(String(e.observed_on)), level: f.num(e.level) });
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card eyebrow={t('m29.my.hero.eyebrow')} title={<span className="flex flex-wrap items-center gap-2" data-testid="m29-my-rung" data-rung={r.rung}>{t('m29.my.hero.title')} <RungPill rung={r.rung} /></span>}
          actions={<WhyThis reasons={r.reasons} testId="m29-my-why" />}>
          <LadderSteps rung={r.rung} target={v.target?.rung ?? null} />
          <p className="mt-3 text-[13.5px] text-ink-2">{r.rung > 0 ? pick(cellOf(`air:${r.rung}:mindset`) ?? {}, 'essence') : t('m29.my.hero.zero')}</p>
          <p className="mt-2 text-[12.5px] text-ink-3">{t('m29.my.hero.rule')}</p>
        </Card>
        <div className="grid grid-cols-2 gap-2" data-testid="m29-my-tiles">
          <StatTile label={t('m29.my.tile.next')} value={next ? `${f.num(nextMet)} / ${f.num(DIMENSIONS.length)}` : <span className="text-[18px]">{t('m29.my.tile.top')}</span>} sub={next ? t('m29.my.tile.nextSub', { rung: name(next.rung) }) : undefined} tone={next ? 'info' : 'ok'} />
          <StatTile label={t('m29.my.tile.target')} value={v.target ? <span className="text-[18px]">{name(v.target.rung)}</span> : '—'} sub={v.target ? (v.target_met ? t('m29.my.tile.targetMet') : t('m29.my.tile.targetGap', { n: f.num(v.target_missing.length) })) : undefined} tone={v.target_met ? 'ok' : 'sim'} />
          <StatTile label={t('m29.my.tile.check')} value={latest ? f.num(latest.score) : '—'} sub={latest ? t('m29.my.tile.checkSub', { band: t(`m29.band.${latest.band}`), date: f.date(String(latest.completed_at).slice(0, 10)) }) : t('m29.my.tile.checkNone')} tone={latest && isAboveBasic(latest.band) ? 'ok' : 'info'} />
          <StatTile label={t('m29.my.tile.cells')} value={`${f.num(r.cells.filter((c) => c.met).length)} / ${f.num(r.cells.length)}`} sub={t('m29.my.tile.cellsSub')} />
        </div>
      </div>

      <Section title={t('m29.my.grid.title')} description={t('m29.my.grid.intro')}>
        <ScrollRegion label={t('m29.my.grid.title')} className="card overflow-x-auto" data-testid="m29-my-grid">
          <table className="w-full min-w-[640px] table-fixed text-[13px]">
            <caption className="sr-only">{t('m29.my.grid.title')}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="caps w-28 px-3 py-2 text-start">{t('m29.lad.grid.rung')}</th>
                {DIMENSIONS.map((x) => <th key={x} scope="col" className="px-3 py-2 text-start align-bottom"><DimHead dim={x} /></th>)}
              </tr>
            </thead>
            <tbody>
              {[4, 3, 2, 1].map((rung) => (
                <tr key={rung} className="border-b border-line/60 align-top">
                  <th scope="row" className="px-3 py-3 text-start"><RungPill rung={rung} /></th>
                  {DIMENSIONS.map((dim) => {
                    const c = r.cells.find((x) => x.rung === rung && x.dimension === dim);
                    const def = cellOf(`air:${rung}:${dim}`);
                    if (!c || !def) return <td key={dim} />;
                    const state = c.met ? 'met' : next && rung === next.rung ? 'next' : rung <= r.rung + 1 ? 'gap' : 'later';
                    const tone = state === 'met' ? 'border-ok/40 bg-ok-bg' : state === 'next' ? 'border-accent/40 bg-accent-soft' : 'border-line bg-sunken';
                    return (
                      <td key={dim} className="px-2 py-2">
                        <div className={`h-full space-y-1.5 rounded-card border p-2.5 ${tone}`} data-testid="m29-my-cell" data-cell={c.id} data-state={state}>
                          <div className="flex items-center justify-between gap-2">
                            <StatusPill tone={state === 'met' ? 'ok' : state === 'next' ? 'accent' : 'neutral'}>{t(`m29.my.state.${state}`)}</StatusPill>
                            {v.target?.plus_cells.includes(c.id) && <span className="caps text-[10px] text-ok">{t('m29.steps.target')}</span>}
                          </div>
                          <p className="text-[12.5px] text-ink">{pick(def, 'descriptor')}</p>
                          {c.met ? (
                            <p className="text-[12px] text-ink-2" data-testid="m29-my-evidence">
                              <Icon name="check" size={12} className="me-1 inline text-ok" />
                              {t('m29.my.metBy', { skill: skillName(c.skill_id), level: f.num(c.level ?? 0) })}
                              {evLabel(c.evidence_id) && <span className="block text-ink-3">{evLabel(c.evidence_id)}</span>}
                            </p>
                          ) : (
                            <p className="text-[12px] text-ink-3">{t('m29.my.have', { have: f.num(c.have), need: f.num(def.min_level) })}</p>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={next ? t('m29.my.next.title', { rung: name(next.rung) }) : t('m29.my.next.top')} eyebrow={t('m29.my.next.eyebrow')}>
          {next && next.missing.length ? (
            <ul className="space-y-3" data-testid="m29-my-next">
              {next.missing.map((id) => {
                const c = cellOf(id);
                if (!c) return null;
                return (
                  <li key={id} className="rounded-card border border-line p-3" data-cell={id}>
                    <div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-semibold">{t(`m29.dim.${c.dimension}`)}</span><SkillChips ids={c.skill_ids} data={d} level={c.min_level} /></div>
                    <p className="text-[13px] text-ink-2">{pick(c, 'descriptor')}</p>
                    <p className="mt-1 text-[12.5px] text-ink-3">{t('m29.lad.grid.example')}: {pick(c, 'example')}</p>
                    <div className="mt-2"><LearningList items={c.learning} d={d} /></div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-[13px] text-ink-2">{next ? t('m29.my.next.ready') : t('m29.my.next.topBody')}</p>}
        </Card>
        <div className="space-y-4">
          <Card title={t('m29.my.target.title', { family: fam ? pick(fam, 'name') : '—' })} eyebrow={t('m29.my.target.eyebrow')}>
            <div data-testid="m29-my-target" data-met={v.target_met ? 'yes' : 'no'}>
              <TargetLine target={v.target} d={d} />
              <p className="mt-2 text-[13px] text-ink-2">{v.target ? pick(v.target, 'rationale') : t('m29.my.target.none')}</p>
              {v.target && (
                <p className="mt-2 text-[13px]">{v.target_met ? <span className="text-ok">{t('m29.my.target.met')}</span>
                  : t('m29.my.target.missing', { list: v.target_missing.map((id) => { const c = cellOf(id); return c ? `${name(c.rung)} · ${t(`m29.dim.${c.dimension}`)}` : id; }).join(', ') })}</p>
              )}
            </div>
          </Card>
          <Card title={t('m29.my.eng.title')} eyebrow={t('m29.my.eng.eyebrow')}>
            {r.engineering.length ? (
              <ul className="space-y-1 text-[13px]" data-testid="m29-my-engineering">
                {r.engineering.map((e) => <li key={e.skill_id} className="flex items-center justify-between gap-2"><span>{skillName(e.skill_id)}</span><span className="num text-ink-3">{t('m29.my.eng.level', { level: f.num(e.level) })}</span></li>)}
              </ul>
            ) : <p className="text-[13px] text-ink-3">{t('m29.my.eng.none')}</p>}
            <p className="mt-2 text-[12.5px] text-ink-3">{t('m29.my.eng.note')}</p>
          </Card>
        </div>
      </div>

      <Callout tone="info" title={t('m29.my.honest.title')}>{t('m29.my.honest.body', { max: f.num(MAX_RUNG) })}</Callout>
    </div>
  );
}
