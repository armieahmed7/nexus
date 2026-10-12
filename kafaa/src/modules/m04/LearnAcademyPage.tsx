// FS20 /learn/academies/:academyId (public): one academy on the module + project + mentor template. Modules (FS19 pack courses with
// hours), the capstone project, its deliverable and the skills a signed-off capstone records (as F01 evidence), the mentor and
// reviewer roles, selection criteria, cohorts with statistics suppressed under 10, and sources. Signed-in staff nominate themselves
// (or, as line manager, someone in their team) for a cohort that is open to nominations.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, BenchmarkChips, Icon, Modal, SelectField, TextArea, KeyValue, DataTable } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { usePeople } from './ui';
import { AsOfSources, CohortPill, LevelDots, NoDecisionNote, Simulated, SkillChip, Suppressible, TemplateTriad, cohortStatsOf, useAcademyData, useEnvelope, type AcademyData, type Row } from './fsUi';

export default function LearnAcademyPage() {
  const { academyId = '' } = useParams();
  const t = useT();
  const q = useAcademyData();
  return (
    <Async state={q} isEmpty={(d) => !d.academies.some((a) => a.id === academyId)} empty={
      <Page title={t('m04.routes.learn-academy.title')}><EmptyState icon="book" title={t('m04.acad.notFound')} action={<L to="/learn/academies" className="btn-outline btn-sm">{t('m04.acad.back')}</L>} /></Page>}>
      {(d) => <Academy d={d} a={d.academies.find((x) => x.id === academyId)!} />}
    </Async>
  );
}

