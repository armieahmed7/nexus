// M06 /workforce/talent: HR, editors and admins manage vacancies (link-out), outreach events, internship placements and
// programme intake status. Direct writes are allowed on these talent_content tables; every write is audited by the backend.
import { useMemo, useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import type { Table } from '../../data/types';
import { Page, Card, Async, EmptyState, Tabs, DataTable, Modal, ConfirmDialog, StatusPill, SimChip, Callout, Icon } from '../../ui';
import { ENEC_ENTITIES, entityName, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';

type FieldSpec = { key: string; label: string; type: 'text' | 'date' | 'number' | 'select' | 'checkbox' | 'url'; required?: boolean; options?: { value: string; label: string }[]; dir?: 'rtl' | 'ltr' };
type Row = Record<string, unknown> & { id: string };

/** Generic create/edit modal for one talent_content table. Validates required fields, dates and https links. */
function EntityModal({ open, onClose, title, fields, initial, onSave }: { open: boolean; onClose: () => void; title: string; fields: FieldSpec[]; initial: Record<string, unknown>; onSave: (v: Record<string, unknown>) => Promise<boolean> }) {
  const t = useT();
  const [v, setV] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(initial);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setV(initial);
    setErrors({});
  }
  const validate = () => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const x = v[f.key];
      if (f.required && (x === undefined || x === null || String(x).trim() === '')) e[f.key] = t('common.validation.required');
      if (f.type === 'url' && x && !/^https:\/\/[^\s]+$/.test(String(x))) e[f.key] = t('m06.talent.httpsOnly');
      if (f.type === 'number' && x !== '' && x != null && (Number.isNaN(Number(x)) || Number(x) < 0)) e[f.key] = t('common.validation.format');
    }
    if (v.starts_on && v.ends_on && String(v.ends_on) < String(v.starts_on)) e.ends_on = t('m06.talent.endBeforeStart');
    if (v.posted_on && v.closes_on && String(v.closes_on) < String(v.posted_on)) e.closes_on = t('m06.talent.endBeforeStart');
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            disabled={busy}
            data-testid="m06-talent-save"
            onClick={async () => {
              if (!validate()) return;
              setBusy(true);
              try {
                if (await onSave(v)) onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t('common.working') : t('common.save')}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className={`flex flex-col gap-1 ${f.type === 'checkbox' ? 'sm:col-span-2' : ''}`}>
            {f.type === 'checkbox' ? (
              <span className="flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={!!v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} />
                {f.label}
              </span>
            ) : (
              <>
                <span className="text-[13px] font-semibold">
                  {f.label}
                  {f.required && <span className="text-bad"> *</span>}
                </span>
                {f.type === 'select' ? (
                  <select className="input" value={String(v[f.key] ?? '')} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                    <option value="">{t('common.choose')}</option>
                    {f.options!.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    dir={f.dir ?? (f.type === 'url' || f.type === 'date' || f.type === 'number' ? 'ltr' : undefined)}
                    type={f.type === 'url' ? 'url' : f.type}
                    value={String(v[f.key] ?? '')}
                    onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
                    aria-invalid={errors[f.key] ? true : undefined}
                  />
                )}
              </>
            )}
            {errors[f.key] && <span role="alert" className="text-[12px] text-bad">{errors[f.key]}</span>}
          </label>
        ))}
      </div>
    </Modal>
  );
}

export default function TalentContentPage() {
  const t = useT();
  return (
    <Page title={t('m06.routes.workforce-talent.title')} intro={t('m06.talent.intro')} wide>
      <Callout tone="info" title={t('m06.talent.rulesTitle')}>{t('m06.talent.rulesBody')}</Callout>
      <Tabs
        tabs={[
          { id: 'vacancies', label: t('m06.talent.tabVacancies'), content: <VacanciesTab /> },
          { id: 'events', label: t('m06.talent.tabEvents'), content: <EventsTab /> },
          { id: 'internships', label: t('m06.talent.tabInternships'), content: <InternshipsTab /> },
          { id: 'programmes', label: t('m06.talent.tabProgrammes'), content: <ProgrammesTab /> },
        ]}
      />
    </Page>
  );
}

