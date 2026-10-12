// FS66 University programme alignment: shared UI parts (world loader, status pill, coverage block, criteria checklist, programme editor).
// Rules: ./alignment.ts (the same functions the backends and the PGlite validator use). Pages never compute access themselves: rows come
// from the repository (RLS: a partner university reads only its own programmes).
import { useMemo, useState, type ReactNode } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { BenchmarkLine, Card, CheckboxField, ConfirmDialog, Drawer, Icon, KeyValue, ProgressBar, SelectField, SimChip, StatusPill, TextArea, TextField, WhyThis, type PillTone } from '../../ui';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import type { Reason } from '../../domain/engines/types';
import { restrictedSkills } from '../m25/coverage';
import {
  AUTO_CRITERIA, COVERAGE_MIN, DEGREES, REVIEW_CRITERIA, UA_LEVEL_MAX, anchorsOf, autoCriteria, displayStatus, programmeCoverage, programmeProblem,
  type AutoCriteria, type ProgrammeCoverage, type ProgrammeInput, type UaWorld,
} from './alignment';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const today = () => new Date().toISOString().slice(0, 10);

/** Reference tables the FS66 rules need (all readable by universities, reviewers and HR). */
export function useUaWorld() {
  const repo = useRepo();
  return useQuery(['skills', 'competencies', 'job_roles', 'role_profile_versions', 'skill_alignments', 'organisations'], async (): Promise<UaWorld> => {
    const [skills, competencies, job_roles, role_profile_versions, skill_alignments, organisations] = await Promise.all([
      repo.list('skills'), repo.list('competencies'), repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('role_profile_versions'), repo.list('skill_alignments'), repo.list('organisations'),
    ]);
    return { skills, competencies, job_roles, role_profile_versions, skill_alignments, organisations } as unknown as UaWorld;
  });
}

const TONE: Record<string, PillTone> = { draft: 'neutral', submitted: 'info', endorsed: 'ok', returned: 'bad', lapsed: 'sim' };
export function UaStatusPill({ row }: { row: Row }) {
  const t = useT();
  const s = displayStatus(row, today());
  return <StatusPill tone={TONE[s]}><span data-testid="m10-ua-status" data-status={s}>{t(`m10.ua.status.${s}`)}</span></StatusPill>;
}

export function useNames(w: UaWorld | undefined) {
  const pick = usePick();
  return useMemo(() => {
    const sk = new Map((w?.skills ?? []).map((s) => [String(s.id), s]));
    const jr = new Map((w?.job_roles ?? []).map((r) => [String(r.id), r]));
    const org = new Map((w?.organisations ?? []).map((o) => [String(o.id), o]));
    return {
      skill: (id: string) => pick(sk.get(id), 'name') || id,
      role: (id: string) => pick(jr.get(id), 'title') || id,
      org: (id: string | null | undefined) => (id ? pick(org.get(id), 'name') || id : ''),
      skillRow: (id: string) => sk.get(id),
      roleRow: (id: string) => jr.get(id),
    };
  }, [w, pick]);
}

/** Reasons behind a coverage score (WhyThis): one per role and horizon, plus the threshold. */
export function coverageReasons(cov: ProgrammeCoverage, w: UaWorld): Reason[] {
  const jr = new Map(w.job_roles.map((r) => [String(r.id), r]));
  const out: Reason[] = cov.roles.map((r) => ({
    code: 'ua_role', key: 'm10.reasons.ua_role',
    vars: { role: { en: String(jr.get(r.role_id)?.title_en ?? r.role_id), ar: String(jr.get(r.role_id)?.title_ar ?? r.role_id) }, horizon: r.horizon, covered: r.covered, n: r.n, score: r.score ?? 0 },
  }));
  out.push({ code: 'ua_rule', key: 'm10.reasons.ua_rule', vars: { min: COVERAGE_MIN } });
  return out;
}

