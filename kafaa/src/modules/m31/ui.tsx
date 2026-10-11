// M31 shared page helpers (FS38, FS39, FS40; owners: wave E E1). Reference data (technologies, current roles, families, skills and the
// delta training catalogue), the seven-dimension change grid, the public delta body, training links, sources and the planning note.
// Pages only; the rules live in nextgen.ts, literacy.ts, twin.ts and plantModel.ts.
import type { ReactNode } from 'react';
import { Card, SourceLink, StatusPill, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useLang, usePick, useT } from '../../i18n';
import { DIMENSIONS } from './nextgen';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface RefData {
  techs: Row[];
  techById: Map<string, Row>;
  roles: Row[];
  roleById: Map<string, Row>;
  concepts: Map<string, Row>;
  families: Map<string, Row>;
  skills: Map<string, Row>;
  training: Map<string, Row>;
}

/** Reference data for the FS38 pages (all public reads). */
export function useNgRef() {
  const repo = useRepo();
  return useQuery(['adv_technologies', 'job_roles', 'job_families', 'skills', 'microcred_defs', 'courses', 'pathways', 'horizon_lanes'], async (): Promise<RefData> => {
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const [techs, roles, fams, skills, mcs, courses, pws, lanes] = await Promise.all([
      safe(repo.list('adv_technologies') as Promise<Row[]>), safe(repo.list('job_roles', { order: [['sort', 'asc']] } as never) as Promise<Row[]>), safe(repo.list('job_families') as Promise<Row[]>),
      safe(repo.list('skills') as Promise<Row[]>), safe(repo.list('microcred_defs') as Promise<Row[]>), safe(repo.list('courses') as Promise<Row[]>), safe(repo.list('pathways') as Promise<Row[]>),
      safe(repo.list('horizon_lanes') as Promise<Row[]>),
    ]);
    const training = new Map<string, Row>();
    for (const m of mcs.filter((x) => x.status === 'current')) training.set(`microcred:${m.code}`, { ...m, kind: 'microcred', ref: m.code, to: `/my/skills/credentials/c/${m.code}` });
    for (const c of courses) training.set(`course:${c.id}`, { ...c, kind: 'course', ref: c.id, to: `/learn/course/${c.id}` });
    for (const p of pws) training.set(`pathway:${p.id}`, { ...p, kind: 'pathway', ref: p.id, to: `/learn/pathways/${p.id}` });
    for (const l of lanes) training.set(`lane:${l.id}`, { ...l, kind: 'lane', ref: l.id, to: '/my/future' });
    const current = roles.filter((r) => (r.lifecycle ?? 'current') === 'current');
    return {
      techs: [...techs].sort((a, b) => String(a.id).localeCompare(String(b.id))), techById: new Map(techs.map((x) => [x.id, x])),
      roles: current, roleById: new Map(current.map((x) => [x.id, x])), concepts: new Map(roles.filter((r) => r.lifecycle === 'concept').map((x) => [x.id, x])),
      families: new Map(fams.map((x) => [x.id, x])), skills: new Map(skills.map((x) => [x.id, x])), training,
    };
  }, []);
}

/** Skills a training item builds (course competencies, micro-credential criteria, pathway skill, lane skills): used to show which link closes a gap. */
export function trainingSkills(d: RefData): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, x] of d.training) {
    const ids = new Set<string>();
    if (x.skill_id) ids.add(x.skill_id);
    for (const s of (x.skill_ids ?? []) as string[]) ids.add(s);
    for (const c of (x.criteria ?? []) as Row[]) if (c.kind === 'skill' && c.ref) ids.add(c.ref);
    for (const c of (x.competency_ids ?? []) as string[]) for (const s of d.skills.values()) if (s.competency_id === c) ids.add(s.id);
    out[k] = [...ids];
  }
  return out;
}

export function TechName({ d, id }: { d: RefData; id: string }) {
  const pick = usePick();
  const x = d.techById.get(id);
  return <>{x ? pick(x, 'family') : id}</>;
}

/** One coloured chip per change kind. */
export function ChangeChip({ change }: { change: string }) {
  const t = useT();
  const tone = change === 'new' ? 'border-transparent bg-[rgb(var(--accent))] text-white' : change === 'adapts' ? 'border-accent/40 bg-accent-soft text-eyebrow' : 'border-line bg-sunken text-ink-3';
  return <span className={`chip normal-case tracking-normal ${tone}`} data-change={change}>{t(`m31.ng.change.${change}`)}</span>;
}

