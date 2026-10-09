// M20 · F15 cohort enrolment form (HR programme owners): choose a cohort, a start date and a staff member (from
// rpc.rotationCandidates, which returns names to programme owners only), preview the placement plan, confirm.
import { useMemo, useState } from 'react';
import { Card, ConfirmDialog, EmptyState, Icon, Skeleton } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { addDays, planPlacements } from './rotation';
import { stepsOf, todayIso, type RotData, type RotLabels, type Template } from './rotUi';

export function EnrolForm({ d, tpl, lab }: { d: RotData; tpl: Template; lab: RotLabels }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const today = todayIso();
  const cohorts = d.cohorts.filter((c) => c.template_id === tpl.id && c.status !== 'completed');
  const [cohort, setCohort] = useState(cohorts[0]?.id ?? '');
  const [start, setStart] = useState(addDays(today, 7));
  const [person, setPerson] = useState('');
  const [term, setTerm] = useState('');
  const [confirm, setConfirm] = useState(false);
  const cq = useQuery(['rotation_placements', 'people'], () => repo.rpc.rotationCandidates(tpl.id), [tpl.id]);
  const cands = cq.data ?? [];
  const shown = useMemo(() => cands.filter((c) => c.eligible && (!term || `${c.display_name} ${c.display_name_ar} ${lab.role(c.job_role_id)}`.toLowerCase().includes(term.toLowerCase()))).slice(0, 40), [cands, term, lab]);
  const plan = planPlacements(stepsOf(tpl), start || today);
  const chosen = cands.find((c) => c.id === person);
  if (tpl.status !== 'active') return <Card title={t('m20.rot.enrol.title')}><p className="text-[13px] text-ink-2">{t('m20.rot.enrol.inactive')}</p></Card>;
  return (
    <Card title={t('m20.rot.enrol.title')} className="border-accent/40">
      <div className="space-y-3" data-testid="m20-rot-enrol">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block"><span className="caps">{t('m20.rot.enrol.cohort')}</span>
            <select className="input mt-1" value={cohort} onChange={(e) => setCohort(e.target.value)} data-testid="m20-rot-enrol-cohort">
              <option value="">{t('m20.rot.common.noCohort')}</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{pick(c, 'name')}</option>)}
            </select>
          </label>
          <label className="block"><span className="caps">{t('m20.rot.enrol.start')}</span><input type="date" className="input mt-1" min={today} max={addDays(today, 365)} value={start} onChange={(e) => setStart(e.target.value)} data-testid="m20-rot-enrol-start" /></label>
        </div>
        <label className="block"><span className="caps">{t('m20.rot.enrol.person')}</span><input className="input mt-1" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('m20.rot.enrol.search')} data-testid="m20-rot-enrol-search" /></label>
        {cq.loading ? <Skeleton lines={3} /> : cq.data == null ? <EmptyState icon="lock" title={t('m20.rot.enrol.noAccess')} /> : (
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-btn border border-line p-1" role="listbox" aria-label={t('m20.rot.enrol.person')}>
            {shown.map((c) => (
              <li key={c.id}>
                <button type="button" role="option" aria-selected={person === c.id} disabled={c.enrolled} onClick={() => setPerson(c.id)} data-testid="m20-rot-enrol-person"
                  className={`flex w-full items-center justify-between gap-2 rounded-btn px-2 py-1.5 text-start text-[13px] ${person === c.id ? 'bg-accent-soft' : 'hover:bg-sunken'} disabled:opacity-60`}>
                  <span className="min-w-0"><span className="font-semibold">{pick({ name_en: c.display_name, name_ar: c.display_name_ar }, 'name')}</span> <span className="text-ink-3">· {lab.role(c.job_role_id)} · {lab.family(c.job_family_id)}</span></span>
                  {c.enrolled && <span className="chip border-line bg-sunken text-ink-3">{t('m20.rot.enrol.enrolled')}</span>}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="p-2 text-[13px] text-ink-3">{t('m20.rot.enrol.none')}</li>}
          </ul>
        )}
        <div>
          <div className="caps mb-1">{t('m20.rot.enrol.preview')}</div>
          <ol className="space-y-1 text-[12.5px]">{plan.map((x) => <li key={x.step.seq} className="flex justify-between gap-2"><span>{x.step.seq}. {pick(x.step as unknown as Record<string, unknown>, 'host_team')}</span><span className="num text-ink-3">{f.date(x.starts_on)} – {f.date(x.ends_on)}</span></li>)}</ol>
        </div>
        <p className="text-[12.5px] text-ink-3">{t('m20.rot.enrol.routing')}</p>
        <button className="btn-primary w-full" disabled={!person || !start} onClick={() => setConfirm(true)} data-testid="m20-rot-enrol-submit"><Icon name="plus" size={14} />{t('m20.rot.enrol.submit')}</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m20.rot.enrol.confirmTitle')} actingAs={t('m20.rot.common.owner')}
        consequence={t('m20.rot.enrol.confirmBody', { name: chosen ? pick({ name_en: chosen.display_name, name_ar: chosen.display_name_ar }, 'name') : '', n: f.num(plan.length), d: f.date(start) })}
        confirmLabel={t('m20.rot.enrol.submit')} onConfirm={async () => { const r = await run(() => repo.rpc.enrolRotation(tpl.id, person, cohort || null, start)); if (r.ok) setPerson(''); }} />
    </Card>
  );
}
