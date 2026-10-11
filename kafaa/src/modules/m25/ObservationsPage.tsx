// /training/observations (F25 L3): supervisor observations of on-the-job behaviour after qualifying courses. Line managers see their
// own team (observer of record or line manager) and record the checklist from day 60; the training manager sees and records all
// and runs the scheduler; auditors read. An observation is about applying the course at work; it is never a qualification sign-off.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { Async, Callout, DataTable, Drawer, EmptyState, Icon, Page, RadioGroup, StatusPill, Tabs, TextArea, type PillTone } from '../../ui';
import { useFormat, useLang, useT } from '../../i18n';
import { L3_RATINGS, type L3Rating } from './eff';
import type { L3View } from './backend/rpc';
import { useM25Labels, useM25Refs } from './ui';

const VIEW_TONE: Record<string, PillTone> = { scheduled: 'info', due: 'sim', overdue: 'bad', done: 'ok', cancelled: 'neutral' };

export default function ObservationsPage() {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const refs = useM25Refs();
  const lab = useM25Labels(refs.data);
  const [tab, setTab] = useState('due');
  const [open, setOpen] = useState<L3View | null>(null);
  const q = useQuery(['l3_observations'], async () => {
    const r = await repo.rpc.l3Board();
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  const name = (r: L3View, k: 'person' | 'observer') => (lang === 'ar' ? r[`${k}_name_ar`] : r[`${k}_name`]) || '—';
  const groups = useMemo(() => {
    const rows = q.data?.rows ?? [];
    return { due: rows.filter((r) => r.view === 'due' || r.view === 'overdue'), upcoming: rows.filter((r) => r.view === 'scheduled'), done: rows.filter((r) => r.view === 'done') };
  }, [q.data]);

  const table = (rows: L3View[], key: string) => (
    <DataTable<L3View>
      rows={rows}
      rowKey={(r) => r.id}
      csvName={`l3-${key}`}
      empty={<EmptyState title={t(`m25.l3.empty.${key}`)} />}
      initialSort={{ key: 'due', dir: key === 'done' ? 'desc' : 'asc' }}
      columns={[
        { key: 'person', header: t('m25.l3.person'), value: (r) => name(r, 'person'), sortable: true },
        { key: 'course', header: t('m25.common.course'), value: (r) => lab.course(r.course_id).title, render: (r) => <div><div>{lab.course(r.course_id).title}</div><div className="ltr text-[12px] text-ink-3">{lab.course(r.course_id).code}</div></div>, sortable: true },
        { key: 'completed', header: t('m25.l3.completed'), value: (r) => r.completed_on, render: (r) => f.date(r.completed_on), sortable: true },
        { key: 'due', header: t('m25.l3.due'), value: (r) => r.due_on, render: (r) => <div><div>{f.date(r.due_on)}</div><div className="text-[12px] text-ink-3">{t('m25.l3.opens', { date: f.date(r.opens_on) })}</div></div>, sortable: true },
        { key: 'observer', header: t('m25.l3.observer'), value: (r) => name(r, 'observer') },
        { key: 'status', header: t('m25.common.status'), value: (r) => r.view, render: (r) => <StatusPill tone={VIEW_TONE[r.view]}>{t(`m25.l3.view.${r.view}`)}</StatusPill> },
        { key: 'act', header: '', csv: false, render: (r) => (r.can_record
          ? <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(r)} data-testid={`m25-l3-record-${r.id}`}>{t('m25.l3.record')}</button>
          : r.view === 'done' ? <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(r)}>{t('m25.l3.view_')}</button> : null) },
      ]}
    />
  );

  return (
    <Page
      title={t('m25.routes.training-observations.title')}
      intro={t('m25.l3.intro')}
      wide
      actions={s.can('learning_analytics', ['A']) ? <button type="button" className="btn-outline btn-sm" onClick={() => run(() => repo.rpc.scheduleL3(null))} data-testid="m25-l3-schedule"><Icon name="calendar" />{t('m25.eff.scheduleL3')}</button> : undefined}
    >
      <Callout tone="info" title={t('m25.l3.notSignoffTitle')}>{t('m25.l3.notSignoff')}</Callout>
      <Async state={q}>
        {(d) => (
          <div data-testid="m25-l3-board">
            <p className="mb-2 text-[12.5px] text-ink-3">{d.mode === 'all' ? t('m25.l3.modeAll') : t('m25.l3.modeMine')}</p>
            <Tabs value={tab} onChange={setTab} tabs={[
              { id: 'due', label: t('m25.l3.tab.due'), badge: groups.due.length || undefined, content: table(groups.due, 'due') },
              { id: 'upcoming', label: t('m25.l3.tab.upcoming'), badge: groups.upcoming.length || undefined, content: table(groups.upcoming, 'upcoming') },
              { id: 'done', label: t('m25.l3.tab.done'), content: table(groups.done, 'done') },
            ]} />
          </div>
        )}
      </Async>
      {open && <RecordDrawer obs={open} onClose={() => setOpen(null)} title={`${name(open, 'person')} · ${lab.course(open.course_id).title}`} />}
    </Page>
  );
}

function RecordDrawer({ obs, onClose, title }: { obs: L3View; onClose: () => void; title: string }) {
  const t = useT();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const readOnly = !obs.can_record;
  const [vals, setVals] = useState<Record<string, L3Rating | ''>>(() => Object.fromEntries(obs.items.map((i) => [i.key, (i.rating as L3Rating) ?? ''])));
  const [note, setNote] = useState(obs.note ?? '');
  const complete = obs.items.every((i) => vals[i.key]) && obs.items.some((i) => vals[i.key] && vals[i.key] !== 'na');
  const save = async () => {
    const r = await run(() => repo.rpc.recordL3(obs.id, { items: obs.items.map((i) => ({ key: i.key, rating: vals[i.key] as L3Rating })), note }));
    if (r.ok) onClose();
  };
  return (
    <Drawer open onClose={onClose} title={title}
      footer={readOnly ? undefined : <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('m25.common.cancel')}</button><button type="button" className="btn-primary" disabled={!complete} onClick={save} data-testid="m25-l3-save">{t('m25.l3.save')}</button></div>}>
      <div className="space-y-4" data-testid="m25-l3-form">
        <p className="text-[13px] text-ink-2">{t('m25.l3.formIntro')}</p>
        {obs.items.map((i, n) => (
          <fieldset key={i.key} className="rounded-card border border-line p-3">
            <legend className="px-1 text-[13px] font-semibold">{n + 1}. {lang === 'ar' ? i.ar : i.en}</legend>
            {readOnly ? (
              <StatusPill tone={i.rating === 'yes' ? 'ok' : i.rating === 'partly' ? 'sim' : i.rating === 'no' ? 'bad' : 'neutral'}>{i.rating ? t(`m25.l3.rating.${i.rating}`) : '—'}</StatusPill>
            ) : (
              <RadioGroup label={t('m25.l3.ratingLabel')} name={`l3-${i.key}`} value={vals[i.key] ?? ''} onChange={(v) => setVals((x) => ({ ...x, [i.key]: v as L3Rating }))}
                options={L3_RATINGS.map((r) => ({ value: r, label: t(`m25.l3.rating.${r}`) }))} />
            )}
          </fieldset>
        ))}
        {readOnly ? (obs.note ? <p className="text-[13px] text-ink-2">{obs.note}</p> : null) : (
          <TextArea label={t('m25.l3.note')} name="note" value={note} onChange={setNote} rows={3} hint={t('m25.l3.noteHint')} />
        )}
      </div>
    </Drawer>
  );
}
