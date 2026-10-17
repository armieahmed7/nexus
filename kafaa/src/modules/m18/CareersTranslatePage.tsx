// FS34 /careers/translate (FS wave D · E4): "Your skills in nuclear", the transferable-skills translator for career-changers.
// Public and anonymous: pick a current occupation from the ESCO-aligned list (oil and gas, power, process, aviation, defence,
// utilities) and see the nearest ENEC roles, what transfers, the delta skills and a bridging route with its duration (FS19
// cross-over courses first). Everything is computed in the browser from public rows with translate() (the same rule as SQL
// kafaa_fs34_translate): nothing is stored, no RPC is called. Signed-in staff can switch to "my passport", which runs the same
// rule on their own skill states through rpc.translateMine (read-only). Ranking runs through the engine kernel (FS34 context).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, StatusPill, SourceLink, Icon, BenchmarkChips, Tabs, WhyThis, ProgressRing, StatTile } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useBenchmarks } from '../../data/useBenchmarks';
import { figureOf } from '../../domain/benchmarks';
import { lintRanked } from '../../domain/engines/rank';
import type { Ranked } from '../../domain/engines/types';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import {
  translate, templateSkills, heldOf, INDUSTRIES, PRACTICE_HOURS_PER_LEVEL, STUDY_HOURS_PER_WEEK, MAX_RESULTS,
  type OccupationTemplate, type TrData, type Translation, type TrResult, type TrItem,
} from './translate';
import type { TranslateMine } from './backend/rpc';

type Row = Record<string, unknown>;
interface Base { tr: TrData; templates: OccupationTemplate[]; roleById: Map<string, Row>; compById: Map<string, Row>; courseById: Map<string, Row>; skillById: Map<string, Row> }

/** The public rows the translator reads (anonymous reads; RLS returns the same rows as the definer for these tables). */
function useBase() {
  const repo = useRepo();
  return useQuery(['occupation_templates', 'job_roles', 'role_competencies', 'competencies', 'skills', 'courses', 'course_skill_links', 'course_pack_items', 'career_paths', 'engine_settings'], async (): Promise<Base> => {
    const [templates, roles, roleComps, competencies, skills, courses, links, packs, edges, eng] = await Promise.all([
      repo.list('occupation_templates', { filter: { status: 'published' }, order: [['sort', 'asc']] }), repo.list('job_roles'), repo.list('role_competencies'), repo.list('competencies'),
      repo.list('skills'), repo.list('courses'), repo.list('course_skill_links'), repo.list('course_pack_items'), repo.list('career_paths'), repo.get('engine_settings', 'recommend').catch(() => null),
    ]);
    const w = (eng as Row | null)?.weights;
    const weights = w && typeof w === 'object' ? Object.fromEntries(Object.entries(w as Row).filter(([, v]) => typeof v === 'number')) as Record<string, number> : undefined;
    const tr: TrData = { roles: roles as never, roleComps: roleComps as never, competencies: competencies as never, skills: skills as never, courses: courses as never, links: links as never, packs: packs as never, edges: edges as never, weights };
    const by = (rows: unknown[]) => new Map((rows as Row[]).map((r) => [String(r.id), r]));
    return { tr, templates: templates as unknown as OccupationTemplate[], roleById: by(roles), compById: by(competencies), courseById: by(courses), skillById: by(skills) };
  });
}

/** Deterministic order (coverage, fewer gap levels, id), run through the engine kernel so the model slot sees the same candidates. */
export function rankTranslation(t: Translation): Ranked<TrResult>[] {
  return t.results.map((r) => ({ id: r.role_id, score: r.pct / 100, reasons: r.reasons, item: r }));
}

export default function CareersTranslatePage() {
  const t = useT();
  const s = useSession();
  const q = useBase();
  const staff = s.status === 'signed_in' && s.person?.kind === 'staff' && s.can('skills_profile', ['Own']);
  return (
    <Page title={t('m18.routes.careers-translate.title')} eyebrow={t('m18.fs34.eyebrow')} intro={t('m18.fs34.intro')} wide
      actions={<L to="/careers" className="btn-outline btn-sm" data-testid="m18-fs34-to-careers"><Icon name="briefcase" size={14} />{t('m18.fs34.toCareers')}</L>}>
      <div className="flex flex-wrap items-center gap-2">
        <BenchmarkChips feature="FS34" />
      </div>
      <Callout tone="info" title={t('m18.fs34.privacyTitle')}><span data-testid="m18-fs34-privacy">{t('m18.fs34.privacy')}</span></Callout>
      <WhyNow />
      <Async state={q}>
        {(b) => (b.templates.length === 0 ? <EmptyState title={t('m18.fs34.none')} icon="briefcase" /> : staff ? (
          <Tabs initial="occupation" tabs={[
            { id: 'occupation', label: t('m18.fs34.tab.occupation'), content: <FromOccupation b={b} /> },
            { id: 'passport', label: t('m18.fs34.tab.passport'), content: <FromPassport b={b} /> },
          ]} />
        ) : <FromOccupation b={b} />)}
      </Async>
      <Method />
    </Page>
  );
}

