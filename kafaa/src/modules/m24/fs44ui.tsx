// FS44 / FS45 shared page pieces (FS wave E · E3, M24): pills, the lecture card, the "record a lecture" form, risk and readiness
// widgets. Pages never import backend/*.
import { useMemo, useState, type ReactNode } from 'react';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Modal, ConfirmDialog, StatusPill, Icon, SourceLink, ProgressBar, type PillTone } from '../../ui';
import { LECTURE_FAMILIES, LECTURE_FORMATS, LEC_LIMITS } from './lectures';
import { Chips, MultiPick, type KcRefs, useKcLabels } from './ui';
import type { LectureChapter } from './backend/rpc';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Published sources these pages cite (read from the FS research packs on 2026-10-10). */
export const PLAN2035 = { url: 'https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf', as_of: '2026-10-10' };
export const NGT310 = { url: 'https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf', as_of: '2026-10-10' };
export const NGT611 = { url: 'https://www.iaea.org/node/41993', as_of: '2026-10-08' };

const LEC_TONE: Record<string, PillTone> = { draft: 'neutral', review: 'sim', published: 'ok', withdrawn: 'bad' };
export function LecturePill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={LEC_TONE[status] ?? 'neutral'} status={status}>{t(`m24.lc.status.${status}`)}</StatusPill>;
}
const CTB_TONE: Record<string, PillTone> = { pending: 'sim', validated: 'ok', rejected: 'bad' };
export function ContribPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={CTB_TONE[status] ?? 'neutral'} status={status}>{t(`m24.lc.ctb.${status}`)}</StatusPill>;
}
const RISK_TONE: Record<string, PillTone> = { overdue: 'bad', high: 'bad', medium: 'sim', low: 'ok', done: 'accent' };
export function RiskPill({ level }: { level: string }) {
  const t = useT();
  return <StatusPill tone={RISK_TONE[level] ?? 'neutral'} status={level}>{t(`m24.lz.risk.${level}`)}</StatusPill>;
}
const LOC_TONE: Record<string, PillTone> = { partner_led: 'neutral', co_delivery: 'info', uae_led_supervised: 'accent', transferred: 'ok', on_hold: 'sim' };
export function LocStatusPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={LOC_TONE[status] ?? 'neutral'} status={status}>{t(`m24.lz.status.${status}`)}</StatusPill>;
}
/** Readiness as a bar with the percentage and the ready-now count. */
export function ReadinessBar({ pct, ready, need, testId }: { pct: number; ready: number; need: number; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const tone = pct >= 100 ? 'ok' : pct >= 50 ? 'accent' : 'bad';
  return (
    <div className="min-w-[140px]" data-testid={testId} data-pct={pct}>
      <div className="flex items-baseline justify-between gap-2 text-[12px]"><span className="num font-semibold">{f.pct(pct, 0)}</span><span className="text-ink-3">{t('m24.lz.readyOf', { n: f.num(ready), need: f.num(need) })}</span></div>
      <ProgressBar value={Math.min(100, pct)} tone={tone} label={t('m24.lz.readiness')} />
    </div>
  );
}

export function minutes(t: ReturnType<typeof useT>, f: ReturnType<typeof useFormat>, n: number) {
  return t('m24.lc.minutes', { n: f.num(n) });
}

/** One lecture in the library grid. */
export function LectureCard({ l, refs, extra }: { l: Row; refs: KcRefs; extra?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useKcLabels(refs);
  return (
    <li className="card flex min-w-0 flex-col gap-2 p-4" data-testid="m24-lc-card" data-id={l.id} data-position={l.position_id ? 'yes' : 'no'}>
      <div className="flex items-start justify-between gap-2">
        <span className="chip border-line bg-sunken text-ink-2"><Icon name="book" size={12} />{t(`m24.lc.format.${l.format}`)}</span>
        {l.status !== 'published' && <LecturePill status={l.status} />}
      </div>
      <L to={`/knowledge/lectures/${l.id}`} className="link font-semibold" data-testid="m24-lc-open">{pick(l, 'title')}</L>
      <p className="line-clamp-3 text-[13px] text-ink-2">{pick(l, 'abstract')}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
        <span className="inline-flex items-center gap-1"><Icon name="user" size={12} />{pick({ n_en: l.speaker_name, n_ar: l.speaker_name_ar }, 'n')}</span>
        <span className="inline-flex items-center gap-1"><Icon name="calendar" size={12} />{f.date(l.delivered_on)}</span>
        <span>{minutes(t, f, Number(l.duration_min))}</span>
        <span>{t(`m24.lc.lang.${l.lang}`)}</span>
      </div>
      <Chips items={(l.skill_ids ?? []).map((id: string) => lab.skill(id))} />
      {l.position_id && <p className="text-[12px] text-ink-2" data-testid="m24-lc-protects"><Icon name="shield" size={12} className="me-1 inline" />{t('m24.lc.protects', { role: pick({ p_en: l.position_title_en, p_ar: l.position_title_ar }, 'p') })}</p>}
      {extra}
    </li>
  );
}

/** "Record a lecture": metadata of an expert talk (synthetic recording reference). Saves a draft or submits it for publication. */
export function LectureForm({ open, onClose, refs, onSaved, initial }: { open: boolean; onClose: () => void; refs: KcRefs; onSaved: () => void; initial?: Row | null }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState(() => ({
    title_en: initial?.title_en ?? '', title_ar: initial?.title_ar ?? '', abstract_en: initial?.abstract_en ?? '', abstract_ar: initial?.abstract_ar ?? '',
    format: initial?.format ?? 'talk', lang: initial?.lang ?? 'en', delivered_on: initial?.delivered_on ? String(initial.delivered_on).slice(0, 10) : today,
    duration_min: String(initial?.duration_min ?? 45), system_family: initial?.system_family ?? 'training', recording_code: initial?.recording_code ?? '',
    skill_ids: (initial?.skill_ids ?? []) as string[], chapters: ((initial?.chapters ?? []) as LectureChapter[]).map((c) => ({ at: String(c.at), en: c.en, ar: c.ar })),
  }));
  const [confirm, setConfirm] = useState<null | boolean>(null);
  const [msg, setMsg] = useState<{ code: string; message: string } | null>(null);
  const set = (k: string, val: unknown) => setV((x) => ({ ...x, [k]: val }));
  const skillOpts = useMemo(() => refs.safeSkills.filter((k) => k.lifecycle !== 'obsolete').map((k) => ({ id: k.id, label: pick(k, 'name') })), [refs, pick]);
  const save = async (submit: boolean) => {
    const r = await act(() => repo.rpc.saveLecture({
      id: initial?.id ?? null, title_en: v.title_en, title_ar: v.title_ar, abstract_en: v.abstract_en, abstract_ar: v.abstract_ar, format: v.format, lang: v.lang as 'en' | 'ar',
      delivered_on: v.delivered_on, duration_min: Number(v.duration_min), skill_ids: v.skill_ids, system_family: v.system_family, recording_code: v.recording_code || null,
      chapters: v.chapters.filter((c) => c.en || c.ar).map((c) => ({ at: Number(c.at), en: c.en, ar: c.ar })), submit,
    }));
    if (r.ok) { setMsg(null); onSaved(); onClose(); } else setMsg({ code: r.code, message: r.message });
  };
  const field = (k: 'title_en' | 'title_ar', label: string, max: number) => (
    <label className="block"><span className="caps">{label}</span><input className="input mt-1" dir={k.endsWith('_ar') ? 'rtl' : 'ltr'} maxLength={max} value={v[k]} onChange={(e) => set(k, e.target.value)} data-testid={`m24-lc-f-${k}`} /></label>
  );
  return (
    <Modal open={open} onClose={onClose} size="lg" title={initial ? t('m24.lc.form.editTitle') : t('m24.lc.form.title')}
      footer={<div className="flex flex-wrap justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-outline" onClick={() => setConfirm(false)} data-testid="m24-lc-f-draft">{t('m24.lc.form.saveDraft')}</button>
        <button className="btn-primary" onClick={() => setConfirm(true)} data-testid="m24-lc-f-submit">{t('m24.lc.form.submit')}</button>
      </div>}>
      <div className="space-y-3" data-testid="m24-lc-form">
        <p className="text-[12.5px] text-ink-2">{t('m24.lc.form.intro')}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {field('title_en', t('m24.lc.form.titleEn'), LEC_LIMITS.TITLE[1])}
          {field('title_ar', t('m24.lc.form.titleAr'), LEC_LIMITS.TITLE[1])}
          <label className="block"><span className="caps">{t('m24.lc.form.abstractEn')}</span><textarea className="input mt-1" rows={4} dir="ltr" maxLength={LEC_LIMITS.ABSTRACT[1]} value={v.abstract_en} onChange={(e) => set('abstract_en', e.target.value)} data-testid="m24-lc-f-abstract_en" /></label>
          <label className="block"><span className="caps">{t('m24.lc.form.abstractAr')}</span><textarea className="input mt-1" rows={4} dir="rtl" maxLength={LEC_LIMITS.ABSTRACT[1]} value={v.abstract_ar} onChange={(e) => set('abstract_ar', e.target.value)} data-testid="m24-lc-f-abstract_ar" /></label>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <label className="block"><span className="caps">{t('m24.lc.form.format')}</span><select className="input mt-1" value={v.format} onChange={(e) => set('format', e.target.value)} data-testid="m24-lc-f-format">{LECTURE_FORMATS.map((x) => <option key={x} value={x}>{t(`m24.lc.format.${x}`)}</option>)}</select></label>
          <label className="block"><span className="caps">{t('m24.lc.form.lang')}</span><select className="input mt-1" value={v.lang} onChange={(e) => set('lang', e.target.value)}>{['en', 'ar'].map((x) => <option key={x} value={x}>{t(`m24.lc.lang.${x}`)}</option>)}</select></label>
          <label className="block"><span className="caps">{t('m24.lc.form.delivered')}</span><input type="date" className="input mt-1" max={today} value={v.delivered_on} onChange={(e) => set('delivered_on', e.target.value)} data-testid="m24-lc-f-date" /></label>
          <label className="block"><span className="caps">{t('m24.lc.form.duration')}</span><input type="number" min={LEC_LIMITS.DURATION[0]} max={LEC_LIMITS.DURATION[1]} className="input mt-1" value={v.duration_min} onChange={(e) => set('duration_min', e.target.value)} data-testid="m24-lc-f-duration" /></label>
          <label className="block"><span className="caps">{t('m24.lc.form.family')}</span><select className="input mt-1" value={v.system_family} onChange={(e) => set('system_family', e.target.value)} data-testid="m24-lc-f-family">{LECTURE_FAMILIES.map((x) => <option key={x} value={x}>{t(`m24.family.${x}`)}</option>)}</select></label>
        </div>
        <MultiPick label={t('m24.lc.form.skills')} options={skillOpts} value={v.skill_ids} onChange={(x) => set('skill_ids', x)} max={LEC_LIMITS.SKILLS_MAX} testId="m24-lc-f-skills" />
        <fieldset className="min-w-0">
          <legend className="caps">{t('m24.lc.form.chapters')}</legend>
          <div className="space-y-2">
            {v.chapters.map((c, i) => (
              <div key={i} className="grid grid-cols-[70px_1fr_1fr_auto] items-center gap-2">
                <input className="input" type="number" min={0} value={c.at} aria-label={t('m24.lc.form.chapterAt')} onChange={(e) => set('chapters', v.chapters.map((x, j) => (j === i ? { ...x, at: e.target.value } : x)))} />
                <input className="input" dir="ltr" value={c.en} aria-label={t('m24.lc.form.chapterEn')} onChange={(e) => set('chapters', v.chapters.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} />
                <input className="input" dir="rtl" value={c.ar} aria-label={t('m24.lc.form.chapterAr')} onChange={(e) => set('chapters', v.chapters.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)))} />
                <button className="btn-ghost btn-sm" onClick={() => set('chapters', v.chapters.filter((_, j) => j !== i))} aria-label={t('m24.lc.form.chapterRemove')}><Icon name="close" size={14} /></button>
              </div>
            ))}
            {v.chapters.length < LEC_LIMITS.CHAPTERS_MAX && <button className="btn-ghost btn-sm" onClick={() => set('chapters', [...v.chapters, { at: '0', en: '', ar: '' }])} data-testid="m24-lc-f-addchapter"><Icon name="plus" size={14} /> {t('m24.lc.form.addChapter')}</button>}
          </div>
        </fieldset>
        <label className="block max-w-xs"><span className="caps">{t('m24.lc.form.recording')}</span><input className="input mt-1 font-mono" placeholder="REC-2026-014" value={v.recording_code} onChange={(e) => set('recording_code', e.target.value)} /></label>
        <p className="text-[12px] text-ink-3"><Icon name="shield" size={12} className="me-1 inline" />{t('m24.lc.form.positionNote')}</p>
        <p className="text-[12px] text-ink-3"><Icon name="lock" size={12} className="me-1 inline" />{t('m24.lc.form.securityNote')}</p>
        {msg && <div role="alert" className="rounded-md border border-bad/40 bg-bad-bg p-3 text-[13px] text-bad" data-testid="m24-lc-f-error" data-code={msg.code}>{msg.message}</div>}
      </div>
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? t('m24.lc.form.confirmSubmit') : t('m24.lc.form.confirmDraft')}
        consequence={confirm ? t('m24.lc.form.consequenceSubmit') : t('m24.lc.form.consequenceDraft')} actingAs={pick({ n_en: s.person?.display_name ?? '', n_ar: s.person?.display_name_ar ?? '' }, 'n')}
        onConfirm={async () => { const sub = !!confirm; setConfirm(null); await save(sub); }} />
    </Modal>
  );
}

/** The cited method line under the library. */
export function LibrarySources() {
  const t = useT();
  const f = useFormat();
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3" data-testid="m24-lc-sources">
      <span>{t('m24.lc.method')}</span>
      <SourceLink href={PLAN2035.url} date={f.date(PLAN2035.as_of)}>{t('m24.lc.srcPlan2035')}</SourceLink>
      <SourceLink href={NGT611.url} date={f.date(NGT611.as_of)}>{t('m24.lc.srcKlrm')}</SourceLink>
    </p>
  );
}
