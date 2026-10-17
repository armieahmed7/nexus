// M11 /future: the ADVANCE programme and the skills advanced reactors may need. Technology families with their MoU partners,
// sources and dates; skills per technology; skill bridges from today's roles; a future-role catalogue; learning tracks.
// Every page carries "ENEC is evaluating these technologies; no deployment decision is implied". No headcount, no sites.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Grid, SelectField, FilterBar, useFilters, EmptyState, SourceLink, Icon } from '../../ui';
import { useT, usePick, useFormat, useLang, L, techDesigns } from '../../i18n';
import { useQuery, useRepo, type RowOf } from '../../data';
import { publicTextIsClean } from '../../domain/future';
import { SourceList, useSourceDates, type Source } from '../m09/shared';
import { AREAS, NoDecision, RELATION_CLS, techSlug } from './shared';
import { NextGenLink } from '../m31/links'; // FS wave E integration (FS38 -> ADVANCE pages)
import { CourseLink } from '../m04/CourseLink'; // audit 2026-10-13: internal courses are not linked for signed-out visitors

export type FutureData = {
  techs: RowOf<'adv_technologies'>[];
  skills: RowOf<'adv_skills'>[];
  bridges: RowOf<'skill_bridges'>[];
  roles: RowOf<'future_roles'>[];
  tracks: RowOf<'adv_tracks'>[];
  jobRoles: RowOf<'job_roles'>[];
  orgs: RowOf<'organisations'>[];
};
export function useFutureData() {
  const repo = useRepo();
  return useQuery(['adv_technologies', 'adv_skills', 'skill_bridges', 'future_roles', 'adv_tracks', 'job_roles', 'organisations'], async (): Promise<FutureData> => {
    const [techs, skills, bridges, roles, tracks, jobRoles, orgs] = await Promise.all([
      repo.list('adv_technologies', { order: [['sort', 'asc']] }),
      repo.list('adv_skills', { order: [['sort', 'asc']] }),
      repo.list('skill_bridges'),
      repo.list('future_roles', { order: [['sort', 'asc']] }),
      repo.list('adv_tracks', { order: [['sort', 'asc']] }),
      repo.list('job_roles'),
      repo.list('organisations', { filter: { public_listed: true } }),
    ]);
    return { techs, skills, bridges, roles, tracks, jobRoles, orgs };
  });
}

const ADVANCE_URL = 'https://world-nuclear-news.org/articles/enec-to-evaluate-deployment-of-smrs-and-microreact';
const COP28_URL = 'https://world-nuclear-news.org/articles/enec-signs-multiple-smr-mous';
const FANR_URL = 'https://www.thenationalnews.com/business/energy/2026/02/11/uaes-nuclear-regulator-ready-for-capacity-expansion/';
const KEPCO_URL = 'https://www.world-nuclear-news.org/articles/kepco-and-enec-enhance-cooperation-in-nuclear-energy';
const PRESIGHT_URL = 'https://www.enec.ae/en/news/latest-news/enec-and-presight-co-develop-eneciq-ai-platform-to-boost-efficiency-and-knowledge-sharing/';
const EDF_URL = 'https://www.world-nuclear-news.org/articles/edf-to-assist-with-barakah-operation-and-maintenan';

export default function FuturePage() {
  const t = useT();
  const q = useFutureData();
  return (
    <Page title={t('m11.routes.future.title')} eyebrow={t('m11.pub.eyebrow')} intro={t('m11.pub.intro')}>
      <NoDecision />
      <Async state={q} isEmpty={(d) => d.techs.length === 0} empty={<EmptyState title={t('m11.pub.empty')} />}>{(d) => <Body d={d} />}</Async>
      <NoDecision compact />
    </Page>
  );
}