function useLookups() {
  const repo = useRepo();
  const pick = usePick();
  const t = useT();
  const q = useQuery(['job_roles', 'organisations', 'job_families'], async () => {
    const [roles, orgs, fams] = await Promise.all([repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('organisations'), repo.list('job_families', { order: [['sort', 'asc']] })]);
    return { roles, orgs, fams };
  });
  return useMemo(() => {
    const d = q.data;
    return {
      roles: (d?.roles ?? []).map((r) => ({ value: r.id, label: pick(r, 'title') })),
      entities: ENEC_ENTITIES.map((id) => ({ value: id, label: pick(d?.orgs.find((o) => o.id === id), 'name') || entityName(t, id) })),
      universities: (d?.orgs ?? []).filter((o) => o.kind === 'university').map((o) => ({ value: o.id, label: pick(o, 'name') })),
      families: (d?.fams ?? []).map((f) => ({ value: f.id, label: pick(f, 'name') })),
      orgName: (id: string | null | undefined) => pick(d?.orgs.find((o) => o.id === id), 'name') || entityName(t, id) || '—',
    };
  }, [q.data, pick, t]);
}

/** Save helper: insert or update through the repository, toasting the outcome. */
function useSaver(table: Table) {
  const repo = useRepo();
  const run = useAction();
  const t = useT();
  return async (id: string | null, v: Record<string, unknown>) => {
    const r = await run(() => (id ? repo.update(table, id, v as never) : repo.insert(table, v as never)), { success: t('m06.talent.saved') });
    return r.ok;
  };
}

