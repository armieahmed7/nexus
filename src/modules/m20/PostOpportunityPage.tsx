// /opportunities/post (M20 · F08): managers and the training manager post a stretch assignment. Security, cyber, safeguards
// and protected-area work is never offered here, and the RPC refuses it (restricted_kind, audited) if anyone tries.
import { useMemo, useState } from 'react';
import { Page, Card, Async, Callout, Icon, ConfirmDialog, TextField, TextArea, SelectField, CheckboxField, RadioGroup } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, useNav, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { OPP_KINDS, LOCATIONS, PRIORITY_FLAGS, MAX_SKILLS, RESTRICTED_SKILL_AREAS, validateOpportunity, type OpportunityInput } from './domain';
import type { JobFamiliesRow, SkillsRow } from '../../data/types';

const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default function PostOpportunityPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['skills', 'job_families'], async () => {
    const [skills, families] = await Promise.all([repo.list('skills', { order: [['sort', 'asc']] }), repo.list('job_families', { order: [['sort', 'asc']] })]);
    return { skills, families };
  });
  return (
    <Page title={t('m20.routes.opportunities-post.title')} intro={t('m20.post.intro')}>
      <Async state={q} isEmpty={() => false}>{(d) => <PostForm skills={d.skills} families={d.families} />}</Async>
    </Page>
  );
}

