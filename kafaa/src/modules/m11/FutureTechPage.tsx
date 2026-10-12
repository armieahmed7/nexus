// M11 /future/:tech: one technology family. MoU partners (linked to the directory) with source and date, the skills it needs
// compared with APR-1400 operations, skill bridges from today's roles, concept future roles and learning tracks.
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Grid, KeyValue, Icon } from '../../ui';
import { useT, usePick, L } from '../../i18n';
import { SourceList, useSourceDates, type Source } from '../m09/shared';
import { useFutureData, type FutureData } from './FuturePage';
import { AREAS, NoDecision, RELATION_CLS, TECH_ORGS, techSlug } from './shared';
import { NextGenLink } from '../m31/links'; // FS wave E integration (FS38 -> ADVANCE pages)

export default function FutureTechPage() {
  const t = useT();
  const { tech = '' } = useParams();
  const q = useFutureData();
  const id = tech.startsWith('tech-') ? tech : `tech-${tech}`;
  return (
    <Async state={q}>
      {(d) => {
        const x = d.techs.find((y) => y.id === id);
        return x ? <Tech d={d} id={id} /> : (
          <Page title={t('m11.routes.future-tech.title')}>
            <NoDecision />
            <EmptyState title={t('m11.tech.notFound')} action={<L to="/future" className="btn-outline btn-sm">{t('m11.tech.back')}</L>} />
          </Page>
        );
      }}
    </Async>
  );
}

function Tech({ d, id }: { d: FutureData; id: string }) {
  const t = useT();
  const pick = usePick();
  const dates = useSourceDates();
  const x = d.techs.find((y) => y.id === id)!;
  const skills = d.skills.filter((s) => s.tech_id === id);
  const bridges = d.bridges.filter((b) => b.tech_id === id);
  const roles = d.roles.filter((r) => r.tech_ids.includes(id));
  const tracks = d.tracks.filter((r) => r.tech_ids.includes(id));
  const orgs = (TECH_ORGS[id] ?? []).map((o) => d.orgs.find((y) => y.id === o)).filter(Boolean) as FutureData['orgs'];
  const jr = (rid: string) => d.jobRoles.find((r) => r.id === rid);
  const idx = d.techs.findIndex((y) => y.id === id);
  const prev = d.techs[idx - 1];
  const next = d.techs[idx + 1];
  return (
    <Page title={pick(x, 'family')} eyebrow={x.designs} intro={pick(x, 'skill_areas')} actions={<L to="/future" className="btn-outline">{t('m11.tech.back')}</L>}>
      <NoDecision />
      <div className="mb-4"><NextGenLink compact /></div>
      <Grid cols={2}>
        <Card title={t('m11.tech.mou')}>
          <KeyValue items={[
            [t('m11.pub.partners'), pick(x, 'partners')],
            [t('m11.pub.mouDate'), <span key="d" className="num">{x.mou_date}</span>],
            [t('m11.tech.binding'), t('m11.pub.nonBinding')],
          ]} />
          {orgs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5" data-testid="m11-tech-orgs">
              {orgs.map((o) => <L key={o.id} to={`/partners/${o.id}`} className="chip border-line bg-panel text-ink hover:border-accent">{pick(o, 'name')}</L>)}
            </div>
          )}
        </Card>
        <Card title={t('m09.detail.sources')} footer={t('m11.tech.sourceFoot')}>
          <SourceList sources={(x.sources as Source[]) ?? []} dates={dates} />
        </Card>
      </Grid>

      <Section title={t('m11.tech.skills')} description={t('m11.pub.matrixDesc')}>
        {skills.length === 0 ? <EmptyState /> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m11-tech-skills">
            {(['transfers', 'adapts', 'new'] as const).map((r) => (
              <Card key={r} title={<span className={`chip ${RELATION_CLS[r]}`}>{t(`m11.rel.${r}`)}</span>}>
                <p className="mb-2 text-[12px] text-ink-3">{t(`m11.relHint.${r}`)}</p>
                <ul className="space-y-1 text-[13px]">
                  {skills.filter((s) => s.relation === r).sort((a, b) => AREAS.indexOf(a.area as never) - AREAS.indexOf(b.area as never)).map((s) => <li key={s.id}>{pick(s, 'skill')} <span className="text-[11.5px] text-ink-3">· {t(`m11.area.${s.area}`)}</span></li>)}
                  {skills.filter((s) => s.relation === r).length === 0 && <li className="text-ink-3">—</li>}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {bridges.length > 0 && (
        <Section title={t('m11.pub.bridgeTitle')}>
          <ul className="space-y-2">
            {bridges.map((b) => (
              <li key={b.id} className="card grid grid-cols-1 gap-3 p-3 md:grid-cols-[1fr_2fr_2fr]">
                <L to={`/careers/roles/${b.from_role_id}`} className="font-semibold">{jr(b.from_role_id) ? pick(jr(b.from_role_id), 'title') : b.from_role_id}</L>
                <div><div className="caps text-ok">{t('m11.pub.transfers')}</div><p className="text-[13px]">{pick(b, 'transfers')}</p></div>
                <div><div className="caps text-sim">{t('m11.pub.isNew')}</div><p className="text-[13px]">{pick(b, 'new')}</p></div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Grid cols={2}>
        <Card title={t('m11.pub.catalogueTitle')}>
          {roles.length === 0 ? <p className="text-ink-3">—</p> : (
            <ul className="space-y-2 text-[13px]">{roles.map((r) => <li key={r.id}><span className="font-semibold">{pick(r, 'title')}</span> <span className="chip border-line bg-sunken text-ink-2">{t(`m11.horizon.${r.horizon}`)}</span><p className="text-ink-2">{pick(r, 'summary')}</p></li>)}</ul>
          )}
        </Card>
        <Card title={t('m11.pub.tracksTitle')}>
          {tracks.length === 0 ? <p className="text-ink-3">—</p> : (
            <ul className="space-y-2 text-[13px]">{tracks.map((r) => <li key={r.id}><span className="font-semibold">{pick(r, 'title')}</span><p className="text-ink-2">{pick(r, 'summary')}</p>{r.course_id && <L to={`/learn/course/${r.course_id}`}>{t('m11.pub.openCourse')}</L>}</li>)}</ul>
          )}
        </Card>
      </Grid>

      <nav className="flex justify-between gap-2 text-[13px]" aria-label={t('m11.tech.navLabel')}>
        {prev ? <L to={`/future/${techSlug(prev.id)}`} className="inline-flex items-center gap-1"><Icon name="back" size={14} />{pick(prev, 'family')}</L> : <span />}
        {next ? <L to={`/future/${techSlug(next.id)}`} className="inline-flex items-center gap-1">{pick(next, 'family')}<Icon name="chevron" size={14} /></L> : <span />}
      </nav>
      <NoDecision compact />
    </Page>
  );
}
