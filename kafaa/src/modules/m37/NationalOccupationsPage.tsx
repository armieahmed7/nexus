// FS63 /national/occupations (national_alignment R/Agg/W/A): every current role mapped to a national occupation label and an indicative
// skill level (Kafa'a's education rule, pending review); a MoHRE code is shown only when verified from an official UAE government source,
// otherwise "code pending review" (the research pack verifies no code, so all 28 read pending). Kafa'a is not a MoHRE system. HR and admins
// see the SIMULATED skill-level uplift trend (every cell under 10 suppressed). The HR director and admins edit labels and levels; only a
// platform admin records a verified code, never the last editor of the row (maker-checker); every action confirmed, audited, codes ledgered.
import { useMemo, useState } from 'react';
import { Page, Section, Async, BarChart, LineChart, BenchmarkChips, Callout, ConfirmDialog, DataTable, Drawer, EmptyState, SelectField, SourceLink, StatTile, StatusPill, TextArea, TextField, KeyValue, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { useBenchmarks } from '../../data/useBenchmarks';
import { LEVELS, codeProblem, codeView, indicativeLevel, occupationProblem, type OccupationRow, type OccupationTrend } from './occupations';
import { NotMohreCallout, Simulated, type Row } from './ui';

export default function NationalOccupationsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const data = useQuery(['role_occupations', 'job_roles', 'job_families'], async () => {
    const [occ, roles, fams] = await Promise.all([repo.list('role_occupations' as never), repo.list('job_roles'), repo.list('job_families')]);
    return { occ: occ as unknown as OccupationRow[], roles: roles as Row[], fams: fams as Row[] };
  }, []);
  const trend = useQuery(['role_occupations', 'people'], () => repo.rpc.occupationTrend(), []);
  return (
    <Page title={t('m37.routes.national-occupations.title')} intro={t('m37.ro.intro')} wide eyebrow={<BenchmarkChips feature="FS63" />}
      actions={<L to="/national/alignment" className="btn-ghost btn-sm no-underline">{t('m37.ro.toAlignment')}</L>}>
      <Async state={data}>{(d) => (
        <div className="space-y-6" data-testid="m37-ro">
          <NotMohreCallout />
          <Mapping d={d} canEdit={s.can('national_alignment', ['W', 'A'])} canVerify={s.can('national_alignment', ['A'])} />
          {s.can('national_alignment', ['Agg', 'W', 'A']) && (
            <Async state={trend} isEmpty={(x) => !x} empty={<EmptyState title={t('m37.none')} />}>{(tr) => (tr ? <Trend tr={tr} /> : null)}</Async>
          )}
        </div>
      )}</Async>
    </Page>
  );
}