/** Coverage by role and horizon with the uncovered skills, the best score against the endorsement threshold and the FS57 rule note. */
export function CoverageBlock({ cov, w, compact }: { cov: ProgrammeCoverage; w: UaWorld; compact?: boolean }) {
  const t = useT();
  const f = useFormat();
  const n = useNames(w);
  return (
    <div className="space-y-3" data-testid="m10-ua-coverage">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-sunken p-3"><div className="caps">{t('m10.ua.cov.now')}</div><div className="num text-[22px] font-semibold" data-testid="m10-ua-cov-now">{cov.now == null ? '—' : f.num(cov.now)}</div></div>
        <div className="rounded-card border border-line bg-sunken p-3"><div className="caps">{t('m10.ua.cov.h2030')}</div><div className="num text-[22px] font-semibold" data-testid="m10-ua-cov-2030">{cov.h2030 == null ? '—' : f.num(cov.h2030)}</div></div>
        <div className="rounded-card border border-line bg-sunken p-3"><div className="caps">{t('m10.ua.cov.best')}</div><div className="num text-[22px] font-semibold" data-testid="m10-ua-cov-best">{cov.best == null ? '—' : f.num(cov.best)}</div></div>
      </div>
      <BenchmarkLine value={cov.best} max={100} label={t('m10.ua.cov.lineLabel')} lines={[{ kind: 'target', label: t('m10.ua.cov.threshold'), value: COVERAGE_MIN }]} compact={compact} />
      {!compact && (
        <ul className="space-y-2">
          {cov.roles.map((r) => (
            <li key={`${r.role_id}-${r.horizon}`} className="rounded-card border border-line p-3" data-testid="m10-ua-cov-role">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{n.role(r.role_id)} <span className="chip border-line bg-sunken text-ink-2">{t(`m10.ua.cov.hz.${r.horizon}`)}</span></span>
                <span className="num font-semibold">{r.score == null ? '—' : f.num(r.score)} <span className="text-[12px] font-normal text-ink-3">{t('m10.ua.cov.coveredOf', { covered: f.num(r.covered), n: f.num(r.n) })}</span></span>
              </div>
              <ProgressBar value={r.score ?? 0} />
              {r.uncovered.length > 0 && (
                <p className="mt-1 text-[12.5px] text-ink-3">{t('m10.ua.cov.uncovered')}: {r.uncovered.map((s) => n.skill(s)).join(' · ')}</p>
              )}
            </li>
          ))}
          {cov.roles.length === 0 && <li className="text-ink-3">{t('m10.ua.cov.noRoles')}</li>}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
        <WhyThis reasons={coverageReasons(cov, w)} testId="m10-ua-why" />
        <span>{t('m10.ua.cov.rule')}</span>
      </div>
    </div>
  );
}

export function CriteriaList({ auto, review }: { auto: AutoCriteria; review?: Partial<Record<string, boolean>> }) {
  const t = useT();
  const mark = (okv: boolean | undefined) => (okv ? <Icon name="check" size={14} className="text-ok" /> : <Icon name="close" size={14} className="text-bad" />);
  return (
    <ul className="space-y-1.5 text-[13.5px]" data-testid="m10-ua-criteria">
      {AUTO_CRITERIA.map((k) => (
        <li key={k} className="flex items-start gap-2" data-testid={`m10-ua-crit-${k}`} data-ok={auto[k] ? 'yes' : 'no'}>{mark(auto[k])}<span>{t(`m10.ua.crit.${k}`, { min: COVERAGE_MIN })} <span className="text-[11.5px] text-ink-3">({t('m10.ua.crit.computed')})</span></span></li>
      ))}
      {review && REVIEW_CRITERIA.map((k) => (
        <li key={k} className="flex items-start gap-2" data-testid={`m10-ua-crit-${k}`}>{mark(review[k])}<span>{t(`m10.ua.crit.${k}`)} <span className="text-[11.5px] text-ink-3">({t('m10.ua.crit.reviewer')})</span></span></li>
      ))}
    </ul>
  );
}

/** International anchors of one skill from the FS08 crosswalk. */
export function Anchors({ skillId, w }: { skillId: string; w: UaWorld }) {
  const a = anchorsOf(skillId, w.skill_alignments).slice(0, 3);
  return (
    <span className="flex flex-wrap gap-1">
      {a.map((x, i) => <span key={i} className="chip border-line bg-sunken text-[11px] text-ink-2" title={x.code}>{x.framework.toUpperCase()}</span>)}
    </span>
  );
}

// ───────────── editor
interface SkillLine { skill_id: string; level: string; modules: string }
interface Draft { id: string | null; org: string; code: string; title_en: string; title_ar: string; degree: string; nqf: string; field_en: string; field_ar: string; summary_en: string; summary_ar: string;
  roles: string[]; skills: SkillLine[]; placement: boolean; accreditation: string }
const toDraft = (r: Row | null, org: string): Draft => ({
  id: r?.id ?? null, org: r?.university_org_id ?? org, code: r?.code ?? '', title_en: r?.title_en ?? '', title_ar: r?.title_ar ?? '', degree: r?.degree ?? 'bachelor', nqf: r?.nqf_level != null ? String(r.nqf_level) : '',
  field_en: r?.field_en ?? '', field_ar: r?.field_ar ?? '', summary_en: r?.summary_en ?? '', summary_ar: r?.summary_ar ?? '', roles: [...(r?.target_role_ids ?? [])],
  skills: (r?.skills ?? []).map((s: Row) => ({ skill_id: s.skill_id, level: String(s.level), modules: (s.modules ?? []).join('; ') })), placement: r?.placement ?? false, accreditation: r?.accreditation_ref ?? '',
});
export function draftInput(d: Draft, submit: boolean): ProgrammeInput {
  return {
    ...(d.id ? { id: d.id } : {}), university_org_id: d.org, code: d.code, title_en: d.title_en, title_ar: d.title_ar, degree: d.degree, nqf_level: d.nqf === '' ? null : Number(d.nqf),
    field_en: d.field_en, field_ar: d.field_ar, summary_en: d.summary_en, summary_ar: d.summary_ar, target_role_ids: d.roles,
    skills: d.skills.filter((s) => s.skill_id).map((s) => ({ skill_id: s.skill_id, level: Number(s.level), modules: s.modules.split(';').map((m) => m.trim()).filter(Boolean) })),
    placement: d.placement, accreditation_ref: d.accreditation, submit,
  };
}

/** Create or edit a programme (university for its own organisation; partnerships admins on behalf). Live coverage preview with the same rule. */
export function ProgrammeEditor({ open, onClose, row, org, orgChoices, w }: { open: boolean; onClose: () => void; row: Row | null; org: string; orgChoices?: Row[]; w: UaWorld }) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const n = useNames(w);
  const [d, setD] = useState<Draft>(() => toDraft(row, org));
  const [confirm, setConfirm] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const restricted = useMemo(() => restrictedSkills(w.skills, w.competencies), [w]);
  const skillOpts = useMemo(() => w.skills.filter((s) => !restricted.has(String(s.id)) && s.lifecycle !== 'obsolete').map((s) => ({ value: String(s.id), label: pick(s, 'name') }))
    .sort((a, b) => a.label.localeCompare(b.label, lang)), [w, restricted, pick, lang]);
  const roles = w.job_roles.filter((r) => r.lifecycle !== 'concept' && !r.security_sensitive);
  const input = draftInput(d, false);
  const problem = programmeProblem(input, w);
  const cov = programmeCoverage(input, w);
  const auto = autoCriteria(input, w);
  const save = async (submit: boolean) => {
    const r = await run(() => repo.rpc.saveProgramme(draftInput(d, submit)));
    if (r.ok) { setConfirm(false); onClose(); }
  };
  return (
    <Drawer open={open} onClose={onClose} title={row ? t('m10.ua.ed.editTitle', { code: row.code }) : t('m10.ua.ed.newTitle')}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => save(false)} disabled={!!problem} data-testid="m10-ua-save">{t('m10.ua.ed.saveDraft')}</button>
          <button type="button" className="btn-primary" onClick={() => setConfirm(true)} disabled={!!problem} data-testid="m10-ua-submit">{t('m10.ua.ed.submit')}</button>
        </div>
      }>
      <div className="space-y-4" data-testid="m10-ua-editor">
        <SimChip label={t('m10.ua.sampleChip')} />
        {orgChoices && !row && (
          <SelectField label={t('m10.ua.ed.university')} name="org" value={d.org} onChange={(v) => set({ org: v })} options={orgChoices.map((o) => ({ value: String(o.id), label: pick(o, 'name') }))} />
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t('m10.ua.ed.code')} name="code" value={d.code} onChange={(v) => set({ code: v })} required disabled={!!row} />
          <SelectField label={t('m10.ua.ed.degree')} name="degree" value={d.degree} onChange={(v) => set({ degree: v })} options={DEGREES.map((x) => ({ value: x, label: t(`m10.ua.degree.${x}`) }))} />
          <TextField label={t('m10.ua.ed.titleEn')} name="title_en" value={d.title_en} onChange={(v) => set({ title_en: v })} required />
          <TextField label={t('m10.ua.ed.titleAr')} name="title_ar" value={d.title_ar} onChange={(v) => set({ title_ar: v })} required />
          <TextField label={t('m10.ua.ed.nqf')} name="nqf" type="number" value={d.nqf} onChange={(v) => set({ nqf: v })} hint={t('m10.ua.ed.nqfHint')} />
          <TextField label={t('m10.ua.ed.accreditation')} name="acc" value={d.accreditation} onChange={(v) => set({ accreditation: v })} />
          <TextField label={t('m10.ua.ed.fieldEn')} name="field_en" value={d.field_en} onChange={(v) => set({ field_en: v })} />
          <TextField label={t('m10.ua.ed.fieldAr')} name="field_ar" value={d.field_ar} onChange={(v) => set({ field_ar: v })} />
        </div>
        <CheckboxField label={t('m10.ua.ed.placement')} checked={d.placement} onChange={(v) => set({ placement: v })} />
        <fieldset>
          <legend className="caps mb-1">{t('m10.ua.ed.roles')}</legend>
          <div className="flex flex-wrap gap-2" data-testid="m10-ua-ed-roles">
            {roles.map((r) => {
              const on = d.roles.includes(String(r.id));
              return (
                <label key={r.id} className={`chip cursor-pointer ${on ? 'border-accent/40 bg-accent-soft text-eyebrow' : 'border-line bg-sunken text-ink-2'}`}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={(e) => set({ roles: e.target.checked ? [...d.roles, String(r.id)] : d.roles.filter((x) => x !== r.id) })} />
                  {pick(r, 'title')}
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="caps mb-1">{t('m10.ua.ed.skills')}</legend>
          {d.skills.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-card border border-line p-2 sm:grid-cols-[2fr_1fr_3fr_auto]" data-testid="m10-ua-ed-skill">
              <SelectField label={t('m10.ua.ed.skill')} name={`sk-${i}`} value={s.skill_id} onChange={(v) => set({ skills: d.skills.map((x, j) => (j === i ? { ...x, skill_id: v } : x)) })} options={skillOpts} />
              <SelectField label={t('m10.ua.ed.level')} name={`lv-${i}`} value={s.level} onChange={(v) => set({ skills: d.skills.map((x, j) => (j === i ? { ...x, level: v } : x)) })}
                options={Array.from({ length: UA_LEVEL_MAX }, (_, k) => ({ value: String(k + 1), label: String(k + 1) }))} />
              <TextField label={t('m10.ua.ed.modules')} name={`md-${i}`} value={s.modules} onChange={(v) => set({ skills: d.skills.map((x, j) => (j === i ? { ...x, modules: v } : x)) })} hint={t('m10.ua.ed.modulesHint')} />
              <button type="button" className="btn-ghost btn-sm self-end" aria-label={t('m10.ua.ed.removeSkill')} onClick={() => set({ skills: d.skills.filter((_, j) => j !== i) })}><Icon name="close" size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn-outline btn-sm" onClick={() => set({ skills: [...d.skills, { skill_id: '', level: '1', modules: '' }] })} data-testid="m10-ua-ed-add"><Icon name="plus" size={14} />{t('m10.ua.ed.addSkill')}</button>
          <p className="text-[12px] text-ink-3">{t('m10.ua.ed.ceiling', { max: UA_LEVEL_MAX })}</p>
        </fieldset>
        <TextArea label={t('m10.ua.ed.summaryEn')} name="summary_en" value={d.summary_en} onChange={(v) => set({ summary_en: v })} rows={2} />
        <TextArea label={t('m10.ua.ed.summaryAr')} name="summary_ar" value={d.summary_ar} onChange={(v) => set({ summary_ar: v })} rows={2} />
        <Card title={t('m10.ua.ed.preview')}>
          <CoverageBlock cov={cov} w={w} compact />
          <div className="mt-3"><CriteriaList auto={auto} /></div>
          {d.skills.length > 0 && <p className="mt-2 text-[12px] text-ink-3">{d.skills.filter((s) => s.skill_id).map((s) => n.skill(s.skill_id)).join(' · ')}</p>}
        </Card>
        {problem && <p className="text-[12.5px] text-bad" role="status" data-testid="m10-ua-problem">{t(`m10.ua.problem.${problem}`)}</p>}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m10.ua.ed.submit')} consequence={t('m10.ua.ed.submitConsequence')} confirmLabel={t('m10.ua.ed.submit')} onConfirm={() => save(true)} />
    </Drawer>
  );
}

/** Small summary card of a programme (workspace and register). */
export function ProgrammeCard({ p, w, action }: { p: Row; w: UaWorld; action?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const n = useNames(w);
  const cov = programmeCoverage(p, w);
  return (
    <Card as="article" eyebrow={`${n.org(p.university_org_id)} · ${t(`m10.ua.degree.${p.degree}`)}`} title={pick(p, 'title')} actions={<UaStatusPill row={p} />} className="flex h-full flex-col">
      <div data-testid={`m10-ua-card-${p.id}`} className="flex flex-1 flex-col gap-2">
        <KeyValue items={[
          [t('m10.ua.code'), <span key="c" className="num">{p.code}</span>],
          [t('m10.ua.nqf'), p.nqf_level ? t('m10.ua.nqfValue', { n: f.num(p.nqf_level) }) : '—'],
          [t('m10.ua.mapped'), f.num((p.skills ?? []).length)],
          [t('m10.ua.window'), p.status === 'endorsed' ? t('m10.ua.windowValue', { from: f.date(p.covers_from), to: f.date(p.valid_to) }) : '—'],
        ]} />
        <CoverageBlock cov={cov} w={w} compact />
        {p.decision_note && p.status === 'returned' && <p className="rounded-card border border-line bg-sunken p-2 text-[12.5px]">{t('m10.ua.returnNote')}: {p.decision_note}</p>}
        {action && <div className="mt-auto pt-2">{action}</div>}
      </div>
    </Card>
  );
}
