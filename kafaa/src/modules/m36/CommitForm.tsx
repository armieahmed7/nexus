// FS64 commit / revise form (provider administrators: ecosystem OrgW). The live check is the RPC's own rule (commitmentProblem, the SQL
// twin kafaa_rg_commit_problem), so the form shows exactly what the server will refuse; a ConfirmDialog precedes rpc.commitProvision.
// Started terms of a revision are locked (shown, not editable).
import { useMemo, useState } from 'react';
import { useAction, useRepo } from '../../data';
import { ConfirmDialog, Modal, TextField, TextArea, SelectField, CheckboxField } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { KINDS, commitmentProblem, lockedTerms, openTerms, type CommitmentInput, type PlanEntry } from './regional';
import { useTermLabel, type Row } from './ui';

export function CommitForm({ open, onClose, current, demand, skills, onDone }: {
  open: boolean; onClose: () => void; current?: Row | null; demand: Row[]; skills: Map<string, Row> | undefined; onDone?: (id: string) => void;
}) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const termLabel = useTermLabel();
  const pick = usePick();
  const today = todayIso();
  const areas = useMemo(() => [...new Set(demand.filter((d) => d.status === 'current').map((d) => String(d.area)))], [demand]);
  const locked: PlanEntry[] = current ? lockedTerms(current.plan as PlanEntry[], today) : [];
  const [area, setArea] = useState<string>(current?.area ?? areas[0] ?? '');
  const [kind, setKind] = useState<string>(current?.kind ?? 'cohort');
  const [titleEn, setTitleEn] = useState<string>(current?.title_en ?? '');
  const [titleAr, setTitleAr] = useState<string>(current?.title_ar ?? '');
  const [sumEn, setSumEn] = useState<string>(current?.summary_en ?? '');
  const [sumAr, setSumAr] = useState<string>(current?.summary_ar ?? '');
  const [level, setLevel] = useState<string>(String(current?.level ?? 2));
  const [skillIds, setSkillIds] = useState<string[]>((current?.skill_ids as string[]) ?? []);
  const terms = useMemo(() => [...new Set([...locked.map((l) => l.term), ...openTerms(today)])], [locked, today]);
  const [seats, setSeats] = useState<Record<string, string>>(Object.fromEntries(((current?.plan as PlanEntry[]) ?? []).map((p) => [p.term, String(p.seats)])));
  const [confirm, setConfirm] = useState(false);
  const allAreas = current && !areas.includes(current.area) ? [...areas, current.area] : areas;
  const areaSkills = [...(skills?.values() ?? [])].filter((s) => s.area === area && s.lifecycle !== 'obsolete' && s.area !== 'security').sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const plan: PlanEntry[] = terms.filter((x) => seats[x] && seats[x].trim() !== '').map((x) => ({ term: x, seats: Number(seats[x]) }));
  const input: CommitmentInput = {
    ...(current ? { id: current.id, action: 'revise' as const } : { action: 'create' as const }),
    area, kind, title_en: titleEn, title_ar: titleAr, summary_en: sumEn, summary_ar: sumAr, skill_ids: skillIds.filter((id) => areaSkills.some((s) => s.id === id)), level: Number(level), plan,
  };
  const ctxSkills = Object.fromEntries([...(skills?.values() ?? [])].map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
  const problem = commitmentProblem(input, { areas: allAreas, skills: ctxSkills, today }, locked);
  const gapOf = (a: string) => demand.find((d) => d.status === 'current' && d.area === a && Number(d.year) === 2030)?.gap_plan;
  const submit = async () => {
    const r = await run(() => repo.rpc.commitProvision(input));
    if (r.ok && r.data) { onDone?.(r.data.id); onClose(); }
  };
  return (
    <>
      <Modal open={open} onClose={onClose} size="lg" title={current ? t('m36.form.reviseTitle') : t('m36.form.title')}
        footer={<>
          <button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m36-commit-submit">{current ? t('m36.form.saveRevision') : t('m36.form.save')}</button>
        </>}>
        <div className="space-y-3" data-testid="m36-commit-form">
          <p className="text-[12.5px] text-ink-2">{t('m36.form.intro')}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SelectField name="area" label={t('m36.form.area')} value={area} onChange={(v) => { setArea(v); setSkillIds([]); }}
              options={allAreas.map((a) => { const g = gapOf(a); return { value: a, label: `${t(`m36.area.${a}`)}${g != null ? ` · ${t('m36.form.gapHint', { n: f.num(Number(g)) })}` : ''}` }; })} />
            <SelectField name="kind" label={t('m36.form.kind')} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(`m36.kind.${k}`) }))} />
            <SelectField name="level" label={t('m36.form.level')} value={level} onChange={setLevel} options={[1, 2, 3, 4].map((l) => ({ value: String(l), label: t(`m36.level.${l}`) }))} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextField name="title_en" label={t('m36.form.titleEn')} value={titleEn} onChange={setTitleEn} />
            <TextField name="title_ar" label={t('m36.form.titleAr')} value={titleAr} onChange={setTitleAr} />
            <TextArea name="summary_en" label={t('m36.form.summaryEn')} value={sumEn} onChange={setSumEn} rows={3} />
            <TextArea name="summary_ar" label={t('m36.form.summaryAr')} value={sumAr} onChange={setSumAr} rows={3} />
          </div>
          <fieldset className="rounded-card border border-line p-3">
            <legend className="px-1 text-[13px] font-semibold">{t('m36.form.skills')}</legend>
            {areaSkills.length ? <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
              {areaSkills.map((s) => <CheckboxField key={s.id} label={pick(s, 'name')} checked={skillIds.includes(s.id)}
                onChange={(v) => setSkillIds((xs) => (v ? [...xs, s.id] : xs.filter((x) => x !== s.id)))} />)}
            </div> : <p className="text-[12px] text-ink-3">{t('m36.form.noSkills')}</p>}
          </fieldset>
          <fieldset className="rounded-card border border-line p-3">
            <legend className="px-1 text-[13px] font-semibold">{t('m36.form.plan')}</legend>
            <p className="mb-2 text-[12px] text-ink-3">{t('m36.form.planHint')}</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="m36-commit-plan">
              {terms.map((x) => {
                const lk = locked.find((l) => l.term === x);
                return (
                  <label key={x} className="block text-[12.5px]" data-term={x}>
                    <span className="block font-medium">{termLabel(x)}{lk ? ` · ${t('m36.form.locked')}` : ''}</span>
                    <input type="number" min={1} max={500} inputMode="numeric" className="input mt-0.5 w-full" value={seats[x] ?? ''} disabled={!!lk}
                      aria-label={t('m36.form.seatsFor', { term: termLabel(x) })} onChange={(e) => setSeats((m) => ({ ...m, [x]: e.target.value }))} />
                  </label>
                );
              })}
            </div>
          </fieldset>
          {problem
            ? <p className="text-[12.5px] text-bad" data-testid="m36-commit-problem" data-problem={problem}>{t(`m36.problem.commit.${problem}`)}</p>
            : <p className="text-[12.5px] text-ok" data-testid="m36-commit-ready">{t('m36.form.ready', { n: f.num(plan.length), seats: f.num(plan.reduce((x, p) => x + p.seats, 0)) })}</p>}
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={current ? t('m36.form.confirmRevise') : t('m36.form.confirm')}
        consequence={t('m36.form.consequence')} actingAs={t('m36.form.actingAs')} confirmLabel={current ? t('m36.form.saveRevision') : t('m36.form.save')}
        onConfirm={async () => { await submit(); setConfirm(false); }} />
    </>
  );
}