function Mapping({ d, canEdit, canVerify }: { d: { occ: OccupationRow[]; roles: Row[]; fams: Row[] }; canEdit: boolean; canVerify: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const bm = useBenchmarks();
  const [edit, setEdit] = useState<OccupationRow | null>(null);
  const [verify, setVerify] = useState<OccupationRow | null>(null);
  const role = (id: string) => d.roles.find((r) => r.id === id);
  const fam = (id: string) => { const x = d.fams.find((y) => y.id === id); return x ? pick(x, 'name') : id; };
  const rows = useMemo(() => [...d.occ].sort((a, b) => Number(role(a.role_id)?.sort ?? 0) - Number(role(b.role_id)?.sort ?? 0)), [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const verified = rows.filter((r) => codeView(r).shown).length;
  const mohre = (bm.data ?? []).find((b) => b.id === 'MOHRE');
  const fig = (k: string) => ((mohre?.figures ?? []) as unknown as { key: string; value: number }[]).find((x) => x.key === k)?.value;
  const byLevel = LEVELS.map((l) => ({ label: t('m37.ro.levelN', { n: f.num(l) }), value: rows.filter((r) => r.skill_level === l).length }));
  const cols: Column<OccupationRow>[] = [
    { key: 'role', header: t('m37.ro.col.role'), value: (r) => pick(role(r.role_id), 'title'), sortable: true, render: (r) => (
      <span className="flex flex-col"><span className="font-semibold">{pick(role(r.role_id), 'title')}</span><span className="text-[11.5px] text-ink-3">{fam(role(r.role_id)?.family_id)}</span></span>) },
    { key: 'label', header: t('m37.ro.col.label'), value: (r) => pick(r as never, 'label'), sortable: true, render: (r) => <span>{pick(r as never, 'label')}</span> },
    { key: 'code', header: t('m37.ro.col.code'), value: (r) => codeView(r).shown ?? t('m37.ro.pending'), render: (r) => {
      const v = codeView(r);
      return v.shown
        ? <span className="flex flex-col gap-0.5" data-testid="m37-ro-code" data-status="verified"><span className="num font-semibold">{v.shown}</span>{v.source && <SourceLink href={v.source.url} date={v.source.as_of}>{v.source.label}</SourceLink>}</span>
        : <span data-testid="m37-ro-code" data-status="pending"><StatusPill tone="sim">{t('m37.ro.pending')}</StatusPill></span>;
    } },
    { key: 'level', header: t('m37.ro.col.level'), align: 'end', value: (r) => r.skill_level, sortable: true, render: (r) => (
      <span className="flex flex-col items-end"><span className="num font-semibold" data-testid="m37-ro-level">{t('m37.ro.levelN', { n: f.num(r.skill_level) })}</span>
        <span className="text-[11.5px] text-ink-3">{t(`m37.ro.basis.${r.level_basis}`)}</span></span>) },
    { key: 'education', header: t('m37.ro.col.education'), value: (r) => r.education_basis ?? '', render: (r) => <span className="text-[12.5px]">{r.education_basis ? t(`m37.ro.edu.${r.education_basis}`) : '—'}</span> },
    ...((canEdit || canVerify) ? [{ key: 'act', header: '', csv: false, render: (r: OccupationRow) => (
      <span className="flex flex-wrap justify-end gap-1">
        {canEdit && <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(r)} data-testid="m37-ro-edit">{t('m37.admin.edit')}</button>}
        {canVerify && <button type="button" className="btn-outline btn-sm" onClick={() => setVerify(r)} data-testid="m37-ro-verify">{codeView(r).shown ? t('m37.ro.clear') : t('m37.ro.verify')}</button>}
      </span>) }] : []),
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m37-ro-tiles">
        <StatTile label={t('m37.ro.tile.roles')} value={f.num(rows.length)} sub={t('m37.ro.tile.rolesSub')} />
        <StatTile label={t('m37.ro.tile.verified')} value={f.num(verified)} sub={t('m37.ro.tile.verifiedSub')} tone="ok" />
        <StatTile label={t('m37.ro.tile.pending')} value={f.num(rows.length - verified)} sub={t('m37.ro.tile.pendingSub')} tone="sim" />
        <StatTile label={t('m37.ro.tile.classification')} value={fig('occupational_categories') == null ? '—' : f.num(fig('occupational_categories'))}
          sub={t('m37.ro.tile.classificationSub', { levels: fig('skill_levels') == null ? '—' : f.num(fig('skill_levels')) })} source={mohre ? <SourceLink href={mohre.urls[0]} date={mohre.as_of}>{pick(mohre as never, 'name')}</SourceLink> : undefined} />
      </div>
      <Section title={t('m37.ro.tableTitle')} description={t('m37.ro.tableIntro')}>
        <div className="overflow-x-auto" data-testid="m37-ro-table"><DataTable rows={rows} columns={cols} rowKey={(r) => r.id} pageSize={30} caption={t('m37.ro.tableTitle')} csvName="kafaa-role-occupations" dense /></div>
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m37.ro.levelsTitle')} description={t('m37.ro.levelsIntro')}>
          <div data-testid="m37-ro-levels"><BarChart title={t('m37.ro.levelsTitle')} data={byLevel} /></div>
        </Section>
        <Callout tone="info" title={t('m37.ro.ruleTitle')}><span data-testid="m37-ro-rule">{t('m37.ro.ruleBody')}</span></Callout>
      </div>
      {edit && <Editor row={edit} role={role(edit.role_id)} onClose={() => setEdit(null)} />}
      {verify && <Verify row={verify} role={role(verify.role_id)} onClose={() => setVerify(null)} />}
    </>
  );
}

function Editor({ row, role, onClose }: { row: OccupationRow; role: Row; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [x, setX] = useState({ label_en: row.label_en, label_ar: row.label_ar, skill_level: String(row.skill_level), level_basis: row.level_basis, rationale_en: row.rationale_en ?? '', rationale_ar: row.rationale_ar ?? '' });
  const [confirm, setConfirm] = useState(false);
  const input = { role_id: row.role_id, label_en: x.label_en, label_ar: x.label_ar, skill_level: Number(x.skill_level), level_basis: x.level_basis, rationale_en: x.rationale_en || null, rationale_ar: x.rationale_ar || null };
  const problem = occupationProblem(input, role);
  const rule = indicativeLevel(role?.education);
  return (
    <>
      <Drawer open onClose={onClose} title={t('m37.ro.editTitle', { role: pick(role, 'title') })}
        footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary btn-sm" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m37-ro-save">{t('m37.admin.save')}</button></div>}>
        <div className="space-y-3" data-testid="m37-ro-editor" data-problem={problem ?? ''}>
          <TextField name="m37-ro-label-en" label={t('m37.ro.labelEn')} value={x.label_en} onChange={(v) => setX({ ...x, label_en: v })} />
          <TextField name="m37-ro-label-ar" label={t('m37.ro.labelAr')} value={x.label_ar} onChange={(v) => setX({ ...x, label_ar: v })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField name="m37-ro-level" label={t('m37.ro.col.level')} value={x.skill_level} onChange={(v) => setX({ ...x, skill_level: v })} options={LEVELS.map((l) => ({ value: String(l), label: t('m37.ro.levelN', { n: f.num(l) }) }))} />
            <SelectField name="m37-ro-basis" label={t('m37.ro.basisLabel')} value={x.level_basis} onChange={(v) => setX({ ...x, level_basis: v, skill_level: v === 'education_rule' && rule ? String(rule) : x.skill_level })}
              options={['education_rule', 'reviewed'].map((b) => ({ value: b, label: t(`m37.ro.basis.${b}`) }))} />
          </div>
          <p className="text-[12.5px] text-ink-3">{t('m37.ro.ruleHint', { level: rule == null ? '—' : f.num(rule), edu: role?.education ? t(`m37.ro.edu.${role.education}`) : '—' })}</p>
          {x.level_basis === 'reviewed' && <>
            <TextArea name="m37-ro-rat-en" label={t('m37.ro.rationaleEn')} value={x.rationale_en} onChange={(v) => setX({ ...x, rationale_en: v })} rows={2} />
            <TextArea name="m37-ro-rat-ar" label={t('m37.ro.rationaleAr')} value={x.rationale_ar} onChange={(v) => setX({ ...x, rationale_ar: v })} rows={2} />
          </>}
          {problem && <Callout tone="bad" title={t('m37.admin.check')}><span data-testid="m37-ro-problem">{t(`m37.problem.ro.${problem}`)}</span></Callout>}
          <KeyValue items={[[t('m37.ro.col.code'), codeView(row).shown ?? t('m37.ro.pending')], [t('m37.col.version'), f.num(row.version)]]} />
        </div>
      </Drawer>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m37.ro.confirmSave')} consequence={t('m37.ro.saveConsequence')}
        onConfirm={async () => { const r = await run(() => repo.rpc.saveRoleOccupation(input)); setConfirm(false); if (r.ok) onClose(); }} />
    </>
  );
}

function Verify({ row, role, onClose }: { row: OccupationRow; role: Row; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const v = codeView(row);
  const [x, setX] = useState({ code: '', source_label: '', source_url: 'https://', source_as_of: todayIso() });
  const [confirm, setConfirm] = useState(false);
  const input = { role_id: row.role_id, ...x };
  const problem = v.shown ? null : codeProblem(input, todayIso());
  const self = !v.shown && row.updated_by === s.identity.personId;
  return (
    <>
      <Drawer open onClose={onClose} title={v.shown ? t('m37.ro.clearTitle', { role: pick(role, 'title') }) : t('m37.ro.verifyTitle', { role: pick(role, 'title') })}
        footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary btn-sm" disabled={!!problem || self} onClick={() => setConfirm(true)} data-testid="m37-ro-verify-save">{v.shown ? t('m37.ro.clear') : t('m37.ro.verify')}</button></div>}>
        <div className="space-y-3" data-testid="m37-ro-verifier" data-problem={problem ?? ''}>
          <Callout tone="sim" title={t('m37.ro.verifyRuleTitle')}>{t('m37.ro.verifyRuleBody')}</Callout>
          {self && <Callout tone="bad" title={t('m37.ro.makerChecker')} />}
          {!v.shown && <>
            <TextField name="m37-ro-code" label={t('m37.ro.col.code')} value={x.code} onChange={(c) => setX({ ...x, code: c.toUpperCase() })} />
            <TextField name="m37-ro-src-label" label={t('m37.admin.srcLabel')} value={x.source_label} onChange={(c) => setX({ ...x, source_label: c })} />
            <TextField name="m37-ro-src-url" label={t('m37.admin.srcUrl')} value={x.source_url} onChange={(c) => setX({ ...x, source_url: c })} />
            <TextField name="m37-ro-src-asof" label={t('m37.admin.srcAsOf')} value={x.source_as_of} onChange={(c) => setX({ ...x, source_as_of: c })} type="date" />
            {problem && x.code && <p className="text-[12.5px] text-bad" data-testid="m37-ro-code-problem">{t(`m37.problem.code.${problem}`)}</p>}
          </>}
        </div>
      </Drawer>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={v.shown ? t('m37.ro.confirmClear') : t('m37.ro.confirmVerify')}
        consequence={v.shown ? t('m37.ro.clearConsequence') : t('m37.ro.verifyConsequence')} requireReason={!!v.shown} reasonLabel={t('m37.ro.clearReason')}
        onConfirm={async (reason) => {
          const r = v.shown ? await run(() => repo.rpc.clearOccupationCode(row.role_id, reason)) : await run(() => repo.rpc.verifyOccupationCode(input));
          setConfirm(false); if (r.ok) onClose();
        }} />
    </>
  );
}

function Trend({ tr }: { tr: OccupationTrend }) {
  const t = useT();
  const f = useFormat();
  const yr = (y: number) => f.num(y, { useGrouping: false });
  return (
    <Section title={<span className="inline-flex flex-wrap items-center gap-2">{t('m37.ro.trendTitle')}<Simulated /></span>} description={t('m37.ro.trendIntro')}>
      <div className="space-y-4" data-testid="m37-ro-trend" data-simulated="true">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div data-testid="m37-ro-trend-upper"><LineChart title={t('m37.ro.trendUpper')} unit="%" yMin={0} yMax={100}
            series={[{ name: t('m37.ro.trendUpper'), points: tr.years.map((y) => ({ x: yr(y.year), y: y.upper_pct })), dashed: true }]} /></div>
          <div data-testid="m37-ro-trend-mean"><LineChart title={t('m37.ro.trendMean')} yMin={1} yMax={5}
            series={[{ name: t('m37.ro.trendMean'), points: tr.years.map((y) => ({ x: yr(y.year), y: y.mean })), dashed: true }]} /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" data-testid="m37-ro-trend-table">
            <caption className="sr-only">{t('m37.ro.trendTitle')}</caption>
            <thead><tr className="text-ink-3"><th className="text-start">{t('m37.ro.year')}</th><th className="text-end">{t('m37.ro.total')}</th>
              {LEVELS.map((l) => <th key={l} className="text-end">{t('m37.ro.levelN', { n: f.num(l) })}</th>)}<th className="text-end">{t('m37.ro.trendUpper')}</th></tr></thead>
            <tbody>{tr.years.map((y) => (
              <tr key={y.year} className="border-t border-line">
                <td className="num">{yr(y.year)}</td>
                <td className="num text-end">{y.total == null ? <Sup /> : f.num(y.total)}</td>
                {y.levels.map((l) => <td key={l.level} className="num text-end">{l.n == null ? <Sup /> : f.num(l.n)}</td>)}
                <td className="num text-end">{y.upper_pct == null ? <Sup /> : f.pct(y.upper_pct)}</td>
              </tr>))}</tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-ink-3" data-testid="m37-ro-trend-note">{t('m37.ro.trendNote', { roles: f.num(tr.mapped_roles), min: f.num(tr.min_group) })}</p>
      </div>
    </Section>
  );
}

function Sup() {
  const t = useT();
  return <span className="text-ink-3" title={t('common.suppressed')} data-suppressed="true">{t('common.suppressedShort')}</span>;
}
