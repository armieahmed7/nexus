// M14 · /admin/access: users, roles and scopes. Platform admins grant any role (elevated grants wait for a second admin,
// maker-checker); partner admins manage partner_user access in their own organisation only; auditors read.
// Quarterly access reviews keep or revoke elevated grants; leavers lose access automatically (kafaa_my_roles ignores
// a leaver's assignments) and are listed for clean-up. Every action goes through an audited RPC.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { roleLabel, useSession } from '../../auth/session';
import { LEVELS, MATRIX, PLATFORM_ROLES, RESOURCES, RESOURCE_LABELS, levelsOf, type PlatformRole } from '../../auth/policy';
import { useFormat, useI18n, usePick, useT } from '../../i18n';
import { Async, Callout, Card, DataTable, Drawer, EmptyState, FilterBar, Icon, KeyValue, Modal, Page, SelectField, StatusPill, Tabs, TextArea, TextField, minLen, required, useFilters, useForm, type Column } from '../../ui';
import type { PeopleRow, RoleAssignmentsRow } from '../../data/types';
import { ACCESS_REVIEW_DAYS, ELEVATED_ROLES, accessReviewState } from '../../domain/g5rules';
import { Metric } from '../m16/parts';

const SCOPES = ['self', 'all', 'entity', 'family', 'team', 'crew', 'org'];

