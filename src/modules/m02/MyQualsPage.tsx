// M02 /my/quals: my qualification cards, task by task, with status, evaluator role, date, expiry and supervisor
// acknowledgement; expiry timeline; gap analysis for my role (and a target role); my expiry notices.
// Mirror of the training records system: Kafa'a never sets a qualification status by itself.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, StatTile, Grid, Tabs, Timeline, Callout, StatusPill, SelectField, DataTable, SimChip } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { displayView } from './quals';
import { useQualData, QualPill, MirrorNote, ExpiryText, TaskTable, QualGapTable, NoticeChip, type QualData } from './shared';

export default function MyQualsPage() {
  const t = useT();
  const s = useSession();
  const me = s.identity.personId ?? '-';
  const q = useQualData({ filter: { person_id: me } }, [me]);
  return (
    <Page title={t('m02.routes.my-quals.title')} intro={t('m02.my.intro')} actions={<SimChip label={t('m02.mirror.chip')} />}>
      <Async state={q}>{(d) => <MyQuals d={d} me={me} roleId={s.person?.job_role_id ?? null} />}</Async>
    </Page>
  );
}

function MyQuals({ d, me, roleId }: { d: QualData; me: string; roleId: string | null }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const [target, setTarget] = useState('');
  const recs = d.records.filter((r) => r.person_id === me);
  const views = recs.map((r) => ({ r, v: displayView(r) }));
  const count = (pred: (v: ReturnType<typeof displayView>) => boolean) => views.filter((x) => pred(x.v)).length;
  const notices = useQuery(['notifications'], () => repo.list('notifications', { filter: { person_id: me }, order: [['created_at', 'desc']] }), [me]);
  const roles = useQuery(['job_roles'], () => repo.list('job_roles', { filter: { status: 'published' }, order: [['sort', 'asc']] }));
  const timeline = useMemo(
    () =>
      views
        .filter((x) => !x.v.masked && x.r.expires_on)
        .sort((a, b) => a.r.expires_on!.localeCompare(b.r.expires_on!))
        .map((x) => ({ id: x.r.id, when: f.date(x.r.expires_on), title: `${d.stdById.get(x.r.standard_id)?.code ?? ''} ${pick(d.stdById.get(x.r.standard_id), 'title')}`, detail: t(`m02.status.${x.v.view}`), tone: x.v.view === 'expired' ? ('bad' as const) : x.v.view === 'due' ? ('sim' as const) : ('ok' as const) })),
    [views, d, f, pick, t],
  );
  if (!recs.length)
    return (
      <EmptyState title={t('m02.my.none')} action={<L to="/careers" className="btn-outline btn-sm">{t('m02.my.toCareers')}</L>}>
        {t('m02.my.noneBody')}
      </EmptyState>
    );
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m02.my.tQualified')} value={f.num(count((v) => v.view === 'qualified' || v.view === 'renewed'))} tone="ok" />
        <StatTile label={t('m02.my.tDue')} value={f.num(count((v) => v.view === 'due' || (v.notice != null && v.view === 'qualified')))} sub={t('m02.my.tDueSub')} tone="sim" />
        <StatTile label={t('m02.my.tExpired')} value={f.num(count((v) => v.view === 'expired' || v.view === 'not_qualified' || v.view === 'suspended'))} tone="bad" />
        <StatTile label={t('m02.my.tProgress')} value={f.num(count((v) => v.view === 'in_progress' || v.view === 'planned'))} tone="info" />
      </Grid>
      <Callout tone="sim" title={t('m02.mirror.title')}>
        {t('m02.mirror.body')}
      </Callout>
      <Tabs
        tabs={[
          {
            id: 'cards',
            label: t('m02.my.tabCards'),
            badge: recs.length,
            content: (
              <ul className="space-y-4" data-testid="m02-my-cards">
                {recs.map((r) => {
                  const std = d.stdById.get(r.standard_id);
                  return (
                    <li key={r.id}>
                      <Card
                        eyebrow={`${std?.code ?? r.standard_id} · v${r.standard_version} · ${std?.discipline ?? ''}`}
                        title={pick(std, 'title')}
                        actions={
                          <div className="flex flex-wrap items-center gap-1.5">
                            <NoticeChip rec={r} />
                            <QualPill rec={r} />
                          </div>
                        }
                        footer={<MirrorNote system={r.source_system} synced={r.last_synced} />}
                      >
                        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
                          <span>
                            <span className="caps me-1">{t('m02.qualifiedOn')}</span>
                            {r.qualified_on && !r.security_mirror_only ? f.date(r.qualified_on) : '—'}
                          </span>
                          <span>
                            <span className="caps me-1">{t('m02.task.expiry')}</span>
                            <ExpiryText rec={r} />
                          </span>
                        </div>
                        {r.needs_review && (
                          <div className="mb-3">
                            <Callout tone="sim" title={t('m02.needsReview')}>
                              {r.review_reason}
                            </Callout>
                          </div>
                        )}
                        {r.review_reason && !r.needs_review && r.status === 'in_progress' && (
                          <div className="mb-3">
                            <Callout tone="info">{r.review_reason}</Callout>
                          </div>
                        )}
                        <TaskTable rec={r} data={d} />
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ),
          },
          {
            id: 'timeline',
            label: t('m02.my.tabTimeline'),
            content: timeline.length ? <Timeline items={timeline} /> : <EmptyState title={t('m02.my.noExpiries')} />,
          },
          {
            id: 'gap',
            label: t('m02.my.tabGap'),
            content: (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card title={t('m02.my.gapMine')} eyebrow={roleId ? undefined : t('m02.my.noRole')}>
                  <QualGapTable data={d} personId={me} roleId={roleId} />
                </Card>
                <Card title={t('m02.my.gapTarget')}>
                  <SelectField
                    label={t('m01.plan.to')}
                    name="target"
                    value={target}
                    onChange={setTarget}
                    placeholder={t('common.choose')}
                    options={(roles.data ?? []).filter((r) => r.id !== roleId).map((r) => ({ value: r.id, label: pick(r, 'title') }))}
                  />
                  {target ? (
                    <div className="mt-3 space-y-2">
                      <QualGapTable data={d} personId={me} roleId={target} />
                      <L to={`/careers/plan?from=${roleId ?? 'none'}&to=${target}`} className="text-[13px]">
                        {t('m02.my.openPlanner')}
                      </L>
                    </div>
                  ) : (
                    <p className="mt-3 text-[13px] text-ink-2">{t('m02.my.pickTarget')}</p>
                  )}
                </Card>
              </div>
            ),
          },
          {
            id: 'notices',
            label: t('m02.my.tabNotices'),
            content: (
              <Async state={notices} empty={<EmptyState title={t('m02.my.noNotices')} />}>
                {(ns) => {
                  const rows = ns.filter((n) => n.kind === 'expiry');
                  return (
                    <DataTable
                      rows={rows}
                      rowKey={(n) => n.id}
                      searchable={false}
                      empty={<EmptyState title={t('m02.my.noNotices')} />}
                      columns={[
                        { key: 'when', header: t('m02.my.noticeWhen'), value: (n) => n.created_at, render: (n) => f.dateTime(n.created_at), sortable: true },
                        { key: 'title', header: t('m02.my.noticeTitle'), value: (n) => pick(n, 'title') },
                        { key: 'sev', header: t('m02.task.status'), value: (n) => n.severity, render: (n) => <StatusPill tone={n.severity === 'warn' ? 'sim' : n.severity === 'bad' ? 'bad' : 'info'}>{n.read_at ? t('m02.my.read') : t('m02.my.unread')}</StatusPill> },
                      ]}
                    />
                  );
                }}
              </Async>
            ),
          },
        ]}
      />
    </>
  );
}
