// /my/mentoring/programme (M04 · F13): the mentoring programme for its owner, the training manager: active pairs by mentoring type,
// completion and goal attainment as aggregates only (cells under 10 pairs are suppressed), the mentor pool, and knowledge-transfer
// validations. Line managers (and the training manager) also nominate subject-matter-expert mentors in their own line here.
import { useState } from 'react';
import { Page, Section, Card, Grid, StatTile, Async, EmptyState, ErrorState, Callout, DataTable, BarChart, Icon, ConfirmDialog, SimChip, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { usePeople } from './ui';
import { SkillChip } from './mentoringUi';
import type { ProgrammeCell } from './mentoring';
import type { SmeNominee } from './backend/rpc';

export default function MentoringProgrammePage() {
  const t = useT();
  const s = useSession();
  const tm = s.roles.includes('training_manager');
  return (
    <Page title={t('m04.routes.my-mentoring-programme.title')} intro={t('m04.prog.intro')} wide>
      <div className="space-y-8">
        {tm ? <Dashboard /> : <Callout title={t('m04.prog.aggOnlyTitle')}>{t('m04.prog.aggOnlyBody')}</Callout>}
        <Nominations />
      </div>
    </Page>
  );
}

function Dashboard() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const q = useQuery(['mentoring_agreements', 'mentoring_sessions', 'mentors', 'mentoring_requests'], () => repo.rpc.mentoringProgramme(), []);
  const val = (c: ProgrammeCell, k: keyof ProgrammeCell, pct = false) => (c.suppressed ? t('common.suppressedShort') : c[k] == null ? '—' : `${f.num(Number(c[k]))}${pct ? '%' : ''}`);
  const cols: Column<ProgrammeCell>[] = [
    { key: 'key', header: t('m04.prog.colType'), value: (c) => t(c.key === 'total' ? 'm04.prog.total' : `m04.mtr.type.${c.key}`) },
    { key: 'pairs', header: t('m04.prog.colPairs'), value: (c) => (c.suppressed ? null : c.pairs), render: (c) => <span data-suppressed={c.suppressed || undefined}>{val(c, 'pairs')}</span>, align: 'end' },
    { key: 'active', header: t('m04.prog.colActive'), value: (c) => c.active, render: (c) => val(c, 'active'), align: 'end' },
    { key: 'closed', header: t('m04.prog.colClosed'), value: (c) => c.closed, render: (c) => val(c, 'closed'), align: 'end' },
    { key: 'completion', header: t('m04.prog.colCompletion'), value: (c) => c.completion_pct, render: (c) => val(c, 'completion_pct', true), align: 'end' },
    { key: 'attainment', header: t('m04.prog.colAttainment'), value: (c) => c.attainment_pct, render: (c) => val(c, 'attainment_pct', true), align: 'end' },
    { key: 'sessions', header: t('m04.prog.colSessions'), value: (c) => c.sessions, render: (c) => val(c, 'sessions'), align: 'end' },
  ];
  return (
    <Async state={q} isEmpty={() => false}>
      {(r) => {
        if (!r.ok || !r.data) return <ErrorState error={r.message} />;
        const d = r.data;
        return (
          <div className="space-y-6" data-testid="m04-programme">
            <Grid cols={4}>
              <StatTile label={t('m04.prog.pairs')} value={val(d.total, 'pairs')} sub={t('m04.prog.pairsSub', { n: f.num(Number(d.total.active ?? 0)) })} />
              <StatTile label={t('m04.prog.completion')} value={val(d.total, 'completion_pct', true)} sub={t('m04.prog.completionSub')} />
              <StatTile label={t('m04.prog.attainment')} value={val(d.total, 'attainment_pct', true)} sub={t('m04.prog.attainmentSub')} tone="ok" />
              <StatTile label={t('m04.prog.ktValidated')} value={d.kt_validated == null ? t('common.suppressed') : f.num(d.kt_validated)} sub={t('m04.prog.ktValidatedSub')} />
            </Grid>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <Section title={t('m04.prog.byType')} description={t('m04.prog.byTypeBody', { n: f.num(d.min_group) })}>
                <DataTable rows={[...d.by_type, d.total]} columns={cols} rowKey={(c) => c.key} searchable={false} csvName="kafaa-mentoring-programme.csv" caption={t('m04.prog.byType')} dense />
              </Section>
              <Section title={t('m04.prog.chartTitle')}>
                <Card><BarChart title={t('m04.prog.chartTitle')} data={d.by_type.map((c) => ({ label: t(`m04.mtr.type.${c.key}`), value: c.suppressed ? null : c.pairs, suppressed: c.suppressed }))} /></Card>
              </Section>
            </div>
            <Section title={t('m04.prog.pool')}>
              <Grid cols={4}>
                <StatTile label={t('m04.prog.optedIn')} value={f.num(d.mentors.opted_in)} sub={t('m04.prog.capacitySub', { used: f.num(d.mentors.matched), cap: f.num(d.mentors.capacity) })} />
                <StatTile label={t('m04.prog.smes')} value={f.num(d.mentors.sme)} sub={t('m04.prog.smesSub')} />
                <StatTile label={t('m04.prog.khnp')} value={f.num(d.mentors.khnp_paired)} sub={t('m04.prog.khnpSub')} />
                <StatTile label={t('m04.prog.asOf')} value={<span className="text-[15px]">{f.date(d.as_of)}</span>} sub={<SimChip label={t('m04.prog.synthetic')} />} />
              </Grid>
            </Section>
          </div>
        );
      }}
    </Async>
  );
}

