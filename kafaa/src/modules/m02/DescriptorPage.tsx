// FS23 /competencies/descriptors/:skillId · A skill's behaviourally anchored descriptors (public): the ladder from "not yet" to Expert
// with a skill-specific essence, 2-4 observable indicators and evidence modes at every level where the skill exists, "not defined
// here" with the published rationale elsewhere, the generic level attributes beside each level (SFIA 9), the external equivalents
// of each level (FS24 scale map) and the skill's crosswalk level maps (FS08, data-only). Signed in: your level is marked and the next
// level reads "what to show next".
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Async, BenchmarkChips, Callout, Card, CheckboxField, EmptyState, Page, Section, StatusPill, WhyThis } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { levelState } from './descriptors';
import { alignmentFollowsMap, bandOfLevel } from './authority';
import { BasisPill, DescriptorBlock, EquivalentChips, LEVELS, RangeDots, TrackPill, frameworksFor, rangeReasons, useLevelName, useLevelsData, type LevelsData, type Row } from './levelsUi';

export default function DescriptorPage() {
  const t = useT();
  const { skillId = '' } = useParams();
  const q = useLevelsData();
  const pick = usePick();
  const s = q.data?.skill.get(skillId);
  return (
    <Page title={s ? pick(s, 'name') : t('m02.routes.competencies-descriptor.title')} eyebrow={t('m02.routes.competencies-descriptor.title')} intro={t('m02.dp.intro')} wide
      actions={<L to="/competencies/descriptors" className="btn-outline">{t('m02.dp.toLibrary')}</L>}>
      <div data-testid="m02-bench-fs23"><BenchmarkChips feature="FS23" /></div>
      <Async state={q} isEmpty={(d) => !d.skill.get(skillId)} empty={<EmptyState title={t('m02.dp.notFound')}><L to="/competencies/descriptors">{t('m02.dp.toLibrary')}</L></EmptyState>}>
        {(d) => <Body d={d} skillId={skillId} />}
      </Async>
    </Page>
  );
}

function useMine(skillId: string) {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  return useQuery(['person_skills', 'authority_recognitions'], async () => {
    if (!me) return null;
    const [ps, ar] = await Promise.all([
      repo.list('person_skills', { filter: { person_id: me, skill_id: skillId } }).catch(() => []) as Promise<Row[]>,
      repo.list('authority_recognitions', { filter: { person_id: me, skill_id: skillId } }).catch(() => []) as Promise<Row[]>,
    ]);
    return { ps: ps.find((x) => x.active !== false) ?? null, ar: ar.find((x) => x.status === 'recognised') ?? null };
  }, [me, skillId]);
}

