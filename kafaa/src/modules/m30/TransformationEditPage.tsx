// /workforce/transformation/:roleId (M30 · FS11 editor). The training manager or the HR director edits a role's transformation map:
// archetype, technology drivers, the staff summary and the public summary (EN and AR), sources. Live checks show exactly what
// publishTransformation will refuse (headcount, sites or deployment claims; the FS12 copy check against "replace" / "redundant" and
// their Arabic equivalents; numbers in the public summary; a source to publish). Save a draft, or publish after a confirmation
// (audited, NEXUS ledger). The published version history is listed. Security roles stay path-level (no archetype, no drivers).
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, Callout, ConfirmDialog, CheckboxField, SelectField, TextArea, TextField, StatusPill, WhyThis } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useFormat, usePick, useT, L } from '../../i18n';
import { useCrumbLabel } from '../../shell/crumbs';
import { ARCHETYPES, DRIVERS, PUBLIC_MAX, SUMMARY_MAX, bannedWording, checkTransformation, isPathOnly, type RtInput } from './transform';
import { BenchTies, FS11, useRefData, useRoleMap, type RefData, RefGaps } from './ui';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Src = { label: string; url: string; as_of?: string | null };

export default function TransformationEditPage() {
  const t = useT();
  const { roleId = '' } = useParams();
  const ref = useRefData();
  const q = useRoleMap(roleId, '2030');
  return (
    <Page title={t('m30.routes.workforce-transformation-edit.title')} intro={t('m30.ed.intro')} eyebrow={<BenchTies feature={FS11} />}
      actions={<L to="/workforce/transformation" className="btn-outline no-underline">{t('m30.routes.workforce-transformation.title')}</L>}>
      <RefGaps d={ref.data} onRetry={ref.reload} />
      <Async state={ref}>{(d) => (
        <Async state={q}>{(v) => {
          const role = d.roleById.get(roleId);
          if (!role || !v || !v.map) return <EmptyState title={t('m30.pub.notFound')} />;
          if (!v.can_edit) return <Callout tone="info" title={t('m30.ed.readOnly')}>{t('m30.ed.readOnlyBody')}</Callout>;
          return <Editor d={d} role={role} row={d.mapByRole.get(roleId) ?? null} draft={v.draft} />;
        }}</Async>
      )}</Async>
    </Page>
  );
}

