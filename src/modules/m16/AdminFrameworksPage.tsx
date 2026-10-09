// M16 · /admin/frameworks: job families and roles, competencies, and versioned qualification standards with effective
// dates. Framework owners (training manager, instructor W; platform admin A) edit role text and revise standards;
// a revision creates a new version, supersedes the old one and flags affected qualification records for review.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, Callout, DataTable, Drawer, EmptyState, FilterBar, KeyValue, Modal, Page, SelectField, StatusPill, Tabs, TextArea, Timeline, minLen, required, useFilters, useForm, type Column } from '../../ui';
import type { JobRolesRow, QualStandardsRow } from '../../data/types';
import { Metric } from './parts';
import MicrocredAdminTab from '../m17/MicrocredAdminTab'; // W5E1 (F32): micro-credentials tab

export default function AdminFrameworksPage() {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const canEdit = s.can('frameworks', ['W', 'A']);
  const data = useQuery(['job_families', 'job_roles', 'competencies', 'role_competencies', 'qual_standards', 'qual_records'], async () => {
    const [families, roles, comps, rc, standards] = await Promise.all([
      repo.list('job_families', { order: [['sort', 'asc']] }),
      repo.list('job_roles', { order: [['sort', 'asc']] }),
      repo.list('competencies', { order: [['code', 'asc']] }),
      repo.list('role_competencies'),
      repo.list('qual_standards', { order: [['code', 'asc'], ['version', 'desc']] }),
    ]);
    return { families, roles, comps, rc, standards };
  });
  return (
    <Page title={t('m16.routes.admin-frameworks.title')} intro={t('m16.fw.intro')} actions={<StatusPill tone="neutral">{canEdit ? t('m16.fw.asOwner') : t('m16.fw.readOnly')}</StatusPill>} wide>
      <Async state={data}>
        {(d) => (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label={t('m16.fw.families')} value={f.num(d.families.length)} />
              <Metric label={t('m16.fw.roles')} value={f.num(d.roles.length)} sub={t('m16.fw.regulated', { n: f.num(d.roles.filter((r) => r.regulated).length) })} />
              <Metric label={t('m16.fw.competencies')} value={f.num(d.comps.length)} />
              <Metric label={t('m16.fw.standards')} value={f.num(d.standards.filter((x) => x.status === 'current').length)} sub={t('m16.fw.versions', { n: f.num(d.standards.length) })} />
            </div>
            <Tabs
              tabs={[
                { id: 'roles', label: t('m16.fw.tabRoles'), content: <RolesTab d={d} canEdit={canEdit} /> },
                { id: 'competencies', label: t('m16.fw.tabCompetencies'), content: <CompetenciesTab d={d} /> },
                { id: 'standards', label: t('m16.fw.tabStandards'), content: <StandardsTab standards={d.standards} roles={d.roles} canEdit={canEdit} /> },
                { id: 'microcredentials', label: t('m17.mc.admin.tab'), content: <MicrocredAdminTab /> }, // W5E1 (F32)
              ]}
              initial={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'microcredentials' ? 'microcredentials' : undefined}
            />
          </div>
        )}
      </Async>
    </Page>
  );
}

type FwData = { families: { id: string; name_en: string; name_ar: string; grp: string }[]; roles: JobRolesRow[]; comps: { id: string; code: string; domain: string; domain_en: string; domain_ar: string; name_en: string; name_ar: string; levels: unknown }[]; rc: { role_id: string; competency_id: string; required_level: number; importance: string }[]; standards: QualStandardsRow[] };

