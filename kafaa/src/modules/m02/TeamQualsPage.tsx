// M02 /team/quals: people in my scope against qualification standards, coloured by status (due = within 30 days), with
// filters, CSV export, a person drawer (records task by task + gap analysis for their role) and the
// "who is qualified for task X" lookup for work planners, limited to people in scope.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Tabs, FilterBar, useFilters, Drawer, StatusPill, SelectField, DataTable, toCsv, downloadText, Icon, type Column } from '../../ui';
import { useT, usePick, useFormat } from '../../i18n';
import { useSession } from '../../auth/session';
import { displayView, viewTone, qualifiedForTask } from './quals';
import { useQualData, PersonName, QualPill, ExpiryText, TaskTable, QualGapTable, MirrorNote, type QualData, type Person, type Rec } from './shared';

export default function TeamQualsPage() {
  const t = useT();
  const q = useQualData();
  return (
    <Page title={t('m02.routes.team-quals.title')} intro={t('m02.matrix.intro')} wide>
      <Async state={q}>
        {(d) => (
          <Tabs
            tabs={[
              { id: 'matrix', label: t('m02.matrix.tabMatrix'), content: <Matrix d={d} /> },
              { id: 'who', label: t('m02.matrix.tabWho'), content: <WhoIsQualified d={d} /> },
            ]}
          />
        )}
      </Async>
    </Page>
  );
}

const CELL: Record<string, string> = { ok: 'bg-ok-bg text-ok', sim: 'bg-sim-bg text-sim', bad: 'bg-bad-bg text-bad', info: 'bg-info-bg text-info', neutral: 'bg-sunken text-ink-3' };

