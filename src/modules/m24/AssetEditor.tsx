// M24 · F21 knowledge asset editor (from a capture session or written directly by an SME): bilingual title, summary and key
// points, the body, skills, standards and system family, deterministic enrichment (RAKE key phrases, TF-IDF keywords, BM25
// suggestions of skills, OE lessons and courses with the matched terms as the reason) and a live content screen that blocks
// security, safeguards and cyber details and contact details before submission (the server checks again).
import { useMemo, useState } from 'react';
import { Callout, Card, SelectField, TextArea, TextField, WhyThis, EngineBadge, Icon } from '../../ui';
import { useAction, useRepo, type RowOf } from '../../data';
import { useEngine } from '../../data/useEngine';
import { usePick, useT, useFormat } from '../../i18n';
import { hasContactDetails, postGuard } from '../m22/domain';
import { LIMITS, SYSTEM_FAMILIES, assetText, type KeyPoint } from './capture';
import { enrich, type Suggestion } from './enrich';
import { MultiPick, useKcLabels, type KcRefs } from './ui';
import type { Reason } from '../../domain/engines/types';

export interface EditorSeed {
  id?: string | null; session_id?: string | null; title_en?: string; title_ar?: string; summary_en?: string; summary_ar?: string; body?: string; body_lang?: 'en' | 'ar';
  key_points?: KeyPoint[]; skill_ids?: string[]; standard_ids?: string[]; system_family?: string;
}

export function useEnrichment(text: string, refs: KcRefs) {
  return useMemo(() => enrich(text, {
    skills: refs.safeSkills.map((s) => ({ id: s.id, text: `${s.name_en} ${s.description_en ?? ''} ${s.name_ar}` })),
    oe: refs.oe.map((o) => ({ id: o.id, text: `${o.title_en} ${o.summary_en} ${o.lesson_en} ${o.title_ar}` })),
    courses: refs.safeCourses.map((c) => ({ id: c.id, text: `${c.title_en} ${c.summary_en ?? ''} ${c.title_ar}` })),
  }), [text, refs]);
}
/** "Why this?" reasons for one suggestion: the matched terms and the BM25 score. */
export const suggestionReasons = (s: Suggestion): Reason[] => [
  { code: 'kc_terms', key: 'm24.reasons.kc_terms', vars: { terms: s.terms.join(', ') } },
  { code: 'kc_score', key: 'm24.reasons.kc_score', vars: { score: s.score } },
];