function RolesTab({ d, canEdit }: { d: FwData; canEdit: boolean }) {
  const t = useT();
  const pick = usePick();
  const [flt, setFlt] = useFilters({ q: '', family: '', status: '', regulated: '' });
  const [edit, setEdit] = useState<JobRolesRow | null>(null);
  const fam = new Map(d.families.map((x) => [x.id, x]));
  const rows = d.roles.filter((r) => (!flt.family || r.family_id === flt.family) && (!flt.status || r.status === flt.status) && (!flt.regulated || String(r.regulated) === flt.regulated) && (!flt.q || `${r.title_en} ${r.title_ar} ${r.id}`.toLowerCase().includes(flt.q.toLowerCase())));
  const cols: Column<JobRolesRow>[] = [
    { key: 'title', header: t('m16.fw.role'), value: (r) => pick(r, 'title'), sortable: true, render: (r) => <L to={`/careers/roles/${r.id}`} className="font-semibold text-eyebrow hover:underline">{pick(r, 'title')}</L> },
    { key: 'family', header: t('m16.fw.family'), value: (r) => (fam.get(r.family_id) ? pick(fam.get(r.family_id)!, 'name') : r.family_id) },
    { key: 'level', header: t('m14.profile.level'), value: (r) => r.level, render: (r) => t(`m14.level.${r.level}`) },
    { key: 'flags', header: t('m16.fw.flags'), value: (r) => [r.regulated && 'regulated', r.critical && 'critical', r.security_sensitive && 'security'].filter(Boolean).join(' '), render: (r) => (
      <span className="flex flex-wrap gap-1">
        {r.regulated && <StatusPill tone="accent">{t('m16.fw.regulatedTag')}</StatusPill>}
        {r.critical && <StatusPill tone="sim">{t('m16.fw.critical')}</StatusPill>}
        {r.security_sensitive && <StatusPill tone="reserved">{t('m16.fw.securityTag')}</StatusPill>}
      </span>
    ) },
    { key: 'comps', header: t('m16.fw.competencies'), value: (r) => d.rc.filter((x) => x.role_id === r.id).length, align: 'end' },
    { key: 'version', header: t('m16.fw.version'), value: (r) => r.version, align: 'end' },
    { key: 'status', header: t('m16.fw.status'), value: (r) => r.status, render: (r) => <StatusPill status={r.status} /> },
    ...(canEdit ? [{ key: 'act', header: '', csv: false, render: (r: JobRolesRow) => <button className="btn-ghost btn-sm" onClick={() => setEdit(r)}>{t('common.edit')}</button> } as Column<JobRolesRow>] : []),
  ];
  return (
    <div className="space-y-3">
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="q"
        fields={[
          { key: 'family', label: t('m16.fw.family'), options: d.families.map((x) => ({ value: x.id, label: pick(x, 'name') })) },
          { key: 'status', label: t('m16.fw.status'), options: ['published', 'draft'].map((x) => ({ value: x, label: t(`common.status.${x}`) })) },
          { key: 'regulated', label: t('m16.fw.regulatedTag'), options: [{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }] },
        ]}
      />
      {rows.length === 0 ? <EmptyState title={t('m16.fw.noRoles')} /> : <div data-testid="m16-fw-roles"><DataTable rows={rows} rowKey={(r) => r.id} columns={cols} csvName="kafaa-roles" /></div>}
      {edit && <EditRole role={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditRole({ role, onClose }: { role: JobRolesRow; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ summary_en: role.summary_en, summary_ar: role.summary_ar, status: role.status }, { summary_en: [required(), minLen(20)], summary_ar: [required()] });
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t('m16.fw.editRole', { role: role.title_en })}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            disabled={form.submitting}
            onClick={form.handleSubmit(async (v) => {
              const r = await run(() => repo.update('job_roles', role.id, { summary_en: v.summary_en, summary_ar: v.summary_ar, status: v.status as never, version: role.version + 1 }), { success: t('m16.fw.saved') });
              if (r.ok) onClose();
            })}
            data-testid="m16-role-save"
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {role.regulated && <Callout tone="sim">{t('m16.fw.regulatedEdit', { ref: role.regulation_ref ?? 'FANR' })}</Callout>}
        <TextArea label={t('m16.fw.summaryEn')} rows={3} required {...form.field('summary_en')} />
        <TextArea label={t('m16.fw.summaryAr')} rows={3} required {...form.field('summary_ar')} />
        <SelectField label={t('m16.fw.status')} options={['published', 'draft'].map((x) => ({ value: x, label: t(`common.status.${x}`) }))} {...form.field('status')} />
        <p className="text-[12px] text-ink-3">{t('m16.fw.reasonHint')}</p>
      </div>
    </Modal>
  );
}

function CompetenciesTab({ d }: { d: FwData }) {
  const t = useT();
  const pick = usePick();
  const [flt, setFlt] = useFilters({ q: '', domain: '' });
  const domains = [...new Map(d.comps.map((c) => [c.domain, c])).values()];
  const rows = d.comps.filter((c) => (!flt.domain || c.domain === flt.domain) && (!flt.q || `${c.code} ${c.name_en} ${c.name_ar}`.toLowerCase().includes(flt.q.toLowerCase())));
  return (
    <div className="space-y-3">
      <FilterBar value={flt} onChange={setFlt} search="q" fields={[{ key: 'domain', label: t('m16.fw.domain'), options: domains.map((c) => ({ value: c.domain, label: pick(c, 'domain') })) }]} />
      <DataTable
        rows={rows}
        rowKey={(c) => c.id}
        csvName="kafaa-competencies"
        columns={[
          { key: 'code', header: t('m16.fw.code'), value: (c) => c.code, sortable: true, render: (c) => <code className="ltr">{c.code}</code> },
          { key: 'name', header: t('m16.fw.competency'), value: (c) => pick(c, 'name'), sortable: true },
          { key: 'domain', header: t('m16.fw.domain'), value: (c) => pick(c, 'domain') },
          { key: 'levels', header: t('m16.fw.levels'), value: (c) => (Array.isArray(c.levels) ? c.levels.length : 0), align: 'end' },
          { key: 'roles', header: t('m16.fw.usedBy'), value: (c) => d.rc.filter((x) => x.competency_id === c.id).length, align: 'end' },
        ]}
      />
    </div>
  );
}

function StandardsTab({ standards, roles, canEdit }: { standards: QualStandardsRow[]; roles: JobRolesRow[]; canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [flt, setFlt] = useFilters({ q: '', status: 'current', discipline: '' });
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [revise, setRevise] = useState<QualStandardsRow | null>(null);
  const disciplines = useMemo(() => [...new Set(standards.map((x) => x.discipline))].sort(), [standards]);
  const roleName = new Map(roles.map((r) => [r.id, pick(r, 'title')]));
  const rows = standards.filter((x) => (!flt.status || x.status === flt.status) && (!flt.discipline || x.discipline === flt.discipline) && (!flt.q || `${x.code} ${x.title_en} ${x.title_ar}`.toLowerCase().includes(flt.q.toLowerCase())));
  const history = openCode ? standards.filter((x) => x.code === openCode).sort((a, b) => b.version - a.version) : [];
  return (
    <div className="space-y-3">
      <Callout tone="info">{t('m16.fw.standardsIntro')}</Callout>
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="q"
        fields={[
          { key: 'status', label: t('m16.fw.status'), options: ['current', 'superseded', 'draft'].map((x) => ({ value: x, label: t(`m16.fw.st.${x}`) })) },
          { key: 'discipline', label: t('m16.fw.discipline'), options: disciplines.map((x) => ({ value: x, label: x })) },
        ]}
      />
      <div data-testid="m16-fw-standards">
        <DataTable
          rows={rows}
          rowKey={(x) => x.id}
          csvName="kafaa-standards"
          onRowClick={(x) => setOpenCode(x.code)}
          columns={[
            { key: 'code', header: t('m16.fw.code'), value: (x) => x.code, sortable: true, render: (x) => <code className="ltr">{x.code}</code> },
            { key: 'title', header: t('m16.fw.standard'), value: (x) => pick(x, 'title'), sortable: true, render: (x) => <span className="font-semibold">{pick(x, 'title')}{x.security_restricted && <> <StatusPill tone="reserved">{t('m16.fw.restricted')}</StatusPill></>}</span> },
            { key: 'discipline', header: t('m16.fw.discipline'), value: (x) => x.discipline },
            { key: 'version', header: t('m16.fw.version'), value: (x) => x.version, align: 'end' },
            { key: 'effective', header: t('m16.fw.effective'), value: (x) => x.effective_date, sortable: true, render: (x) => f.date(x.effective_date) },
            { key: 'requal', header: t('m16.fw.requal'), value: (x) => x.requal_months ?? '', render: (x) => (x.requal_months ? t('m16.fw.months', { n: x.requal_months }) : '—') },
            { key: 'owner', header: t('m16.fw.owner'), value: (x) => x.owner_role },
            { key: 'status', header: t('m16.fw.status'), value: (x) => x.status, render: (x) => <StatusPill status={x.status === 'current' ? 'active' : x.status}>{t(`m16.fw.st.${x.status}`)}</StatusPill> },
          ]}
        />
      </div>
      <Drawer open={!!openCode} onClose={() => setOpenCode(null)} title={openCode ?? ''}>
        {history.length > 0 && (
          <div className="space-y-4" data-testid="m16-standard-history">
            <KeyValue
              items={[
                [t('m16.fw.standard'), pick(history[0], 'title')],
                [t('m16.fw.roles'), history[0].role_ids.map((r) => roleName.get(r) ?? r).join(' · ') || '—'],
                [t('m16.fw.owner'), history[0].owner_role],
              ]}
            />
            <Timeline
              items={history.map((h) => ({
                id: h.id,
                title: t('m16.fw.versionLine', { v: h.version, status: t(`m16.fw.st.${h.status}`) }),
                when: f.date(h.effective_date),
                body: h.change_reason ?? t('m16.fw.firstVersion'),
                tone: h.status === 'current' ? 'ok' : 'neutral',
              }))}
            />
            <div className="flex flex-wrap gap-2">
              <L to={`/training/quals/${history[0].id}`} className="btn-outline btn-sm">{t('m16.fw.openEditor')}</L>
              {canEdit && history[0].status === 'current' && <button className="btn-primary btn-sm" onClick={() => setRevise(history[0])} data-testid="m16-revise">{t('m16.fw.revise')}</button>}
            </div>
          </div>
        )}
      </Drawer>
      {revise && <Revise std={revise} onClose={() => setRevise(null)} />}
    </div>
  );
}

function Revise({ std, onClose }: { std: QualStandardsRow; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [result, setResult] = useState<{ new_id: string; flagged: number } | null>(null);
  const form = useForm({ reason: '' }, { reason: [required(), minLen(10)] });
  return (
    <Modal
      open
      onClose={onClose}
      title={t('m16.fw.reviseTitle', { code: std.code, v: std.version + 1 })}
      footer={
        result ? (
          <button className="btn-primary" onClick={onClose}>{t('common.close')}</button>
        ) : (
          <>
            <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
            <button
              className="btn-primary"
              disabled={form.submitting}
              onClick={form.handleSubmit(async (v) => {
                const r = await run(() => repo.rpc.reviseStandard(std.id, v.reason));
                if (r.ok && r.data) setResult(r.data);
              })}
              data-testid="m16-revise-confirm"
            >
              {t('m16.fw.revise')}
            </button>
          </>
        )
      }
    >
      {result ? (
        <Callout tone="ok" title={t('m16.fw.revised', { id: result.new_id })}>{t('m16.fw.flagged', { n: result.flagged })}</Callout>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-2">{t('m16.fw.reviseBody')}</p>
          <TextArea label={t('m16.fw.reason')} required rows={3} {...form.field('reason')} />
        </div>
      )}
    </Modal>
  );
}
