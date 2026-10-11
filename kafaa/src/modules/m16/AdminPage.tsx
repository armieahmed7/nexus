// M16 · /admin hub: the admin areas this person's roles open (with live counts), the work waiting on them, feature
// flags (platform admin; locked flags never change), the contact-request inbox and the demo-data reset (local only).
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { checkGuard } from '../../auth/guards';
import { ROUTES } from '../../routes/registry';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, Callout, Card, DataTable, EmptyState, Icon, Page, StatusPill, useToast } from '../../ui';
import type { ContactRequestsRow, FeatureFlagsRow } from '../../data/types';
import { todayIso } from '../../domain/rules';
import { accessReviewState } from '../../domain/g5rules';
import { GatedConfirm, Metric } from './parts';

export default function AdminPage() {
  const t = useT();
  const s = useSession();
  const areas = useMemo(() => ROUTES.filter((r) => r.nav?.lens === 'admin' && r.id !== 'admin' && checkGuard(r.guard, s) === 'ok').sort((a, b) => a.nav!.order - b.nav!.order), [s]);
  const isAdmin = s.hasRole('admin');
  const canFlags = s.can('integrations', ['R', 'A']);
  const canInbox = s.can('users_roles', ['R', 'W']);
  return (
    <Page title={t('m16.routes.admin.title')} intro={t('m16.hub.intro')} wide>
      <Queues />
      <Card title={t('m16.hub.areas')}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="m16-areas">
          {areas.map((r) => (
            <li key={r.id}>
              <L to={r.path} className="flex h-full items-start gap-2 rounded-btn border border-line p-3 hover:border-accent hover:bg-accent-soft">
                <Icon name="shield" className="mt-0.5 text-eyebrow" />
                <span>
                  <span className="block font-semibold">{t(`${r.module.toLowerCase()}.routes.${r.id}.title`)}</span>
                  <span className="block text-[12.5px] text-ink-3">{t(`${r.module.toLowerCase()}.routes.${r.id}.purpose`)}</span>
                </span>
              </L>
            </li>
          ))}
        </ul>
      </Card>
      {canFlags && <Flags canEdit={s.can('integrations', ['A'])} />}
      {canInbox && <Inbox canEdit={s.can('users_roles', ['W'])} />}
      {isAdmin && <DemoReset />}
    </Page>
  );
}

function Queues() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const s = useSession();
  const q = useQuery(['role_assignments', 'content_pages', 'advisor_sessions', 'concern_cases', 'integrations', 'contact_requests'], async () => {
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const [ra, pages, sessions, concerns, ints, contacts] = await Promise.all([
      s.can('users_roles', ['R', 'W']) ? safe(repo.list('role_assignments')) : Promise.resolve([]),
      s.can('public_content', ['W', 'A']) || s.can('internal_content', ['W']) ? safe(repo.list('content_pages')) : Promise.resolve([]),
      s.can('dalil_config', ['W', 'A', 'R']) ? safe(repo.list('advisor_sessions', { filter: { handoff_status: 'requested' } })) : Promise.resolve([]),
      s.can('concern_cases', ['R']) ? safe(repo.list('concern_cases')) : Promise.resolve([]),
      s.can('integrations', ['R']) ? safe(repo.list('integrations')) : Promise.resolve([]),
      s.can('users_roles', ['R', 'W']) ? safe(repo.list('contact_requests', { filter: { status: 'new' } })) : Promise.resolve([]),
    ]);
    return { ra, pages, sessions, concerns, ints, contacts };
  });
  return (
    <Async state={q}>
      {(d) => {
        const items: { label: string; n: number; to: string; tone?: 'bad' | 'info' | 'sim' }[] = [];
        if (s.can('users_roles', ['R', 'W'])) {
          items.push({ label: t('m16.hub.qPending'), n: d.ra.filter((a) => a.status === 'pending_second').length, to: '/admin/access', tone: 'info' });
          items.push({ label: t('m16.hub.qReviews'), n: d.ra.filter((a) => accessReviewState(a) === 'overdue').length, to: '/admin/access', tone: 'bad' });
          items.push({ label: t('m16.hub.qContacts'), n: d.contacts.length, to: '/admin#inbox', tone: 'info' });
        }
        if (s.can('public_content', ['W', 'A'])) items.push({ label: t('m16.hub.qReview'), n: d.pages.filter((p) => p.status === 'in_review' || p.status === 'in_translation').length, to: '/admin/content', tone: 'sim' });
        if (s.can('public_content', ['W', 'A'])) items.push({ label: t('m16.hub.qOverdue'), n: d.pages.filter((p) => p.is_published && p.review_on < todayIso()).length, to: '/admin/content', tone: 'bad' });
        if (s.can('dalil_config', ['W', 'A', 'R'])) items.push({ label: t('m16.hub.qHandoffs'), n: d.sessions.length, to: '/admin/dalil', tone: 'info' });
        if (s.can('concern_cases', ['R'])) items.push({ label: t('m16.hub.qConcerns'), n: d.concerns.filter((c) => c.status === 'received').length, to: '/admin/ecp', tone: 'bad' });
        if (s.can('integrations', ['R'])) items.push({ label: t('m16.hub.qSync'), n: d.ints.filter((i) => i.status !== 'ok' && i.status !== 'disabled').length, to: '/admin/integrations', tone: 'sim' });
        if (items.length === 0) return null;
        return (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="m16-queues">
            {items.map((x) => (
              <L key={x.label} to={x.to} className="block">
                <Metric label={x.label} value={f.num(x.n)} tone={x.n ? x.tone : 'ok'} sub={x.n ? t('m16.hub.open') : t('m16.hub.clear')} />
              </L>
            ))}
          </div>
        );
      }}
    </Async>
  );
}

