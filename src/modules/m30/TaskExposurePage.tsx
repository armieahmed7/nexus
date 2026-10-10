// /my/role-2030/tasks (M30 · FS12 Task exposure view: what the tool will do, what you will still own). For my role (or any current
// role): every rated task in one of three bands (AI-assisted, partly automatable, human core) with the OECD capability reason behind
// it, the skills that complement AI (skills of the human-core tasks), the band mix beside the sourced SkillsFuture Singapore reference
// line, and the wording rule: change is described as tasks moving, never as people being made surplus. Staff (transformation R).
import { Page, Section, Card, Async, EmptyState, Callout, Donut, WhyThis, SimChip, BenchmarkLine, useReasonText } from '../../ui';
import { useFormat, usePick, useT, L } from '../../i18n';
import { BANDS, pctOf, type Band, type MapTask, type RoleMap } from './transform';
import type { RoleTransformationView } from './backend/rpc';
import { BandPill, BenchTies, DriverChip, FS12, HorizonChip, NoDeployNote, RolePicker, useRefData, useRefLabel, useRoleMap, useRoleParams, type RefData } from './ui';

export default function TaskExposurePage() {
  const t = useT();
  const p = useRoleParams();
  const ref = useRefData();
  const q = useRoleMap(p.role, '2030');
  return (
    <Page title={t('m30.routes.my-role-2030-tasks.title')} intro={t('m30.tx.intro')} wide
      eyebrow={<span className="inline-flex flex-wrap items-center gap-2"><SimChip label={t('m30.planning.chip')} /><BenchTies feature={FS12} /></span>}
      actions={<L to={`/my/role-2030${p.role ? `?role=${p.role}` : ''}`} className="btn-outline no-underline" data-testid="m30-to-map">{t('m30.tx.toMap')}</L>}>
      <Async state={ref}>{(d) => (
        <div className="space-y-6">
          <div className="sm:max-w-md"><RolePicker d={d} value={p.role ?? ''} onChange={(v) => p.set('role', v || null)} /></div>
          <Callout tone="info" title={t('m30.tx.principleTitle')}>{t('m30.tx.principleBody')}</Callout>
          <Async state={q}>{(v) => <Body v={v} d={d} />}</Async>
        </div>
      )}</Async>
    </Page>
  );
}

function Body({ v, d }: { v: RoleTransformationView | null; d: RefData }) {
  const t = useT();
  if (!v) return <EmptyState title={t('m30.my.noAccess')} />;
  if (!v.map) return <EmptyState title={t('m30.my.noRole')}>{t('m30.my.noRoleBody')}</EmptyState>;
  if (v.map.path_only) return <Callout tone="info" title={t('m30.pathOnly.title')}><span data-testid="m30-path-only">{t('m30.pathOnly.body')}</span></Callout>;
  return <Bands map={v.map} d={d} />;
}

const BAND_ORDER: Band[] = ['augment', 'automate_partly', 'human_core'];

function TaskRow({ x }: { x: MapTask }) {
  const t = useT();
  const pick = usePick();
  const text = useReasonText();
  // the first FS06 reason (after the move) states the capability comparison; shown inline, the rest behind "Why this?"
  const lead = x.reasons[1] ?? x.reasons[0];
  return (
    <li className="space-y-1 py-2 text-[13px]">
      <div className="font-semibold">{pick(x, 'title')}</div>
      <p className="text-[12.5px] text-ink-2" data-testid="m30-band-reason">{lead ? text(lead) : ''}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <HorizonChip horizon={x.horizon} />
        {x.driver && <DriverChip driver={x.driver} />}
        {x.critical && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m30.work.critical')}</span>}
        <WhyThis reasons={x.reasons} testId="m30-band-why" />
      </div>
    </li>
  );
}

function Bands({ map, d }: { map: RoleMap; d: RefData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const label = useRefLabel(d);
  const by = (b: Band) => map.tasks.filter((x) => x.band === b);
  const rated = map.tasks.length;
  const assisted = rated ? pctOf(by('augment').length + by('automate_partly').length, rated) : null;
  return (
    <div className="space-y-6">
      <h2 className="text-[18px] font-semibold">{pick(d.roleById.get(map.role_id), 'title')}</h2>
      {rated === 0 ? <EmptyState title={t('m30.work.none')}>{t('m30.work.noneBody')}</EmptyState> : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="m30-bands">
            {BAND_ORDER.map((b) => (
              <Card key={b} title={<span className="inline-flex items-center gap-2"><BandPill band={b} /><span className="num text-ink-3">{f.num(by(b).length)}</span></span>} eyebrow={t(`m30.bandHint.${b}`)}>
                {by(b).length === 0 ? <p className="text-[12.5px] text-ink-3">{t('m30.work.emptyMove')}</p> : (
                  <ul className="divide-y divide-line" data-testid={`m30-band-${b}`}>{by(b).map((x) => <TaskRow key={x.id} x={x} />)}</ul>
                )}
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title={t('m30.tx.mixTitle')} eyebrow={t('m30.tx.mixEyebrow')}>
              <Donut title={t('m30.tx.mixTitle')} data={BANDS.map((b) => ({ label: t(`m30.band.${b}`), value: by(b).length, tone: b === 'human_core' ? 'leaf' : b === 'augment' ? 'accent' : 'sim' }))}
                center={<span className="num text-[18px] font-semibold">{f.num(rated)}</span>} />
            </Card>
            <Card title={t('m30.tx.refTitle')} eyebrow={t('m30.tx.refEyebrow')}>
              <BenchmarkLine value={assisted} max={100} unit="pct" label={t('m30.tx.refLabel', { n: f.num(rated) })} benchmark={{ id: 'SSG-SF', figure: 'ai_aided_tasks' }} />
              <p className="mt-2 text-[12px] text-ink-3">{t('m30.tx.refNote')}</p>
            </Card>
          </div>
        </>
      )}
      <Section title={t('m30.tx.compTitle')} description={t('m30.tx.compDesc')}>
        {map.complements.length === 0 ? <EmptyState title={t('m30.tx.compNone')} /> : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="m30-complements">
            {map.complements.map((c) => (
              <li key={c.skill_id} className="flex items-start gap-2 rounded-card border border-ok-line bg-ok-bg/40 p-2.5 text-[13px]">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold"><L to={`/skills/${c.skill_id}`} data-testid="m30-comp-link">{label('skill', c.skill_id)}</L></div>
                  <div className="text-[12px] text-ink-2">{c.source === 'tasks' ? t('m30.tx.compTasks', { n: f.num(c.tasks), level: f.num(c.level) }) : t('m30.tx.compProfile', { level: f.num(c.level) })}</div>
                </div>
                <WhyThis reasons={c.reasons} testId="m30-comp-why" />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <NoDeployNote />
    </div>
  );
}