export function SuggestionList({ list, refs, decisions, onDecide }: { list: Suggestion[]; refs: KcRefs; decisions?: Record<string, string>; onDecide?: (key: string, d: 'accepted' | 'rejected') => void }) {
  const t = useT();
  const pick = usePick();
  const lab = useKcLabels(refs);
  const label = (s: Suggestion) => (s.kind === 'skill' ? lab.skill(s.ref) : s.kind === 'oe' ? pick(lab.oe(s.ref), 'title') || s.ref : (() => { const c = lab.course(s.ref); return c ? `${c.code} · ${pick(c, 'title')}` : s.ref; })());
  if (!list.length) return <p className="text-[13px] text-ink-3">{t('m24.enrich.none')}</p>;
  return (
    <ul className="space-y-1.5" data-testid="m24-suggestions">
      {list.map((s) => {
        const key = `${s.kind}:${s.ref}`;
        const d = decisions?.[key] ?? s.decision;
        return (
          <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-2 py-1.5">
            <span className="min-w-0 text-[13px]"><span className="chip me-2 border-line bg-sunken text-ink-2">{t(`m24.enrich.kind_${s.kind}`)}</span>{label(s)}</span>
            <span className="flex items-center gap-1">
              <WhyThis reasons={suggestionReasons(s)} testId="m24-suggestion-why" />
              {onDecide ? (
                <>
                  <button type="button" className={`btn-sm ${d === 'accepted' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={d === 'accepted'} onClick={() => onDecide(key, 'accepted')} data-testid="m24-suggestion-accept">{t('m24.enrich.accept')}</button>
                  <button type="button" className={`btn-sm ${d === 'rejected' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={d === 'rejected'} onClick={() => onDecide(key, 'rejected')}>{t('m24.enrich.reject')}</button>
                </>
              ) : <span className="text-[12px] text-ink-3">{t(`m24.enrich.decision_${d}`)}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AssetEditor({ seed, refs, source, onDone }: { seed: EditorSeed; refs: KcRefs; source: string; onDone?: (id: string, status: string) => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const eng = useEngine('search');
  const lab = useKcLabels(refs);
  const [v, setV] = useState({ title_en: seed.title_en ?? '', title_ar: seed.title_ar ?? '', summary_en: seed.summary_en ?? '', summary_ar: seed.summary_ar ?? '', body: seed.body ?? '', system_family: seed.system_family ?? '' });
  const [kp, setKp] = useState<KeyPoint[]>(seed.key_points?.length ? seed.key_points : [{ en: '', ar: '' }]);
  const [skills, setSkills] = useState<string[]>(seed.skill_ids ?? []);
  const [stds, setStds] = useState<string[]>(seed.standard_ids ?? []);
  const [busy, setBusy] = useState(false);
  const en = useEnrichment(source || v.body, refs);
  const policies = refs.policies as unknown as { category: string; patterns: string[]; enabled: boolean }[];
  const text = assetText({ ...v, key_points: kp });
  const cat = postGuard(text, policies);
  const contact = hasContactDetails(text);
  const len = (s: string, [lo, hi]: readonly [number, number]) => s.trim().length >= lo && s.trim().length <= hi;
  const valid = len(v.title_en, LIMITS.TITLE) && len(v.title_ar, LIMITS.TITLE) && len(v.summary_en, LIMITS.SUMMARY) && len(v.summary_ar, LIMITS.SUMMARY) && len(v.body, LIMITS.BODY)
    && kp.length >= 1 && kp.every((k) => len(k.en, [1, LIMITS.KEY_POINT_MAX]) && len(k.ar, [1, LIMITS.KEY_POINT_MAX])) && !!v.system_family;
  const save = async (submit: boolean) => {
    setBusy(true);
    try {
      const r = await run(() => repo.rpc.submitAsset({ id: seed.id ?? null, session_id: seed.session_id ?? null, ...v, body_lang: seed.body_lang ?? 'en', key_points: kp, skill_ids: skills, standard_ids: stds, system_family: v.system_family, suggestions: en.suggestions, submit }));
      if (r.ok && r.data) onDone?.(r.data.id, r.data.status);
    } finally { setBusy(false); }
  };
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" data-testid="m24-asset-editor">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField name="title_en" label={t('m24.editor.titleEn')} required value={v.title_en} onChange={set('title_en')} />
          <TextField name="title_ar" label={t('m24.editor.titleAr')} required value={v.title_ar} onChange={set('title_ar')} />
          <TextArea name="summary_en" label={t('m24.editor.summaryEn')} required rows={3} value={v.summary_en} onChange={set('summary_en')} />
          <TextArea name="summary_ar" label={t('m24.editor.summaryAr')} required rows={3} value={v.summary_ar} onChange={set('summary_ar')} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold">{t('m24.editor.keyPoints')}</legend>
          {kp.map((k, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input className="input" aria-label={t('m24.editor.pointEn', { n: i + 1 })} placeholder={t('m24.editor.pointEn', { n: i + 1 })} value={k.en} maxLength={LIMITS.KEY_POINT_MAX} onChange={(e) => setKp((x) => x.map((y, j) => (j === i ? { ...y, en: e.target.value } : y)))} />
              <input className="input" dir="rtl" aria-label={t('m24.editor.pointAr', { n: i + 1 })} placeholder={t('m24.editor.pointAr', { n: i + 1 })} value={k.ar} maxLength={LIMITS.KEY_POINT_MAX} onChange={(e) => setKp((x) => x.map((y, j) => (j === i ? { ...y, ar: e.target.value } : y)))} />
              <button type="button" className="btn-ghost btn-sm" disabled={kp.length <= 1} onClick={() => setKp((x) => x.filter((_, j) => j !== i))} aria-label={t('m24.editor.removePoint')}><Icon name="close" size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn-outline btn-sm" disabled={kp.length >= LIMITS.KEY_POINTS[1]} onClick={() => setKp((x) => [...x, { en: '', ar: '' }])}><Icon name="plus" size={14} />{t('m24.editor.addPoint')}</button>
        </fieldset>
        <TextArea name="body" label={t('m24.editor.body')} required rows={10} value={v.body} onChange={set('body')} hint={t('m24.editor.bodyHint', { n: f.num(v.body.trim().length) })} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SelectField name="family" label={t('m24.kb.family')} required options={SYSTEM_FAMILIES.map((x) => ({ value: x, label: t(`m24.family.${x}`) }))} value={v.system_family} onChange={set('system_family')} placeholder={t('m24.common.choose')} />
          <MultiPick label={t('m24.asset.skills')} options={refs.safeSkills.map((s) => ({ id: s.id, label: pick(s, 'name') }))} value={skills} onChange={setSkills} max={LIMITS.SKILLS} testId="m24-editor-skills" />
          <MultiPick label={t('m24.asset.standards')} options={refs.standards.map((q) => ({ id: q.id, label: lab.standard(q.id) }))} value={stds} onChange={setStds} max={LIMITS.STANDARDS} />
        </div>
        {cat && <Callout tone="bad" title={t('m24.editor.blockedTitle', { category: t(`m24.guard.${cat}`) })}>{t('m24.editor.blockedBody')}</Callout>}
        {!cat && contact && <Callout tone="bad" title={t('m24.editor.contactTitle')}>{t('m24.editor.contactBody')}</Callout>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" disabled={busy} onClick={() => save(false)} data-testid="m24-editor-save">{t('m24.editor.saveDraft')}</button>
          <button className="btn-primary" disabled={busy || !valid || !!cat || contact} onClick={() => save(true)} data-testid="m24-editor-submit">{t('m24.editor.submit')}</button>
          {!valid && <span className="self-center text-[12px] text-ink-3">{t('m24.editor.incomplete')}</span>}
        </div>
      </div>
      <aside className="space-y-3">
        <Card title={t('m24.enrich.title')} actions={<EngineBadge engine={eng} />}>
          <p className="text-[12.5px] text-ink-2">{t('m24.enrich.intro')}</p>
          <div className="caps mt-3">{t('m24.enrich.phrases')}</div>
          <div className="mt-1 flex flex-wrap gap-1.5" data-testid="m24-rake">{en.phrases.length ? en.phrases.map((p) => <span key={p.phrase} className="chip border-line bg-sunken text-ink-2">{p.phrase}</span>) : <span className="text-[12.5px] text-ink-3">—</span>}</div>
          <div className="caps mt-3">{t('m24.enrich.keywords')}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">{en.keywords.slice(0, 10).map((k) => <span key={k.term} className="chip border-line bg-panel text-ink-2" title={String(k.score)}>{k.term}</span>)}</div>
          <div className="caps mt-3">{t('m24.enrich.suggestions')}</div>
          <div className="mt-1"><SuggestionList list={en.suggestions} refs={refs} /></div>
          <p className="mt-2 text-[12px] text-ink-3">{t('m24.enrich.reviewerDecides')}</p>
        </Card>
        <Callout title={t('m24.editor.reviewTitle')}>{t('m24.editor.reviewBody')}</Callout>
      </aside>
    </div>
  );
}

export type AssetRow = RowOf<'knowledge_assets'>;
