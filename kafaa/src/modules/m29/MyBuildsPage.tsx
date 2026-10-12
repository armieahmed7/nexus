// FS80 /my/ai-fluency/builds (ai_literacy Own): what I built and shared. My entries in every status (a returned entry shows AI
// governance's note), their adoption counters and my builder credit (F01 evidence, written only once an entry is approved and has its
// first adopter), the entries I adopted, and the editor: describe a governed automation or agent as metadata only (purpose, data used,
// accountable owner, human check, how to use, the AI-system register row) and save a draft or submit it (rpc.submitAutomation behind a
// ConfirmDialog). The same check as the server runs before sending (automationProblem): no code, links, credentials or plant security.
import { useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, Drawer, ConfirmDialog, TextField, TextArea, SelectField, CheckboxField, Icon, WhyThis } from '../../ui';
import { useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { AUTOMATION_KINDS, DATA_CLASSES, LIMITS, automationProblem, builderLevel, creditReasons, editable, type AutomationInput } from './automations';
import { AtmStatus, Counter, KindChip, MetadataNotice, SystemLink, useAtmRun, useGallery, type GalleryData } from './fs80ui';
import { RungPill, type Row } from './ui';

export default function MyBuildsPage() {
  const t = useT();
  const q = useGallery();
  return (
    <Page title={t('m29.routes.my-ai-builds.title')} intro={t('m29.atm.my.intro')} wide eyebrow={<BenchmarkChips feature="FS80" />}
      actions={<L to="/workforce/ai-automations" className="btn-outline btn-sm no-underline">{t('m29.atm.my.toGallery')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Body d={d} reload={q.reload} />}</Async>
    </Page>
  );
}

const blank = (): AutomationInput => ({ title_en: '', title_ar: '', kind: 'workflow', purpose_en: '', purpose_ar: '', data_used_en: '', data_used_ar: '', data_classes: ['internal'], system_id: '',
  owner_person_id: '', oversight_en: '', oversight_ar: '', benefit_en: '', benefit_ar: '', how_en: '', how_ar: '', min_rung: 1, action: 'submit' });
const fromRow = (a: Row): AutomationInput => ({
  id: a.id, title_en: a.title_en, title_ar: a.title_ar, kind: a.kind, purpose_en: a.purpose_en, purpose_ar: a.purpose_ar, data_used_en: a.data_used_en, data_used_ar: a.data_used_ar,
  data_classes: [...(a.data_classes ?? [])], system_id: a.system_id, owner_person_id: a.owner_person_id, oversight_en: a.oversight_en, oversight_ar: a.oversight_ar,
  benefit_en: a.benefit_en, benefit_ar: a.benefit_ar, how_en: a.how_en, how_ar: a.how_ar, min_rung: Number(a.min_rung), action: 'submit',
});

function Body({ d, reload }: { d: GalleryData; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [edit, setEdit] = useState<AutomationInput | null>(null);
  const mine = d.entries.filter((a: Row) => a.builder_person_id === d.pid);
  const sysOf = (id: string) => d.systems.find((s: Row) => s.id === id);
  const adopters = mine.reduce((m: number, a: Row) => m + Number(a.adoption_count), 0);
  const best = mine.reduce((m: number, a: Row) => Math.max(m, builderLevel(a.status, Number(a.adoption_count))), 0);
  const adoptedRows = d.mine.map((x: Row) => ({ x, a: d.entries.find((a: Row) => a.id === x.automation_id) })).filter((r) => r.a);
  return (
    <div className="space-y-6">
      <MetadataNotice />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m29-atm-my-tiles">
        <StatTile label={t('m29.atm.my.tile.entries')} value={f.num(mine.length)} />
        <StatTile label={t('m29.atm.my.tile.approved')} value={f.num(mine.filter((a: Row) => a.status === 'approved').length)} tone="ok" />
        <StatTile label={t('m29.atm.my.tile.adopters')} value={f.num(adopters)} sub={t('m29.atm.my.tile.adoptersSub')} />
        <StatTile label={t('m29.atm.my.tile.credit')} value={best ? t('m29.atm.credit.levelShort', { n: f.num(best) }) : '—'} sub={t('m29.atm.my.tile.creditSub')} />
      </div>
      <Section title={t('m29.atm.my.list.title')} description={t('m29.atm.my.list.intro')}
        actions={<button type="button" className="btn-primary btn-sm" data-testid="m29-atm-new" onClick={() => setEdit(blank())}><Icon name="plus" size={14} /> {t('m29.atm.my.new')}</button>}>
        {mine.length ? (
          <ul className="space-y-3" data-testid="m29-atm-my-list">
            {mine.map((a: Row) => {
              const lvl = builderLevel(a.status, Number(a.adoption_count));
              return (
                <li key={a.id} className="card space-y-2 p-4" data-testid="m29-atm-my-item" data-id={a.id} data-status={a.status}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5"><AtmStatus status={a.status} /><KindChip kind={a.kind} />
                      <L to={`/workforce/ai-automations/${a.id}`} className="min-w-0 break-words font-semibold">{pick(a, 'title')}</L></span>
                    {editable(a.status) && <button type="button" className="btn-outline btn-sm" data-testid="m29-atm-edit" onClick={() => setEdit(fromRow(a))}>{a.status === 'returned' ? t('m29.atm.my.fix') : t('m29.atm.my.edit')}</button>}
                  </div>
                  {a.status === 'returned' && a.decision_note && <Callout tone="sim" title={t('m29.atm.one.returned')}><span data-testid="m29-atm-my-note">{a.decision_note}</span></Callout>}
                  <SystemLink sys={sysOf(a.system_id)} />
                  <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-ink-3">
                    <Counter n={Number(a.adoption_count)} />
                    <span>{lvl ? t('m29.atm.credit.levelShort', { n: f.num(lvl) }) : t('m29.atm.credit.none')}</span>
                    <WhyThis reasons={creditReasons(a as never)} testId="m29-atm-my-why" />
                    <span>{t('m29.atm.one.version')} {f.num(Number(a.version))}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title={t('m29.atm.my.none')}>{t('m29.atm.my.noneBody')}</EmptyState>}
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m29.atm.my.evidence.title')} eyebrow={t('m29.atm.my.evidence.eyebrow')}>
          {d.evidence.length ? (
            <ul className="space-y-1.5 text-[13px]" data-testid="m29-atm-my-evidence">
              {d.evidence.map((e: Row) => { const a = d.entries.find((x: Row) => x.id === e.ref_id); return (
                <li key={e.id} className="flex flex-wrap items-center gap-2"><span className="chip border-ok-line bg-ok-bg normal-case tracking-normal text-ok">{t('m29.atm.credit.levelShort', { n: f.num(Number(e.level)) })}</span>
                  <span className="min-w-0 break-words">{a ? pick(a, 'title') : e.ref_id}</span><span className="text-ink-3">{f.date(String(e.observed_on))}</span></li>
              ); })}
            </ul>
          ) : <p className="text-[13px] text-ink-3" data-testid="m29-atm-my-evidence-none">{t('m29.atm.my.evidence.none')}</p>}
          <p className="mt-2 text-[12px] text-ink-3">{t('m29.atm.my.evidence.note')} <L to="/my/skills">{t('m29.atm.my.evidence.passport')}</L></p>
        </Card>
        <Card title={t('m29.atm.my.adopted.title')}>
          {adoptedRows.length ? (
            <ul className="space-y-1.5 text-[13px]" data-testid="m29-atm-my-adopted">
              {adoptedRows.map(({ x, a }) => <li key={x.id} className="flex flex-wrap items-center gap-2"><L to={`/workforce/ai-automations/${a.id}`} className="min-w-0 break-words">{pick(a, 'title')}</L><span className="text-ink-3">{f.date(String(x.adopted_on))}</span></li>)}
            </ul>
          ) : <p className="text-[13px] text-ink-3">{t('m29.atm.my.adopted.none')}</p>}
        </Card>
      </div>
      {edit && <Editor init={edit} d={d} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload?.(); }} />}
    </div>
  );
}

function Editor({ init, d, onClose, onSaved }: { init: AutomationInput; d: GalleryData; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAtmRun();
  const [v, setV] = useState<AutomationInput>(init);
  const [confirm, setConfirm] = useState<'draft' | 'submit' | null>(null);
  const set = <K extends keyof AutomationInput>(k: K, x: AutomationInput[K]) => setV((o) => ({ ...o, [k]: x }));
  const systems = d.systems.filter((s: Row) => s.status === 'published');
  // Accountable owner: me, the chosen AI system's owner (from the register row) or the entry's current owner (names on the rows).
  const chosen = d.systems.find((s: Row) => s.id === v.system_id);
  const owners = new Map<string, string>();
  if (d.pid) owners.set(d.pid, d.person ? pick(d.person, 'display_name') : t('m29.atm.ed.me'));
  if (chosen?.owner_person_id) owners.set(chosen.owner_person_id, `${pick(chosen, 'owner')} · ${t('m29.atm.ed.systemOwner')}`);
  if (init.owner_person_id && init.id) { const row = d.entries.find((a: Row) => a.id === init.id); if (row && !owners.has(init.owner_person_id)) owners.set(init.owner_person_id, pick(row, 'owner')); }
  const problem = automationProblem({ ...v, action: 'submit' }, { systems: d.systems.map((s: Row) => ({ id: s.id, status: s.status })), staff: [...owners.keys()] });
  const lim = (k: keyof typeof LIMITS) => t('m29.atm.ed.limit', { n: LIMITS[k] });
  const pair = (k: 'title' | 'purpose' | 'data_used' | 'oversight' | 'benefit' | 'how', limit: keyof typeof LIMITS, area = true) => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {(['en', 'ar'] as const).map((l) => {
        const key = `${k}_${l}` as keyof AutomationInput;
        const common = { label: t(`m29.atm.ed.${k}_${l}`), name: key, value: String(v[key] ?? ''), onChange: (x: string) => set(key, x as never), hint: lim(limit) };
        return area ? <TextArea key={l} rows={2} {...common} /> : <TextField key={l} {...common} />;
      })}
    </div>
  );
  return (
    <Drawer open onClose={onClose} title={init.id ? t('m29.atm.ed.editTitle') : t('m29.atm.ed.newTitle')}
      footer={<>
        <button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn-outline" data-testid="m29-atm-save-draft" onClick={() => setConfirm('draft')}>{t('m29.atm.ed.saveDraft')}</button>
        <button type="button" className="btn-primary" data-testid="m29-atm-submit" disabled={!!problem} onClick={() => setConfirm('submit')}>{t('m29.atm.ed.submit')}</button>
      </>}>
      <div className="space-y-3" data-testid="m29-atm-editor">
        <Callout tone="info" title={t('m29.atm.ed.rules.title')}>{t('m29.atm.ed.rules.body')}</Callout>
        {pair('title', 'title', false)}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SelectField label={t('m29.atm.ed.kind')} name="kind" value={v.kind} options={AUTOMATION_KINDS.map((k) => ({ value: k, label: t(`m29.atm.kind.${k}`) }))} onChange={(x) => set('kind', x)} />
          <SelectField label={t('m29.atm.ed.system')} name="system" value={v.system_id} placeholder={t('m29.atm.ed.systemPick')} options={systems.map((s: Row) => ({ value: s.id, label: pick(s, 'name') }))} onChange={(x) => set('system_id', x)} hint={t('m29.atm.ed.systemHint')} />
          <SelectField label={t('m29.atm.ed.owner')} name="owner" value={v.owner_person_id} placeholder={t('m29.atm.ed.ownerPick')} options={[...owners.entries()].map(([value, label]) => ({ value, label }))} onChange={(x) => set('owner_person_id', x)} />
          <SelectField label={t('m29.atm.ed.rung')} name="rung" value={String(v.min_rung)} options={[1, 2, 3].map((r) => ({ value: String(r), label: t(`m29.rung.${['aware', 'practitioner', 'builder'][r - 1]}`) }))} onChange={(x) => set('min_rung', Number(x))} hint={t('m29.atm.ed.rungHint')} />
        </div>
        {v.system_id && <SystemLink sys={d.systems.find((s: Row) => s.id === v.system_id)} />}
        {pair('purpose', 'purpose')}
        {pair('data_used', 'data')}
        <fieldset className="space-y-1">
          <legend className="caps mb-1">{t('m29.atm.ed.classes')}</legend>
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            {DATA_CLASSES.map((c) => <CheckboxField key={c} label={t(`m29.atm.class.${c}`)} hint={t(`m29.atm.classHelp.${c}`)} checked={v.data_classes.includes(c)} onChange={(on) => set('data_classes', on ? [...v.data_classes, c] : v.data_classes.filter((x) => x !== c))} />)}
          </div>
        </fieldset>
        {pair('oversight', 'oversight')}
        {pair('how', 'how')}
        {pair('benefit', 'benefit')}
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]" data-testid="m29-atm-check" data-problem={problem ?? 'none'}>
          {problem ? <><Icon name="alert" size={14} /><span className="text-bad">{t(`m29.atm.problem.${problem}`)}</span></> : <><Icon name="check" size={14} /><span className="text-ok">{t('m29.atm.ed.ready')}</span></>}
          <span className="text-ink-3">{t('m29.atm.ed.minRung')}</span> <RungPill rung={v.min_rung} />
        </div>
      </div>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'submit' ? t('m29.atm.ed.confirm.submitTitle') : t('m29.atm.ed.confirm.draftTitle')}
        consequence={confirm === 'submit' ? t('m29.atm.ed.confirm.submit') : t('m29.atm.ed.confirm.draft')}
        onConfirm={async () => { const r = await run(() => repo.rpc.submitAutomation({ ...v, action: confirm ?? 'draft' }), confirm === 'submit' ? 'm29.atm.ok.submitted' : 'm29.atm.ok.draft'); setConfirm(null); if (r.ok) onSaved(); }} />
    </Drawer>
  );
}