function Body({ d }: { d: FutureData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const dates = useSourceDates();
  const asOf = (id: string) => t('common.asOf', { date: f.date(dates.get(id) ?? '2026-10-08') });
  // Rule M11-R1: the public page never renders projected headcount or site information.
  const clean = publicTextIsClean([...d.techs, ...d.skills, ...d.roles, ...d.tracks, ...d.bridges]);
  return (
    <>
      <div className="mb-4"><NextGenLink /></div>
      <Section title={t('m11.pub.advanceTitle')}>
        <Grid cols={3}>
          <Card eyebrow={t('m11.pub.advanceDate')} title={t('m11.pub.advanceLaunch')}>
            <p className="text-[13px] text-ink-2">{t('m11.pub.advanceLaunchBody')}</p>
            <div className="mt-2"><SourceLink href={ADVANCE_URL} date={asOf('wnn-advance')}>{t('m11.pub.srcAdvance')}</SourceLink></div>
          </Card>
          <Card eyebrow={t('m11.pub.copDate')} title={t('m11.pub.copTitle')}>
            <p className="text-[13px] text-ink-2">{t('m11.pub.copBody')}</p>
            <div className="mt-2"><SourceLink href={COP28_URL} date={asOf('wnn-smr-mous')}>{t('m11.pub.srcCop')}</SourceLink></div>
          </Card>
          <Card eyebrow={t('m11.pub.fanrDate')} title={t('m11.pub.fanrTitle')}>
            <p className="text-[13px] text-ink-2">{t('m11.pub.fanrBody')}</p>
            <div className="mt-2"><SourceLink href={FANR_URL} date={asOf('national-fanr-2026')}>{t('m11.pub.srcFanr')}</SourceLink></div>
          </Card>
        </Grid>
      </Section>

      <Section title={t('m11.pub.techTitle')} description={t('m11.pub.techDesc')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m11-techs">
          {d.techs.map((x) => {
            const sk = d.skills.filter((s) => s.tech_id === x.id);
            return (
              <li key={x.id} className="card flex flex-col gap-2 p-4" data-testid="m11-tech-card">
                <div className="caps num">{techDesigns(t, x.designs)}</div>
                <L to={`/future/${techSlug(x.id)}`} className="text-[15px] font-semibold leading-snug">{pick(x, 'family')}</L>
                <p className="text-[13px]"><span className="font-semibold">{t('m11.pub.partners')}: </span>{pick(x, 'partners')}</p>
                <p className="text-[13px] text-ink-2"><span className="font-semibold text-ink">{t('m11.pub.differs')}: </span>{pick(x, 'skill_areas')}</p>
                <div className="flex flex-wrap gap-1 text-[11.5px]">
                  {(['transfers', 'adapts', 'new'] as const).map((r) => <span key={r} className={`chip ${RELATION_CLS[r]}`}>{t(`m11.rel.${r}`)} · {f.num(sk.filter((s) => s.relation === r).length)}</span>)}
                </div>
                <div className="mt-auto space-y-1 border-t border-line pt-2">
                  <div className="text-[12px]"><span className="caps">{t('m11.pub.mouDate')}: </span><span className="num">{x.mou_date}</span> <span className="chip border-sim-line bg-sim-bg text-sim">{t('m11.pub.nonBinding')}</span></div>
                  <SourceList sources={(x.sources as Source[]) ?? []} dates={dates} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[12.5px] text-ink-3">{t('m11.pub.techFoot')}</p>
      </Section>

      <SkillsMatrix d={d} />
      <Bridges d={d} />
      <Catalogue d={d} />
      <Tracks d={d} />

      <Section title={t('m11.pub.adjacentTitle')}>
        <Grid cols={2}>
          <Card title={t('m11.pub.aiTitle')}>
            <p className="text-[13px] text-ink-2">{t('m11.pub.aiBody')}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <SourceLink href={KEPCO_URL} date={asOf('wnn-kepco-2025')}>{t('m11.pub.srcKepco')}</SourceLink>
              <SourceLink href={PRESIGHT_URL} date={asOf('enec-presight')}>{t('m11.pub.srcPresight')}</SourceLink>
            </div>
          </Card>
          <Card title={t('m11.pub.cmTitle')}>
            <p className="text-[13px] text-ink-2">{t('m11.pub.cmBody')}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <SourceLink href={COP28_URL} date={asOf('wnn-smr-mous')}>{t('m11.pub.srcInl')}</SourceLink>
              <SourceLink href={EDF_URL} date={asOf('wnn-edf')}>{t('m11.pub.srcEdf')}</SourceLink>
            </div>
          </Card>
        </Grid>
      </Section>
      {!clean && <p className="text-[12px] text-bad">{t('m11.pub.guard')}</p>}
    </>
  );
}

function SkillsMatrix({ d }: { d: FutureData }) {
  const t = useT();
  const pick = usePick();
  const areas = AREAS.filter((a) => d.skills.some((s) => s.area === a));
  return (
    <Section title={t('m11.pub.matrixTitle')} description={t('m11.pub.matrixDesc')}>
      <div className="flex flex-wrap gap-2 text-[12px]">{(['transfers', 'adapts', 'new'] as const).map((r) => <span key={r} className={`chip ${RELATION_CLS[r]}`}>{t(`m11.rel.${r}`)}: {t(`m11.relHint.${r}`)}</span>)}</div>
      <div className="card overflow-x-auto" tabIndex={0}>
        <table className="table-base w-full text-[12.5px]" data-testid="m11-matrix">
          <caption className="sr-only">{t('m11.pub.matrixTitle')}</caption>
          <thead className="bg-raised">
            <tr><th scope="col">{t('m11.pub.area')}</th>{d.techs.map((x) => <th key={x.id} scope="col">{pick(x, 'family')}</th>)}</tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a}>
                <th scope="row" className="text-start font-semibold">{t(`m11.area.${a}`)}</th>
                {d.techs.map((x) => {
                  const cell = d.skills.filter((s) => s.tech_id === x.id && s.area === a);
                  return (
                    <td key={x.id} className="align-top">
                      {cell.length ? <ul className="space-y-1">{cell.map((s) => <li key={s.id}><span className={`chip ${RELATION_CLS[s.relation]}`} title={t(`m11.rel.${s.relation}`)}>{pick(s, 'skill')}</span></li>)}</ul> : <span className="text-ink-3">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Bridges({ d }: { d: FutureData }) {
  const t = useT();
  const pick = usePick();
  const fromIds = useMemo(() => Array.from(new Set(d.bridges.map((b) => b.from_role_id))), [d.bridges]);
  const [role, setRole] = useState(fromIds[0] ?? '');
  const jr = (id: string) => d.jobRoles.find((r) => r.id === id);
  const list = d.bridges.filter((b) => b.from_role_id === role);
  return (
    <Section title={t('m11.pub.bridgeTitle')} description={t('m11.pub.bridgeDesc')}>
      <div className="max-w-sm">
        <SelectField label={t('m11.pub.fromRole')} name="from-role" value={role} onChange={setRole} options={fromIds.map((id) => ({ value: id, label: jr(id) ? pick(jr(id), 'title') : id }))} />
      </div>
      {list.length === 0 ? <EmptyState title={t('m11.pub.noBridges')} /> : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m11-bridges">
          {list.map((b) => {
            const tech = d.techs.find((x) => x.id === b.tech_id);
            return (
              <li key={b.id} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold">{jr(b.from_role_id) ? pick(jr(b.from_role_id), 'title') : b.from_role_id}</span>
                  <Icon name="chevron" size={14} className="text-ink-3" />
                  <L to={`/future/${techSlug(b.tech_id)}`} className="font-semibold">{tech ? pick(tech, 'family') : b.tech_id}</L>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-btn border border-ok-line bg-ok-bg p-2.5"><div className="caps text-ok">{t('m11.pub.transfers')}</div><p className="text-[13px]">{pick(b, 'transfers')}</p></div>
                  <div className="rounded-btn border border-sim-line bg-sim-bg p-2.5"><div className="caps text-sim">{t('m11.pub.isNew')}</div><p className="text-[13px]">{pick(b, 'new')}</p></div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {role && <L to={`/careers/roles/${role}`} className="text-[13px]">{t('m11.pub.roleLink')}</L>}
    </Section>
  );
}

function Catalogue({ d }: { d: FutureData }) {
  const t = useT();
  const pick = usePick();
  const [flt, setFlt] = useFilters({ tech: '', horizon: '' }, true);
  const rows = d.roles.filter((r) => (!flt.tech || r.tech_ids.includes(flt.tech)) && (!flt.horizon || r.horizon === flt.horizon));
  const jr = (id: string) => d.jobRoles.find((r) => r.id === id);
  const sk = (id: string) => d.skills.find((s) => s.id === id);
  return (
    <Section title={t('m11.pub.catalogueTitle')} description={t('m11.pub.catalogueDesc')}>
      <FilterBar value={flt} onChange={setFlt} fields={[
        { key: 'tech', label: t('m11.pub.f.tech'), options: d.techs.map((x) => ({ value: x.id, label: pick(x, 'family') })) },
        { key: 'horizon', label: t('m11.pub.f.horizon'), options: ['watch', 'explore', 'prepare'].map((h) => ({ value: h, label: t(`m11.horizon.${h}`) })) },
      ]} />
      <div className="flex flex-wrap gap-2 text-[12px] text-ink-2">{['watch', 'explore', 'prepare'].map((h) => <span key={h}><span className="font-semibold">{t(`m11.horizon.${h}`)}:</span> {t(`m11.horizonHint.${h}`)}</span>)}</div>
      {rows.length === 0 ? <EmptyState title={t('m11.pub.noRoles')} /> : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m11-future-roles">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug">{pick(r, 'title')}</h3>
                <span className="chip border-line bg-sunken text-ink-2">{t(`m11.horizon.${r.horizon}`)}</span>
              </div>
              <p className="text-[13px] text-ink-2">{pick(r, 'summary')}</p>
              <div className="text-[12.5px]"><span className="caps">{t('m11.pub.from')}: </span>{r.from_role_ids.map((id, i) => <span key={id}>{i > 0 && ', '}<L to={`/careers/roles/${id}`}>{jr(id) ? pick(jr(id), 'title') : id}</L></span>)}</div>
              <div className="flex flex-wrap gap-1">{r.skill_ids.map((id) => { const s = sk(id); return s ? <span key={id} className={`chip ${RELATION_CLS[s.relation]}`}>{pick(s, 'skill')}</span> : null; })}</div>
              <div className="mt-auto flex flex-wrap gap-1 border-t border-line pt-2 text-[12px]">{r.tech_ids.map((id) => { const x = d.techs.find((y) => y.id === id); return <L key={id} to={`/future/${techSlug(id)}`} className="chip border-line bg-panel text-ink">{x ? pick(x, 'family') : id}</L>; })}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12.5px] text-ink-3">{t('m11.pub.catalogueFoot')}</p>
    </Section>
  );
}

function Tracks({ d }: { d: FutureData }) {
  const t = useT();
  const lang = useLang();
  const pick = usePick();
  const f = useFormat();
  const dates = useSourceDates();
  return (
    <Section title={t('m11.pub.tracksTitle')} description={t('m11.pub.tracksDesc')}>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m11-tracks">
        {d.tracks.map((x) => (
          <li key={x.id} className="card flex flex-col gap-2 p-4">
            <div className="flex flex-wrap gap-1 text-[11.5px]">
              <span className="chip border-line bg-sunken text-ink-2">{t(`m11.audience.${x.audience}`)}</span>
              <span className="chip border-line bg-sunken text-ink-2">{t(`m11.level.${x.level}`)}</span>
              <span className="chip border-line bg-sunken text-ink-2">{t('m11.pub.hours', { n: f.num(x.hours) })}</span>
            </div>
            <h3 className="font-semibold leading-snug">{pick(x, 'title')}</h3>
            <p className="text-[13px] text-ink-2">{pick(x, 'summary')}</p>
            <ol className="list-inside list-decimal space-y-0.5 text-[12.5px]">
              {((x.modules as { en: string; ar: string; minutes: number }[]) ?? []).map((m, i) => <li key={i}>{lang === 'ar' ? m.ar : m.en} <span className="num text-ink-3">· {t('m11.pub.minutes', { n: f.num(m.minutes) })}</span></li>)}
            </ol>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
              <SourceList sources={(x.sources as Source[]) ?? []} dates={dates} compact />
              {x.course_id && <CourseLink courseId={x.course_id} className="text-[12.5px]">{t('m11.pub.openCourse')}</CourseLink>}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