/** Three sourced figures from the benchmark registry (never typed into copy). */
function WhyNow() {
  const t = useT();
  const f = useFormat();
  const q = useBenchmarks();
  const rows = q.data ?? [];
  const items = [
    { id: 'UK-NUC', key: 'new_jobs_2030', label: t('m18.fs34.fig.uk') },
    { id: 'SMR-WF', key: 'hires_2023_2033', label: t('m18.fs34.fig.fr') },
    { id: 'ESCO', key: 'occupations', label: t('m18.fs34.fig.esco') },
  ].map((x) => ({ ...x, fig: figureOf(rows, x.id, x.key) })).filter((x) => x.fig);
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="m18-fs34-figures">
      {items.map((x) => <StatTile key={x.id} label={x.label} value={f.num(x.fig!.value)} sub={<span className="inline-flex flex-wrap gap-1"><BenchmarkChips ids={[x.id]} /></span>} />)}
    </div>
  );
}

const INDUSTRY_ICON: Record<string, string> = { oil_gas: 'globe', power: 'sparkle', process: 'chart', aviation: 'external', defence: 'shield', utilities: 'reset' };

function FromOccupation({ b }: { b: Base }) {
  const t = useT();
  const pick = usePick();
  const [sel, setSel] = useState<string | null>(null);
  const tpl = b.templates.find((x) => x.id === sel) ?? null;
  const result = useMemo(() => (tpl ? translate(b.tr, heldOf(tpl), tpl.industry) : null), [b, tpl]);
  return (
    <div className="space-y-6">
      <Section title={t('m18.fs34.pickTitle')} description={t('m18.fs34.pickDesc', { n: b.templates.length })}>
        <div className="space-y-4" data-testid="m18-fs34-occupations">
          {INDUSTRIES.filter((ind) => b.templates.some((x) => x.industry === ind)).map((ind) => (
            <div key={ind}>
              <div className="caps mb-2 flex items-center gap-1.5"><Icon name={INDUSTRY_ICON[ind] ?? 'briefcase'} size={13} />{t(`m18.fs34.industry.${ind}`)}</div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {b.templates.filter((x) => x.industry === ind).map((x) => (
                  <li key={x.id}>
                    <button type="button" aria-pressed={sel === x.id} onClick={() => setSel(x.id)} data-testid="m18-fs34-occupation" data-id={x.id}
                      className={`card w-full p-3 text-start transition hover:border-accent ${sel === x.id ? 'border-accent ring-2 ring-accent/30' : ''}`}>
                      <div className="font-semibold leading-snug">{pick(x as unknown as Row, 'title')}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
                        <span className="chip border-line bg-sunken"><bdi dir="ltr">ESCO {x.esco_code}</bdi></span>
                        <span>{t('m18.fs34.skillsN', { n: templateSkills(x).length })}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
      {tpl && result && (
        <>
          <Transfers b={b} tpl={tpl} />
          <Results b={b} result={result} context={{ occupation: tpl.id, industry: tpl.industry }} />
        </>
      )}
      {!tpl && <EmptyState title={t('m18.fs34.pickFirst')} icon="briefcase">{t('m18.fs34.pickFirstBody')}</EmptyState>}
    </div>
  );
}

function Level({ n }: { n: number }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={t('m18.fs34.levelAria', { n })} title={t(`m18.fs34.level.${Math.max(1, Math.min(4, n))}`)}>
      {[1, 2, 3, 4].map((i) => <span key={i} className={`h-2 w-2 rounded-full ${i <= n ? 'bg-accent' : 'bg-line'}`} />)}
    </span>
  );
}

function Transfers({ b, tpl }: { b: Base; tpl: OccupationTemplate }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const sk = templateSkills(tpl);
  const src = (Array.isArray(tpl.sources) ? tpl.sources : []) as { label: string; url: string; as_of: string }[];
  return (
    <Section title={t('m18.fs34.bringTitle', { occ: pick(tpl as unknown as Row, 'title') })} description={pick(tpl as unknown as Row, 'summary')}>
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
          <span className="chip border-line bg-sunken"><bdi dir="ltr">ESCO {tpl.esco_code}</bdi></span>
          {tpl.isco_code && <span className="chip border-line bg-sunken"><bdi dir="ltr">ISCO-08 {tpl.isco_code}</bdi></span>}
          <span>{t('m18.fs34.escoLabel')}: <bdi>{pick(tpl as unknown as Row, 'esco_label')}</bdi></span>
          {src.map((s) => <SourceLink key={s.url} href={s.url} date={s.as_of}>{t('m18.fs34.escoSource')}</SourceLink>)}
        </div>
        <div className="overflow-x-auto">
          <table className="table-base w-full text-[13px]" data-testid="m18-fs34-bring">
            <thead><tr><th className="text-start">{t('m18.fs34.col.skill')}</th><th className="text-start">{t('m18.fs34.col.level')}</th><th className="text-start">{t('m18.fs34.col.esco')}</th><th className="text-start">{t('m18.fs34.col.tie')}</th></tr></thead>
            <tbody>
              {sk.map((s) => (
                <tr key={s.skill_id} data-skill={s.skill_id}>
                  <td><L to={`/skills/${s.skill_id}`} className="link">{pick(b.skillById.get(s.skill_id), 'name') || s.skill_id}</L></td>
                  <td><Level n={s.level} /></td>
                  <td><SourceLink href={`https://esco.ec.europa.eu/en/classification/skill?uri=${s.esco_uri}`}>{pick(s as unknown as Row, 'esco_label')}</SourceLink> <span className="text-[11.5px] text-ink-3">· {t(`m18.fs34.rel.${s.esco_relation}`)}</span></td>
                  <td><StatusPill tone={s.match === 'exact' ? 'ok' : 'neutral'}>{t(`m18.fs34.match.${s.match}`)}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-ink-3">{t('m18.fs34.levelsNote', { date: f.date(tpl.as_of) })}</p>
      </Card>
    </Section>
  );
}

function Results({ b, result, context }: { b: Base; result: Translation; context: Record<string, unknown> }) {
  const t = useT();
  const eng = useEngine('recommend');
  const ranked = useQuery([], async () => {
    const det = () => rankTranslation(result);
    const out = await eng.run(det, { candidates: result.results.map((r) => ({ id: r.role_id, pct: r.pct, gaps: r.gaps.map((g) => g.competency_id) })), context: { surface: 'translator', feature: 'FS34', ...context } });
    if (lintRanked(out.results).length) throw new Error(lintRanked(out.results).join('; '));
    return out.results;
  }, [eng.kind, result]);
  return (
    <Section title={t('m18.fs34.resultsTitle')} description={t('m18.fs34.resultsDesc', { n: MAX_RESULTS })}>
      <Async state={ranked}>
        {(rs) => rs.length === 0 ? <EmptyState title={t('m18.fs34.noResults')} icon="briefcase" /> : (
          <ol className="space-y-4" data-testid="m18-fs34-results">
            {rs.map((x, i) => <RoleResult key={x.id} b={b} r={x.item!} rank={i + 1} />)}
          </ol>
        )}
      </Async>
    </Section>
  );
}

const KIND_ICON: Record<TrItem['kind'], string> = { crossover: 'link', course: 'book', practice: 'users' };

function RoleResult({ b, r, rank }: { b: Base; r: TrResult; rank: number }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const role = b.roleById.get(r.role_id);
  const comp = (id: string) => pick(b.compById.get(id), 'name') || id;
  return (
    <li className="card p-4" data-testid="m18-fs34-result" data-role={r.role_id}>
      <div className="flex flex-wrap items-start gap-4">
        <ProgressRing value={r.pct} label={f.pct(r.pct, 0)} />
        <div className="min-w-0 flex-1">
          <div className="caps">{t('m18.fs34.rank', { n: rank })}</div>
          <h3 className="text-[17px] font-semibold leading-snug"><L to={`/careers/roles/${r.role_id}`} className="link">{pick(role, 'title') || r.role_id}</L></h3>
          <p className="text-[13px] text-ink-2">{t('m18.fs34.coverLine', { pct: f.pct(r.pct, 0), n: r.transfers.length, of: r.transfers.length + r.gaps.filter((g) => g.have === 0).length })}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusPill tone="accent">{t('m18.fs34.duration', { weeks: f.num(r.weeks), months: f.num(r.months) })}</StatusPill>
            <span className="text-[12.5px] text-ink-2 num">{t('m18.fs34.hours', { hours: f.num(r.hours) })}</span>
            <WhyThis reasons={r.reasons} testId="m18-fs34-why" />
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div>
          <div className="caps mb-1">{t('m18.fs34.transfersTitle')}</div>
          {r.transfers.length ? (
            <ul className="space-y-1 text-[13px]" data-testid="m18-fs34-transfers">
              {r.transfers.map((x) => <li key={x.competency_id} className="flex items-center justify-between gap-2"><span>{comp(x.competency_id)}</span><span className="num text-ink-2">{f.num(Math.min(x.have, x.need))}/{f.num(x.need)}</span></li>)}
            </ul>
          ) : <p className="text-[13px] text-ink-3">{t('m18.fs34.noTransfers')}</p>}
        </div>
        <div>
          <div className="caps mb-1">{t('m18.fs34.gapsTitle')}</div>
          {r.gaps.length ? (
            <ul className="space-y-1 text-[13px]" data-testid="m18-fs34-gaps">
              {r.gaps.map((g) => <li key={g.competency_id} className="flex items-center justify-between gap-2"><span>{comp(g.competency_id)} <span className="text-[11.5px] text-ink-3">· {t(`m18.importance.${g.importance}`)}</span></span><span className="num text-ink-2">{f.num(g.have)} → {f.num(g.need)}</span></li>)}
            </ul>
          ) : <p className="text-[13px] text-ok">{t('m18.fs34.noGaps')}</p>}
        </div>
        <div>
          <div className="caps mb-1">{t('m18.fs34.routeTitle')}</div>
          <ol className="space-y-2 text-[13px]" data-testid="m18-fs34-bridge">
            {r.bridge.map((x) => (
              <li key={x.step} className="flex gap-2" data-kind={x.kind}>
                <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-eyebrow">{f.num(x.step)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Icon name={KIND_ICON[x.kind]} size={13} />
                    {x.course_id ? <L to={`/learn/course/${x.course_id}`} className="link">{pick(b.courseById.get(x.course_id), 'title') || x.course_id}</L> : <span>{t('m18.fs34.practice', { skill: comp(x.competency_ids[0]) })}</span>}
                    <StatusPill tone={x.kind === 'crossover' ? 'accent' : x.kind === 'course' ? 'info' : 'neutral'}>{t(`m18.fs34.kind.${x.kind}`)}</StatusPill>
                  </div>
                  <div className="text-[12px] text-ink-2 num">{t('m18.fs34.itemTime', { hours: f.num(x.hours), weeks: f.num(x.weeks) })}</div>
                  <WhyThis reasons={x.reasons} testId="m18-fs34-item-why" />
                </div>
              </li>
            ))}
          </ol>
          {r.bridge.length === 0 && <p className="text-[13px] text-ink-3">{t('m18.fs34.noRoute')}</p>}
        </div>
      </div>
    </li>
  );
}

function FromPassport({ b }: { b: Base }) {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['person_skills'], async (): Promise<TranslateMine> => {
    const r = await repo.rpc.translateMine();
    if (!r.ok) throw new Error(r.message);
    return r.data!;
  });
  return (
    <div className="space-y-4" data-testid="m18-fs34-passport">
      <Callout tone="info" title={t('m18.fs34.passportTitle')}>{t('m18.fs34.passportBody')}</Callout>
      <Async state={q}>
        {(d) => d.held === 0 ? <EmptyState title={t('m18.fs34.passportEmpty')} icon="user"><L to="/my/skills" className="btn-outline btn-sm">{t('m18.fs34.toPassport')}</L></EmptyState> : (
          <>
            <p className="text-[13px] text-ink-2" data-testid="m18-fs34-held">{t('m18.fs34.heldN', { n: d.held })}</p>
            <Results b={b} result={d} context={{ passport: true }} />
          </>
        )}
      </Async>
    </div>
  );
}

function Method() {
  const t = useT();
  const f = useFormat();
  return (
    <Section title={t('m18.fs34.methodTitle')}>
      <Card>
        <ul className="list-disc space-y-1.5 ps-5 text-[13px]" data-testid="m18-fs34-method">
          <li>{t('m18.fs34.method.cover')}</li>
          <li>{t('m18.fs34.method.roles')}</li>
          <li>{t('m18.fs34.method.route', { per: f.num(PRACTICE_HOURS_PER_LEVEL), week: f.num(STUDY_HOURS_PER_WEEK) })}</li>
          <li>{t('m18.fs34.method.templates')}</li>
          <li>{t('m18.fs34.method.limits')}</li>
        </ul>
      </Card>
    </Section>
  );
}
