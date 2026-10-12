// FS71 /admin/skills/technologies (framework owners: frameworks W/A: instructors, the training manager, admins): the technology
// catalogue, its tags on opportunities and role-profile versions, and the quarterly badges. The form runs techProblem (the same rule as
// both backends) before anything is sent, so a vendor or product brand is refused with the name it matched. Badges are computed from the
// published criteria for review, then published per ended quarter (ConfirmDialog); a published quarter is kept, never overwritten.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT, L } from '../../i18n';
import {
  Async, BenchmarkChips, Callout, ConfirmDialog, DataTable, EmptyState, Modal, Page, Section, SelectField, StatTile, StatusPill, Tabs, TextArea, TextField, type Column,
} from '../../ui';
import { todayIso } from '../../domain/rules';
import { quarterClosed, quarterOf, quartersTo } from './signals';
import { BRAND_DENY, MAX_SKILLS, TECH_CATEGORIES, brandHits, techProblem, type BadgeResult, type TechInput } from './technologies';
import { BadgeCriteria, useQuarterLabel, useRef70, useRun28, type Ref, type Row } from './fs70ui';

export default function TechnologiesAdminPage() {
  const t = useT();
  const s = useSession();
  const ref = useRef70();
  const canWrite = s.can('frameworks', ['W', 'A']);
  return (
    <Page title={t('m28.routes.admin-skills-technologies.title')} intro={t('m28.hta.intro')} wide eyebrow={<BenchmarkChips feature="FS71" />}
      actions={<L to="/skills/technologies" className="btn-outline btn-sm no-underline">{t('m28.hta.public')}</L>}>
      {!canWrite && <div className="mb-4"><Callout tone="sim" title={t('m28.hta.readOnlyTitle')}>{t('m28.hta.readOnlyBody')}</Callout></div>}
      <Async state={ref}>{(r) => (
        <div data-testid="m28-hta">
          <Tabs tabs={[
            { id: 'catalogue', label: t('m28.hta.tab.catalogue'), content: <Catalogue r={r} canWrite={canWrite} /> },
            { id: 'tags', label: t('m28.hta.tab.tags'), content: <Tags r={r} canWrite={canWrite} /> },
            { id: 'badges', label: t('m28.hta.tab.badges'), content: <BadgeRuns r={r} canWrite={canWrite} /> },
          ]} />
        </div>
      )}</Async>
    </Page>
  );
}

