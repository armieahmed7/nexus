// M06 /my/applications: own applications with plain-language stages, history mirrored from ENEC HR, withdraw, retention date.
import { useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import type { ApplicationsRow } from '../../data/types';
import { Page, Card, Async, EmptyState, Callout, Stepper, Timeline, StatusPill, ConfirmDialog, Grid, Section } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { APP_FLOW, isClosed, stageIndex } from './shared';

export default function MyApplicationsPage() {
  const t = useT();
  const repo = useRepo();
  const me = useSession().identity.personId;
  // "My" applications: the person's own rows (an HR authority who can read every application still sees only their own here).
  const apps = useQuery(['applications', 'talent_programmes'], async () => {
    if (!me) return [];
    const [a, p] = await Promise.all([repo.list('applications', { filter: { person_id: me }, order: [['submitted_at', 'desc']] }), repo.list('talent_programmes')]);
    return a.map((x) => ({ app: x, prog: p.find((y) => y.id === x.programme_id) ?? null }));
  }, [me]);
  return (
    <Page title={t('m06.routes.my-applications.title')} intro={t('m06.my.intro')} actions={<L to="/pathways" className="btn-outline btn-sm">{t('m06.my.findMore')}</L>}>
      <Async
        state={apps}
        empty={<EmptyState title={t('m06.my.none')} action={<L to="/pathways" className="btn-primary btn-sm">{t('m06.my.findProgramme')}</L>}>{t('m06.my.noneBody')}</EmptyState>}
      >
        {(rows) => (
          <div className="space-y-4" data-testid="m06-my-applications">
            {rows.map(({ app, prog }) => (
              <ApplicationCard key={app.id} app={app} progName={prog} />
            ))}
          </div>
        )}
      </Async>
      <Section title={t('m06.my.rightsTitle')}>
        <Grid cols={3}>
          <Callout tone="info" title={t('m06.my.right1Title')}>{t('m06.my.right1')}</Callout>
          <Callout tone="info" title={t('m06.my.right2Title')}>{t('m06.my.right2')}</Callout>
          <Callout tone="info" title={t('m06.my.right3Title')}>{t('m06.my.right3')}</Callout>
        </Grid>
      </Section>
    </Page>
  );
}

function ApplicationCard({ app, progName }: { app: ApplicationsRow; progName: { name_en: string; name_ar: string } | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const events = useQuery('application_events', () => (open ? repo.list('application_events', { filter: { application_id: app.id }, order: [['ts', 'asc']] }) : Promise.resolve([])), [open, app.id]);
  const closed = isClosed(app.stage);
  const failedAt = app.stage === 'unsuccessful' || app.stage === 'withdrawn' ? 1 : undefined;
  return (
    <Card
      title={progName ? pick(progName, 'name') : app.programme_id}
      eyebrow={t('m06.my.ref', { id: app.id })}
      actions={<StatusPill status={app.stage}>{t(`m06.appStage.${app.stage}`)}</StatusPill>}
    >
      <Stepper steps={APP_FLOW.map((s) => ({ id: s, label: t(`m06.appStage.${s}`) }))} current={app.stage === 'accepted' ? APP_FLOW.length : closed ? 1 : stageIndex(app.stage)} failedAt={failedAt} />
      <p className="mt-3 text-[13.5px]">{t(`m06.appExplain.${app.stage}`)}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
        <span>{t('m06.my.submitted', { date: f.date(app.submitted_at) })}</span>
        <span>{t('m06.my.updated', { date: f.date(app.updated_at) })}</span>
        {app.decision_source && <span>{t('m06.my.decisionSource')}</span>}
        {app.delete_after && <span className="text-sim">{t('m06.my.deleteOn', { date: f.date(app.delete_after) })}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-outline btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? t('m06.my.hideHistory') : t('m06.my.showHistory')}
        </button>
        {!closed && (
          <button className="btn-ghost btn-sm text-bad" onClick={() => setConfirm(true)} data-testid="m06-withdraw">
            {t('m06.my.withdraw')}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3">
          <Async state={events} empty={<p className="text-ink-3">{t('m06.my.noHistory')}</p>}>
            {(evs) => (
              <Timeline
                items={evs.map((e) => ({
                  id: e.id,
                  when: f.dateTime(e.ts),
                  title: t(`m06.appStage.${e.stage}`),
                  detail: `${pick(e, 'note')}${e.by_role ? ` · ${e.by_role === 'Applicant' ? t('m06.my.byYou') : t('m06.my.byHr')}` : ''}`,
                  tone: e.stage === 'unsuccessful' || e.stage === 'withdrawn' ? 'bad' : e.stage === 'offer' || e.stage === 'accepted' ? 'ok' : 'accent',
                }))}
              />
            )}
          </Async>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        danger
        title={t('m06.my.withdrawTitle')}
        consequence={t('m06.my.withdrawBody')}
        reasonLabel={t('m06.my.withdrawReason')}
        confirmLabel={t('m06.my.withdraw')}
        onConfirm={async (reason) => {
          await run(() => repo.rpc.withdrawApplication(app.id, reason));
        }}
      />
    </Card>
  );
}