function Flags({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const q = useQuery('feature_flags', () => repo.list('feature_flags', { order: [['area', 'asc'], ['key', 'asc']] }));
  const [flip, setFlip] = useState<FeatureFlagsRow | null>(null);
  return (
    <Card title={t('m16.flags.title')}>
      <p className="mb-3 text-[13px] text-ink-2">{t('m16.flags.intro')}</p>
      <Async state={q} empty={<EmptyState title={t('m16.flags.none')} />}>
        {(rows) => (
          <ul className="divide-y divide-line" data-testid="m16-flags">
            {rows.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{pick(x, 'label')}</span>
                    <code className="ltr text-[11.5px] text-ink-3">{x.key}</code>
                    {x.locked && <StatusPill tone="reserved"><Icon name="lock" size={11} /> {t('m16.flags.locked')}</StatusPill>}
                  </div>
                  <p className="text-[12.5px] text-ink-2">{pick(x, 'description')}</p>
                  <p className="text-[11.5px] text-ink-3">{t('m16.flags.area', { area: ['public', 'dalil', 'nexus', 'privacy', 'safety'].includes(x.area) ? t(`m16.flags.areas.${x.area}`) : x.area })} · {t('m16.flags.changed', { when: f.dateTime(x.updated_at) })}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={x.enabled}
                  aria-label={pick(x, 'label')}
                  disabled={!canEdit || x.locked}
                  onClick={() => setFlip(x)}
                  className={`relative h-6 w-11 shrink-0 rounded-full border transition ${x.enabled ? 'border-accent bg-accent' : 'border-line bg-sunken'} disabled:opacity-50`}
                  data-testid={`m16-flag-${x.key}`}
                >
                  <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-panel shadow transition-all ${x.enabled ? 'end-0.5' : 'start-0.5'}`} style={{ width: 18, height: 18 }} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Async>
      {!canEdit && <p className="mt-2 text-[12px] text-ink-3">{t('m16.flags.readOnly')}</p>}
      <GatedConfirm
        open={!!flip}
        onClose={() => setFlip(null)}
        title={flip ? t(flip.enabled ? 'm16.flags.turnOff' : 'm16.flags.turnOn', { name: pick(flip, 'label') }) : ''}
        consequence={flip ? pick(flip, 'description') : ''}
        actingAs={t('m16.hub.asAdmin')}
        onConfirm={() => flip && run(() => repo.update('feature_flags', flip.id, { enabled: !flip.enabled, updated_at: new Date().toISOString(), updated_by: s.identity.personId }), { success: t('m16.flags.saved') })}
      />
    </Card>
  );
}

function Inbox({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const q = useQuery('contact_requests', () => repo.list('contact_requests', { order: [['created_at', 'desc']] }));
  const today = todayIso();
  return (
    <section id="inbox">
      <Card title={t('m16.inbox.title')}>
        <p className="mb-3 text-[13px] text-ink-2">{t('m16.inbox.intro')}</p>
        <Async state={q} empty={<EmptyState title={t('m16.inbox.none')} />} isEmpty={(r) => r.length === 0}>
          {(rows) => (
            <DataTable<ContactRequestsRow>
              rows={rows}
              rowKey={(r) => r.id}
              csvName="contact-requests"
              columns={[
                { key: 'created', header: t('m16.inbox.received'), value: (r) => r.created_at, sortable: true, render: (r) => f.dateTime(r.created_at) },
                { key: 'topic', header: t('m16.inbox.topic'), value: (r) => r.topic, render: (r) => t(`m12.contact.topics.${r.topic}`) },
                { key: 'route', header: t('m16.inbox.routeTo'), value: (r) => r.route_to },
                { key: 'msg', header: t('m16.inbox.message'), value: (r) => r.message, render: (r) => <span className="line-clamp-2 max-w-[360px] text-[12.5px]">{r.message}</span> },
                { key: 'lang', header: t('m16.inbox.lang'), value: (r) => r.lang, render: (r) => (r.lang === 'ar' ? 'العربية' : 'English') },
                { key: 'consent', header: t('m16.inbox.consent'), value: (r) => (r.consent_contact ? 'yes' : 'no'), render: (r) => (r.consent_contact ? <StatusPill tone="ok">{t('common.yes')}</StatusPill> : <StatusPill tone="neutral">{t('common.no')}</StatusPill>) },
                { key: 'retention', header: t('m16.inbox.retention'), value: (r) => r.retention_until ?? '', render: (r) => (r.retention_until && r.retention_until < today ? <StatusPill tone="sim">{t('m16.inbox.expired')}</StatusPill> : r.retention_until ? f.date(r.retention_until) : '—') },
                { key: 'status', header: t('m16.inbox.status'), value: (r) => r.status, render: (r) => <StatusPill status={r.status === 'new' ? 'open' : r.status === 'routed' ? 'in_progress' : 'closed'}>{t(`m16.inbox.st.${r.status}`)}</StatusPill> },
                ...(canEdit
                  ? [{ key: 'act', header: '', csv: false, render: (r: ContactRequestsRow) => (
                      <span className="flex gap-1">
                        {r.status === 'new' && <button className="btn-outline btn-sm" onClick={() => run(() => repo.update('contact_requests', r.id, { status: 'routed' }), { success: t('m16.inbox.routed') })}>{t('m16.inbox.markRouted')}</button>}
                        {r.status !== 'closed' && <button className="btn-ghost btn-sm" onClick={() => run(() => repo.update('contact_requests', r.id, { status: 'closed' }), { success: t('m16.inbox.closed') })}>{t('m16.inbox.close')}</button>}
                      </span>
                    ) }]
                  : []),
              ]}
            />
          )}
        </Async>
      </Card>
    </section>
  );
}

function DemoReset() {
  const t = useT();
  const repo = useRepo();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const local = repo.backend === 'local' && !!repo.reset;
  return (
    <Card title={t('m16.reset.title')}>
      {local ? (
        <>
          <p className="text-[13px] text-ink-2">{t('m16.reset.body')}</p>
          <button className="btn-danger btn-sm mt-3" onClick={() => setOpen(true)} data-testid="m16-reset">
            <Icon name="reset" />
            {t('m16.reset.button')}
          </button>
          <GatedConfirm
            open={open}
            danger
            onClose={() => setOpen(false)}
            title={t('m16.reset.button')}
            consequence={t('m16.reset.consequence')}
            actingAs={t('m16.hub.asAdmin')}
            onConfirm={async () => {
              await repo.reset!();
              toast.push({ tone: 'ok', title: t('m16.reset.done') });
            }}
          />
        </>
      ) : (
        <Callout tone="info">{t('m16.reset.live')}</Callout>
      )}
    </Card>
  );
}
