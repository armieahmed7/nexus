// FS06 on /training/sat/tasks/:taskId: the task's future attributes. Exposure with "Why this?", change horizon and technology
// driver, the OECD needs-versus-AI bars at the horizon, the skills the task needs today and at its horizon, the edit flow
// (training manager or designated SAT analyst; setTaskFuture writes one SAT change-log row) and the task's future change history.
import { useState } from 'react';
import { Card, EmptyState, SimChip, WhyThis } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { DriverChip, ExposurePill, FutureDiff, FutureEditor, HorizonChip, NeedsBars, useFutureData } from './fxui';
import type { SatData } from './ui';

type Task = SatData['tasks'][number];

export function FutureCard({ d, task }: { d: SatData; task: Task }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const q = useFutureData(task.role_id);
  const [edit, setEdit] = useState(false);
  const data = q.data;
  const ft = data?.view?.tasks.find((x) => x.id === task.id);
  const history = d.changes.filter((c) => c.task_id === task.id && c.area === 'future');
  if (task.restricted || task.status !== 'active') return null;
  return (
    <Card title={t('m26.fx.cardTitle')} eyebrow={<span className="inline-flex flex-wrap items-center gap-2">{t('m26.fx.cardEyebrow')}<SimChip label={t('m26.fx.simChip')} /></span>}
      actions={data?.view?.can_write && ft ? <button className="btn-outline btn-sm" onClick={() => setEdit(true)} data-testid="m26-fx-edit">{ft.exposure ? t('m26.fx.edit.open') : t('m26.fx.edit.rate')}</button> : undefined}>
      <div data-testid="m26-fx-card">
        {!data ? <p className="text-[13px] text-ink-3">{t('m26.fx.loading')}</p> : !ft ? <EmptyState title={t('m26.fx.noAccess')} /> : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2" data-testid="m26-fx-summary">
                <ExposurePill exposure={ft.exposure} />
                <HorizonChip horizon={ft.change_horizon} />
                <DriverChip driver={ft.tech_driver} />
                {ft.exposure && <WhyThis reasons={ft.reasons} testId="m26-fx-task-why" />}
              </div>
              {ft.exposure ? <p className="text-[13px] text-ink-2">{t(`m26.fx.meaning.${ft.exposure}`)}</p> : <p className="text-[13px] text-ink-3">{t('m26.fx.notRated')}</p>}
              <NeedsBars needs={ft.needs} horizon={ft.change_horizon} levels={data.levels} />
              {ft.future_on && <p className="text-[12px] text-ink-3">{t('m26.fx.ratedOn', { date: f.date(ft.future_on) })}</p>}
            </div>
            <div className="space-y-3">
              <div>
                <div className="caps mb-1">{t('m26.fx.skillsTitle')}</div>
                {ft.skills.length === 0 ? <p className="text-[13px] text-ink-3">{t('m26.fx.noSkills')}</p> : (
                  <ul className="divide-y divide-line rounded-card border border-line" data-testid="m26-fx-skills">
                    {ft.skills.map((s) => (
                      <li key={s.skill_id} className="flex flex-wrap items-center gap-2 p-2 text-[13px]">
                        <span className="min-w-0 flex-1">{pick(data.skills.find((k) => k.id === s.skill_id), 'name') || s.skill_id}</span>
                        <span className="num chip border-line bg-sunken text-ink-2">{t('m26.fx.skillLevel', { n: f.num(s.level) })}</span>
                        <span className={`chip ${s.kind === 'future' ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-panel text-ink-2'}`}>{t(`m26.fx.kind.${s.kind}`)}</span>
                        <span className="text-[11.5px] text-ink-3">{t(`m26.fx.src.${s.source}`)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="caps mb-1">{t('m26.fx.historyTitle')}</div>
                {history.length === 0 ? <p className="text-[13px] text-ink-3">{t('m26.fx.noHistory')}</p> : (
                  <ul className="space-y-2" data-testid="m26-fx-history">
                    {history.slice(0, 4).map((c) => (
                      <li key={c.id} className="rounded-card border border-line p-2.5">
                        <div className="text-[12.5px]">{c.summary}</div>
                        <div className="text-[11.5px] text-ink-3">{pick({ name_en: c.opened_by_name, name_ar: c.opened_by_name_ar }, 'name')} · {f.date(c.opened_at)}</div>
                        <FutureDiff before={c.before} after={c.after} />
                      </li>
                    ))}
                  </ul>
                )}
                <L to="/training/sat/changes?status=closed&area=future" className="link mt-1 inline-block text-[12.5px]">{t('m26.fx.allHistory')}</L>
              </div>
            </div>
          </div>
        )}
      </div>
      {edit && data && ft && <FutureEditor open={edit} task={ft} data={data} onClose={() => setEdit(false)} />}
    </Card>
  );
}