function Academy({ d, a }: { d: AcademyData; a: Row }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const env = useEnvelope();
  const s = useSession();
  const [nominate, setNominate] = useState(false);
  const cohorts = d.cohorts.filter((c) => c.academy_id === a.id);
  const open = cohorts.filter((c) => c.status === 'nominating');
  const staff = s.status === 'signed_in' && s.can('training', ['Own']) && s.person?.kind === 'staff';
  const hours = a.module_course_ids.reduce((n: number, id: string) => n + Number(d.courses.get(id)?.duration_hours ?? 0), 0);
  return (
    <Page title={pick(a, 'name')} intro={pick(a, 'tagline')} wide eyebrow={<span className="flex flex-wrap items-center gap-2"><BenchmarkChips feature="FS20" /><Simulated /></span>}
      actions={staff && open.length ? <button type="button" className="btn-primary" onClick={() => setNominate(true)} data-testid="m04-acad-nominate"><Icon name="plus" size={14} />{t('m04.acad.nominate.cta')}</button> : null}>
      <div className="space-y-6">
        <TemplateTriad compact />
        {a.id === 'ac-energy' && <p className="text-[13px]" data-testid="m04-acad-to-consortium"><L to="/ecosystem/consortium">{t('m04.acad.toConsortium')}</L></p>}{/* FS83 (wave-I integration): the consortium cohort builds on this academy */}
        {a.no_decision && <NoDecisionNote />}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title={t('m04.acad.triad.modules')} eyebrow={t('m04.acad.modulesN', { n: f.num(a.module_course_ids.length), h: f.num(hours) })} className="lg:col-span-2">
            <ol className="space-y-2" data-testid="m04-acad-modules">
              {a.module_course_ids.map((id: string, i: number) => {
                const c = d.courses.get(id);
                return (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2 text-[13px] last:border-0">
                    <span className="flex items-center gap-2"><span className="num grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-[12px] text-eyebrow">{f.num(i + 1)}</span><L to={`/learn/course/${id}`}>{pick(c, 'title') || id}</L></span>
                    <span className="text-ink-3">{t('m04.common.hours', { n: f.num(Number(c?.duration_hours ?? 0)) })}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[12.5px] text-ink-3">{env(hours, a.weeks, Number(a.weekly_hours))}</p>
          </Card>
          <Card title={t('m04.acad.roles.title')}>
            <KeyValue items={[
              [t('m04.acad.triad.mentor'), pick(a, 'mentor_role')],
              [t('m04.acad.triad.reviewer'), pick(a, 'reviewer_role')],
              [t('m04.acad.capacity'), f.num(a.capacity)],
              [t('m04.acad.criteria'), pick(a, 'criteria')],
            ]} />
          </Card>
        </div>
        <Card title={t('m04.acad.triad.project')} eyebrow={t(`m04.acad.kind.${a.artefact_kind}`)}>
          <p className="text-[14px] text-ink" data-testid="m04-acad-project">{pick(a, 'project')}</p>
          <p className="mt-2 text-[13px] text-ink-2"><span className="caps me-1 text-[10.5px]">{t('m04.acad.deliverable')}</span>{pick(a, 'deliverable')}</p>
          <div className="mt-3">
            <h3 className="caps mb-1.5">{t('m04.acad.records')}</h3>
            <ul className="flex flex-wrap gap-1.5">{(a.capstone_skills ?? []).map((x: { skill_id: string; level: number }) => <li key={x.skill_id}><SkillChip skill={d.skills.get(x.skill_id)} level={x.level} /></li>)}</ul>
            <p className="mt-2 text-[12.5px] text-ink-3">{t('m04.acad.recordsNote')}</p>
          </div>
        </Card>
        <Section title={t('m04.acad.cohorts.title')} description={t('m04.acad.cohorts.intro')}>
          <DataTable rows={cohorts} rowKey={(r) => r.id} searchable={false} caption={t('m04.acad.cohorts.title')} columns={[
            { key: 'label', header: t('m04.acad.cohort'), value: (r) => pick(r, 'label'), render: (r) => <span className="font-medium" data-testid="m04-acad-cohort">{pick(r, 'label')}</span> },
            { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <CohortPill status={r.status} /> },
            { key: 'dates', header: t('m04.acad.dates'), value: (r) => `${f.date(r.starts_on)} – ${f.date(r.ends_on)}` },
            { key: 'n', header: t('m04.acad.participants'), render: (r) => <Suppressible value={cohortStatsOf(d.stats, r.id)?.participants} />, align: 'end' },
            { key: 'mods', header: t('m04.acad.modulePct'), render: (r) => <Suppressible value={cohortStatsOf(d.stats, r.id)?.module_pct} pct />, align: 'end' },
            { key: 'done', header: t('m04.acad.completionPct'), render: (r) => <Suppressible value={cohortStatsOf(d.stats, r.id)?.completion_pct} pct />, align: 'end' },
            { key: 'pass', header: t('m04.acad.passPct'), render: (r) => <Suppressible value={cohortStatsOf(d.stats, r.id)?.pass_pct} pct />, align: 'end' },
          ]} />
        </Section>
        <AsOfSources items={a.sources} />
        {nominate && <NominateModal academy={a} cohorts={open} onClose={() => setNominate(false)} />}
      </div>
    </Page>
  );
}

export function NominateModal({ academy, cohorts, onClose }: { academy: Row; cohorts: Row[]; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const q = useQuery(['academy_members'], () => repo.rpc.academyNominees(), []);
  const [cohort, setCohort] = useState(cohorts[0]?.id ?? '');
  const [person, setPerson] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={t('m04.acad.nominate.title', { name: pick(academy, 'name') })}
      footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary" disabled={!cohort || busy} data-testid="m04-acad-nominate-send" onClick={async () => {
          setBusy(true);
          const r = await run(() => repo.rpc.nominateAcademy({ cohort_id: cohort, person_id: person || null, note }), { success: t('m04.acad.nominate.sent') });
          setBusy(false);
          if (r?.ok) onClose();
        }}>{t('m04.acad.nominate.send')}</button></div>}>
      <div className="space-y-3">
        <SelectField name="m04-nom-cohort" label={t('m04.acad.cohort')} value={cohort} onChange={setCohort} options={cohorts.map((c) => ({ value: c.id, label: pick(c, 'label') }))} />
        <Async state={q} isEmpty={() => false}>{(list) => (
          <SelectField name="m04-nom-person" label={t('m04.acad.nominate.who')} value={person} onChange={setPerson}
            options={list.map((n) => ({ value: n.self ? '' : n.person_id, label: n.self ? t('m04.acad.nominate.me') : people.name(n.person_id) }))} hint={t('m04.acad.nominate.whoHint')} />
        )}</Async>
        <TextArea name="m04-nom-note" label={t('m04.acad.nominate.note')} value={note} onChange={setNote} rows={3} hint={t('m04.acad.nominate.noteHint')} />
        <p className="flex items-start gap-1.5 text-[12.5px] text-ink-3"><Icon name="info" size={13} className="mt-0.5 shrink-0" />{t('m04.acad.nominate.next')}</p>
      </div>
    </Modal>
  );
}
