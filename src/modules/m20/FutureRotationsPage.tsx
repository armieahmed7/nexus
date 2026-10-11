// /opportunities/rotations/future (M20 · FS28): rotations aimed at future roles (digital twin, data office, ADVANCE study team, energy
// transition). Each card shows the FS05 concept roles it prepares for, the placement sequence with its future-skill objectives, its sourced
// basis and, for ADVANCE, the career-level-only notice. Programme owners tag or untag templates (security roles are refused).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, Icon, SourceLink, BenchmarkChips, StatTile, Grid, ConfirmDialog, SelectField, CheckboxField, SimChip } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { OWNER_ROLES, totalMonths, type Step } from './rotation';
import { TRACKS, MAX_FUTURE_ROLES, validateTag } from './secondment';
import { TrackChip, FutureSkillChips, useRoleTitle, useRuleMessage } from './fsUi';
import type { JobRolesRow, RotationTemplatesRow, SkillsRow } from '../../data/types';

export default function FutureRotationsPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['rotation_templates', 'job_roles', 'skills'], async () => {
    const [templates, roles, skills] = await Promise.all([repo.list('rotation_templates', { order: [['title_en', 'asc']] }), repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('skills', { order: [['sort', 'asc']] })]);
    return { templates, roles, skills };
  });
  return (
    <Page title={t('m20.routes.rotations-future.title')} eyebrow={<L to="/opportunities/rotations">{t('m20.sec.rot.back')}</L>} intro={t('m20.sec.rot.intro')} wide>
      <div className="mb-4"><BenchmarkChips feature="FS28" /></div>
      <Async state={q} isEmpty={() => false}>{(d) => <Body templates={d.templates} roles={d.roles} skills={d.skills} />}</Async>
    </Page>
  );
}

function Body({ templates, roles, skills }: { templates: RotationTemplatesRow[]; roles: JobRolesRow[]; skills: SkillsRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const roleTitle = useRoleTitle(roles);
  const owner = s.roles.some((r) => (OWNER_ROLES as readonly string[]).includes(r));
  const future = templates.filter((x) => x.future_track);
  const published = future.filter((x) => x.status === 'active' && x.listed);
  const drafts = future.filter((x) => x.status !== 'active' || !x.listed);
  const concept = new Set(published.flatMap((x) => x.future_role_ids ?? []));
  return (
    <div className="space-y-6">
      <Grid cols={3}>
        <StatTile label={t('m20.sec.rot.statPublished')} value={f.num(published.length)} sub={t('m20.sec.rot.statPublishedSub')} tone="ok" />
        <StatTile label={t('m20.sec.rot.statRoles')} value={f.num(concept.size)} sub={t('m20.sec.rot.statRolesSub')} />
        <StatTile label={t('m20.sec.rot.statTracks')} value={f.num(new Set(published.map((x) => x.future_track)).size)} sub={t('m20.sec.rot.statTracksSub')} />
      </Grid>
      {published.length === 0 ? <EmptyState icon="sparkle" title={t('m20.sec.rot.none')} /> : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-3" data-testid="m20-sec-future-templates">
          {published.map((x) => <li key={x.id} data-testid="m20-sec-template" data-track={x.future_track ?? ''}><TemplateCard x={x} roleTitle={roleTitle} skills={skills} /></li>)}
        </ul>
      )}
      {drafts.length > 0 && (
        <Section title={t('m20.sec.rot.drafts')} description={t('m20.sec.rot.draftsSub')}>
          <ul className="grid grid-cols-1 gap-4 xl:grid-cols-3">{drafts.map((x) => <li key={x.id}><TemplateCard x={x} roleTitle={roleTitle} skills={skills} /></li>)}</ul>
        </Section>
      )}
      <Callout tone="info" title={t('m20.sec.rot.securityTitle')}>{t('m20.sec.rot.security')}</Callout>
      {owner && <TagCard templates={templates} roles={roles} />}
    </div>
  );
}