function Editor({ d, role, row, draft }: { d: RefData; role: Row; row: Row | null; draft: Row | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  useCrumbLabel(pick(role, 'title'));
  const path = isPathOnly(role as never);
  const start = (draft ?? row ?? {}) as Row;
  const [archetype, setArchetype] = useState<string>(start.archetype ?? '');
  const [drivers, setDrivers] = useState<string[]>(start.drivers ?? []);
  const [txt, setTxt] = useState({ summary_en: start.summary_en ?? '', summary_ar: start.summary_ar ?? '', public_summary_en: start.public_summary_en ?? '', public_summary_ar: start.public_summary_ar ?? '' });
  const [sources, setSources] = useState<Src[]>((start.sources ?? []) as Src[]);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setDrivers(start.drivers ?? []); }, [role.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const input = (publish: boolean): RtInput => ({ role_id: role.id, archetype: archetype || null, drivers, ...txt, sources: sources.map((s) => ({ label: s.label, url: s.url, as_of: s.as_of ?? undefined })), publish });
  const draftCode = useMemo(() => checkTransformation(input(false), role as never), [archetype, drivers, txt, sources]); // eslint-disable-line react-hooks/exhaustive-deps
  const pubCode = useMemo(() => checkTransformation(input(true), role as never), [archetype, drivers, txt, sources]); // eslint-disable-line react-hooks/exhaustive-deps
  const banned = Object.values(txt).map(bannedWording).find(Boolean) ?? null;
  const save = (publish: boolean) => act(() => repo.rpc.publishTransformation(input(publish)), { success: publish ? t('m30.ed.published') : t('m30.ed.saved') });
  const setT = (k: keyof typeof txt) => (v: string) => setTxt((x) => ({ ...x, [k]: v }));
  return (
    <div className="space-y-5" data-testid="m30-editor">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] font-semibold">{pick(role, 'title')}</h2>
        {row && <StatusPill status={row.status}>{t(`m30.status.${row.status}`)}</StatusPill>}
        {row && <span className="chip border-line bg-sunken text-ink-2">{t('m30.my.version', { v: f.num(row.version) })}</span>}
        {draft && <span className="chip border-sim-line bg-sim-bg text-sim" data-testid="m30-ed-draft">{t('m30.ed.draftFrom', { when: f.dateTime(draft.saved_at) })}</span>}
      </div>
      {path && <Callout tone="info" title={t('m30.pathOnly.title')}>{t('m30.ed.pathBody')}</Callout>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title={t('m30.ed.shape')} className="xl:col-span-1">
          <div className="space-y-3">
            <SelectField label={t('m30.ed.archetype')} name="archetype" value={archetype} onChange={setArchetype} disabled={path}
              options={ARCHETYPES.map((a) => ({ value: a, label: t(`m30.archetype.${a}`) }))} placeholder={t('m30.ed.archetypeNone')} />
            <fieldset className="space-y-1.5" data-testid="m30-ed-drivers">
              <legend className="text-[13px] font-semibold">{t('m30.ed.drivers')}</legend>
              {DRIVERS.map((dr) => (
                <CheckboxField key={dr} label={t(`m30.driver.${dr}`)} checked={drivers.includes(dr)} disabled={path}
                  onChange={(on) => setDrivers((xs) => (on ? [...xs.filter((x) => x !== dr), dr] : xs.filter((x) => x !== dr)))} />
              ))}
            </fieldset>
          </div>
        </Card>
        <Card title={t('m30.ed.texts')} className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextArea label={t('m30.ed.summaryEn')} name="summary_en" value={txt.summary_en} onChange={setT('summary_en')} rows={5} hint={t('m30.ed.len', { n: f.num(txt.summary_en.trim().length), max: f.num(SUMMARY_MAX) })} />
            <div dir="rtl"><TextArea label={t('m30.ed.summaryAr')} name="summary_ar" value={txt.summary_ar} onChange={setT('summary_ar')} rows={5} hint={t('m30.ed.len', { n: f.num(txt.summary_ar.trim().length), max: f.num(SUMMARY_MAX) })} /></div>
            <TextArea label={t('m30.ed.publicEn')} name="public_summary_en" value={txt.public_summary_en} onChange={setT('public_summary_en')} rows={3} hint={t('m30.ed.publicHint', { max: f.num(PUBLIC_MAX) })} />
            <div dir="rtl"><TextArea label={t('m30.ed.publicAr')} name="public_summary_ar" value={txt.public_summary_ar} onChange={setT('public_summary_ar')} rows={3} hint={t('m30.ed.publicHint', { max: f.num(PUBLIC_MAX) })} /></div>
          </div>
        </Card>
      </div>
      <Card title={t('m30.ed.sources')}>
        <ul className="space-y-2" data-testid="m30-ed-sources">
          {sources.map((s, i) => (
            <li key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.4fr_auto]">
              <TextField label={t('m30.ed.srcLabel')} name={`src-label-${i}`} value={s.label} onChange={(v) => setSources((xs) => xs.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
              <TextField label={t('m30.ed.srcUrl')} name={`src-url-${i}`} value={s.url} onChange={(v) => setSources((xs) => xs.map((x, j) => (j === i ? { ...x, url: v } : x)))} />
              <button type="button" className="btn-ghost btn-sm self-end" onClick={() => setSources((xs) => xs.filter((_, j) => j !== i))}>{t('m30.ed.srcRemove')}</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-outline btn-sm mt-2" onClick={() => setSources((xs) => [...xs, { label: '', url: 'https://', as_of: null }])}>{t('m30.ed.srcAdd')}</button>
      </Card>
      <Card title={t('m30.ed.checks')}>
        <ul className="space-y-1 text-[13px]" data-testid="m30-ed-checks">
          <li className={draftCode === 'ok' ? 'text-ok' : 'text-bad'} data-code={draftCode}>{draftCode === 'ok' ? t('m30.ed.checkDraftOk') : t(`m30.ed.code.${draftCode}`)}</li>
          <li className={pubCode === 'ok' ? 'text-ok' : 'text-bad'} data-code={pubCode}>{pubCode === 'ok' ? t('m30.ed.checkPubOk') : t(`m30.ed.code.${pubCode}`)}</li>
          {banned && <li className="text-bad" data-testid="m30-ed-banned">{t('m30.ed.bannedFound', { word: banned })}</li>}
        </ul>
        <p className="mt-2 text-[12px] text-ink-3">{t('m30.ed.rule')} <WhyThis reasons={[{ code: 'copy_rule', key: 'm30.reasons.copy_rule', vars: {} }]} testId="m30-ed-rule-why" /></p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-outline" disabled={draftCode !== 'ok'} onClick={() => save(false)} data-testid="m30-ed-save">{t('m30.ed.save')}</button>
          <button type="button" className="btn-primary" disabled={pubCode !== 'ok'} onClick={() => setConfirm(true)} data-testid="m30-ed-publish">{t('m30.ed.publish')}</button>
        </div>
      </Card>
      {row && (row.history as Row[]).length > 0 && (
        <Card title={t('m30.ed.history')}>
          <ol className="space-y-2 text-[13px]" data-testid="m30-ed-history">
            {[...(row.history as Row[])].reverse().map((h) => (
              <li key={h.version} className="rounded-card border border-line p-2.5">
                <div className="flex flex-wrap items-center gap-2"><span className="chip border-line bg-sunken text-ink-2">{t('m30.my.version', { v: f.num(h.version) })}</span><span className="text-ink-3">{f.date(h.published_at)}</span></div>
                <p className="mt-1 text-ink-2">{pick(h, 'summary')}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m30.ed.confirmTitle')} consequence={t('m30.ed.confirmBody')} confirmLabel={t('m30.ed.publish')}
        onConfirm={async () => { await save(true); setConfirm(false); }} />
    </div>
  );
}
