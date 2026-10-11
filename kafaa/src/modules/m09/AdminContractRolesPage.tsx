// F33 /admin/suppliers/contract-roles: ENEC records which ENEC role profiles each supplier is contracted to staff, with a headcount band.
// Partner admins then see their team matrix against these profiles. Admin (partner_org A) edits through rpc.setContractRoleTarget;
// auditors read only. Security, cyber and safeguards roles are never contracted through the passport.
import { useState } from 'react';
import { Page, Card, Async, EmptyState, DataTable, ConfirmDialog, SelectField, TextField, CheckboxField, StatusPill, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat } from '../../i18n';
import { useSession } from '../../auth/session';
import { can } from '../../data/access';
import { HEADCOUNT_BANDS, RESTRICTED_FAMILIES } from './contractor';
import type { Row } from './passportUi';

export default function AdminContractRolesPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['contract_role_targets', 'organisations'], async () => {
    const [targets, orgs, roles] = await Promise.all([
      repo.list('contract_role_targets', { order: [['org_id', 'asc']] }) as Promise<Row[]>,
      repo.list('organisations', { filter: { kind: 'supplier' }, order: [['name_en', 'asc']] }) as Promise<Row[]>,
      repo.list('job_roles', { filter: { status: 'published' }, order: [['sort', 'asc']] }) as Promise<Row[]>,
    ]);
    return { targets, orgs, roles };
  });
  return (
    <Page title={t('m09.routes.admin-contract-roles.title')} intro={t('m09.cp.adm.intro')}>
      <Async state={q} isEmpty={() => false}>{(d) => <Body {...d} />}</Async>
    </Page>
  );
}

function Body({ targets, orgs, roles }: { targets: Row[]; orgs: Row[]; roles: Row[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canEdit = can(s.identity, 'partner_org', ['A']);
  const blank = { org_id: '', role_id: '', headcount_band: '1-4', contract_ref: '', scope_en: '', scope_ar: '', active: true };
  const [form, setForm] = useState<typeof blank | null>(null);
  const [confirm, setConfirm] = useState(false);
  const org = (id: string) => orgs.find((o) => o.id === id);
  const role = (id: string) => roles.find((r) => r.id === id);
  const allowed = roles.filter((r) => !r.security_sensitive && !RESTRICTED_FAMILIES.includes(r.family_id));
  const cols: Column<Row>[] = [
    { key: 'org', header: t('m09.cp.adm.org'), value: (r) => pick(org(r.org_id), 'name') || r.org_id, sortable: true },
    { key: 'role', header: t('m09.cp.adm.role'), value: (r) => pick(role(r.role_id), 'title'), sortable: true },
    { key: 'band', header: t('m09.cp.adm.band'), value: (r) => r.headcount_band, render: (r) => <span className="num">{r.headcount_band}</span> },
    { key: 'ref', header: t('m09.cp.adm.ref'), value: (r) => r.contract_ref },
    { key: 'scope', header: t('m09.cp.adm.scope'), value: (r) => pick(r, 'scope') },
    { key: 'status', header: t('m09.cp.adm.status'), value: (r) => (r.active ? 'active' : 'archived'), render: (r) => <StatusPill status={r.active ? 'active' : 'archived'}>{t(r.active ? 'm09.cp.adm.active' : 'm09.cp.adm.inactive')}</StatusPill> },
    { key: 'upd', header: t('m09.cp.adm.updated'), value: (r) => r.updated_at, render: (r) => f.date(r.updated_at), sortable: true },
    ...(canEdit ? [{ key: 'edit', header: <span className="sr-only">{t('m09.cp.adm.edit')}</span>, render: (r: Row) => <button type="button" className="btn-ghost btn-sm" onClick={() => setForm({ org_id: r.org_id, role_id: r.role_id, headcount_band: r.headcount_band, contract_ref: r.contract_ref, scope_en: r.scope_en, scope_ar: r.scope_ar, active: r.active })}>{t('m09.cp.adm.edit')}</button> }] : []),
  ];
  return (
    <>
      <Card title={t('m09.cp.adm.listTitle')} actions={canEdit ? <button type="button" className="btn-primary btn-sm" onClick={() => setForm(blank)} data-testid="m09-crt-new">{t('m09.cp.adm.new')}</button> : undefined} padded={false}>
        {targets.length === 0 ? <div className="p-4"><EmptyState title={t('m09.cp.adm.none')} /></div> : <DataTable rows={targets} columns={cols} rowKey={(r) => r.id} csvName="kafaa-contracted-roles" caption={t('m09.cp.adm.listTitle')} />}
      </Card>
      {!canEdit && <p className="text-[12.5px] text-ink-3">{t('m09.cp.adm.readOnly')}</p>}
      {form && (
        <Card title={t('m09.cp.adm.formTitle')}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="m09-crt-form">
            <SelectField label={t('m09.cp.adm.org')} name="org" value={form.org_id} onChange={(v) => setForm({ ...form, org_id: v })} options={orgs.map((o) => ({ value: o.id, label: pick(o, 'name') }))} required />
            <SelectField label={t('m09.cp.adm.role')} name="role" value={form.role_id} onChange={(v) => setForm({ ...form, role_id: v })} options={allowed.map((r) => ({ value: r.id, label: pick(r, 'title') }))} required hint={t('m09.cp.adm.roleHint')} />
            <SelectField label={t('m09.cp.adm.band')} name="band" value={form.headcount_band} onChange={(v) => setForm({ ...form, headcount_band: v })} options={HEADCOUNT_BANDS.map((b) => ({ value: b, label: b }))} required />
            <TextField label={t('m09.cp.adm.ref')} name="ref" value={form.contract_ref} onChange={(v) => setForm({ ...form, contract_ref: v })} />
            <TextField label={t('m09.cp.adm.scopeEn')} name="scope_en" value={form.scope_en} onChange={(v) => setForm({ ...form, scope_en: v })} />
            <TextField label={t('m09.cp.adm.scopeAr')} name="scope_ar" value={form.scope_ar} onChange={(v) => setForm({ ...form, scope_ar: v })} />
            <CheckboxField label={t('m09.cp.adm.activeLabel')} checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary" disabled={!form.org_id || !form.role_id} onClick={() => setConfirm(true)} data-testid="m09-crt-save">{t('m09.cp.adm.save')}</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>{t('common.cancel')}</button>
          </div>
        </Card>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m09.cp.adm.confirmTitle')}
        consequence={form ? t('m09.cp.adm.confirmBody', { org: pick(org(form.org_id), 'name'), role: pick(role(form.role_id), 'title'), band: form.headcount_band }) : ''}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.setContractRoleTarget(form!));
          setConfirm(false);
          if (r.ok) setForm(null);
        }} />
    </>
  );
}