function Body({ d, skillId }: { d: LevelsData; skillId: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const levelName = useLevelName();
  const s = d.skill.get(skillId)!;
  const r = d.rangeOf.get(skillId);
  const mine = useMine(skillId).data;
  const held = mine?.ps && Number(mine.ps.level) > 0 ? Number(mine.ps.level) : null;
  const [showAttrs, setShowAttrs] = useState(false);
  const fws = frameworksFor(s);
  const fwShort = (id: string) => d.frameworks.find((x) => x.id === id)?.short ?? id;
  const attr = (lv: number, a: string) => d.attrs.find((x) => x.level === lv && x.attribute === a);
  const name = { en: s.name_en, ar: s.name_ar };
  const aligns = useMemo(() => d.alignments.filter((a) => a.skill_id === skillId && a.status === 'published'), [d.alignments, skillId]);
  const next = held && held < 4 && levelState(r, held + 1) === 'defined' ? held + 1 : null;
  const latest = d.descs.filter((x) => x.skill_id === skillId && x.status === 'published').reduce((m, x) => (String(x.updated_at) > m ? String(x.updated_at) : m), '');
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
          <bdi dir="ltr" className="font-semibold">{s.code}</bdi><span>·</span><span>{t(`m02.area.${s.area}`)}</span><TrackPill track={r?.track} /><BasisPill basis={r?.basis} />
          <RangeDots range={r} held={held} testId="m02-dp-range" />
          <L to={`/skills/${s.id}`} className="ms-auto text-[12.5px]">{t('m02.dp.toSkill')}</L>
        </div>
        <p className="mt-2 text-[13.5px] text-ink-2">{pick(s, 'description')}</p>
        {r && <p className="mt-2 text-[13px]" data-testid="m02-dp-rationale"><span className="font-semibold">{t('m02.dp.whyRange')} </span>{pick(r, 'rationale')}</p>}
        {latest && <p className="mt-1 text-[11.5px] text-ink-3">{t('m02.dp.updated', { date: f.date(latest.slice(0, 10)) })}</p>}
      </Card>

      {mine && (
        <Callout tone={held ? 'ok' : 'info'} title={held ? t('m02.dp.youHold', { level: f.num(held), name: levelName(held) }) : t('m02.dp.youNotYet')}>
          <span data-testid="m02-dp-mine">
            {held ? t(`common.skills.basis.${mine.ps.basis}`) : t('m02.dp.youNotYetBody')}
            {next && <> · {t('m02.dp.nextIs', { name: levelName(next) })}</>}
            {mine.ar && <> · <StatusPill tone="info">{t('m02.dp.youAuthority')}</StatusPill></>}
          </span>
        </Callout>
      )}

      <Section title={t('m02.dp.ladderTitle')} description={t('m02.dp.ladderDesc')} actions={<CheckboxField label={t('m02.dp.showAttrs')} checked={showAttrs} onChange={setShowAttrs} />}>
        <ol className="space-y-3" data-testid="m02-dp-ladder">
          {LEVELS.map((lv) => {
            const st = levelState(r, lv);
            const desc = d.descOf(skillId, lv);
            const isHeld = held === lv;
            return (
              <li key={lv} className={`card p-4 ${st !== 'defined' ? 'border-dashed bg-sunken/40' : ''} ${isHeld ? 'ring-2 ring-ok' : ''} ${next === lv ? 'ring-2 ring-accent/50' : ''}`} data-testid={`m02-dp-level-${lv}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-[15px] font-semibold text-eyebrow">{f.num(lv)}</span>
                  <span className="font-semibold">{levelName(lv)}</span>
                  {Number(s.key_level) === lv && st === 'defined' && <StatusPill tone="info">{t('m02.dp.keyLevel')}</StatusPill>}
                  {isHeld && <StatusPill tone="ok">{t('m02.dp.yourLevel')}</StatusPill>}
                  {next === lv && <StatusPill tone="neutral">{t('m02.dp.nextLevel')}</StatusPill>}
                  <span className="ms-auto"><EquivalentChips maps={d.maps} band={bandOfLevel(lv)} frameworks={fws} fwShort={fwShort} /></span>
                </div>
                <div className={`mt-3 grid grid-cols-1 gap-4 ${showAttrs ? 'lg:grid-cols-[2fr_1fr]' : ''}`}>
                  {st === 'defined' && desc ? (
                    <DescriptorBlock d={desc} testId={`m02-dp-desc-${lv}`} />
                  ) : (
                    <div className="text-[13px] text-ink-2" data-testid={`m02-dp-undefined-${lv}`}>
                      <p className="font-medium">{t('m02.dp.notDefined')}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-ink-3">{t(st === 'below' ? 'm02.dp.belowRange' : 'm02.dp.aboveRange')}</span>
                        <WhyThis reasons={rangeReasons(r, lv, name)} testId={`m02-dp-why-${lv}`} />
                      </div>
                    </div>
                  )}
                  {showAttrs && (
                    <dl className="space-y-1 border-line text-[12.5px] lg:border-s lg:ps-4" data-testid={`m02-dp-attrs-${lv}`}>
                      {['autonomy', 'influence', 'complexity', 'knowledge', 'behaviours'].map((a) => (
                        <div key={a}><dt className="caps">{pick(attr(lv, a), 'name')}</dt><dd className="text-ink-2">{pick(attr(lv, a), 'text')}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            );
          })}
          <li className="card border-accent/40 bg-accent-soft/30 p-4" data-testid="m02-dp-authority">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t('m02.sc.band.authority')}</span>
              <StatusPill tone="info">{t('m02.lv.notALevel')}</StatusPill>
              <span className="ms-auto"><EquivalentChips maps={d.maps} band="authority" frameworks={fws} fwShort={fwShort} /></span>
            </div>
            <p className="mt-2 text-[13px] text-ink-2">{t('m02.dp.authorityBody')} <L to="/competencies/scale" className="text-eyebrow">{t('m02.dp.toScale')}</L></p>
          </li>
        </ol>
      </Section>

      <Section title={t('m02.dp.crosswalkTitle')} description={t('m02.dp.crosswalkDesc')}>
        {aligns.length === 0 ? <EmptyState title={t('m02.dp.noCrosswalk')} /> : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="m02-dp-crosswalk">
            {aligns.map((a) => {
              const fol = alignmentFollowsMap(a.level_map, d.maps, a.framework);
              return (
                <li key={a.id} className="card p-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{fwShort(a.framework)}</span>
                    <span className="text-ink-2">{pick(a, 'label')}</span>
                    {fol !== 'n/a' && fol !== 'empty' && <StatusPill tone={fol === 'follows' ? 'ok' : 'sim'}>{t(`m02.sc.follow.${fol}`)}</StatusPill>}
                  </div>
                  {Object.keys(a.level_map ?? {}).length > 0 && (
                    <p className="mt-1 text-[12px] text-ink-3">
                      {Object.entries(a.level_map as Record<string, string>).map(([k, v]) => `${t('m02.dp.lvShort', { n: f.num(Number(k)) })} → ${v}`).join(' · ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