function VacanciesTab() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const lk = useLookups();
  const save = useSaver('vacancies');
  const run = useAction();
  const q = useQuery('vacancies', () => repo.list('vacancies', { order: [['posted_on', 'desc']] }));
  const [edit, setEdit] = useState<Row | null | 'new'>(null);
  const [closing, setClosing] = useState<Row | null>(null);
  const fields: FieldSpec[] = [
    { key: 'title_en', label: t('m06.talent.titleEn'), type: 'text', required: true, dir: 'ltr' },
    { key: 'title_ar', label: t('m06.talent.titleAr'), type: 'text', required: true, dir: 'rtl' },
    { key: 'role_id', label: t('m06.talent.role'), type: 'select', options: lk.roles },
    { key: 'entity_id', label: t('m06.talent.entity'), type: 'select', required: true, options: lk.entities },
    { key: 'location', label: t('m06.talent.locationEn'), type: 'text', required: true, dir: 'ltr' },
    { key: 'location_ar', label: t('m06.talent.locationAr'), type: 'text', dir: 'rtl' }, // shown on /ar pages via pick(v, 'location')
    { key: 'official_url', label: t('m06.talent.officialUrl'), type: 'url', required: true },
    { key: 'posted_on', label: t('m06.talent.postedOn'), type: 'date', required: true },
    { key: 'closes_on', label: t('m06.talent.closesOn'), type: 'date' },
    { key: 'uae_nationals_only', label: t('m06.talent.uaeOnly'), type: 'checkbox' },
    { key: 'sample', label: t('m06.talent.sampleFlag'), type: 'checkbox' },
  ];
  const blank = { title_en: '', title_ar: '', role_id: '', entity_id: 'enec-ops', location: 'Barakah, Al Dhafra', location_ar: 'براكة، منطقة الظفرة', official_url: 'https://www.enec.ae/careers-and-scholarships/careers/', posted_on: todayIso(), closes_on: '', uae_nationals_only: false, sample: true, status: 'open' };
  return (
    <Card title={t('m06.talent.tabVacancies')} actions={<button className="btn-primary btn-sm" onClick={() => setEdit('new')} data-testid="m06-new-vacancy"><Icon name="plus" size={14} />{t('m06.talent.newVacancy')}</button>} padded={false}>
      <div className="p-3">
        <Async state={q} empty={<EmptyState title={t('m06.vacancies.none')} />}>
          {(rows) => (
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              csvName="vacancies"
              columns={[
                { key: 'title', header: t('m06.talent.title'), value: (r) => pick(r, 'title'), sortable: true, render: (r) => <span className="font-semibold">{pick(r, 'title')}</span> },
                { key: 'entity', header: t('m06.talent.entity'), value: (r) => lk.orgName(r.entity_id), sortable: true },
                { key: 'posted', header: t('m06.talent.postedOn'), value: (r) => r.posted_on, sortable: true, render: (r) => f.date(r.posted_on) },
                { key: 'closes', header: t('m06.talent.closesOn'), value: (r) => r.closes_on ?? '', sortable: true, render: (r) => f.date(r.closes_on) },
                { key: 'uae', header: t('m06.talent.uaeOnlyShort'), value: (r) => (r.uae_nationals_only ? 'yes' : 'no'), render: (r) => (r.uae_nationals_only ? <StatusPill tone="accent">{t('common.yes')}</StatusPill> : t('common.no')) },
                { key: 'status', header: t('m06.talent.status'), value: (r) => r.status, render: (r) => <span className="flex gap-1"><StatusPill status={r.status} />{r.sample && <SimChip label={t('common.sample')} />}</span> },
                {
                  key: 'actions', header: '', csv: false,
                  render: (r) => (
                    <span className="flex gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => setEdit(r as unknown as Row)}>{t('common.edit')}</button>
                      {r.status === 'open' && <button className="btn-ghost btn-sm text-bad" onClick={() => setClosing(r as unknown as Row)}>{t('m06.talent.close')}</button>}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </Async>
      </div>
      <EntityModal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit === 'new' ? t('m06.talent.newVacancy') : t('m06.talent.editVacancy')}
        fields={fields}
        initial={edit === 'new' || edit === null ? blank : edit}
        onSave={(v) => save(edit === 'new' || edit === null ? null : edit.id, { ...v, role_id: v.role_id || null, closes_on: v.closes_on || null })}
      />
      <ConfirmDialog
        open={!!closing}
        onClose={() => setClosing(null)}
        danger
        title={t('m06.talent.closeTitle')}
        consequence={t('m06.talent.closeBody')}
        onConfirm={async () => {
          if (closing) await run(() => repo.update('vacancies', closing.id, { status: 'closed' }), { success: t('m06.talent.saved') });
        }}
      />
    </Card>
  );
}

function EventsTab() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const save = useSaver('events');
  const q = useQuery('events', () => repo.list('events', { order: [['starts_on', 'desc']] }));
  const [edit, setEdit] = useState<Row | null | 'new'>(null);
  const kinds = ['career_fair', 'open_day', 'webinar', 'festival', 'info_session', 'summer_school'];
  const fields: FieldSpec[] = [
    { key: 'title_en', label: t('m06.talent.titleEn'), type: 'text', required: true, dir: 'ltr' },
    { key: 'title_ar', label: t('m06.talent.titleAr'), type: 'text', required: true, dir: 'rtl' },
    { key: 'kind', label: t('m06.talent.kind'), type: 'select', required: true, options: kinds.map((k) => ({ value: k, label: t(`m06.eventKind.${k}`) })) },
    { key: 'starts_on', label: t('m06.talent.startsOn'), type: 'date', required: true },
    { key: 'ends_on', label: t('m06.talent.endsOn'), type: 'date' },
    { key: 'location_en', label: t('m06.talent.locationEn'), type: 'text', required: true, dir: 'ltr' },
    { key: 'location_ar', label: t('m06.talent.locationAr'), type: 'text', required: true, dir: 'rtl' },
    { key: 'url', label: t('m06.talent.eventUrl'), type: 'url' },
    { key: 'sample', label: t('m06.talent.sampleFlag'), type: 'checkbox' },
  ];
  const blank = { title_en: '', title_ar: '', kind: 'info_session', starts_on: todayIso(), ends_on: '', location_en: 'Online', location_ar: 'عبر الإنترنت', url: '', sample: true, audience: 'Students and job seekers', sources: [] };
  return (
    <Card title={t('m06.talent.tabEvents')} actions={<button className="btn-primary btn-sm" onClick={() => setEdit('new')}><Icon name="plus" size={14} />{t('m06.talent.newEvent')}</button>} padded={false}>
      <div className="p-3">
        <Async state={q} empty={<EmptyState title={t('m06.events.none')} />}>
          {(rows) => (
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              csvName="events"
              columns={[
                { key: 'title', header: t('m06.talent.title'), value: (r) => pick(r, 'title'), sortable: true },
                { key: 'kind', header: t('m06.talent.kind'), value: (r) => t(`m06.eventKind.${r.kind}`), sortable: true },
                { key: 'start', header: t('m06.talent.startsOn'), value: (r) => r.starts_on, sortable: true, render: (r) => f.date(r.starts_on) },
                { key: 'loc', header: t('m06.talent.location'), value: (r) => pick(r, 'location') },
                { key: 'flag', header: '', csv: false, render: (r) => (r.sample ? <SimChip label={t('common.sample')} /> : <StatusPill tone="ok">{t('m06.talent.sourced')}</StatusPill>) },
                { key: 'actions', header: '', csv: false, render: (r) => <button className="btn-ghost btn-sm" onClick={() => setEdit(r as unknown as Row)}>{t('common.edit')}</button> },
              ]}
            />
          )}
        </Async>
      </div>
      <EntityModal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit === 'new' ? t('m06.talent.newEvent') : t('m06.talent.editEvent')}
        fields={fields}
        initial={edit === 'new' || edit === null ? blank : edit}
        onSave={(v) => save(edit === 'new' || edit === null ? null : edit.id, { ...v, ends_on: v.ends_on || null, url: v.url || null })}
      />
    </Card>
  );
}

function InternshipsTab() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const lk = useLookups();
  const save = useSaver('internships');
  const q = useQuery('internships', () => repo.list('internships', { order: [['starts_on', 'desc']] }));
  const [edit, setEdit] = useState<Row | null | 'new'>(null);
  const fields: FieldSpec[] = [
    { key: 'title_en', label: t('m06.talent.titleEn'), type: 'text', required: true, dir: 'ltr' },
    { key: 'title_ar', label: t('m06.talent.titleAr'), type: 'text', required: true, dir: 'rtl' },
    { key: 'host_entity_id', label: t('m06.talent.host'), type: 'select', required: true, options: lk.entities },
    { key: 'university_org_id', label: t('m06.talent.university'), type: 'select', options: lk.universities },
    { key: 'family_id', label: t('m06.talent.family'), type: 'select', options: lk.families },
    { key: 'seats', label: t('m06.talent.seats'), type: 'number', required: true },
    { key: 'starts_on', label: t('m06.talent.startsOn'), type: 'date', required: true },
    { key: 'intake_year', label: t('m06.talent.intakeYear'), type: 'number', required: true },
    { key: 'status', label: t('m06.talent.status'), type: 'select', required: true, options: ['open', 'closed', 'filled'].map((s) => ({ value: s, label: t(`m06.talent.st.${s}`) })) },
  ];
  const blank = { title_en: '', title_ar: '', host_entity_id: 'enec-ops', university_org_id: '', family_id: '', seats: 4, starts_on: '2027-06-15', intake_year: 2027, status: 'open' };
  return (
    <Card title={t('m06.talent.tabInternships')} actions={<button className="btn-primary btn-sm" onClick={() => setEdit('new')}><Icon name="plus" size={14} />{t('m06.talent.newInternship')}</button>} padded={false}>
      <div className="p-3">
        <Async state={q} empty={<EmptyState title={t('m06.talent.noInternships')} />}>
          {(rows) => (
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              csvName="internships"
              columns={[
                { key: 'title', header: t('m06.talent.title'), value: (r) => pick(r, 'title'), sortable: true },
                { key: 'host', header: t('m06.talent.host'), value: (r) => lk.orgName(r.host_entity_id) },
                { key: 'uni', header: t('m06.talent.university'), value: (r) => (r.university_org_id ? lk.orgName(r.university_org_id) : t('m06.talent.anyUniversity')) },
                { key: 'seats', header: t('m06.talent.seats'), value: (r) => r.seats, sortable: true, align: 'end' },
                { key: 'start', header: t('m06.talent.startsOn'), value: (r) => r.starts_on, sortable: true, render: (r) => f.date(r.starts_on) },
                { key: 'status', header: t('m06.talent.status'), value: (r) => r.status, render: (r) => <StatusPill status={r.status}>{t(`m06.talent.st.${r.status}`)}</StatusPill> },
                { key: 'actions', header: '', csv: false, render: (r) => <button className="btn-ghost btn-sm" onClick={() => setEdit(r as unknown as Row)}>{t('common.edit')}</button> },
              ]}
            />
          )}
        </Async>
      </div>
      <EntityModal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit === 'new' ? t('m06.talent.newInternship') : t('m06.talent.editInternship')}
        fields={fields}
        initial={edit === 'new' || edit === null ? blank : edit}
        onSave={(v) => save(edit === 'new' || edit === null ? null : edit.id, { ...v, seats: Number(v.seats), intake_year: Number(v.intake_year), university_org_id: v.university_org_id || null, family_id: v.family_id || null })}
      />
    </Card>
  );
}

