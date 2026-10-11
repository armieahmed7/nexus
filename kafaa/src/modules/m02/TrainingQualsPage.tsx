// M02 /training/quals: qualification standards (versioned cards) with task counts, records in my scope and records
// needing review; my evaluator qualifications; my evaluation queue (records in progress on standards I may evaluate).
import { useState } from 'react';
import { Page, Section, Card, Grid, Async, EmptyState, DataTable, StatusPill, StatTile, FilterBar, useFilters, CheckboxField, ConfirmDialog, Icon } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useT, usePick, useFormat, L, useNav } from '../../i18n';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import { useQualData, PersonName, QualPill, type QualData } from './shared';

export default function TrainingQualsPage() {
  const t = useT();
  const q = useQualData();
  return (
    <Page title={t('m02.routes.training-quals.title')} intro={t('m02.stds.intro')} wide>
      <Async state={q}>{(d) => <Standards d={d} />}</Async>
    </Page>
  );
}

function Standards({ d }: { d: QualData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const nav = useNav();
  const s = useSession();
  const repo = useRepo();
  const act = useAction();
  const [sweep, setSweep] = useState(false);
  const [flt, setFlt] = useFilters({ q: '', discipline: '', superseded: '' }, true);
  const me = s.identity.personId;
  const today = todayIso();
  const myEq = myEvaluatorQuals(d, me);
  const stds = d.stds.filter((x) => (flt.superseded === 'true' || x.status !== 'superseded') && (!flt.discipline || x.discipline === flt.discipline) && (!flt.q || `${x.code} ${x.title_en} ${x.title_ar}`.toLowerCase().includes(flt.q.toLowerCase())));
  const recsOn = (sid: string) => d.records.filter((r) => r.standard_id === sid && r.person_id !== me);
  const queue = d.records.filter((r) => r.person_id !== me && myEq.validIds.has(r.standard_id) && (['in_progress', 'planned', 'expired', 'due'].includes(r.status) || r.needs_review));
  const disciplines = [...new Set(d.stds.map((x) => x.discipline))].sort();
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m02.stds.tCurrent')} value={f.num(d.stds.filter((x) => x.status === 'current').length)} />
        <StatTile label={t('m02.stds.tRecords')} value={f.num(d.records.filter((r) => r.person_id !== me).length)} sub={t('m02.stds.tRecordsSub')} />
        <StatTile label={t('m02.stds.tReview')} value={f.num(d.records.filter((r) => r.needs_review).length)} tone="sim" />
        <StatTile label={t('m02.stds.tQueue')} value={f.num(queue.length)} tone="info" />
      </Grid>
      <Section
        title={t('m02.stds.listTitle')}
        actions={
          s.can('qual_records', ['Scope']) && (
            <button className="btn-outline btn-sm" onClick={() => setSweep(true)} data-testid="m02-stds-sweep">
              <Icon name="bell" size={13} className="me-1 inline" />
              {t('m02.team.runSweep')}
            </button>
          )
        }
      >
        <FilterBar
          value={flt}
          onChange={setFlt}
          search="q"
          fields={[{ key: 'discipline', label: t('m02.matrix.discipline'), options: disciplines.map((x) => ({ value: x, label: x })) }]}
          extra={<CheckboxField label={t('m02.stds.showSuperseded')} checked={flt.superseded === 'true'} onChange={(v) => setFlt({ superseded: v ? 'true' : '' })} />}
        />
        <div data-testid="m02-standards">
          <DataTable
            rows={stds}
            rowKey={(x) => x.id}
            searchable={false}
            csvName="qualification-standards"
            onRowClick={(x) => nav(`/training/quals/${x.id}`)}
            empty={<EmptyState title={t('m02.stds.none')} />}
            columns={[
              { key: 'code', header: t('m02.stds.code'), value: (x) => x.code, sortable: true, render: (x) => <L to={`/training/quals/${x.id}`} className="num font-semibold">{x.code}</L> },
              { key: 'title', header: t('m02.stds.title'), value: (x) => pick(x, 'title'), sortable: true },
              { key: 'discipline', header: t('m02.matrix.discipline'), value: (x) => x.discipline, sortable: true },
              { key: 'version', header: t('m02.stds.version'), value: (x) => x.version, render: (x) => <span className="num">v{x.version}</span> },
              { key: 'status', header: t('m02.task.status'), value: (x) => x.status, render: (x) => <StatusPill status={x.status}>{t(`m02.stdStatus.${x.status}`)}</StatusPill> },
              { key: 'tasks', header: t('m02.stds.tasks'), value: (x) => d.tasksOf(x.id).length, align: 'end' },
              { key: 'records', header: t('m02.stds.records'), value: (x) => recsOn(x.id).length, align: 'end' },
              { key: 'review', header: t('m02.stds.review'), value: (x) => recsOn(x.id).filter((r) => r.needs_review).length, align: 'end', render: (x) => { const n = recsOn(x.id).filter((r) => r.needs_review).length; return n ? <StatusPill tone="sim">{f.num(n)}</StatusPill> : '0'; } },
              { key: 'requal', header: t('m02.stds.requal'), value: (x) => x.requal_months ?? '', render: (x) => (x.requal_months ? t('m02.stds.months', { n: f.num(x.requal_months) }) : '—') },
              { key: 'sec', header: '', csv: false, render: (x) => (x.security_restricted ? <StatusPill tone="neutral">{t('m02.stds.restricted')}</StatusPill> : null) },
            ]}
          />
        </div>
      </Section>

      <Grid cols={2}>
        <Card title={t('m02.stds.myEvaluator')}>
          {myEq.rows.length === 0 ? (
            <p className="text-ink-2">{t('m02.stds.noEvaluator')}</p>
          ) : (
            <ul className="space-y-1.5 text-[13px]" data-testid="m02-my-evaluator">
              {myEq.rows.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2">
                  <L to={`/training/quals/${q.standard_id}`}>
                    {d.stdById.get(q.standard_id)?.code} · {pick(d.stdById.get(q.standard_id), 'title')}
                  </L>
                  <StatusPill status={q.valid_to >= today ? 'valid' : 'expired'}>{t('m02.stds.validTo', { d: f.date(q.valid_to) })}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t('m02.stds.queueTitle')}>
          {queue.length === 0 ? (
            <p className="text-ink-2">{t('m02.stds.queueEmpty')}</p>
          ) : (
            <ul className="space-y-1.5 text-[13px]" data-testid="m02-eval-queue">
              {queue.slice(0, 12).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <L to={`/training/quals/${r.standard_id}?record=${r.id}`}>
                    <PersonName p={d.personById.get(r.person_id)} /> · {d.stdById.get(r.standard_id)?.code}
                  </L>
                  <span className="flex gap-1">
                    {r.needs_review && <StatusPill tone="sim">{t('m02.needsReview')}</StatusPill>}
                    <QualPill rec={r} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Grid>
      <ConfirmDialog open={sweep} onClose={() => setSweep(false)} title={t('m02.team.runSweep')} consequence={t('m02.team.sweepConsequence')} onConfirm={() => act(() => repo.rpc.qualExpirySweep())} />
    </>
  );
}

/** The caller's evaluator qualifications (rows are visible to their holder and to sign-off roles). */
function myEvaluatorQuals(d: QualData, me: string | null) {
  const rows = d.evaluatorQuals.filter((q) => q.person_id === me);
  const today = todayIso();
  return { rows, validIds: new Set(rows.filter((q) => q.valid_to >= today).map((q) => q.standard_id)) };
}