export default function AdminAccessPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const { lang } = useI18n();
  const repo = useRepo();
  const s = useSession();
  const isAdmin = s.can('users_roles', ['W']);
  const isPartnerAdmin = !isAdmin && s.can('users_roles', ['OrgW']);
  const readOnly = !isAdmin && !isPartnerAdmin;
  const data = useQuery(['people', 'role_assignments', 'organisations'], async () => {
    const [people, assignments, orgs] = await Promise.all([repo.list('people', { order: [['display_name', 'asc']] }), repo.list('role_assignments', { order: [['granted_at', 'desc']] }), repo.list('organisations')]);
    return { people, assignments, orgs };
  });
  const [flt, setFlt] = useFilters({ q: '', kind: '', status: '', role: '', org: '' }, true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [revoke, setRevoke] = useState<RoleAssignmentsRow | null>(null);
  const [review, setReview] = useState<{ a: RoleAssignmentsRow; decision: 'keep' | 'revoke' } | null>(null);
  const run = useAction();

  const byPerson = useMemo(() => {
    const m = new Map<string, RoleAssignmentsRow[]>();
    for (const a of data.data?.assignments ?? []) m.set(a.person_id, [...(m.get(a.person_id) ?? []), a]);
    return m;
  }, [data.data]);
  const personName = (id: string | null | undefined) => {
    const p = data.data?.people.find((x) => x.id === id);
    return p ? pick({ n_en: p.display_name, n_ar: p.display_name_ar || p.display_name }, 'n') : id ?? '—';
  };
  const orgName = (id: string | null | undefined) => {
    const o = data.data?.orgs.find((x) => x.id === id);
    return o ? o.short || pick(o, 'name') : '—';
  };
  const role = (r: string) => roleLabel(r as PlatformRole, lang);
  const me = s.identity.personId;
  const actingAs = isAdmin ? t('m14.access.asAdmin') : isPartnerAdmin ? t('m14.access.asPartnerAdmin') : t('m14.access.asAuditor');

  return (
    <Page title={t('m14.routes.admin-access.title')} intro={t('m14.access.intro')} actions={<StatusPill tone="neutral">{actingAs}</StatusPill>} wide>
      {readOnly && <Callout tone="info">{t('m14.access.readOnly')}</Callout>}
      {isPartnerAdmin && <Callout tone="info">{t('m14.access.partnerScope', { org: orgName(s.identity.orgId) })}</Callout>}
      <Async state={data}>
        {(d) => {
          const active = d.assignments.filter((a) => a.status === 'active');
          const pending = d.assignments.filter((a) => a.status === 'pending_second');
          const reviews = active.filter((a) => accessReviewState(a) !== 'not_required').map((a) => ({ a, st: accessReviewState(a) }));
          const leavers = d.people.filter((p) => p.status === 'leaver' && (byPerson.get(p.id) ?? []).some((a) => a.status !== 'revoked'));
          const people = d.people.filter((p) => {
            const roles = (byPerson.get(p.id) ?? []).filter((a) => a.status !== 'revoked').map((a) => a.role);
            return (!flt.kind || p.kind === flt.kind) && (!flt.status || p.status === flt.status) && (!flt.role || roles.includes(flt.role)) && (!flt.org || p.org_id === flt.org) && (!flt.q || `${p.display_name} ${p.display_name_ar} ${p.id} ${p.persona_id ?? ''}`.toLowerCase().includes(flt.q.toLowerCase()));
          });
          const open = d.people.find((p) => p.id === openId) ?? null;
          const userCols: Column<PeopleRow>[] = [
            { key: 'name', header: t('m14.access.name'), value: (p) => p.display_name, sortable: true, render: (p) => <button className="text-start font-semibold text-eyebrow hover:underline" onClick={() => setOpenId(p.id)}>{personName(p.id)}</button> },
            { key: 'kind', header: t('m14.profile.kind'), value: (p) => p.kind, render: (p) => t(`m14.kind.${p.kind}`) },
            { key: 'org', header: t('m14.profile.org'), value: (p) => orgName(p.org_id) },
            { key: 'roles', header: t('m14.access.roles'), value: (p) => (byPerson.get(p.id) ?? []).filter((a) => a.status !== 'revoked').map((a) => a.role).join(' '), render: (p) => (
              <span className="flex flex-wrap gap-1">
                {(byPerson.get(p.id) ?? []).filter((a) => a.status !== 'revoked').map((a) => <StatusPill key={a.id} tone={a.status === 'pending_second' ? 'sim' : ELEVATED_ROLES.includes(a.role as PlatformRole) ? 'accent' : 'neutral'}>{role(a.role)}</StatusPill>)}
              </span>
            ) },
            { key: 'status', header: t('m14.profile.status'), value: (p) => p.status, render: (p) => <StatusPill status={p.status === 'leaver' ? 'revoked' : p.status}>{t(`m14.pstatus.${p.status}`)}</StatusPill> },
            { key: 'source', header: t('m14.access.source'), value: (p) => (p.persona_id?.startsWith('k-') ? 'kafaa' : p.persona_id ? 'nexus' : 'kafaa'), render: (p) => <span className="text-[12px] text-ink-3">{p.persona_id && !p.persona_id.startsWith('k-') ? t('m14.access.fromNexus') : t('m14.access.kafaaOnly')}</span> },
          ];
          return (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-5" data-testid="m14-access-metrics">
                <Metric label={t('m14.access.mPeople')} value={f.num(d.people.length)} />
                <Metric label={t('m14.access.mElevated')} value={f.num(active.filter((a) => ELEVATED_ROLES.includes(a.role as PlatformRole)).length)} />
                <Metric label={t('m14.access.mPending')} value={f.num(pending.length)} tone={pending.length ? 'info' : undefined} />
                <Metric label={t('m14.access.mReviews')} value={f.num(reviews.filter((x) => x.st !== 'ok').length)} tone={reviews.some((x) => x.st === 'overdue') ? 'bad' : undefined} sub={t('m14.access.mReviewsSub', { n: ACCESS_REVIEW_DAYS })} />
                <Metric label={t('m14.access.mLeavers')} value={f.num(leavers.length)} tone={leavers.length ? 'bad' : undefined} />
              </div>
              <Tabs
                tabs={[
                  {
                    id: 'users',
                    label: t('m14.access.tabUsers'),
                    content: (
                      <div className="space-y-3">
                        <FilterBar
                          value={flt}
                          onChange={setFlt}
                          search="q"
                          fields={[
                            { key: 'kind', label: t('m14.profile.kind'), options: ['staff', 'contractor', 'applicant', 'partner', 'observer', 'external'].map((x) => ({ value: x, label: t(`m14.kind.${x}`) })) },
                            { key: 'status', label: t('m14.profile.status'), options: ['active', 'leaver', 'candidate'].map((x) => ({ value: x, label: t(`m14.pstatus.${x}`) })) },
                            { key: 'role', label: t('m14.access.role'), options: PLATFORM_ROLES.filter((r) => r !== 'public').map((r) => ({ value: r, label: role(r) })) },
                            ...(isPartnerAdmin ? [] : [{ key: 'org', label: t('m14.profile.org'), options: d.orgs.filter((o) => d.people.some((p) => p.org_id === o.id)).map((o) => ({ value: o.id, label: o.short || pick(o, 'name') })) }]),
                          ]}
                        />
                        {people.length === 0 ? <EmptyState title={t('m14.access.noUsers')} /> : <div data-testid="m14-users"><DataTable rows={people} rowKey={(p) => p.id} columns={userCols} csvName="kafaa-users" pageSize={25} /></div>}
                      </div>
                    ),
                  },
                  {
                    id: 'pending',
                    label: `${t('m14.access.tabPending')} (${f.num(pending.length)})`,
                    content:
                      pending.length === 0 ? (
                        <EmptyState title={t('m14.access.noPending')} />
                      ) : (
                        <ul className="space-y-2" data-testid="m14-pending">
                          {pending.map((a) => {
                            const own = a.granted_by === me || a.person_id === me;
                            return (
                              <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
                                <div>
                                  <div className="font-semibold">{t('m14.access.pendingLine', { who: personName(a.person_id), role: role(a.role) })}</div>
                                  <div className="text-[12px] text-ink-3">{t('m14.access.grantedBy', { who: personName(a.granted_by), date: f.dateTime(a.granted_at) })} · {t(`m14.scope.${a.scope_type}`)} {a.scope_value ?? ''}</div>
                                  {own && isAdmin && <div className="text-[12px] text-sim">{t('m14.access.makerChecker')}</div>}
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-2">
                                    <button className="btn-primary btn-sm" disabled={own} onClick={() => run(() => repo.rpc.approveRole(a.id))} data-testid="m14-approve">{t('m14.access.approve')}</button>
                                    <button className="btn-ghost btn-sm" onClick={() => setRevoke(a)}>{t('m14.access.reject')}</button>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ),
                  },
                  {
                    id: 'reviews',
                    label: t('m14.access.tabReviews'),
                    content: (
                      <div className="space-y-3">
                        <Callout tone="info">{t('m14.access.reviewIntro', { n: ACCESS_REVIEW_DAYS })}</Callout>
                        {reviews.length === 0 ? (
                          <EmptyState title={t('m14.access.noReviews')} />
                        ) : (
                          <DataTable
                            rows={reviews.sort((x, y) => ['overdue', 'due', 'ok'].indexOf(x.st) - ['overdue', 'due', 'ok'].indexOf(y.st))}
                            rowKey={(x) => x.a.id}
                            csvName="kafaa-access-reviews"
                            columns={[
                              { key: 'who', header: t('m14.access.name'), value: (x) => personName(x.a.person_id) },
                              { key: 'role', header: t('m14.access.role'), value: (x) => role(x.a.role) },
                              { key: 'scope', header: t('m14.access.scope'), value: (x) => `${x.a.scope_type} ${x.a.scope_value ?? ''}`, render: (x) => `${t(`m14.scope.${x.a.scope_type}`)} ${x.a.scope_value ?? ''}` },
                              { key: 'last', header: t('m14.access.lastReview'), value: (x) => x.a.reviewed_at ?? x.a.granted_at, sortable: true, render: (x) => (x.a.reviewed_at ? f.date(x.a.reviewed_at) : <span className="text-ink-3">{t('m14.access.neverReviewed', { date: f.date(x.a.granted_at) })}</span>) },
                              { key: 'state', header: t('m14.access.state'), value: (x) => x.st, render: (x) => <StatusPill status={x.st === 'ok' ? 'ok' : x.st}>{t(`m14.access.review.${x.st}`)}</StatusPill> },
                              ...(isAdmin
                                ? [{ key: 'act', header: '', csv: false, render: (x: { a: RoleAssignmentsRow }) => (
                                    <span className="flex gap-1">
                                      <button className="btn-outline btn-sm" onClick={() => setReview({ a: x.a, decision: 'keep' })} data-testid="m14-review-keep">{t('m14.access.keep')}</button>
                                      <button className="btn-ghost btn-sm" onClick={() => setReview({ a: x.a, decision: 'revoke' })}>{t('m14.access.revoke')}</button>
                                    </span>
                                  ) } as Column<{ a: RoleAssignmentsRow; st: string }>]
                                : []),
                            ]}
                          />
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'leavers',
                    label: t('m14.access.tabLeavers'),
                    content: (
                      <div className="space-y-3">
                        <Callout tone="info">{t('m14.access.leaverIntro')}</Callout>
                        {leavers.length === 0 ? (
                          <EmptyState title={t('m14.access.noLeavers')} />
                        ) : (
                          <ul className="space-y-2" data-testid="m14-leavers">
                            {leavers.map((p) => (
                              <li key={p.id} className="card p-3">
                                <div className="font-semibold">{personName(p.id)}</div>
                                <ul className="mt-2 flex flex-wrap gap-2">
                                  {(byPerson.get(p.id) ?? []).filter((a) => a.status !== 'revoked').map((a) => (
                                    <li key={a.id} className="flex items-center gap-1 rounded-btn border border-line px-2 py-1 text-[12.5px]">
                                      <span className="line-through decoration-bad">{role(a.role)}</span>
                                      <StatusPill tone="neutral">{t('m14.access.ignored')}</StatusPill>
                                      {isAdmin && <button className="btn-ghost btn-sm" onClick={() => setRevoke(a)}>{t('m14.access.revoke')}</button>}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ),
                  },
                  { id: 'matrix', label: t('m14.access.tabMatrix'), content: <MatrixView /> },
                ]}
              />

              <Drawer open={!!open} onClose={() => setOpenId(null)} title={open ? personName(open.id) : ''}>
                {open && (
                  <PersonAccess
                    person={open}
                    assignments={byPerson.get(open.id) ?? []}
                    orgName={orgName}
                    personName={personName}
                    canGrant={isAdmin || (isPartnerAdmin && open.org_id === s.identity.orgId)}
                    partnerOnly={isPartnerAdmin}
                    canRevoke={(a) => isAdmin || (isPartnerAdmin && a.role === 'partner_user' && a.org_id === s.identity.orgId)}
                    onRevoke={setRevoke}
                  />
                )}
              </Drawer>
            </div>
          );
        }}
      </Async>
      {revoke && <RevokeModal a={revoke} who={personName(revoke.person_id)} roleName={role(revoke.role)} onClose={() => setRevoke(null)} />}
      {review && <ReviewModal a={review.a} decision={review.decision} who={personName(review.a.person_id)} roleName={role(review.a.role)} onClose={() => setReview(null)} />}
    </Page>
  );
}

function PersonAccess({ person, assignments, orgName, personName, canGrant, partnerOnly, canRevoke, onRevoke }: { person: PeopleRow; assignments: RoleAssignmentsRow[]; orgName: (id: string | null | undefined) => string; personName: (id: string | null | undefined) => string; canGrant: boolean; partnerOnly: boolean; canRevoke: (a: RoleAssignmentsRow) => boolean; onRevoke: (a: RoleAssignmentsRow) => void }) {
  const t = useT();
  const f = useFormat();
  const { lang } = useI18n();
  const repo = useRepo();
  const run = useAction();
  const roles = partnerOnly ? (['partner_user'] as PlatformRole[]) : (PLATFORM_ROLES.filter((r) => r !== 'public') as PlatformRole[]);
  const form = useForm({ role: roles[0], scope_type: partnerOnly ? 'org' : 'self', scope_value: partnerOnly ? person.org_id ?? '' : '' }, { role: [required()], scope_type: [required()] });
  const elevated = ELEVATED_ROLES.includes(form.values.role as PlatformRole);
  return (
    <div className="space-y-4" data-testid="m14-person">
      <KeyValue
        items={[
          [t('m14.profile.kind'), t(`m14.kind.${person.kind}`)],
          [t('m14.profile.org'), orgName(person.org_id)],
          [t('m14.profile.status'), <StatusPill key="s" status={person.status === 'leaver' ? 'revoked' : person.status}>{t(`m14.pstatus.${person.status}`)}</StatusPill>],
          [t('m14.access.persona'), <code key="p" className="ltr text-[12px]">{person.persona_id ?? '—'}</code>],
        ]}
      />
      {person.status === 'leaver' && <Callout tone="bad">{t('m14.access.leaverPerson')}</Callout>}
      <div>
        <div className="caps mb-2">{t('m14.access.assignments')}</div>
        {assignments.length === 0 ? (
          <p className="text-[13px] text-ink-3">{t('m14.profile.noRoles')}</p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id} className="rounded-btn border border-line p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`font-semibold ${a.status === 'revoked' ? 'text-ink-3 line-through' : ''}`}>{roleLabel(a.role as PlatformRole, lang)}</span>
                  <StatusPill status={a.status === 'pending_second' ? 'pending' : a.status}>{t(`m14.access.st.${a.status}`)}</StatusPill>
                </div>
                <div className="text-[12px] text-ink-3">
                  {t(`m14.scope.${a.scope_type}`)} {a.scope_value ?? ''} · {t('m14.access.grantedBy', { who: personName(a.granted_by), date: f.date(a.granted_at) })}
                  {a.second_approver ? ` · ${t('m14.access.secondBy', { who: personName(a.second_approver) })}` : ''}
                  {a.reviewed_at ? ` · ${t('m14.access.reviewedOn', { date: f.date(a.reviewed_at) })}` : ''}
                </div>
                {a.status !== 'revoked' && canRevoke(a) && (
                  <button className="btn-ghost btn-sm mt-1" onClick={() => onRevoke(a)}>
                    {t('m14.access.revoke')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {canGrant && person.status !== 'leaver' && (
        <div className="rounded-card border border-line p-3">
          <div className="caps mb-2">{t('m14.access.grant')}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField label={t('m14.access.role')} options={roles.map((r) => ({ value: r, label: roleLabel(r, lang) }))} {...form.field('role')} />
            <SelectField label={t('m14.access.scope')} options={(partnerOnly ? ['org'] : SCOPES).map((x) => ({ value: x, label: t(`m14.scope.${x}`) }))} {...form.field('scope_type')} />
            <TextField label={t('m14.access.scopeValue')} {...form.field('scope_value')} hint={t('m14.access.scopeHint')} />
          </div>
          {elevated && <p className="mt-2 text-[12px] text-sim">{t('m14.access.elevatedNote')}</p>}
          <button
            className="btn-primary btn-sm mt-3"
            disabled={form.submitting}
            onClick={form.handleSubmit(async (v) => {
              const r = await run(() => repo.rpc.grantRole(person.id, v.role as PlatformRole, v.scope_type, v.scope_value || null));
              if (r.ok) form.reset();
            })}
            data-testid="m14-grant"
          >
            <Icon name="plus" />
            {t('m14.access.grantBtn')}
          </button>
        </div>
      )}
    </div>
  );
}

function RevokeModal({ a, who, roleName, onClose }: { a: RoleAssignmentsRow; who: string; roleName: string; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ reason: '' }, { reason: [required(), minLen(5)] });
  return (
    <Modal
      open
      onClose={onClose}
      title={t('m14.access.revokeTitle', { role: roleName, who })}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-danger"
            disabled={form.submitting}
            onClick={form.handleSubmit(async (v) => {
              const r = await run(() => repo.rpc.revokeRole(a.id, v.reason));
              if (r.ok) onClose();
            })}
            data-testid="m14-revoke-confirm"
          >
            {t('m14.access.revoke')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] text-ink-2">{t('m14.access.revokeBody')}</p>
        <TextArea label={t('m14.access.reason')} required rows={2} {...form.field('reason')} />
      </div>
    </Modal>
  );
}

function ReviewModal({ a, decision, who, roleName, onClose }: { a: RoleAssignmentsRow; decision: 'keep' | 'revoke'; who: string; roleName: string; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ note: '' }, decision === 'revoke' ? { note: [required(), minLen(5)] } : {});
  return (
    <Modal
      open
      onClose={onClose}
      title={t(decision === 'keep' ? 'm14.access.keepTitle' : 'm14.access.revokeTitle', { role: roleName, who })}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className={decision === 'keep' ? 'btn-primary' : 'btn-danger'}
            disabled={form.submitting}
            onClick={form.handleSubmit(async (v) => {
              const r = await run(() => repo.rpc.reviewRoleAccess(a.id, decision, v.note));
              if (r.ok) onClose();
            })}
            data-testid="m14-review-confirm"
          >
            {t(decision === 'keep' ? 'm14.access.keep' : 'm14.access.revoke')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] text-ink-2">{t(decision === 'keep' ? 'm14.access.keepBody' : 'm14.access.revokeBody')}</p>
        <TextArea label={t('m14.access.reviewNote')} required={decision === 'revoke'} rows={2} {...form.field('note')} />
        <p className="text-[12px] text-ink-3">{t('m14.access.reviewSelf')}</p>
      </div>
    </Modal>
  );
}

function MatrixView() {
  const t = useT();
  const { lang } = useI18n();
  const [res, setRes] = useState<string>('');
  const roles = PLATFORM_ROLES as unknown as PlatformRole[];
  const resources = RESOURCES.filter((r) => !res || r === res);
  return (
    <div className="space-y-3" data-testid="m14-matrix">
      <Callout tone="info">{t('m14.access.matrixIntro')}</Callout>
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className="caps">{t('m14.access.resource')}</span>
          <select className="input mt-1" value={res} onChange={(e) => setRes(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {RESOURCES.map((r) => <option key={r} value={r}>{RESOURCE_LABELS[r]}</option>)}
          </select>
        </label>
        <p className="text-[12px] text-ink-3">{LEVELS.map((l) => `${l} = ${t(`m14.levels.${l}`)}`).join(' · ')}</p>
      </div>
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="min-w-full text-[12px]">
          <thead className="bg-sunken">
            <tr>
              <th className="sticky start-0 bg-sunken p-2 text-start">{t('m14.access.resource')}</th>
              {roles.map((r) => <th key={r} className="p-2 text-start align-bottom font-semibold" title={roleLabel(r, lang)}><span className="block max-w-[90px] leading-tight">{roleLabel(r, lang)}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r} className="border-t border-line">
                <th className="sticky start-0 bg-panel p-2 text-start font-normal"><code className="ltr">{r}</code><div className="text-ink-3">{RESOURCE_LABELS[r]}</div></th>
                {roles.map((role) => {
                  const ls = levelsOf(role, r);
                  return <td key={role} className={`p-2 text-center ${ls.length ? 'font-semibold' : 'text-ink-3'}`}>{ls.length ? ls.join(' ') : '·'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-ink-3">{t('m14.access.matrixFoot', { n: Object.keys(MATRIX).length })}</p>
    </div>
  );
}