// ───────────── catalogue
function Catalogue({ r, canWrite }: { r: Ref; canWrite: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [edit, setEdit] = useState<Row | 'new' | null>(null);
  const cols: Column<Row>[] = [
    { key: 'name', header: t('m28.hta.col.name'), value: (x) => pick(x, 'name'), render: (x) => <span className="font-semibold" data-testid="m28-hta-row" data-id={x.id}>{pick(x, 'name')}</span> },
    { key: 'category', header: t('m28.hta.col.category'), value: (x) => t(`m28.ht.cat.${x.category}`) },
    { key: 'skills', header: t('m28.hta.col.skills'), value: (x) => (x.skill_ids ?? []).length, align: 'end' },
    { key: 'version', header: t('m28.hta.col.version'), value: (x) => Number(x.version), render: (x) => f.num(Number(x.version)), align: 'end' },
    { key: 'status', header: t('m28.hta.col.status'), value: (x) => x.status, render: (x) => <StatusPill tone={x.status === 'active' ? 'ok' : 'neutral'}>{t(`m28.hta.status.${x.status}`)}</StatusPill> },
    ...(canWrite ? [{ key: 'edit', header: <span className="sr-only">{t('m28.hta.edit')}</span>, csv: false, render: (x: Row) => <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(x)} data-testid="m28-hta-edit">{t('m28.hta.edit')}</button> }] : []),
  ];
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label={t('m28.hta.tile.active')} value={f.num(r.technologies.filter((x) => x.status === 'active').length)} />
        <StatTile label={t('m28.hta.tile.retired')} value={f.num(r.technologies.filter((x) => x.status === 'retired').length)} />
        <StatTile label={t('m28.hta.tile.deny')} value={f.num(BRAND_DENY.length)} sub={t('m28.hta.tile.denySub')} tone="sim" />
      </div>
      <DataTable rows={r.technologies} columns={cols} rowKey={(x) => x.id} csvName="technologies.csv" caption={t('m28.hta.tab.catalogue')}
        toolbar={canWrite ? <button type="button" className="btn-primary btn-sm" onClick={() => setEdit('new')} data-testid="m28-hta-new">{t('m28.hta.new')}</button> : undefined} />
      {edit && <TechForm r={r} tech={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function TechForm({ r, tech, onClose }: { r: Ref; tech: Row | null; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useRun28('ht');
  const isNew = !tech;
  const [v, setV] = useState<TechInput>({
    id: tech?.id ?? 'tech-', name_en: tech?.name_en ?? '', name_ar: tech?.name_ar ?? '', description_en: tech?.description_en ?? '', description_ar: tech?.description_ar ?? '',
    category: tech?.category ?? '', skill_ids: [...(tech?.skill_ids ?? [])], status: tech?.status ?? 'active',
  });
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [addSkill, setAddSkill] = useState('');
  const skillIds = useMemo(() => [...r.skills.keys()], [r.skills]);
  const problem = techProblem(v, skillIds, isNew);
  const brands = [...new Set([v.id, v.name_en, v.name_ar, v.description_en, v.description_ar].flatMap((x) => brandHits(x)))];
  const err = (p: string) => (tried && problem === p ? t(`m28.hta.problem.${p}`) : null);
  const set = (k: keyof TechInput) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const skills = v.skill_ids ?? [];
  const skillOpts = [...r.skills.values()].filter((s) => !skills.includes(s.id) && s.status !== 'retired').map((s) => ({ value: s.id, label: pick(s, 'name') })).sort((a, b) => a.label.localeCompare(b.label));
  const input: TechInput = isNew ? v : { ...v, id: tech!.id };
  return (
    <Modal open onClose={onClose} size="lg" title={isNew ? t('m28.hta.new') : t('m28.hta.editTitle', { name: pick(tech!, 'name') })}
      footer={<><button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary" data-testid="m28-hta-save" onClick={() => { setTried(true); if (!problem) setConfirm(true); }}>{t('m28.hta.save')}</button></>}>
      <form className="space-y-3" data-testid="m28-hta-form" onSubmit={(e) => e.preventDefault()}>
        {isNew && <TextField name="id" label={t('m28.hta.f.id')} value={v.id ?? ''} onChange={set('id')} error={err('id')} hint={t('m28.hta.f.idHint')} required />}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField name="name_en" label={t('m28.hta.f.nameEn')} value={v.name_en} onChange={set('name_en')} error={err('name')} required />
          <TextField name="name_ar" label={t('m28.hta.f.nameAr')} value={v.name_ar} onChange={set('name_ar')} error={err('name')} required />
          <TextArea name="description_en" label={t('m28.hta.f.descEn')} value={v.description_en} onChange={set('description_en')} error={err('description')} required rows={3} />
          <TextArea name="description_ar" label={t('m28.hta.f.descAr')} value={v.description_ar} onChange={set('description_ar')} error={err('description')} required rows={3} />
        </div>
        {brands.length > 0 && <div role="alert" className="rounded-card border border-bad-line bg-bad-bg p-3 text-[13px] text-bad" data-testid="m28-hta-brand">{t('m28.hta.brandFound', { list: brands.join(t('m28.rs.sep')) })}</div>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SelectField name="category" label={t('m28.hta.f.category')} value={v.category} onChange={set('category')} error={err('category')} required placeholder={t('m28.hta.f.categoryPick')}
            options={TECH_CATEGORIES.map((c) => ({ value: c, label: t(`m28.ht.cat.${c}`) }))} />
          <SelectField name="status" label={t('m28.hta.f.status')} value={v.status ?? 'active'} onChange={(x) => setV((o) => ({ ...o, status: x as 'active' | 'retired' }))} error={err('status')}
            options={[{ value: 'active', label: t('m28.hta.status.active') }, { value: 'retired', label: t('m28.hta.status.retired') }]} />
        </div>
        <div>
          <div className="mb-1 text-[13px] font-semibold">{t('m28.hta.f.skills', { n: MAX_SKILLS })}</div>
          <div className="mb-2 flex min-w-0 flex-wrap gap-2" data-testid="m28-hta-skills">
            {skills.length === 0 && <span className="text-[13px] text-ink-3">{t('m28.hta.f.noSkills')}</span>}
            {skills.map((id) => (
              <span key={id} className="chip max-w-full whitespace-normal break-words">{pick(r.skills.get(id) ?? { name_en: id, name_ar: id }, 'name')}
                <button type="button" className="ms-1" aria-label={t('m28.hta.f.removeSkill')} onClick={() => setV((o) => ({ ...o, skill_ids: (o.skill_ids ?? []).filter((x) => x !== id) }))}>×</button></span>
            ))}
          </div>
          {skills.length < MAX_SKILLS && (
            <div className="flex min-w-0 flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1"><SelectField name="add_skill" label={t('m28.hta.f.addSkill')} value={addSkill} onChange={setAddSkill} options={skillOpts} placeholder={t('m28.hta.f.addSkillPick')} /></div>
              <button type="button" className="btn-outline btn-sm" disabled={!addSkill} onClick={() => { setV((o) => ({ ...o, skill_ids: [...(o.skill_ids ?? []), addSkill] })); setAddSkill(''); }}>{t('m28.hta.f.add')}</button>
            </div>
          )}
          {err('skills') && <p className="mt-1 text-[12px] text-bad" role="alert">{err('skills')}</p>}
        </div>
      </form>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m28.hta.save')} consequence={isNew ? t('m28.hta.consequenceNew') : t('m28.hta.consequenceEdit', { v: Number(tech!.version) + 1 })}
        onConfirm={async () => { const res = await run(() => repo.rpc.saveTechnology(input), t('m28.hta.saved')); if (res.ok) { setConfirm(false); onClose(); } }} />
    </Modal>
  );
}

// ───────────── tags
function Tags({ r, canWrite }: { r: Ref; canWrite: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useRun28('ht');
  const q = useQuery(['technology_links', 'opportunities', 'role_profile_versions'], async () => {
    const [links, opps, rpv] = await Promise.all([
      repo.list('technology_links' as never) as Promise<Row[]>,
      (repo.list('opportunities' as never) as Promise<Row[]>).catch(() => [] as Row[]),
      (repo.list('role_profile_versions' as never) as Promise<Row[]>).catch(() => [] as Row[]),
    ]);
    return { links, opps, rpv };
  });
  const active = r.technologies.filter((x) => x.status === 'active');
  const [tech, setTech] = useState(active[0]?.id ?? '');
  const [table, setTable] = useState<'opportunities' | 'role_profile_versions'>('opportunities');
  const [refId, setRefId] = useState('');
  return (
    <Async state={q}>{(d) => {
      const label = (tb: string, id: string) => {
        if (tb === 'opportunities') { const o = d.opps.find((x) => x.id === id); return o ? pick(o, 'title') : id; }
        const p = d.rpv.find((x) => x.id === id); const role = p ? r.roles.get(p.role_id) : undefined;
        return p ? t('m28.hta.rpvLabel', { role: role ? pick(role, 'title') : p.role_id, h: t(`m28.hta.horizon.${p.horizon}`), v: f.num(Number(p.version)) }) : id;
      };
      const mine = d.links.filter((l) => l.technology_id === tech).sort((a, b) => String(b.source_on).localeCompare(String(a.source_on)));
      const tagged = new Set(mine.filter((l) => l.active).map((l) => `${l.ref_table}|${l.ref_id}`));
      const pool = table === 'opportunities' ? d.opps : d.rpv;
      const opts = pool.filter((x) => !tagged.has(`${table}|${x.id}`)).map((x) => ({ value: x.id, label: label(table, x.id) })).sort((a, b) => a.label.localeCompare(b.label));
      const toggle = (ref_table: 'opportunities' | 'role_profile_versions', ref_id: string, on: boolean) =>
        run(() => repo.rpc.tagTechnology({ technology_id: tech, ref_table, ref_id, active: on }), on ? t('m28.hta.tagged') : t('m28.hta.untagged'));
      return (
        <div className="space-y-4 pt-4" data-testid="m28-hta-tags">
          <div className="max-w-md"><SelectField name="tech" label={t('m28.hta.pickTech')} value={tech} onChange={setTech} options={active.map((x) => ({ value: x.id, label: pick(x, 'name') }))} /></div>
          {canWrite && tech && (
            <div className="flex min-w-0 flex-wrap items-end gap-2 rounded-card border border-line bg-panel p-3">
              <div className="min-w-[10rem]"><SelectField name="ref_table" label={t('m28.hta.source')} value={table} onChange={(x) => { setTable(x as typeof table); setRefId(''); }}
                options={[{ value: 'opportunities', label: t('m28.hta.src.opportunities') }, { value: 'role_profile_versions', label: t('m28.hta.src.role_profile_versions') }]} /></div>
              <div className="min-w-0 flex-1"><SelectField name="ref_id" label={t('m28.hta.sourceItem')} value={refId} onChange={setRefId} options={opts} placeholder={t('m28.hta.sourcePick')} /></div>
              <button type="button" className="btn-primary btn-sm" disabled={!refId} data-testid="m28-hta-tag" onClick={async () => { const x = await toggle(table, refId, true); if (x.ok) setRefId(''); }}>{t('m28.hta.tag')}</button>
            </div>
          )}
          {mine.length ? (
            <ul className="space-y-2" data-testid="m28-hta-links">
              {mine.map((l) => (
                <li key={l.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-panel px-3 py-2 text-[13.5px]" data-active={l.active ? '1' : '0'}>
                  <div className="min-w-0">
                    <span className="font-semibold">{label(l.ref_table, l.ref_id)}</span>
                    <span className="ms-2 text-[12px] text-ink-3">{t(`m28.hta.src.${l.ref_table}`)} · {f.date(l.source_on)}{l.family_id ? ` · ${pick(r.families.get(l.family_id) ?? { name_en: l.family_id, name_ar: l.family_id }, 'name')}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={l.active ? 'ok' : 'neutral'}>{l.active ? t('m28.hta.linkOn') : t('m28.hta.linkOff')}</StatusPill>
                    {canWrite && <button type="button" className="btn-ghost btn-sm" onClick={() => toggle(l.ref_table, l.ref_id, !l.active)} data-testid="m28-hta-toggle">{l.active ? t('m28.hta.untag') : t('m28.hta.retag')}</button>}
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title={t('m28.hta.noLinks')} />}
        </div>
      );
    }}</Async>
  );
}

// ───────────── badges
function BadgeRuns({ r, canWrite }: { r: Ref; canWrite: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useRun28('ht');
  const ql = useQuarterLabel();
  const today = todayIso();
  const quarters = quartersTo(quarterOf(today)).reverse();
  const pub = useQuery(['technology_badges'], () => repo.list('technology_badges' as never) as Promise<Row[]>);
  const [quarter, setQuarter] = useState(quarters[1] ?? quarters[0]);
  const [preview, setPreview] = useState<BadgeResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const name = (id: string) => { const x = r.technologies.find((y) => y.id === id); return x ? pick(x, 'name') : id; };
  return (
    <Async state={pub} isEmpty={() => false}>{(rows) => {
      const published = new Set(rows.map((x) => x.quarter));
      const isPub = published.has(quarter);
      const closed = quarterClosed(quarter, today);
      return (
        <div className="space-y-4 pt-4" data-testid="m28-hta-badges">
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="min-w-[12rem]"><SelectField name="quarter" label={t('m28.rs.quarter')} value={quarter} onChange={(x) => { setQuarter(x); setPreview(null); }}
              options={quarters.map((x) => ({ value: x, label: `${ql(x)}${published.has(x) ? ` · ${t('m28.hta.isPublished')}` : ''}` }))} /></div>
            <button type="button" className="btn-outline btn-sm" data-testid="m28-hta-compute" onClick={async () => { const x = await run(() => repo.rpc.computeTechnologyBadges(quarter), t('m28.hta.computed')); if (x.ok && x.data) setPreview(x.data); }}>{t('m28.hta.compute')}</button>
            {canWrite && <button type="button" className="btn-primary btn-sm" disabled={!closed || isPub || !preview} data-testid="m28-hta-publish" onClick={() => setConfirm(true)}>{t('m28.hta.publish')}</button>}
          </div>
          <p className="text-[13px] text-ink-2">{isPub ? t('m28.hta.keptNote') : closed ? t('m28.hta.readyNote') : t('m28.hta.openNote')}</p>
          {preview && (
            <div className="space-y-3" data-testid="m28-hta-preview">
              <p className="text-[13px] text-ink-2">{t('m28.hta.window', { start: f.date(preview.window.start), end: f.date(preview.window.end), v: preview.criteria })}</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-card border border-line bg-panel p-3"><div className="caps mb-1">{t('m28.ht.hot')}</div>
                  {preview.hot.length ? <ol className="list-decimal space-y-1 ps-5 text-[13px]">{preview.hot.map((h) => <li key={h.technology_id}>{name(h.technology_id)} <span className="text-ink-3">({t('m28.ht.counts', { s: f.num(h.sources), fam: f.num(h.families), rec: f.num(h.recent) })})</span></li>)}</ol> : <p className="text-[13px] text-ink-3">{t('m28.ht.noHot')}</p>}</div>
                <div className="rounded-card border border-line bg-panel p-3"><div className="caps mb-1">{t('m28.ht.inDemand')}</div>
                  <p className="text-[13px]">{t('m28.hta.roleCount', { n: f.num(preview.roles.length), r: f.num(new Set(preview.roles.map((x) => x.role_id)).size) })}</p></div>
                <div className="rounded-card border border-line bg-panel p-3"><div className="caps mb-1">{t('m28.hta.near')}</div>
                  {preview.near.length ? <ul className="space-y-1 text-[13px]">{preview.near.slice(0, 6).map((n) => <li key={n.technology_id}>{name(n.technology_id)} <span className="text-ink-3">({t('m28.ht.counts', { s: f.num(n.sources), fam: f.num(n.families), rec: f.num(n.recent) })})</span></li>)}</ul> : <p className="text-[13px] text-ink-3">{t('m28.hta.noNear')}</p>}</div>
              </div>
            </div>
          )}
          <Section title={t('m28.ht.criteriaTitle')}><BadgeCriteria /></Section>
          <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m28.hta.publish')} consequence={t('m28.hta.publishConsequence', { q: ql(quarter) })}
            onConfirm={async () => { const x = await run(() => repo.rpc.publishTechnologyBadges(quarter), t('m28.hta.publishedOk')); if (x.ok) { setConfirm(false); setPreview(null); } }} />
        </div>
      );
    }}</Async>
  );
}