function Nominations() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const q = useQuery(['mentors'], async () => {
    const [list, skills, roles] = await Promise.all([repo.rpc.smeNominees(), repo.list('skills'), repo.list('job_roles')]);
    return { list, skills: new Map(skills.map((x) => [x.id, x])), roles };
  }, []);
  const [target, setTarget] = useState<{ n: SmeNominee; on: boolean } | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  return (
    <Section title={t('m04.prog.nominate')} description={t('m04.prog.nominateBody')}>
      <Async state={q} isEmpty={(d) => d.list.length === 0} empty={<EmptyState icon="shield" title={t('m04.prog.noNominees')}>{t('m04.prog.noNomineesBody')}</EmptyState>}>
        {(d) => (
          <>
            <ul className="space-y-2" data-testid="m04-sme-nominees">
              {d.list.map((n) => (
                <li key={n.mentor_id} className="card flex flex-wrap items-center gap-3 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-eyebrow" aria-hidden><Icon name={n.sme ? 'shield' : 'users'} size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{people.name(n.person_id)} <span className="text-[12.5px] font-normal text-ink-3">· {pick(d.roles.find((r) => r.id === n.role_id), 'title') || '—'}</span></div>
                    <div className="mt-1 flex flex-wrap gap-1">{n.skill_ids.map((sk) => <SkillChip key={sk} skill={d.skills.get(sk) as never} sme={n.sme && (n.sme_skill_ids.length ? n.sme_skill_ids : n.skill_ids).includes(sk)} />)}</div>
                    {n.sme && <div className="mt-1 text-[12.5px] text-eyebrow">{t('m04.prog.nominatedOn', { date: f.date(n.sme_nominated_on) })}</div>}
                  </div>
                  {n.sme
                    ? <button className="btn-outline btn-sm" onClick={() => { setChosen([]); setTarget({ n, on: false }); }}>{t('m04.prog.withdraw')}</button>
                    : <button className="btn-primary btn-sm" onClick={() => { setChosen(n.skill_ids.slice(0, 2)); setTarget({ n, on: true }); }} data-testid="m04-sme-nominate">{t('m04.prog.nominateBtn')}</button>}
                </li>
              ))}
            </ul>
            <ConfirmDialog open={!!target} onClose={() => setTarget(null)} title={t(target?.on ? 'm04.prog.nominateTitle' : 'm04.prog.withdrawTitle')}
              consequence={t(target?.on ? 'm04.prog.nominateConsequence' : 'm04.prog.withdrawConsequence', { name: target ? people.name(target.n.person_id) : '' })}
              onConfirm={async () => { if (target) await run(() => repo.rpc.nominateSme(target.n.mentor_id, target.on, target.on ? chosen : [])); }}>
              {target?.on && (
                <fieldset>
                  <legend className="mb-1 text-[13px] font-semibold">{t('m04.prog.smeSkills')}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {target.n.skill_ids.map((sk) => (
                      <label key={sk} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] ${chosen.includes(sk) ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                        <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={chosen.includes(sk)} onChange={() => setChosen((cur) => (cur.includes(sk) ? cur.filter((x) => x !== sk) : [...cur, sk]))} />
                        {d.skills.get(sk) ? pick(d.skills.get(sk)!, 'name') : sk}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[12px] text-ink-3">{t('m04.prog.smeSkillsHint')}</p>
                </fieldset>
              )}
            </ConfirmDialog>
          </>
        )}
      </Async>
    </Section>
  );
}
