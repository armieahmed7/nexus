// M11 /workforce/future/keyspace [FS04]: the one future-skill keyspace. Every ADVANCE skill (as-*), radar key and gap-plan key
// resolves to catalogue skills (sk-*) with a relation (transfers, adapts, new) and the level a person needs. Coverage tiles prove
// nothing is left unjoined; the full crosswalk downloads as CSV (ESCO-style published crosswalk). Admins (frameworks A) edit rows
// through the audited rpc.saveFutureSkillMap; rows are never removed (switched off instead) and a key always keeps one active skill.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Grid, StatTile, DataTable, Drawer, ConfirmDialog, SelectField, TextField, CheckboxField, Tabs, Callout, type Column } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { Can } from '../../auth/guards';
import { NoDecision, RELATION_CLS } from './shared';
import { BenchmarkChips } from './Benchmarks';
import { BENCHMARK_IDS, CREDIT, mapProblems, rowsOf, unresolvedKeys, type MapRow } from './keyspace';
import type { FutureSkillMapInput } from './backend/rpc';

type CatSkill = RowOf<'skills'>;
interface Key { key: string; kind: 'adv_skill' | 'radar' | 'gap_plan'; label: string; group: string; relation?: string }

export default function KeyspacePage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['future_skill_map', 'adv_skills', 'future_skills', 'skill_gap_plans', 'skills', 'adv_technologies'], async () => {
    const [map, adv, fs, plans, skills, techs] = await Promise.all([
      repo.list('future_skill_map', { order: [['key', 'asc'], ['sort', 'asc']] }),
      repo.list('adv_skills', { order: [['sort', 'asc']] }),
      repo.list('future_skills'),
      repo.list('skill_gap_plans'),
      repo.list('skills'),
      repo.list('adv_technologies', { order: [['sort', 'asc']] }),
    ]);
    return { map: map as unknown as MapRow[], adv, fs, plans, skills, techs };
  });
  return (
    <Page title={t('m11.routes.workforce-future-keyspace.title')} eyebrow={t('m11.ks.eyebrow')} intro={t('m11.ks.intro')} actions={<L to="/workforce/future" className="btn-outline btn-sm">{t('m11.ks.backRadar')}</L>}>
      <BenchmarkChips ids={[...BENCHMARK_IDS].reverse()} />
      <Async state={q} isEmpty={(d) => d.map.length === 0} empty={<EmptyState title={t('m11.ks.empty')} />}>{(d) => <Keyspace {...d} />}</Async>
      <NoDecision compact />
    </Page>
  );
}