/** The seven dimensions in fixed order with what the delta says about each (same when not listed). */
export function DimGrid({ dims, compact }: { dims: Row[]; compact?: boolean }) {
  const t = useT();
  const lang = useLang();
  return (
    <ul className={`grid grid-cols-1 gap-2 ${compact ? '' : 'md:grid-cols-2'}`} data-testid="m31-dims">
      {DIMENSIONS.map((dim) => {
        const x = dims.find((y) => y.dim === dim);
        const change = x?.change ?? 'same';
        return (
          <li key={dim} className={`rounded-md border p-2.5 text-[13px] ${change === 'same' ? 'border-line bg-panel' : 'border-accent/30 bg-accent-soft'}`} data-dim={dim} data-change={change}>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{t(`m31.ng.dim.${dim}`)}</span><ChangeChip change={change} /></div>
            <p className={`mt-1 ${change === 'same' ? 'text-ink-3' : 'text-ink-2'}`}>{x ? (lang === 'ar' ? x.text_ar : x.text_en) : t('m31.ng.dimSame')}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function Sources({ sources }: { sources: Row[] }) {
  const t = useT();
  return (
    <div className="space-y-1" data-testid="m31-sources">
      <div className="caps">{t('m31.ng.sources')}</div>
      <ul className="flex flex-col gap-1">{sources.map((s) => <li key={s.url}><SourceLink href={s.url} date={s.as_of}>{s.label}</SourceLink></li>)}</ul>
    </div>
  );
}

export function TrainingLink({ d, kind, refId, closes }: { d: RefData; kind: string; refId: string; closes?: string[] }) {
  const t = useT();
  const pick = usePick();
  const x = d.training.get(`${kind}:${refId}`);
  return (
    <li className="flex flex-wrap items-center gap-2 text-[13px]" data-testid="m31-training" data-kind={kind} data-ref={refId}>
      <span className="chip border-line bg-sunken normal-case tracking-normal text-ink-2">{t(`m31.ng.trainingKind.${kind}`)}</span>
      {x ? <L to={x.to}>{pick(x, 'title')}</L> : <span>{refId}</span>}
      {closes && closes.length > 0 && <StatusPill tone="ok">{t('m31.ng.closes', { n: closes.length })}</StatusPill>}
    </li>
  );
}

/** Planning note shown on every FS38 screen. */
export function NoDeployNote() {
  const t = useT();
  return <p className="flex items-start gap-2 text-[12.5px] text-ink-3" data-testid="m31-no-deploy"><Icon name="info" size={14} className="mt-0.5 shrink-0" /> {t('m31.ng.noDeploy')}</p>;
}

/** Public body of one delta: what changes, what stays, the dimension grid, skills (names), training links and sources. */
export function DeltaBody({ d, delta, aside }: { d: RefData; delta: Row; aside?: ReactNode }) {
  const t = useT();
  const pick = usePick();
  return (
    <div className="space-y-4" data-testid="m31-delta" data-id={delta.id} data-path-only={delta.path_only ? 'yes' : 'no'}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m31.ng.changes')} className="border-accent/40"><p className="text-[14px]" data-testid="m31-changes">{pick(delta, 'changes')}</p></Card>
        <Card title={t('m31.ng.stays')}><p className="text-[14px] text-ink-2" data-testid="m31-stays">{pick(delta, 'stays')}</p></Card>
      </div>
      {aside}
      <Card title={t('m31.ng.dimsTitle')} eyebrow={t('m31.ng.dimsEyebrow')}><DimGrid dims={delta.dims ?? []} /></Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m31.ng.skillsTitle')}>
          {delta.path_only ? <p className="text-[13px] text-ink-2">{t('m31.ng.pathOnlySkills')}</p> : (
            <ul className="flex flex-wrap gap-1.5" data-testid="m31-skills">
              {(delta.skills ?? []).map((s: Row) => <li key={s.skill_id}><L to={`/skills/${s.skill_id}`} className="chip border-accent/30 bg-accent-soft normal-case tracking-normal text-eyebrow no-underline">{d.skills.get(s.skill_id) ? pick(d.skills.get(s.skill_id), 'name') : s.skill_id}</L></li>)}
            </ul>
          )}
        </Card>
        <Card title={t('m31.ng.trainingTitle')} eyebrow={t('m31.ng.trainingEyebrow')}>
          {(delta.training ?? []).length ? <ul className="space-y-1.5">{(delta.training as Row[]).map((x) => <TrainingLink key={`${x.kind}:${x.ref}`} d={d} kind={x.kind} refId={x.ref} />)}</ul> : <p className="text-[13px] text-ink-3">{t('m31.ng.noTraining')}</p>}
        </Card>
      </div>
      {(delta.concept_role_ids ?? []).length > 0 && (
        <Card title={t('m31.ng.concepts')} eyebrow={t('m31.ng.conceptsEyebrow')}>
          <ul className="flex flex-wrap gap-1.5" data-testid="m31-concepts">
            {(delta.concept_role_ids as string[]).map((id) => <li key={id} className="chip border-sim-line bg-sim-bg normal-case tracking-normal text-sim" data-concept={id}>{d.concepts.get(id) ? pick(d.concepts.get(id), 'title') : id}</li>)}
          </ul>
        </Card>
      )}
      <Sources sources={delta.sources ?? []} />
    </div>
  );
}

/** Synthetic or simulated label used on every FS39/FS40 screen. */
export function SimNote({ children, testId }: { children: ReactNode; testId?: string }) {
  return <p className="flex items-start gap-2 text-[12.5px] text-sim" data-testid={testId}><Icon name="info" size={14} className="mt-0.5 shrink-0" /> {children}</p>;
}
