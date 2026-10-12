// /skills/changes/propose (M16 · FS54, staff: skills_taxonomy W): propose a change to the skills catalogue (add, rename, split, retire,
// re-level). The inclusion rule is checked live as the form fills (same pure rule as both backends: distinct development and assessment,
// distinct names, a source for a new skill); submitting is confirmed and audited, then the skills council decides (two members, neither the
// proposer). Below: my requests with their status and the council's votes (by role).
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, BenchmarkChips, Callout, Card, ConfirmDialog, EmptyState, Icon, Page, RadioGroup, SelectField, TextArea, TextField } from '../../ui';
import type { SkillChangeRequestsRow } from '../../data/types';
import { CHANGE_KINDS, LIMITS, SKILL_AREAS, inclusionChecks, inclusionOk, proposeProblem, requestTitle, type ChangeKind, type Proposal, type ProposeInput, type RequestRow, type SkillLite } from './taxonomyGov';
import { CouncilSteps, InclusionList, KindPill, RequestStatusPill, VoteList } from './govUi';
import { useGovAction } from './govAction';

type Comp = { id: string; name_en: string; name_ar: string };

export default function ProposeSkillChangePage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const q = useQuery(['skills', 'competencies', 'skill_change_requests'], async () => ({
    skills: (await repo.list('skills', { order: [['code', 'asc']] })) as unknown as SkillLite[],
    comps: (await repo.list('competencies').catch(() => [])) as unknown as Comp[],
    mine: await repo.list('skill_change_requests', { filter: { proposed_by: s.identity.personId ?? '' }, order: [['proposed_at', 'desc']] }).catch(() => [] as SkillChangeRequestsRow[]),
  }), [s.identity.personId]);
  return (
    <Page title={t('m16.routes.skills-change-propose.title')} eyebrow={<BenchmarkChips feature="FS54" />} intro={t('m16.gov.prop.intro')} wide>
      <Async state={q} isEmpty={() => false}>
        {(d) => (
          <div className="space-y-6">
            <ProposeForm skills={d.skills} comps={d.comps} mine={d.mine as unknown as RequestRow[]} onDone={() => q.reload?.()} />
            <MyRequests rows={d.mine as unknown as RequestRow[]} />
          </div>
        )}
      </Async>
    </Page>
  );
}

