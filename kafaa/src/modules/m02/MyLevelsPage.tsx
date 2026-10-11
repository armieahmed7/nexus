// FS23/FS24 /my/levels · My levels explained (own skills profile): each skill I hold with what I am seen to do at my level (the
// skill's behaviourally anchored indicators), what to show at the next level (or why there is none), what my level reads as in SFIA,
// SkillsFuture, DigComp, UNESCO and the UAE NQF (indicative, FS24), and my Authority recognitions (a recognition above Expert by a
// panel: never a fifth level, no points or badges, and my F01 level stays 4).
import { useMemo } from 'react';
import { Async, BenchmarkChips, Callout, Card, EmptyState, FilterBar, Page, Section, StatTile, StatusPill, WhyThis, useFilters } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { levelState } from './descriptors';
import { authorityReview, bandOfLevel } from './authority';
import { todayIso } from '../../domain/rules';
import { DescriptorBlock, EquivalentChips, RangeDots, frameworksFor, useLevelName, useLevelsData, type LevelsData, type Row } from './levelsUi';

export default function MyLevelsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const levels = useLevelsData();
  const mine = useQuery(['person_skills', 'authority_recognitions'], async () => {
    if (!me) return { ps: [] as Row[], ar: [] as Row[] };
    const [ps, ar] = await Promise.all([
      repo.list('person_skills', { filter: { person_id: me } }) as Promise<Row[]>,
      repo.list('authority_recognitions', { filter: { person_id: me } }).catch(() => []) as Promise<Row[]>,
    ]);
    return { ps: ps.filter((x) => x.active !== false && Number(x.level) > 0), ar };
  }, [me]);
  const state = { data: levels.data && mine.data ? { d: levels.data, m: mine.data } : undefined, loading: levels.loading || mine.loading, error: levels.error ?? mine.error, reload: () => { levels.reload?.(); mine.reload?.(); } };
  return (
    <Page title={t('m02.routes.my-levels.title')} eyebrow={t('m02.ml.eyebrow')} intro={t('m02.ml.intro')} wide
      actions={<><L to="/my/skills" className="btn-outline">{t('m02.ml.toPassport')}</L><L to="/competencies/levels" className="btn-ghost">{t('m02.ml.toLevels')}</L></>}>
      <div className="flex flex-wrap gap-2" data-testid="m02-bench-my-levels"><BenchmarkChips feature="FS23" /><BenchmarkChips feature="FS24" /></div>
      <Async state={state} isEmpty={(x) => x.m.ps.length === 0} empty={<EmptyState title={t('m02.ml.empty')}><L to="/my/skills">{t('m02.ml.toPassport')}</L></EmptyState>}>
        {(x) => <Body d={x.d} ps={x.m.ps} ar={x.m.ar} />}
      </Async>
    </Page>
  );
}