function Keyspace({ map, adv, fs, plans, skills, techs }: { map: MapRow[]; adv: RowOf<'adv_skills'>[]; fs: RowOf<'future_skills'>[]; plans: RowOf<'skill_gap_plans'>[]; skills: CatSkill[]; techs: RowOf<'adv_technologies'>[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const [edit, setEdit] = useState<Key | null>(null);
  const skName = (id: string) => { const s = skills.find((x) => x.id === id); return s ? pick(s, 'name') : id; };
  const techName = (id: string) => { const x = techs.find((y) => y.id === id); return x ? pick(x, 'family') : id; };
  const radarKeys = useMemo(() => Array.from(new Map(fs.map((x) => [x.skill_key, x])).values()), [fs]);
  const keys: Key[] = [
    ...adv.map((a): Key => ({ key: a.id, kind: 'adv_skill', label: pick(a, 'skill'), group: techName(a.tech_id), relation: a.relation })),
    ...radarKeys.map((r): Key => ({ key: r.skill_key, kind: 'radar', label: pick(r, 'skill'), group: t('m11.ks.radarGroup') })),
  ];
  const planKeys = Array.from(new Set(plans.map((p) => p.skill_key)));
  const resolved = (k: string) => (k.startsWith('sk-') ? skills.some((s) => s.id === k) : rowsOf(map, k).some((m) => skills.some((s) => s.id === m.sk_id)));
  const bad = unresolvedKeys({ advSkills: adv, futureSkills: fs, plans, map, skills });
  const active = map.filter((m) => m.active !== false);
  const rel = (r: string) => active.filter((m) => m.relation === r).length;
  const chips = (k: string) => rowsOf(map, k).map((m) => (
    <span key={m.id} className={`chip ${RELATION_CLS[m.relation] ?? ''}`} title={m.note_en ? pick(m as never, 'note') : undefined}>
      {m.primary_sk && <span aria-hidden>★</span>}{skName(m.sk_id)} · {t(`m11.rel.${m.relation}`)} · {t('m11.ks.lvl', { n: f.num(m.need_level) })}
    </span>
  ));
  const keyCols: Column<Key>[] = [
    { key: 'label', header: t('m11.ks.key'), value: (k) => k.label, sortable: true, render: (k) => <div><div className="font-semibold">{k.label}</div><code className="text-[11.5px] text-ink-3">{k.key}</code></div> },
    { key: 'group', header: t('m11.ks.group'), value: (k) => k.group, sortable: true },
    { key: 'rel', header: t('m11.ks.advRelation'), value: (k) => (k.relation ? t(`m11.rel.${k.relation}`) : '—') },
    { key: 'skills', header: t('m11.ks.catalogue'), value: (k) => rowsOf(map, k.key).map((m) => m.sk_id).join(' '), render: (k) => <div className="flex min-w-[260px] flex-wrap gap-1 text-[11.5px]">{chips(k.key)}</div> },
    { key: 'ok', header: t('m11.ks.resolves'), value: (k) => (resolved(k.key) ? t('common.yes') : t('common.no')), render: (k) => resolved(k.key) ? <span className="chip border-ok-line bg-ok-bg text-ok">✓</span> : <span className="chip border-bad-line bg-bad-bg text-bad">✗</span> },
    { key: 'edit', header: '', csv: false, render: (k) => <Can res="frameworks" levels={['A']}><button className="btn-ghost btn-sm" onClick={() => setEdit(k)} data-testid={`m11-ks-edit-${k.key}`}>{t('common.edit')}</button></Can> },
  ];
  const mapCols: Column<MapRow>[] = [
    { key: 'key', header: t('m11.ks.key'), value: (m) => m.key, sortable: true, render: (m) => <code className="text-[12px]">{m.key}</code> },
    { key: 'kind', header: t('m11.ks.kind'), value: (m) => t(`m11.ks.kinds.${m.key_kind}`), sortable: true },
    { key: 'sk', header: t('m11.ks.catalogue'), value: (m) => `${m.sk_id} ${skName(m.sk_id)}`, sortable: true, render: (m) => <span>{skName(m.sk_id)} <code className="text-[11.5px] text-ink-3">{m.sk_id}</code></span> },
    { key: 'rel', header: t('m11.ks.relation'), value: (m) => m.relation, sortable: true, render: (m) => <span className={`chip ${RELATION_CLS[m.relation] ?? ''}`}>{t(`m11.rel.${m.relation}`)}</span> },
    { key: 'need', header: t('m11.ks.need'), value: (m) => m.need_level, sortable: true, align: 'end', render: (m) => <span className="num">{f.num(m.need_level)}</span> },
    { key: 'primary', header: t('m11.ks.primary'), value: (m) => (m.primary_sk ? 'yes' : ''), render: (m) => (m.primary_sk ? '★' : '') },
    { key: 'active', header: t('m11.ks.active'), value: (m) => (m.active !== false ? 'yes' : 'no'), render: (m) => (m.active !== false ? t('common.yes') : t('common.no')) },
    { key: 'note', header: t('m11.ks.note'), value: (m) => m.note_en ?? '', render: (m) => <span className="text-[12.5px] text-ink-2">{pick(m as never, 'note')}</span> },
  ];
  const planRows = planKeys.map((k) => ({ key: k, label: (() => { const r = fs.find((x) => x.skill_key === k); return r ? pick(r, 'skill') : skName(k); })(), sk: plans.find((p) => p.skill_key === k)?.sk_id ?? null, n: plans.filter((p) => p.skill_key === k).length }));
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m11.ks.statAdv')} value={`${f.num(adv.filter((a) => resolved(a.id)).length)} / ${f.num(adv.length)}`} tone={adv.every((a) => resolved(a.id)) ? 'ok' : 'bad'} sub={t('m11.ks.statAdvSub')} />
        <StatTile label={t('m11.ks.statRadar')} value={`${f.num(radarKeys.filter((r) => resolved(r.skill_key)).length)} / ${f.num(radarKeys.length)}`} tone={radarKeys.every((r) => resolved(r.skill_key)) ? 'ok' : 'bad'} sub={t('m11.ks.statRadarSub')} />
        <StatTile label={t('m11.ks.statPlans')} value={`${f.num(planKeys.filter(resolved).length)} / ${f.num(planKeys.length)}`} tone={planKeys.every(resolved) ? 'ok' : 'bad'} sub={planKeys.length ? t('m11.ks.statPlansSub') : t('m11.ks.statPlansNone')} />
        <StatTile label={t('m11.ks.statCatalogue')} value={f.num(new Set(active.map((m) => m.sk_id)).size)} sub={t('m11.ks.statRel', { t: f.num(rel('transfers')), a: f.num(rel('adapts')), n: f.num(rel('new')) })} />
      </Grid>
      {bad.length > 0 ? <Callout tone="bad" title={t('m11.ks.unresolved')}>{bad.join(', ')}</Callout> : <Callout tone="ok" title={t('m11.ks.allResolved')}>{t('m11.ks.allResolvedBody')}</Callout>}
      <Card>
        <div className="caps mb-2">{t('m11.ks.creditTitle')}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['transfers', 'adapts', 'new'] as const).map((r) => (
            <div key={r} className="flex items-start gap-2 text-[13px]">
              <span className={`chip ${RELATION_CLS[r]}`}>{t(`m11.rel.${r}`)} · ×{f.num(CREDIT[r])}</span>
              <span className="text-ink-2">{t(`m11.ks.relCredit.${r}`)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Tabs tabs={[
        { id: 'adv', label: t('m11.ks.tabAdv'), badge: f.num(adv.length), content: <DataTable rows={keys.filter((k) => k.kind === 'adv_skill')} columns={keyCols} rowKey={(k) => k.key} csvName="kafaa-advance-keyspace" caption={t('m11.ks.tabAdv')} /> },
        { id: 'radar', label: t('m11.ks.tabRadar'), badge: f.num(radarKeys.length), content: <DataTable rows={keys.filter((k) => k.kind === 'radar')} columns={keyCols} rowKey={(k) => k.key} searchable={false} caption={t('m11.ks.tabRadar')} /> },
        { id: 'plans', label: t('m11.ks.tabPlans'), badge: f.num(planKeys.length), content: planRows.length === 0 ? <EmptyState title={t('m11.ks.noPlans')}>{t('m11.ks.noPlansBody')}</EmptyState> : (
          <DataTable rows={planRows} rowKey={(r) => r.key} searchable={false} caption={t('m11.ks.tabPlans')} columns={[
            { key: 'label', header: t('m11.ks.key'), value: (r) => r.label, render: (r) => <div><div className="font-semibold">{r.label}</div><code className="text-[11.5px] text-ink-3">{r.key}</code></div> },
            { key: 'sk', header: t('m11.ks.catalogue'), value: (r) => (r.sk ? skName(r.sk) : '—'), render: (r) => (r.sk ? <span className="chip border-info-line bg-info-bg text-info">{skName(r.sk)}</span> : '—') },
            { key: 'n', header: t('m11.ks.planCount'), value: (r) => r.n, align: 'end', render: (r) => <span className="num">{f.num(r.n)}</span> },
          ]} />
        ) },
        { id: 'all', label: t('m11.ks.tabAll'), badge: f.num(map.length), content: <DataTable rows={map} columns={mapCols} rowKey={(m) => m.id} csvName="kafaa-future-skill-crosswalk" caption={t('m11.ks.tabAll')} /> },
      ]} />
      {edit && <MapEditor k={edit} map={map} skills={skills} onClose={() => setEdit(null)} />}
    </>
  );
}

function MapEditor({ k, map, skills, onClose }: { k: Key; map: MapRow[]; skills: CatSkill[]; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const current = rowsOf(map, k.key);
  const first = current[0];
  const [v, setV] = useState<FutureSkillMapInput>({ key: k.key, key_kind: k.kind, sk_id: first?.sk_id ?? '', relation: (first?.relation as FutureSkillMapInput['relation']) ?? 'adapts', need_level: Number(first?.need_level ?? 2), primary_sk: !!first?.primary_sk, active: true, note_en: first?.note_en ?? '', note_ar: first?.note_ar ?? '' });
  const [confirm, setConfirm] = useState(false);
  const pickRow = (sk: string) => {
    const r = map.find((m) => m.key === k.key && m.sk_id === sk);
    setV(r ? { ...v, sk_id: sk, relation: r.relation as FutureSkillMapInput['relation'], need_level: Number(r.need_level), primary_sk: !!r.primary_sk, active: r.active !== false, note_en: r.note_en ?? '', note_ar: r.note_ar ?? '' } : { ...v, sk_id: sk, primary_sk: false, active: true, note_en: '', note_ar: '' });
  };
  const problems = mapProblems(v);
  const options = skills.filter((s) => s.area !== 'security').map((s) => ({ value: s.id, label: `${pick(s, 'name')} (${s.id})` }));
  const lastActive = current.length === 1 && current[0].sk_id === v.sk_id;
  return (
    <Drawer open onClose={onClose} title={t('m11.ks.editTitle', { key: k.label })}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={problems.length > 0 || (lastActive && v.active === false)} onClick={() => setConfirm(true)} data-testid="m11-ks-save">{t('common.save')}</button></>}>
      <div className="space-y-3" data-testid="m11-ks-form">
        <p className="text-[13px] text-ink-2">{t('m11.ks.editIntro')}</p>
        <SelectField label={t('m11.ks.catalogue')} name="sk" required value={v.sk_id} onChange={pickRow} options={options} />
        <SelectField label={t('m11.ks.relation')} name="relation" value={v.relation} onChange={(x) => setV({ ...v, relation: x as FutureSkillMapInput['relation'] })} options={(['transfers', 'adapts', 'new'] as const).map((r) => ({ value: r, label: `${t(`m11.rel.${r}`)}: ${t(`m11.ks.relCredit.${r}`)}` }))} />
        <SelectField label={t('m11.ks.need')} name="need" value={String(v.need_level)} onChange={(x) => setV({ ...v, need_level: Number(x) })} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: t(`m11.ks.levels.${n}`) }))} />
        <CheckboxField label={t('m11.ks.primaryLabel')} checked={!!v.primary_sk} onChange={(x) => setV({ ...v, primary_sk: x })} hint={t('m11.ks.primaryHint')} />
        <CheckboxField label={t('m11.ks.activeLabel')} checked={v.active !== false} onChange={(x) => setV({ ...v, active: x })} disabled={lastActive} hint={lastActive ? t('m11.ks.lastActive') : t('m11.ks.activeHint')} />
        <TextField label={t('m11.ks.noteEn')} name="note_en" value={v.note_en ?? ''} onChange={(x) => setV({ ...v, note_en: x })} />
        <TextField label={t('m11.ks.noteAr')} name="note_ar" value={v.note_ar ?? ''} onChange={(x) => setV({ ...v, note_ar: x })} />
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m11.ks.saveTitle')} consequence={t('m11.ks.saveBody')} actingAs={t('m11.ks.actingAdmin')}
        onConfirm={async () => { const r = await run(() => repo.rpc.saveFutureSkillMap(v), { success: t('m11.ks.saved') }); if (r.ok) onClose(); }} />
    </Drawer>
  );
}
