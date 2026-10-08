// M14 · /my dashboard: the signed-in person's next expiries (qualifications, licence, medical flag), assigned training,
// development-plan progress, applications and notices, plus quick links to every area their roles open.
// Everything is read through the repository with an explicit person filter, so a manager's scope never leaks in here.
import { useMemo } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { checkGuard } from '../../auth/guards';
import { ROUTES } from '../../routes/registry';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, Card, EmptyState, Icon, Page, ProgressBar, StatTile, StatusPill } from '../../ui';
import { licenceView, medicalView, qualView } from '../../domain/rules';
import type { NotificationsRow } from '../../data/types';

const ACTIVE_ENROLMENT = ['assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress'];
const OPEN_APPLICATION = ['interest', 'submitted', 'screening', 'assessment', 'interview', 'offer'];

export default function MyPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const data = useQuery(
    ['qual_records', 'qual_standards', 'licences', 'medical_due', 'enrolments', 'courses', 'dev_plans', 'plan_activities', 'applications', 'talent_programmes', 'notifications', 'job_roles'],
    async () => {
      if (!me) return null;
      const mine = { filter: { person_id: me } } as const;
      const [quals, standards, licences, medical, enrolments, courses, plans, activities, apps, programmes, notes, roles] = await Promise.all([
        repo.list('qual_records', mine),
        repo.list('qual_standards'),
        repo.list('licences', mine),
        repo.list('medical_due', mine),
        repo.list('enrolments', mine),
        repo.list('courses'),
        repo.list('dev_plans', mine),
        repo.list('plan_activities', mine),
        repo.list('applications', mine),
        repo.list('talent_programmes'),
        repo.list('notifications', { ...mine, order: [['created_at', 'desc']] }),
        repo.list('job_roles'),
      ]);
      return { quals, standards, licences, medical, enrolments, courses, plans, activities, apps, programmes, notes, roles };
    },
    [me],
  );

  const links = useMemo(
    () =>
      ROUTES.filter((r) => r.nav && r.id !== 'my' && checkGuard(r.guard, s) === 'ok' && (r.nav.lens === 'my' || r.nav.lens === 'admin' || r.nav.lens === 'partner'))
        .sort((a, b) => (a.nav!.lens === b.nav!.lens ? a.nav!.order - b.nav!.order : a.nav!.lens.localeCompare(b.nav!.lens))),
    [s],
  );
  const markRead = (n: NotificationsRow) => run(() => repo.update('notifications', n.id, { read_at: new Date().toISOString() }));
  const name = s.person ? pick({ name_en: s.person.display_name, name_ar: s.person.display_name_ar || s.person.display_name }, 'name') : s.persona ? pick(s.persona, 'title') : '';

  return (
    <Page eyebrow={t('m14.my.eyebrow')} title={name ? t('m14.my.hello', { name }) : t('m14.routes.my.title')} intro={t('m14.my.intro')}>
      <Async state={data} isEmpty={(d) => !d} empty={<EmptyState title={t('m14.my.noProfile')}>{t('m14.my.noProfileBody')}</EmptyState>}>
        {(raw) => {
          const d = raw!;
          const std = new Map(d.standards.map((x) => [x.id, x]));
          const course = new Map(d.courses.map((x) => [x.id, x]));
          const prog = new Map(d.programmes.map((x) => [x.id, x]));
          const role = new Map(d.roles.map((x) => [x.id, x]));
          const quals = d.quals.map((q) => ({ q, v: qualView(q) })).filter((x) => x.v.daysToExpiry !== null && ['qualified', 'due', 'expired', 'renewed'].includes(x.v.view)).sort((a, b) => (a.v.daysToExpiry ?? 0) - (b.v.daysToExpiry ?? 0));
          const dueSoon = quals.filter((x) => x.v.view === 'due' || x.v.view === 'expired');
          const lic = d.licences[0];
          const lv = lic ? licenceView(lic) : null;
          const med = d.medical[0];
          const mv = med ? medicalView(med) : null;
          const training = d.enrolments.filter((e) => ACTIVE_ENROLMENT.includes(e.status)).sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999'));
          const plan = d.plans.find((p) => p.status === 'active' || p.status === 'approved') ?? d.plans.find((p) => p.status !== 'closed');
          const acts = plan ? d.activities.filter((a) => a.plan_id === plan.id) : [];
          const done = acts.filter((a) => a.status === 'done').length;
          const apps = d.apps.filter((a) => OPEN_APPLICATION.includes(a.stage));
          const unread = d.notes.filter((n) => !n.read_at);
          return (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m14-my-tiles">
                <StatTile label={t('m14.my.tileExpiring')} value={f.num(dueSoon.length)} tone={dueSoon.length ? 'sim' : 'ok'} sub={t('m14.my.tileExpiringSub')} />
                <StatTile label={t('m14.my.tileTraining')} value={f.num(training.length)} tone={training.some((e) => e.due_on && e.due_on < new Date().toISOString().slice(0, 10)) ? 'bad' : undefined} sub={t('m14.my.tileTrainingSub')} />
                <StatTile label={t('m14.my.tilePlan')} value={acts.length ? f.pct((done * 100) / acts.length, 0) : '—'} sub={plan ? pick(role.get(plan.target_role_id) ?? { title_en: '', title_ar: '' }, 'title') : t('m14.my.noPlan')} />
                <StatTile label={t('m14.my.tileNotices')} value={f.num(unread.length)} tone={unread.length ? 'info' : undefined} sub={t('m14.my.tileNoticesSub')} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card title={t('m14.my.expiriesTitle')} actions={<L to="/my/quals" className="btn-ghost btn-sm">{t('m14.my.viewAll')}</L>}>
                  <ul className="space-y-2" data-testid="m14-my-expiries">
                    {lic && lv && (
                      <li className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2.5">
                        <div>
                          <div className="font-semibold">{t('m14.my.licence', { type: lic.type })}</div>
                          <div className="text-[12px] text-ink-3">{t('m14.my.expiresOn', { date: f.date(lic.expires_on) })} · {t('m14.my.mirror', { system: lic.source_system })}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill status={lv.view} />
                          <L to="/my/licence" className="btn-ghost btn-sm">{t('m14.my.open')}</L>
                        </div>
                      </li>
                    )}
                    {med && mv && (
                      <li className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2.5">
                        <div>
                          <div className="font-semibold">{t('m14.my.medical')}</div>
                          <div className="text-[12px] text-ink-3">{t('m14.my.medicalDue', { date: f.date(med.due_on) })} · {t('m14.my.flagOnly')}</div>
                        </div>
                        <StatusPill status={mv === 'ok' ? 'ok' : mv === 'not_confirmed' ? 'pending' : mv} />
                      </li>
                    )}
                    {quals.slice(0, 5).map(({ q, v }) => (
                      <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2.5">
                        <div>
                          <div className="font-semibold">{std.get(q.standard_id) ? pick(std.get(q.standard_id)!, 'title') : q.standard_id}</div>
                          <div className="text-[12px] text-ink-3">
                            {q.expires_on ? t('m14.my.expiresOn', { date: f.date(q.expires_on) }) : '—'}
                            {v.notice ? ` · ${t('m14.my.notice', { n: v.notice })}` : ''}
                          </div>
                        </div>
                        <StatusPill status={v.view} />
                      </li>
                    ))}
                    {!lic && !med && quals.length === 0 && <li className="text-[13px] text-ink-3">{t('m14.my.noExpiries')}</li>}
                  </ul>
                </Card>

                <Card title={t('m14.my.trainingTitle')} actions={<L to="/my/learning" className="btn-ghost btn-sm">{t('m14.my.viewAll')}</L>}>
                  {training.length === 0 ? (
                    <p className="text-[13px] text-ink-3">{t('m14.my.noTraining')}</p>
                  ) : (
                    <ul className="space-y-2" data-testid="m14-my-training">
                      {training.slice(0, 5).map((e) => (
                        <li key={e.id} className="rounded-btn border border-line p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">{course.get(e.course_id) ? pick(course.get(e.course_id)!, 'title') : e.course_id}</span>
                            <StatusPill status={e.status} />
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                            <span>{e.due_on ? t('m14.my.dueOn', { date: f.date(e.due_on) }) : t('m14.my.noDue')}</span>
                            <span>· {t(`m14.my.source.${e.source}`)}</span>
                          </div>
                          {e.progress_pct > 0 && <div className="mt-1.5"><ProgressBar value={e.progress_pct} /></div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card title={t('m14.my.planTitle')} actions={<L to="/my/plan" className="btn-ghost btn-sm">{t('m14.my.open')}</L>}>
                  {!plan ? (
                    <EmptyState title={t('m14.my.noPlan')} action={<L to="/my/plan" className="btn-outline btn-sm">{t('m14.my.startPlan')}</L>} />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{t('m14.my.towards', { role: role.get(plan.target_role_id) ? pick(role.get(plan.target_role_id)!, 'title') : plan.target_role_id })}</span>
                        <StatusPill status={plan.status} />
                      </div>
                      <ProgressBar value={acts.length ? (done * 100) / acts.length : 0} />
                      <p className="text-[12.5px] text-ink-2">{t('m14.my.planProgress', { done: f.num(done), total: f.num(acts.length) })}</p>
                      <ul className="space-y-1 text-[13px]">
                        {acts.filter((a) => a.status !== 'done').slice(0, 3).map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-2">
                            <span>{pick(a, 'title')}</span>
                            <span className="text-[12px] text-ink-3">{a.due_on ? f.date(a.due_on) : ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>

                <Card title={t('m14.my.appsTitle')} actions={<L to="/my/applications" className="btn-ghost btn-sm">{t('m14.my.viewAll')}</L>}>
                  {apps.length === 0 ? (
                    <p className="text-[13px] text-ink-3">{t('m14.my.noApps')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {apps.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2.5">
                          <span className="font-semibold">{prog.get(a.programme_id) ? pick(prog.get(a.programme_id)!, 'name') : a.programme_id}</span>
                          <span className="flex items-center gap-2 text-[12px] text-ink-3">
                            {f.date(a.updated_at)} <StatusPill status={a.stage} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <Card title={t('m14.my.noticesTitle')} actions={<L to="/my/settings#notifications" className="btn-ghost btn-sm">{t('m14.my.noticeSettings')}</L>}>
                {d.notes.length === 0 ? (
                  <p className="text-[13px] text-ink-3">{t('m14.my.noNotices')}</p>
                ) : (
                  <ul className="divide-y divide-line" data-testid="m14-my-notices">
                    {d.notes.slice(0, 8).map((n) => (
                      <li key={n.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <div className={`flex items-center gap-2 ${n.read_at ? 'text-ink-2' : 'font-semibold'}`}>
                            {!n.read_at && <span className="h-2 w-2 rounded-full bg-accent" aria-label={t('m14.my.unread')} />}
                            {pick(n, 'title')}
                          </div>
                          {(n.body_en || n.body_ar) && <p className="text-[12.5px] text-ink-2">{pick(n, 'body')}</p>}
                          <div className="text-[12px] text-ink-3">{f.dateTime(n.created_at)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill tone={n.severity === 'warn' ? 'sim' : n.severity === 'bad' ? 'bad' : n.severity === 'ok' ? 'ok' : 'info'}>{t(`m14.my.sev.${n.severity}`)}</StatusPill>
                          {n.link && <L to={n.link} className="btn-ghost btn-sm" onClick={() => !n.read_at && markRead(n)}>{t('m14.my.open')}</L>}
                          {!n.read_at && <button className="btn-ghost btn-sm" onClick={() => markRead(n)}>{t('m14.my.markRead')}</button>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title={t('m14.my.linksTitle')}>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="m14-my-links">
                  {links.map((r) => (
                    <li key={r.id}>
                      <L to={r.path} className="flex items-start gap-2 rounded-btn border border-line p-2.5 hover:border-accent hover:bg-accent-soft">
                        <Icon name={r.nav!.lens === 'admin' ? 'shield' : r.nav!.lens === 'partner' ? 'briefcase' : 'user'} className="mt-0.5 text-eyebrow" />
                        <span>
                          <span className="block text-[13.5px] font-semibold">{t(`${r.module.toLowerCase()}.routes.${r.id}.title`)}</span>
                          <span className="block text-[12px] text-ink-3">{t(`${r.module.toLowerCase()}.routes.${r.id}.purpose`)}</span>
                        </span>
                      </L>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          );
        }}
      </Async>
    </Page>
  );
}