function ProgrammesTab() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const q = useQuery('talent_programmes', () => repo.list('talent_programmes', { order: [['sort', 'asc']] }));
  const [change, setChange] = useState<{ id: string; name: string; mode: string } | null>(null);
  return (
    <Card title={t('m06.talent.tabProgrammes')} padded={false}>
      <div className="p-3">
        <p className="mb-3 text-[13px] text-ink-2">{t('m06.talent.programmesHint')}</p>
        <Async state={q} empty={<EmptyState />}>
          {(rows) => (
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              searchable={false}
              columns={[
                { key: 'name', header: t('m06.talent.programme'), value: (r) => pick(r, 'name') },
                { key: 'stage', header: t('m06.talent.stage'), value: (r) => t(`m06.stage.${r.stage}`) },
                { key: 'nat', header: t('m06.card.nationality'), value: (r) => t(`m06.nationality.${r.nationality}`) },
                {
                  key: 'mode', header: t('m06.talent.intake'), value: (r) => r.apply_mode,
                  render: (r) => (
                    <select className="input h-8" value={r.apply_mode} aria-label={t('m06.talent.intake')} onChange={(e) => setChange({ id: r.id, name: pick(r, 'name'), mode: e.target.value })}>
                      {['in_kafaa', 'link_out', 'closed'].map((m) => (
                        <option key={m} value={m}>{t(`m06.applyMode.${m}`)}</option>
                      ))}
                    </select>
                  ),
                },
              ]}
            />
          )}
        </Async>
      </div>
      <ConfirmDialog
        open={!!change}
        onClose={() => setChange(null)}
        title={t('m06.talent.intakeTitle')}
        consequence={change ? t('m06.talent.intakeBody', { name: change.name, mode: t(`m06.applyMode.${change.mode}`) }) : ''}
        onConfirm={async () => {
          if (change) await run(() => repo.update('talent_programmes', change.id, { apply_mode: change.mode as never }), { success: t('m06.talent.saved') });
        }}
      />
    </Card>
  );
}