function ProposeForm({ skills, comps, mine, onDone }: { skills: SkillLite[]; comps: Comp[]; mine: RequestRow[]; onDone: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useGovAction();
  const [params] = useSearchParams();
  const pre = params.get('skill');
  const [kind, setKind] = useState<ChangeKind>((CHANGE_KINDS as readonly string[]).includes(params.get('kind') ?? '') ? (params.get('kind') as ChangeKind) : pre ? 'relevel' : 'add');
  const [skillId, setSkillId] = useState<string>(pre && skills.some((x) => x.id === pre) ? pre : '');
  const [p, setP] = useState<Record<string, string>>({ key_level: '2', area: 'digital', parts: '2' });
  const [parts, setParts] = useState<{ name_en: string; name_ar: string; description_en: string; description_ar: string }[]>([{ name_en: '', name_ar: '', description_en: '', description_ar: '' }, { name_en: '', name_ar: '', description_en: '', description_ar: '' }]);
  const [rationale, setRationale] = useState('');
  const [development, setDevelopment] = useState('');
  const [assessment, setAssessment] = useState('');
  const [confirm, setConfirm] = useState(false);
  const live = useMemo(() => skills.filter((x) => x.lifecycle !== 'obsolete'), [skills]);
  const target = skills.find((x) => x.id === skillId) ?? null;
  const set = (k: string, v: string) => setP((o) => ({ ...o, [k]: v }));
  const proposal: Proposal = useMemo(() => {
    if (kind === 'add') return { name_en: p.name_en ?? '', name_ar: p.name_ar ?? '', description_en: p.description_en ?? '', description_ar: p.description_ar ?? '', area: p.area, competency_id: p.competency_id ?? '',
      key_level: Number(p.key_level), source_label: p.source_label ?? '', source_url: p.source_url ?? '' };
    if (kind === 'rename') return { name_en: p.name_en ?? '', name_ar: p.name_ar ?? '' };
    if (kind === 'split') return { parts };
    if (kind === 'retire') return { replaced_by: p.replaced_by || null };
    return { key_level: Number(p.key_level), level_essence_en: p.level_essence_en ?? '', level_essence_ar: p.level_essence_ar ?? '' };
  }, [kind, p, parts]);
  const input: ProposeInput = { kind, skill_id: kind === 'add' ? null : skillId || null, proposal, rationale, development, assessment };
  const checks = inclusionChecks(input, skills, comps.map((c) => c.id));
  const problem = proposeProblem(input, skills, comps.map((c) => c.id), mine);
  const title = requestTitle(kind, target, proposal);
  const ready = !problem && inclusionOk(checks);
  const reset = () => { setP({ key_level: '2', area: 'digital' }); setRationale(''); setDevelopment(''); setAssessment(''); setSkillId(''); };
  const skillOptions = live.map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'name')}` }));
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card title={t('m16.gov.prop.formTitle')}>
        <div className="space-y-4" data-testid="m16-propose-form">
          <RadioGroup label={t('m16.gov.prop.kind')} name="m16-kind" value={kind} onChange={(v) => setKind(v as ChangeKind)}
            options={CHANGE_KINDS.map((k) => ({ value: k, label: <span><span className="font-semibold">{t(`m16.gov.kind.${k}`)}</span> <span className="text-[12px] text-ink-3">{t(`m16.gov.kindHelp.${k}`)}</span></span> }))} />
          {kind !== 'add' && <SelectField label={t('m16.gov.prop.skill')} name="skill" value={skillId} onChange={setSkillId} options={skillOptions} required />}
          {target && <p className="rounded-btn border border-line bg-sunken p-2 text-[12.5px] text-ink-2" data-testid="m16-propose-target">{pick(target, 'description') || pick(target, 'name')} · {t('m16.gov.prop.current', { level: target.key_level, version: target.version ?? 1 })}</p>}
          {(kind === 'add' || kind === 'rename') && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField label={t('m16.gov.prop.nameEn')} name="name_en" value={p.name_en ?? ''} onChange={(v) => set('name_en', v)} required />
              <TextField label={t('m16.gov.prop.nameAr')} name="name_ar" value={p.name_ar ?? ''} onChange={(v) => set('name_ar', v)} required />
            </div>
          )}
          {kind === 'add' && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextArea label={t('m16.gov.prop.descEn')} name="description_en" rows={2} value={p.description_en ?? ''} onChange={(v) => set('description_en', v)} />
                <TextArea label={t('m16.gov.prop.descAr')} name="description_ar" rows={2} value={p.description_ar ?? ''} onChange={(v) => set('description_ar', v)} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <SelectField label={t('m16.gov.prop.area')} name="area" value={p.area ?? ''} onChange={(v) => set('area', v)} options={SKILL_AREAS.map((a) => ({ value: a, label: t(`m28.area.${a}`) }))} required />
                <SelectField label={t('m16.gov.prop.competency')} name="competency" value={p.competency_id ?? ''} onChange={(v) => set('competency_id', v)} options={comps.map((c) => ({ value: c.id, label: `${c.id.toUpperCase()} · ${pick(c, 'name')}` }))} required />
                <SelectField label={t('m16.gov.prop.keyLevel')} name="key_level" value={p.key_level ?? '2'} onChange={(v) => set('key_level', v)} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: t('m16.gov.prop.level', { n }) }))} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextField label={t('m16.gov.prop.sourceLabel')} name="source_label" value={p.source_label ?? ''} onChange={(v) => set('source_label', v)} required />
                <TextField label={t('m16.gov.prop.sourceUrl')} name="source_url" value={p.source_url ?? ''} onChange={(v) => set('source_url', v)} placeholder="https://" required />
              </div>
            </>
          )}
          {kind === 'split' && (
            <fieldset className="space-y-3" data-testid="m16-propose-parts">
              <legend className="text-[13px] font-semibold">{t('m16.gov.prop.parts')}</legend>
              {parts.map((x, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-btn border border-line p-2 md:grid-cols-2">
                  <TextField label={t('m16.gov.prop.partEn', { n: i + 1 })} name={`part_en_${i}`} value={x.name_en} onChange={(v) => setParts(parts.map((y, j) => (j === i ? { ...y, name_en: v } : y)))} required />
                  <TextField label={t('m16.gov.prop.partAr', { n: i + 1 })} name={`part_ar_${i}`} value={x.name_ar} onChange={(v) => setParts(parts.map((y, j) => (j === i ? { ...y, name_ar: v } : y)))} required />
                </div>
              ))}
              <div className="flex gap-2">
                {parts.length < 4 && <button type="button" className="btn-outline btn-sm" onClick={() => setParts([...parts, { name_en: '', name_ar: '', description_en: '', description_ar: '' }])}><Icon name="plus" size={13} />{t('m16.gov.prop.addPart')}</button>}
                {parts.length > 2 && <button type="button" className="btn-ghost btn-sm" onClick={() => setParts(parts.slice(0, -1))}>{t('m16.gov.prop.removePart')}</button>}
              </div>
            </fieldset>
          )}
          {kind === 'retire' && <SelectField label={t('m16.gov.prop.replacedBy')} name="replaced_by" value={p.replaced_by ?? ''} onChange={(v) => set('replaced_by', v)} options={skillOptions.filter((o) => o.value !== skillId)} placeholder={t('m16.gov.prop.noReplacement')} />}
          {kind === 'relevel' && (
            <>
              <SelectField label={t('m16.gov.prop.newLevel')} name="key_level" value={p.key_level ?? '2'} onChange={(v) => set('key_level', v)} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: t('m16.gov.prop.level', { n }) }))} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextArea label={t('m16.gov.prop.essenceEn')} name="essence_en" rows={2} value={p.level_essence_en ?? ''} onChange={(v) => set('level_essence_en', v)} hint={t('m16.gov.prop.essenceHint')} />
                <TextArea label={t('m16.gov.prop.essenceAr')} name="essence_ar" rows={2} value={p.level_essence_ar ?? ''} onChange={(v) => set('level_essence_ar', v)} />
              </div>
            </>
          )}
          <TextArea label={t('m16.gov.prop.development')} name="development" rows={2} value={development} onChange={setDevelopment} hint={t('m16.gov.prop.developmentHint', { n: LIMITS.statement })} required />
          <TextArea label={t('m16.gov.prop.assessment')} name="assessment" rows={2} value={assessment} onChange={setAssessment} hint={t('m16.gov.prop.assessmentHint', { n: LIMITS.statement })} required />
          <TextArea label={t('m16.gov.prop.rationale')} name="rationale" rows={3} value={rationale} onChange={setRationale} hint={t('m16.gov.prop.rationaleHint')} required />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <p className="text-[12.5px] text-ink-3" data-testid="m16-propose-problem">{problem ? t(`m16.gov.msg.${problem}`) : t('m16.gov.prop.ready')}</p>
            <button className="btn-primary" disabled={!ready} onClick={() => setConfirm(true)} data-testid="m16-propose-submit">{t('m16.gov.prop.submit')}</button>
          </div>
        </div>
      </Card>
      <div className="space-y-4">
        <Card title={t('m16.gov.prop.checkTitle')}>
          <p className="mb-3 text-[12.5px] text-ink-2">{t('m16.gov.prop.checkBody')}</p>
          <InclusionList checks={checks} />
        </Card>
        <Card title={t('m16.gov.prop.previewTitle')}>
          <div className="mb-2 flex items-center gap-2"><KindPill kind={kind} /></div>
          <p className="font-semibold" data-testid="m16-propose-title">{pick({ x_en: title.en, x_ar: title.ar }, 'x')}</p>
          <p className="mt-2 text-[12.5px] text-ink-2">{t(`m16.gov.prop.effect.${kind}`)}</p>
        </Card>
        <Callout title={t('m16.gov.prop.councilTitle')}>{t('m16.gov.prop.councilBody')}</Callout>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m16.gov.prop.confirmTitle')} consequence={t('m16.gov.prop.confirmBody', { title: pick({ x_en: title.en, x_ar: title.ar }, 'x') })} actingAs={t('m16.gov.prop.actingAs')}
        onConfirm={async () => { const r = await act(() => repo.rpc.proposeSkillChange(input), t('m16.gov.prop.sent')); if (r.ok) { reset(); onDone(); } }} />
    </div>
  );
}

function MyRequests({ rows }: { rows: RequestRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <section aria-labelledby="m16-mine">
      <h2 id="m16-mine" className="mb-2 text-[17px] font-semibold">{t('m16.gov.prop.mineTitle')}</h2>
      {rows.length === 0 ? <EmptyState icon="book" title={t('m16.gov.prop.mineNone')}>{t('m16.gov.prop.mineNoneBody')}</EmptyState> : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m16-my-requests">
          {rows.map((r) => (
            <li key={r.id} className="card min-w-0 space-y-2 p-3" data-status={r.status} data-id={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><div className="mb-1 flex flex-wrap gap-1.5"><KindPill kind={r.kind} /><RequestStatusPill status={r.status} /></div><p className="font-semibold">{pick(r, 'title')}</p></div>
                <span className="text-[12px] text-ink-3">{f.date(r.proposed_at)}</span>
              </div>
              <CouncilSteps status={r.status} />
              <VoteList votes={Array.isArray(r.votes) ? r.votes : []} empty={t('m16.gov.prop.waiting')} />
              {r.status === 'published' && <L to="/skills/changes" className="link text-[12.5px]">{t('m16.gov.prop.seeLog')}</L>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