function PostForm({ skills, families }: { skills: SkillsRow[]; families: JobFamiliesRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const nav = useNav();
  const s = useSession();
  const [v, setV] = useState({ kind: 'project', title_en: '', title_ar: '', summary_en: '', summary_ar: '', hours_week: '4', start_on: addDays(14), end_on: addDays(70), seats: '1', location_type: 'office' });
  const [need, setNeed] = useState<string[]>([]);
  const [gain, setGain] = useState<string[]>([]);
  const [fams, setFams] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<'draft' | 'open' | null>(null);
  const [touched, setTouched] = useState(false);
  const input = (status: 'draft' | 'open'): OpportunityInput => ({ ...v, hours_week: Number(v.hours_week), seats: Number(v.seats), skills_needed: need, skills_gained: gain, eligible_families: fams, priority_flags: flags, status });
  const problem = validateOpportunity(input('open'), skills, families.map((x) => x.id), new Date().toISOString().slice(0, 10));
  const fld = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (x: string) => setV((c) => ({ ...c, [k]: x })) });
  const selectable = skills.filter((x) => !RESTRICTED_SKILL_AREAS.includes(x.area));
  return (
    <form className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={(e) => e.preventDefault()} data-testid="m20-post-form">
      <div className="space-y-6">
        <Card title={t('m20.post.what')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label={t('m20.f.kind')} required options={OPP_KINDS.map((k) => ({ value: k, label: t(`m20.kind.${k}`) }))} {...fld('kind')} />
            <RadioGroup label={t('m20.f.location')} name="location_type" value={v.location_type} onChange={(x) => setV((c) => ({ ...c, location_type: x }))} options={LOCATIONS.map((k) => ({ value: k, label: t(`m20.location.${k}`) }))} />
            <TextField label={t('m20.post.titleEn')} required {...fld('title_en')} />
            <TextField label={t('m20.post.titleAr')} required {...fld('title_ar')} />
            <TextArea label={t('m20.post.summaryEn')} required hint={t('m20.post.summaryHint')} {...fld('summary_en')} />
            <TextArea label={t('m20.post.summaryAr')} required hint={t('m20.post.summaryHint')} {...fld('summary_ar')} />
          </div>
          <p className="mt-3 text-[12.5px] text-ink-3"><Icon name="lock" size={12} className="me-1 inline" />{t('m20.post.restricted')}</p>
        </Card>
        <Card title={t('m20.post.skills')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SkillPicker label={t('m20.post.needed')} hint={t('m20.post.neededHint')} skills={selectable} value={need} onChange={setNeed} testId="m20-pick-need" />
            <SkillPicker label={t('m20.post.gained')} hint={t('m20.post.gainedHint')} skills={selectable} value={gain} onChange={setGain} testId="m20-pick-gain" />
          </div>
        </Card>
        <Card title={t('m20.post.when')}>
          <div className="grid gap-3 sm:grid-cols-4">
            <TextField type="date" label={t('m20.post.start')} required {...fld('start_on')} />
            <TextField type="date" label={t('m20.post.end')} required {...fld('end_on')} />
            <TextField type="number" label={t('m20.post.hours')} required {...fld('hours_week')} />
            <TextField type="number" label={t('m20.post.seats')} required {...fld('seats')} />
          </div>
        </Card>
        <Card title={t('m20.post.who')}>
          <div className="caps mb-1">{t('m20.post.families')}</div>
          <p className="mb-2 text-[12.5px] text-ink-3">{t('m20.post.familiesHint')}</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
            {families.map((x) => <CheckboxField key={x.id} label={pick(x, 'name')} checked={fams.includes(x.id)} onChange={(c) => setFams((cur) => (c ? [...cur, x.id] : cur.filter((y) => y !== x.id)))} />)}
          </div>
          <div className="caps mb-1 mt-4">{t('m20.post.flags')}</div>
          <div className="grid gap-1 sm:grid-cols-3">
            {PRIORITY_FLAGS.map((k) => <CheckboxField key={k} label={t(`m20.flag.${k}`)} hint={t(`m20.flagHint.${k}`)} checked={flags.includes(k)} onChange={(c) => setFlags((cur) => (c ? [...cur, k] : cur.filter((y) => y !== k)))} />)}
          </div>
        </Card>
      </div>
      <aside className="space-y-4">
        <Card title={t('m20.post.preview')}>
          <div className="text-[13px] text-ink-2">
            <div className="font-semibold text-ink">{v.title_en || t('m20.post.untitled')}</div>
            <div dir="rtl" className="font-arabic">{v.title_ar}</div>
            <div className="mt-2">{t(`m20.kind.${v.kind}`)} · {t(`m20.location.${v.location_type}`)}</div>
            <div>{t('m20.common.hoursWeek', { n: f.num(Number(v.hours_week) || 0) })} · {t('m20.post.seatsN', { n: f.num(Number(v.seats) || 0) })}</div>
            <div>{f.date(v.start_on)} – {f.date(v.end_on)}</div>
          </div>
          {touched && problem && <p className="mt-3 text-[12.5px] text-bad" role="alert" data-testid="m20-post-problem">{problem.message}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className="btn-primary" onClick={() => { setTouched(true); if (!problem) setConfirm('open'); }} data-testid="m20-post-open">{t('m20.post.publish')}</button>
            <button type="button" className="btn-outline" onClick={() => { setTouched(true); if (!problem) setConfirm('draft'); }} data-testid="m20-post-draft">{t('m20.post.saveDraft')}</button>
          </div>
        </Card>
        <Callout title={t('m20.post.flowTitle')}>{t('m20.post.flowBody')}</Callout>
      </aside>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'draft' ? t('m20.post.draftTitle') : t('m20.post.openTitle')} consequence={confirm === 'draft' ? t('m20.post.draftBody') : t('m20.post.openBody')}
        actingAs={s.roles.includes('training_manager') ? t('m20.post.asTm') : t('m20.post.asManager')}
        onConfirm={async () => {
          if (!confirm) return;
          const r = await run(() => repo.rpc.postOpportunity(input(confirm)));
          if (r.ok && r.data) nav(confirm === 'draft' ? '/opportunities/manage' : `/opportunities/${r.data.id}`);
        }} />
    </form>
  );
}

function SkillPicker({ label, hint, skills, value, onChange, testId }: { label: string; hint: string; skills: SkillsRow[]; value: string[]; onChange: (v: string[]) => void; testId: string }) {
  const t = useT();
  const pick = usePick();
  const [term, setTerm] = useState('');
  const shown = useMemo(() => { const q = term.trim().toLowerCase(); return skills.filter((s) => !q || `${s.name_en} ${s.name_ar} ${s.code}`.toLowerCase().includes(q)); }, [skills, term]);
  return (
    <fieldset data-testid={testId}>
      <legend className="text-[13px] font-semibold">{label} <span className="font-normal text-ink-3">({value.length}/{MAX_SKILLS})</span></legend>
      <p className="mb-1 text-[12px] text-ink-3">{hint}</p>
      {value.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{value.map((id) => { const s = skills.find((x) => x.id === id); return <button type="button" key={id} className="chip border-accent/30 bg-accent-soft text-eyebrow" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={t('m20.post.remove', { s: s ? pick(s, 'name') : id })}>{s ? pick(s, 'name') : id} <Icon name="close" size={10} /></button>; })}</div>}
      <input className="input" value={term} placeholder={t('common.search')} onChange={(e) => setTerm(e.target.value)} aria-label={t('m20.post.searchSkills')} />
      <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto rounded-btn border border-line p-2">
        {shown.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-[13px] hover:bg-sunken">
            <input type="checkbox" className="mt-0.5" checked={value.includes(s.id)} disabled={!value.includes(s.id) && value.length >= MAX_SKILLS} onChange={(e) => onChange(e.target.checked ? [...value, s.id] : value.filter((x) => x !== s.id))} />
            <span><span className="num me-1 text-ink-3">{s.code}</span>{pick(s, 'name')}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