function Body({ d, ps, ar }: { d: LevelsData; ps: Row[]; ar: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const levelName = useLevelName();
  const [flt, setFlt] = useFilters({ q: '', level: '' }, true);
  const fwShort = (id: string) => d.frameworks.find((x) => x.id === id)?.short ?? id;
  const rows = useMemo(() => ps.map((p) => ({ p, s: d.skill.get(p.skill_id) })).filter((x) => x.s && x.s.area !== 'security')
    .sort((a, b) => Number(b.p.level) - Number(a.p.level) || String(a.s.sort ?? 0).localeCompare(String(b.s.sort ?? 0), 'en', { numeric: true })), [ps, d.skill]);
  const term = flt.q.trim().toLowerCase();
  const list = rows.filter((x) => (!flt.level || String(x.p.level) === flt.level) && (!term || `${x.s.name_en} ${x.s.name_ar} ${x.s.code}`.toLowerCase().includes(term)));
  const recognised = ar.filter((x) => x.status === 'recognised');
  const today = todayIso();
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m02-ml-tiles">
        <StatTile label={t('m02.ml.tSkills')} value={f.num(rows.length)} sub={t('m02.ml.tSkillsSub')} />
        <StatTile label={t('m02.ml.tExpert')} value={f.num(rows.filter((x) => Number(x.p.level) === 4).length)} sub={t('m02.ml.tExpertSub')} tone="info" />
        <StatTile label={t('m02.ml.tNext')} value={f.num(rows.filter((x) => Number(x.p.level) < 4 && levelState(d.rangeOf.get(x.s.id), Number(x.p.level) + 1) === 'defined').length)} sub={t('m02.ml.tNextSub')} />
        <StatTile label={t('m02.ml.tAuthority')} value={f.num(recognised.length)} sub={t('m02.ml.tAuthoritySub')} tone={recognised.length ? 'ok' : undefined} />
      </div>

      {ar.length > 0 && (
        <Section title={t('m02.ml.authTitle')} description={t('m02.ml.authDesc')}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m02-ml-authority">
            {ar.map((r) => {
              const s = d.skill.get(r.skill_id);
              const rev = authorityReview(r.review_due, today);
              return (
                <Card key={r.id} as="li" title={<span className="flex flex-wrap items-center gap-2">{pick(s, 'name')}<StatusPill tone={r.status === 'recognised' ? 'ok' : r.status === 'proposed' ? 'info' : 'neutral'}>{t(`m02.au.status.${r.status}`)}</StatusPill></span>}>
                  <p className="text-[13px] text-ink-2">{pick(r, 'citation')}</p>
                  <p className="mt-2 text-[12px] text-ink-3">{t('m02.ml.panel', { seats: (r.panel ?? []).map((x: string) => t(`m02.au.seat.${x}`)).join(' · ') })}</p>
                  {r.status === 'recognised' && <p className="mt-1 text-[12px] text-ink-3">{t('m02.ml.recognisedOn', { date: f.date(String(r.recognised_on).slice(0, 10)), review: f.date(String(r.review_due).slice(0, 10)) })}{rev === 'due_soon' && <> · <StatusPill tone="sim">{t('m02.au.reviewDue')}</StatusPill></>}</p>}
                  {r.status === 'not_yet' && r.decision_note && <p className="mt-1 text-[12px] text-ink-3">{t('m02.ml.notYetNote')} {r.decision_note}</p>}
                  <p className="mt-2 text-[12px]"><span className="text-ink-3">{t('m02.ml.levelStays')}</span></p>
                </Card>
              );
            })}
          </ul>
          <Callout tone="info" title={t('m02.ml.neverTitle')}>{t('m02.ml.neverBody')}</Callout>
        </Section>
      )}

      <Section title={t('m02.ml.listTitle')} description={t('m02.ml.listDesc')}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[{ key: 'level', label: t('m02.ml.level'), options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: levelName(n) })) }]} />
        {list.length === 0 ? <EmptyState title={t('m02.ml.none')} /> : (
          <ul className="space-y-3" data-testid="m02-ml-list">
            {list.map(({ p, s }) => {
              const lv = Number(p.level);
              const r = d.rangeOf.get(s.id);
              const cur = d.descOf(s.id, lv);
              const nextLv = lv < 4 && levelState(r, lv + 1) === 'defined' ? lv + 1 : null;
              const next = nextLv ? d.descOf(s.id, nextLv) : null;
              const rec = ar.find((x) => x.skill_id === s.id && x.status === 'recognised');
              return (
                <li key={p.id} className="card p-4" data-testid={`m02-ml-skill-${s.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <L to={`/competencies/descriptors/${s.id}`} className="font-semibold">{pick(s, 'name')}</L>
                    <RangeDots range={r} held={lv} />
                    <StatusPill tone="ok">{levelName(lv)}</StatusPill>
                    <span className="text-[12px] text-ink-3">{t(`common.skills.basis.${p.basis}`)}</span>
                    {rec && <StatusPill tone="info">{t('m02.sc.band.authority')}</StatusPill>}
                    <span className="ms-auto"><EquivalentChips maps={d.maps} band={bandOfLevel(lv)} frameworks={frameworksFor(s)} fwShort={fwShort} /></span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <div className="caps mb-1">{t('m02.ml.seenToDo', { name: levelName(lv) })}</div>
                      {cur ? <DescriptorBlock d={cur} showModes={false} /> : <p className="text-[13px] text-ink-3">{t('m02.ml.noDescriptor')}</p>}
                    </div>
                    <div className="border-line md:border-s md:ps-4">
                      <div className="caps mb-1">{nextLv ? t('m02.ml.toShowNext', { name: levelName(nextLv) }) : t('m02.ml.topTitle')}</div>
                      {next ? <DescriptorBlock d={next} testId={`m02-ml-next-${s.id}`} /> : (
                        <div className="text-[13px] text-ink-2">
                          <p>{lv === 4 ? t('m02.ml.topExpert') : t('m02.ml.topRange')}</p>
                          {lv < 4 && <p className="mt-1 text-[12.5px] text-ink-3">{pick(r, 'rationale')}</p>}
                          <WhyThis reasons={[{ code: 'top', key: lv === 4 ? 'm02.ml.why.expert' : 'm02.ml.why.range' }, { code: 'sfia', key: 'm02.lv.why.sfia' }]} testId={`m02-ml-why-${s.id}`} />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
