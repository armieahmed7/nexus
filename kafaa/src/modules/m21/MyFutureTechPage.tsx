// M21 /my/future/:tech (F09): my readiness for one technology family. Every ADVANCE skill with how my level counts
// (transfers in full, adapts at half, new at zero) and the evidence behind it, the bridges into this family, the learning
// suggestions that close my gaps most (F02 gap closure) and the concept roles in this family I am closest to.
// FS13: the breakdown is readiness v2 (carry, new capability, recorded learning, credit per ADVANCE skill) with both ceilings and
// the learning and practice that would raise this family most, each with a before/after preview.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, WhyThis, EngineBadge, KeyValue, SimChip } from '../../ui';
import { useT, usePick, useFormat, L, techDesigns } from '../../i18n';
import { useEngine } from '../../data';
import { skillReasons, type StoredReason } from '../../domain/skills';
import type { Reason } from '../../domain/engines/types';
import { NoDecision } from '../m11/shared';
import { SourceList, useSourceDates, type Source } from '../m09/shared';
import { m21Reason, rankBridges, rankFutureRoles, rankResources, TARGET_LEVEL } from './future';
import { itemReasons, pointsOf, toV1Family, v2Levels } from './raises';
import { FS13Chips, PreviewModal, ReadinessMeter, useBi, useRaiseLabels, useRaises } from './v2ui';
import type { RaiseAction } from './raises';
import { FutureMeData, GoalButton, IndexBadge, IndexMeter, InterestToggle, LevelDots, RELATION_TONE, techSlug, useFutureMe, useLabels, useReadiness } from './shared';
import { ResourceList } from './MyFuturePage';
import { NextGenLink } from '../m31/links'; // FS wave E integration (FS38 -> FS13)

export default function MyFutureTechPage() {
  const t = useT();
  const { tech = '' } = useParams();
  const id = tech.startsWith('tech-') ? tech : `tech-${tech}`;
  const q = useFutureMe();
  const eng = useEngine('recommend');
  return (
    <Page title={t('m21.routes.my-future-tech.title')} eyebrow={t('m21.page.eyebrow')} actions={<EngineBadge engine={eng} />} wide>
      <NoDecision compact />
      <FS13Chips />
      <Async state={q} isEmpty={(d) => !d} empty={<EmptyState title={t('m21.page.signIn')} />}>
        {(d) => (d!.techs.some((x) => x.id === id) ? <Tech d={d!} id={id} /> : <EmptyState title={t('m21.tech.notFound')} action={<L to="/my/future" className="btn-outline btn-sm">{t('m21.tech.back')}</L>} />)}
      </Async>
    </Page>
  );
}