function TemplateCard({ x, roleTitle, skills }: { x: RotationTemplatesRow; roleTitle: (id: string) => string; skills: SkillsRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const steps = (x.steps as unknown as Step[]) ?? [];
  const sources = (x.sources as unknown as { id: string; label: string; url: string }[]) ?? [];
  return (
    <Card className="h-full">
      <div className="mb-2 flex flex-wrap items-center gap-1.5"><TrackChip track={x.future_track} />{x.career_level_only && <SimChip label={t('m20.sec.rot.careerLevel')} />}{x.status !== 'active' && <span className="chip border-line bg-sunken text-ink-2">{t('m20.sec.rot.draft')}</span>}</div>
      <h3 className="text-[15px] font-semibold leading-snug"><L to={`/opportunities/rotations/programmes/${x.id}`} className="hover:underline">{pick(x, 'title')}</L></h3>
      <p className="mt-1 text-[13px] text-ink-2">{pick(x, 'summary')}</p>
      <div className="mt-3">
        <div className="caps mb-1">{t('m20.sec.rot.prepares')}</div>
        <ul className="flex flex-wrap gap-1.5" data-testid="m20-sec-roles">
          {(x.future_role_ids ?? []).map((r) => <li key={r}><L to={`/careers/roles/${r}`} className="chip border-accent/30 bg-accent-soft text-eyebrow hover:underline"><Icon name="briefcase" size={11} />{roleTitle(r)}</L></li>)}
        </ul>
      </div>
      <ol className="mt-3 space-y-2" aria-label={t('m20.sec.rot.sequence')}>
        {steps.map((st) => (
          <li key={st.seq} className="rounded-card border border-line bg-panel p-2.5">
            <div className="flex items-center justify-between gap-2 text-[13px]"><span className="font-semibold">{f.num(st.seq)}. {pick({ host_team_en: st.host_team_en, host_team_ar: st.host_team_ar }, 'host_team')}</span><span className="num shrink-0 text-ink-3">{t('m20.sec.rot.months', { n: f.num(st.months) })}</span></div>
            <div className="mt-1.5"><FutureSkillChips ids={st.objectives.map((o) => o.skill_id)} skills={skills} /></div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12.5px] text-ink-3">{t('m20.sec.rot.total', { n: f.num(totalMonths(steps)), min: f.num(x.duration_min_months), max: f.num(x.duration_max_months) })}</p>
      {x.career_level_only && <p className="mt-2 text-[12.5px] text-sim">{t('m20.sec.rot.noDeployment')}</p>}
      {sources.length > 0 && <ul className="mt-2 space-y-1 text-[12px]">{sources.map((s) => <li key={s.id}><SourceLink href={s.url}>{s.label}</SourceLink></li>)}</ul>}
    </Card>
  );
}

function TagCard({ templates, roles }: { templates: RotationTemplatesRow[]; roles: JobRolesRow[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const msg = useRuleMessage();
  const [id, setId] = useState(templates[0]?.id ?? '');
  const [track, setTrack] = useState<string>('digital_twin');
  const [ids, setIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const candidates = useMemo(() => roles.filter((r) => r.lifecycle === 'concept'), [roles]);
  const input = { template_id: id, track: track === 'none' ? null : track, future_role_ids: track === 'none' ? [] : ids };
  const problem = validateTag(input, roles as never);
  return (
    <Card title={t('m20.sec.rot.tagTitle')} data-testid="m20-sec-tag">
      <p className="mb-3 text-[13px] text-ink-2">{t('m20.sec.rot.tagIntro')}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SelectField label={t('m20.sec.rot.tagTemplate')} name="template" value={id} onChange={setId} options={templates.map((x) => ({ value: x.id, label: pick(x, 'title') }))} />
        <SelectField label={t('m20.sec.rot.tagTrack')} name="track" value={track} onChange={setTrack} options={[...TRACKS.map((k) => ({ value: k, label: t(`m20.sec.track.${k}`) })), { value: 'none', label: t('m20.sec.rot.untag') }]} />
      </div>
      {track !== 'none' && (
        <fieldset className="mt-3">
          <legend className="caps mb-1">{t('m20.sec.rot.tagRoles', { n: MAX_FUTURE_ROLES })}</legend>
          <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
            {candidates.map((r) => <CheckboxField key={r.id} label={pick(r, 'title')} checked={ids.includes(r.id)} onChange={(v) => setIds((x) => (v ? [...x, r.id] : x.filter((y) => y !== r.id)))} />)}
          </div>
        </fieldset>
      )}
      {problem && <p className="mt-2 text-[12.5px] text-bad" role="alert">{msg(problem.message)}</p>}
      <button className="btn-primary btn-sm mt-3" disabled={!!problem || !id} onClick={() => setConfirm(true)} data-testid="m20-sec-tag-save"><Icon name="check" size={14} />{t('m20.sec.rot.tagSave')}</button>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m20.sec.rot.tagSave')} consequence={track === 'advance_study' ? t('m20.sec.rot.tagAdvance') : t('m20.sec.rot.tagBody')} confirmLabel={t('m20.sec.rot.tagSave')}
        onConfirm={async () => { await run(() => repo.rpc.tagFutureRotation(input)); }} />
    </Card>
  );
}