function Matrix({ d }: { d: QualData }) {
  const t = useT();
  const pick = usePick();
  const s = useSession();
  const [flt, setFlt] = useFilters({ q: '', team: '', discipline: '', status: '' }, true);
  const [person, setPerson] = useState<Person | null>(null);
  const me = s.identity.personId;
  const people = d.people.filter((p) => p.id !== me && p.kind === 'staff' && d.records.some((r) => r.person_id === p.id));
  const teams = [...new Set(people.map((p) => p.crew ? `crew:${p.crew}` : p.team_id ? `team:${p.team_id}` : ''))].filter(Boolean).sort();
  const stdIds = [...new Set(d.records.map((r) => r.standard_id))].filter((id) => !flt.discipline || d.stdById.get(id)?.discipline === flt.discipline).sort((a, b) => (d.stdById.get(a)?.code ?? a).localeCompare(d.stdById.get(b)?.code ?? b));
  const recOf = (pid: string, sid: string) => d.records.find((r) => r.person_id === pid && r.standard_id === sid);
  const rows = people.filter((p) => {
    if (flt.team && (p.crew ? `crew:${p.crew}` : `team:${p.team_id}`) !== flt.team) return false;
    if (flt.q && !`${p.display_name} ${p.display_name_ar}`.toLowerCase().includes(flt.q.toLowerCase())) return false;
    if (flt.status && !stdIds.some((sid) => { const r = recOf(p.id, sid); return r && displayView(r).view === flt.status; })) return false;
    return true;
  });
  const disciplines = [...new Set(d.stds.map((x) => x.discipline))].sort();
  const exportCsv = () => {
    const cols: Column<Person>[] = [
      { key: 'person', header: t('m02.team.person'), value: (p) => p.display_name },
      { key: 'team', header: t('m02.matrix.team'), value: (p) => (p.crew ? `Crew ${p.crew}` : p.team_id ?? '') },
      ...stdIds.map((sid) => ({ key: sid, header: d.stdById.get(sid)?.code ?? sid, value: (p: Person) => { const r = recOf(p.id, sid); if (!r) return ''; const v = displayView(r); return v.masked ? v.view : `${v.view}${r.expires_on ? ` (${r.expires_on})` : ''}`; } })),
    ];
    downloadText('kafaa-team-qualifications.csv', toCsv(rows, cols));
  };
  if (!people.length) return <EmptyState title={t('m02.team.noTeam')}>{t('m02.team.noTeamBody')}</EmptyState>;
  return (
    <div className="space-y-3">
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="q"
        fields={[
          { key: 'team', label: t('m02.matrix.team'), options: teams.map((x) => ({ value: x, label: x.startsWith('crew:') ? t('m02.matrix.crew', { c: x.slice(5) }) : x.slice(5) })) },
          { key: 'discipline', label: t('m02.matrix.discipline'), options: disciplines.map((x) => ({ value: x, label: x })) },
          { key: 'status', label: t('m02.task.status'), options: ['qualified', 'due', 'expired', 'in_progress', 'suspended'].map((x) => ({ value: x, label: t(`m02.status.${x}`) })) },
        ]}
        extra={
          <button className="btn-outline btn-sm" onClick={exportCsv} data-testid="m02-matrix-csv">
            <Icon name="download" size={13} className="me-1 inline" />
            {t('common.exportCsv')}
          </button>
        }
      />
      <div className="flex flex-wrap gap-2 text-[12px]" aria-label={t('m02.matrix.legend')}>
        {['qualified', 'due', 'expired', 'in_progress', 'not_qualified'].map((v) => (
          <span key={v} className={`rounded px-2 py-0.5 ${CELL[viewTone(v)]}`}>
            {t(`m02.status.${v}`)}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t('m02.matrix.noRows')} />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base w-full" data-testid="m02-matrix">
            <caption className="sr-only">{t('m02.routes.team-quals.title')}</caption>
            <thead>
              <tr>
                <th className="sticky start-0 z-10 bg-panel text-start">{t('m02.team.person')}</th>
                {stdIds.map((sid) => (
                  <th key={sid} className="text-center text-[11.5px]" title={pick(d.stdById.get(sid), 'title')}>
                    {d.stdById.get(sid)?.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="sticky start-0 z-10 bg-panel text-start font-medium">
                    <button className="text-start hover:underline" onClick={() => setPerson(p)} data-testid="m02-matrix-person">
                      <PersonName p={p} />
                    </button>
                    <div className="text-[11.5px] text-ink-3">{p.crew ? t('m02.matrix.crew', { c: p.crew }) : p.team_id}</div>
                  </th>
                  {stdIds.map((sid) => {
                    const r = recOf(p.id, sid);
                    if (!r) return <td key={sid} className="text-center text-ink-3">·</td>;
                    const v = displayView(r);
                    return (
                      <td key={sid} className="p-0.5 text-center">
                        <button className={`w-full rounded px-1.5 py-1 text-[11.5px] font-semibold ${CELL[viewTone(v.view)]}`} onClick={() => setPerson(p)} data-status={v.view} title={`${d.stdById.get(sid)?.code}: ${t(`m02.status.${v.view}`)}${r.expires_on && !v.masked ? ` · ${r.expires_on}` : ''}`}>
                          {t(`m02.statusShort.${v.view}`)}
                          {r.needs_review && ' *'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] text-ink-3">{t('m02.matrix.footnote')}</p>
      <PersonDrawer d={d} person={person} onClose={() => setPerson(null)} />
    </div>
  );
}

function PersonDrawer({ d, person, onClose }: { d: QualData; person: Person | null; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const recs: Rec[] = person ? d.records.filter((r) => r.person_id === person.id) : [];
  return (
    <Drawer open={!!person} onClose={onClose} title={person ? <PersonName p={person} /> : ''}>
      {person && (
        <div className="space-y-4" data-testid="m02-person-drawer">
          <Section title={t('m02.matrix.gapFor')}>
            <QualGapTable data={d} personId={person.id} roleId={person.job_role_id} />
          </Section>
          {recs.map((r) => (
            <Card key={r.id} eyebrow={d.stdById.get(r.standard_id)?.code} title={pick(d.stdById.get(r.standard_id), 'title')} actions={<QualPill rec={r} />} footer={<MirrorNote system={r.source_system} synced={r.last_synced} />}>
              <div className="mb-2 text-[13px]">
                <span className="caps me-1">{t('m02.task.expiry')}</span>
                <ExpiryText rec={r} />
              </div>
              <TaskTable rec={r} data={d} />
            </Card>
          ))}
        </div>
      )}
    </Drawer>
  );
}

function WhoIsQualified({ d }: { d: QualData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const stds = d.stds.filter((s) => s.status === 'current' && d.records.some((r) => r.standard_id === s.id));
  const [std, setStd] = useState(stds[0]?.id ?? '');
  const tasks = d.tasksOf(std);
  const [task, setTask] = useState('');
  const taskId = tasks.some((x) => x.id === task) ? task : tasks[0]?.id ?? '';
  const result = useMemo(() => (std && taskId ? qualifiedForTask(d.records, d.evals, std, taskId) : []), [d, std, taskId]);
  return (
    <div className="space-y-3">
      <p className="text-ink-2">{t('m02.who.desc')}</p>
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m02-who-form">
          <SelectField label={t('m02.who.standard')} name="std" value={std} onChange={(v) => { setStd(v); setTask(''); }} options={stds.map((s) => ({ value: s.id, label: `${s.code} · ${pick(s, 'title')}` }))} />
          <SelectField label={t('m02.who.task')} name="task" value={taskId} onChange={setTask} options={tasks.map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'statement')}` }))} />
        </div>
      </Card>
      <div data-testid="m02-who-result">
        <DataTable
          rows={result}
          rowKey={(r) => r.id}
          searchable={false}
          csvName="qualified-for-task"
          empty={<EmptyState title={t('m02.who.none')}>{t('m02.who.noneBody')}</EmptyState>}
          caption={t('m02.who.count', { n: f.num(result.length) })}
          columns={[
            { key: 'person', header: t('m02.team.person'), value: (r) => d.personById.get(r.person_id)?.display_name ?? r.person_id, render: (r) => <PersonName p={d.personById.get(r.person_id)} />, sortable: true },
            { key: 'team', header: t('m02.matrix.team'), value: (r) => { const p = d.personById.get(r.person_id); return p?.crew ? `Crew ${p.crew}` : p?.team_id ?? ''; } },
            { key: 'status', header: t('m02.task.status'), value: (r) => displayView(r).view, render: (r) => <QualPill rec={r as Rec} /> },
            { key: 'exp', header: t('m02.task.expiry'), value: (r) => r.expires_on ?? '', render: (r) => <ExpiryText rec={r as Rec} />, sortable: true },
          ]}
        />
      </div>
      <p className="text-[12px] text-ink-3">
        <StatusPill tone="neutral">{t('m02.who.scopeNote')}</StatusPill>
      </p>
    </div>
  );
}