function Tech({ d, id }: { d: FutureMeData; id: string }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const dates = useSourceDates();
  const eng = useEngine('recommend');
  const labels = useLabels(d);
  const v1 = useReadiness(d, labels);
  const f2 = d.rv2?.families.find((x) => x.tech_id === id) ?? null;
  const rd = useMemo(() => (d.rv2 ? { ...v1, overall: d.rv2.overall, families: d.rv2.families.map((x) => toV1Family(x)), levels: v2Levels(d.rv2) } : v1), [d.rv2, v1]);
  const fam = rd.families.find((x) => x.tech_id === id)!;
  const rl = useRaiseLabels(d, labels);
  const ranked = useRaises(d, d.rv2, labels);
  const bi = useBi();
  const [pv, setPv] = useState<RaiseAction | null>(null);
  const raises = ranked.filter((x) => (x.item?.families.find((y) => y.tech_id === id)?.delta ?? 0) > 0)
    .sort((a, b) => (b.item!.families.find((y) => y.tech_id === id)!.delta - a.item!.families.find((y) => y.tech_id === id)!.delta) || (a.id < b.id ? -1 : 1)).slice(0, 4);
  const x = d.techs.find((y) => y.id === id)!;
  const adv = d.advSkills.filter((a) => a.tech_id === id);
  const myRole = d.person?.job_role_id ?? null;
  const bridges = useMemo(() => rankBridges({ bridges: d.bridges.filter((b) => b.tech_id === id), families: rd.families, myRole, edges: d.edges, roleLabels: labels.roles, techLabels: labels.techs }), [d, rd, id, myRole, labels]);
  const resources = useMemo(() => rankResources(d.resources, fam, labels.adv, eng.weights), [d.resources, fam, labels, eng.weights]);
  const roles = useMemo(() => rankFutureRoles({ roles: d.roles.filter((r) => r.tech_ids.includes(id)), levels: rd.levels, myRole, edges: d.edges, roleLabels: labels.roles, advLabels: labels.adv }), [d.roles, rd, id, myRole, d.edges, labels]);
  const stateOf = (skillId: string | null) => (skillId ? d.states.find((s) => s.skill_id === skillId) : undefined);
  const rowReasons = (advId: string): Reason[] => {
    const it = fam.items.find((i) => i.adv_skill_id === advId)!;
    const st = stateOf(it.via);
    const base: Reason[] = [m21Reason(`rel_${it.relation}`, { factor: it.factor })];
    if (it.via) base.push(m21Reason('via', { skill: labels.skills[it.via] ?? { en: it.via, ar: it.via }, level: it.level }));
    else base.push(m21Reason('no_evidence'));
    return [...base, ...(st ? skillReasons(((st.reasons as StoredReason[]) ?? []).slice(0, 3)) : [])];
  };
  return (
    <>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="relative overflow-hidden">
          <div className="frame-line absolute inset-x-0 top-0 h-1" aria-hidden />
          <div className="caps num">{techDesigns(t, x.designs)}</div>
          <h2 className="text-[20px] font-semibold leading-snug">{pick(x, 'family')}</h2>
          <div className="mt-3 flex flex-col gap-3">
            {f2 ? (
              <>
                <IndexBadge size="lg" value={f2.index} label={t('m21.fam.index')} sub={t('m21.v2.ceilings', { c: f.num(f2.carry_ceiling, { maximumFractionDigits: 1 }), l: f.num(f2.learn_ceiling, { maximumFractionDigits: 1 }) })} />
                <ReadinessMeter value={f2.index} carry={f2.carry_ceiling} learn={f2.learn_ceiling} label={t('m21.v2.meter', { v: f.num(f2.index), c: f.num(f2.carry_ceiling), l: f.num(f2.learn_ceiling) })} />
              </>
            ) : (
              <>
                <IndexBadge size="lg" value={fam.index} label={t('m21.fam.index')} sub={t('m21.fam.ceiling', { n: f.num(fam.ceiling, { maximumFractionDigits: 1 }) })} />
                <IndexMeter value={fam.index} ceiling={fam.ceiling} label={t('m21.hero.meter', { v: f.num(fam.index), c: f.num(fam.ceiling) })} />
              </>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <WhyThis reasons={fam.reasons} />
              <InterestToggle d={d} kind="tech" target={id} />
              <L to={`/future/${techSlug(id)}`} className="text-[12.5px]">{t('m21.tech.public')}</L>
            </div>
          </div>
        </Card>
        <Card title={t('m21.tech.about')}>
          <KeyValue items={[
            [t('m11.pub.partners'), pick(x, 'partners')],
            [t('m11.pub.differs'), pick(x, 'skill_areas')],
            [t('m11.pub.mouDate'), <span key="d" className="num">{x.mou_date} <span className="chip border-sim-line bg-sim-bg text-sim">{t('m11.pub.nonBinding')}</span></span>],
          ]} />
          <div className="mt-3"><SourceList sources={(x.sources as Source[]) ?? []} dates={dates} /></div>
        </Card>
      </section>
      <div className="my-4"><NextGenLink compact /></div>

      <Section title={t('m21.tech.skillsTitle')} description={t(f2 ? 'm21.v2.tech.skillsDesc' : 'm21.tech.skillsDesc')}>
        <div className="card overflow-x-auto">
          <table className="table-base w-full text-[13px]" data-testid="m21-breakdown">
            <caption className="sr-only">{t('m21.tech.skillsTitle')}</caption>
            <thead className="bg-raised">
              <tr>
                <th scope="col">{t('m21.tech.col.skill')}</th>
                <th scope="col">{t('m21.tech.col.relation')}</th>
                {f2 ? (<>
                  <th scope="col">{t('m21.v2.tech.carry')}</th>
                  <th scope="col">{t('m21.v2.tech.direct')}</th>
                  <th scope="col">{t('m21.v2.tech.learn')}</th>
                  <th scope="col" className="text-end">{t('m21.v2.tech.credit')}</th>
                </>) : (<>
                  <th scope="col">{t('m21.tech.col.level')}</th>
                  <th scope="col">{t('m21.tech.col.counts')}</th>
                </>)}
                <th scope="col" className="text-end">{t('m21.tech.col.points')}</th>
                <th scope="col"><span className="sr-only">{t('m21.tech.col.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {adv.map((a) => {
                const it = fam.items.find((i) => i.adv_skill_id === a.id)!;
                const v = f2?.items.find((i) => i.adv_skill_id === a.id);
                const cell = (lv: number, name: string | null) => (lv > 0 ? <span className="inline-flex flex-col"><span className="inline-flex items-center gap-1.5"><LevelDots level={Math.min(lv, 4)} label={t('m21.hz.levelOf', { n: f.num(lv) })} /><span className="num">{f.num(lv)}</span></span>{name && <span className="text-[11.5px] text-ink-3">{name}</span>}</span> : <span className="text-ink-3">—</span>);
                return (
                  <tr key={a.id} data-testid="m21-breakdown-row">
                    <th scope="row" className="text-start font-semibold">{pick(a, 'skill')}{!v && it.via && <div className="text-[11.5px] font-normal text-ink-3">{t('m21.tech.via', { skill: pick(d.skills.find((s) => s.id === it.via), 'name') })}</div>}</th>
                    <td><span className={`chip ${RELATION_TONE[a.relation]}`}>{t(`m11.rel.${a.relation}`)}</span></td>
                    {v ? (<>
                      <td>{cell(v.carry_level, v.carry_via ? pick(d.skills.find((s) => s.id === v.carry_via), 'name') : null)}</td>
                      <td>{cell(v.direct_level, v.direct_via ? pick(d.skills.find((s) => s.id === v.direct_via), 'name') : null)}</td>
                      <td>{cell(v.learn_level, v.learn_via ? pick(d.resources.find((r) => r.id === v.learn_via), 'title') : null)}</td>
                      <td className="num text-end" data-testid="m21-credit">{f.pct(v.bp / 100, 0)}</td>
                      <td className="num text-end">{f.num(pointsOf(v, f2!.n), { maximumFractionDigits: 1 })} <SimChip /></td>
                      <td><div className="flex flex-wrap justify-end gap-1.5"><WhyThis reasons={itemReasons(v, rl)} />{v.bp < 10000 && <GoalButton d={d} kind="adv_skill" refId={a.id} compact />}</div></td>
                    </>) : (<>
                      <td><span className="inline-flex items-center gap-2"><LevelDots level={it.level} label={t('m21.hz.levelOf', { n: f.num(it.level) })} /><span className="num">{f.num(it.level)}</span></span></td>
                      <td className="num">{t('m21.tech.factor', { n: f.num(it.factor, { maximumFractionDigits: 1 }) })}</td>
                      <td className="num text-end">{f.num(Math.round((1000 * it.credit) / Math.max(1, fam.n)) / 10, { maximumFractionDigits: 1 })} <SimChip /></td>
                      <td><div className="flex flex-wrap justify-end gap-1.5"><WhyThis reasons={rowReasons(a.id)} />{(it.level < TARGET_LEVEL) && <GoalButton d={d} kind="adv_skill" refId={a.id} compact />}</div></td>
                    </>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-ink-3">{t(f2 ? 'm21.v2.tech.note' : 'm21.tech.pointsNote')}</p>
      </Section>

      {f2 && (
        <Section title={t('m21.v2.tech.raiseTitle')} description={t('m21.v2.tech.raiseDesc')}>
          {raises.length === 0 ? <EmptyState title={t('m21.v2.raise.empty')} /> : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m21-tech-raises">
              {raises.map((x) => {
                const fd = x.item!.families.find((y) => y.tech_id === id)!;
                return (
                  <li key={x.id} className="card flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <span className="chip border-line bg-sunken text-ink-2">{t(`m21.v2.kind.${x.item!.kind}`)}</span>
                      <div className="mt-1 font-semibold leading-snug">{bi(x.item!.title)}</div>
                      <div className="num text-[12px] text-ink-3">{f.num(fd.before)} → {f.num(fd.after)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="num text-[20px] font-semibold text-eyebrow">+{f.num(fd.delta)}</span>
                      <div className="flex gap-1.5"><WhyThis reasons={x.reasons} /><button type="button" className="btn-outline btn-sm" onClick={() => setPv(x.item!)}>{t('m21.v2.preview.open')}</button></div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {pv && d.rv2 && <PreviewModal open onClose={() => setPv(null)} r={d.rv2} change={pv.change} title={bi(pv.title)} d={d} />}
        </Section>
      )}

      <Section title={t('m21.tech.bridgesTitle')} description={t('m21.tech.bridgesDesc')}>
        {bridges.length === 0 ? <EmptyState title={t('m21.tech.noBridges')} /> : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m21-tech-bridges">
            {bridges.map((r) => {
              const b = d.bridges.find((y) => y.id === r.id)!;
              return (
                <li key={r.id} className="card flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <L to={`/careers/roles/${b.from_role_id}`} className="font-semibold">{pick(d.jobRoles.find((j) => j.id === b.from_role_id), 'title')}</L>
                    <WhyThis reasons={r.reasons} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-btn border border-ok-line bg-ok-bg p-2.5"><div className="caps text-ok">{t('m11.pub.transfers')}</div><p className="text-[13px]">{pick(b, 'transfers')}</p></div>
                    <div className="rounded-btn border border-sim-line bg-sim-bg p-2.5"><div className="caps text-sim">{t('m11.pub.isNew')}</div><p className="text-[13px]">{pick(b, 'new')}</p></div>
                  </div>
                  <div className="mt-auto"><GoalButton d={d} kind="bridge" refId={b.id} /></div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t('m21.tech.resTitle')} description={t('m21.tech.resDesc')}>
        <ResourceList ranked={resources.slice(0, 6)} title={t('m21.tech.resRanked')} />
      </Section>

      <Section title={t('m21.tech.rolesTitle')}>
        {roles.length === 0 ? <EmptyState title={t('m21.roles.empty')} /> : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m21-tech-roles">
            {roles.map((r) => (
              <li key={r.id} className="card flex flex-col gap-2 p-4">
                <h3 className="font-semibold leading-snug">{pick(r.item, 'title')}</h3>
                <p className="text-[13px] text-ink-2">{pick(r.item, 'summary')}</p>
                <IndexBadge size="sm" value={Math.round(r.score * 1000) / 10} label={t('m21.roles.closeness')} />
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                  <WhyThis reasons={r.reasons} />
                  <GoalButton d={d} kind="future_role" refId={r.id} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <NoDecision />
    </>
  );
}
