// /knowledge/lectures/:lectureId (M24 · FS44, staff): one lecture from the expert library: abstract, chapters, speaker, the skills it
// teaches, the knowledge-loss-risk position it protects (the band stays in the KLRA; KLRA readers get a link), related lectures and
// knowledge assets on the same skills, and, for the speaker, their contribution and why it counts. The speaker or the
// knowledge-management owner can withdraw it (with a reason).
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, Callout, KeyValue, ConfirmDialog, Icon, SimChip, BenchmarkChips, Timeline, WhyThis } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { contributionReasons, evidenceSkills } from './lectures';
import { ContribPill, LecturePill, LibrarySources, minutes, type Row } from './fs44ui';
import { Chips, useKcLabels, useKcRefs, type KcRefs } from './ui';

export default function LecturePage() {
  const { lectureId = '' } = useParams();
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const refs = useKcRefs();
  const q = useQuery(['lectures', 'contributions', 'knowledge_assets'], async () => {
    const [l, all, assets, mine] = await Promise.all([
      (repo.get('lectures' as never, lectureId) as Promise<Row | null>).catch(() => null),
      (repo.list('lectures' as never, { filter: { status: 'published' } } as never) as Promise<Row[]>).catch(() => [] as Row[]),
      repo.list('knowledge_assets', { filter: { published: true } }).catch(() => [] as RowOf<'knowledge_assets'>[]),
      s.identity.personId ? (repo.list('contributions' as never, { filter: { person_id: s.identity.personId, ref_id: lectureId } } as never) as Promise<Row[]>).catch(() => [] as Row[]) : Promise.resolve([] as Row[]),
    ]);
    return { l, all, assets, mine };
  }, [lectureId, s.identity.personId]);
  return (
    <Page title={t('m24.routes.knowledge-lecture.title')} eyebrow={<span className="flex flex-wrap items-center gap-3"><L to="/knowledge/lectures" className="link">{t('m24.lc.back')}</L><BenchmarkChips feature="FS44" /></span>} wide>
      <Async state={refs}>
        {(r) => (
          <Async state={q} isEmpty={(d) => !d.l} empty={<EmptyState icon="book" title={t('m24.lc.notFound')}>{t('m24.lc.notFoundBody')}</EmptyState>}>
            {(d) => <Lecture l={d.l!} all={d.all} assets={d.assets} mine={d.mine} refs={r} reload={() => q.reload?.()} />}
          </Async>
        )}
      </Async>
    </Page>
  );
}

function Lecture({ l, all, assets, mine, refs, reload }: { l: Row; all: Row[]; assets: RowOf<'knowledge_assets'>[]; mine: Row[]; refs: KcRefs; reload: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const act = useAction();
  const lab = useKcLabels(refs);
  const [withdraw, setWithdraw] = useState(false);
  const skillSet = new Set<string>(l.skill_ids ?? []);
  const related = all.filter((x) => x.id !== l.id && (x.skill_ids ?? []).some((k: string) => skillSet.has(k))).slice(0, 4);
  const relatedAssets = assets.filter((a) => (a.skill_ids ?? []).some((k) => skillSet.has(k))).slice(0, 4);
  const isSpeaker = l.speaker_id === s.identity.personId;
  const owner = s.can('knowledge', ['A']);
  const klraReader = s.can('knowledge', ['A', 'Scope']);
  const skills = useMemo(() => new Map(refs.safeSkills.map((k) => [k.id, { id: k.id, area: k.area, competency_id: k.competency_id, lifecycle: k.lifecycle ?? null, fs_area: k.fs_area ?? null }])), [refs]);
  const c = mine[0];
  const chapters = (l.chapters ?? []) as { at: number; en: string; ar: string }[];
  return (
    <div className="space-y-5" data-testid="m24-lc-detail" data-id={l.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold" data-testid="m24-lc-title">{pick(l, 'title')}</h2>
          <p className="mt-1 text-[13px] text-ink-2">{t('m24.lc.by', { name: pick({ n_en: l.speaker_name, n_ar: l.speaker_name_ar }, 'n'), role: lab.role(l.speaker_role_id) })}</p>
        </div>
        <span className="flex items-center gap-2"><LecturePill status={l.status} /><SimChip label={t('m24.lc.syntheticChip')} /></span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={t('m24.lc.abstract')}><p className="text-[14px] leading-relaxed" data-testid="m24-lc-abstract">{pick(l, 'abstract')}</p></Card>
          <Card title={t('m24.lc.chapters')}>
            {chapters.length === 0 ? <p className="text-[13px] text-ink-3">{t('m24.lc.noChapters')}</p> : (
              <div data-testid="m24-lc-chapters"><Timeline items={chapters.map((ch, i) => ({ id: String(i), when: t('m24.lc.atMinute', { n: f.num(ch.at) }), title: pick({ c_en: ch.en, c_ar: ch.ar }, 'c') }))} /></div>
            )}
          </Card>
          <Card title={t('m24.lc.skillsTitle')}>
            <Chips items={(l.skill_ids ?? []).map((id: string) => <L key={id} to={`/skills/${id}`} className="link">{lab.skill(id)}</L>)} />
            <p className="mt-2 text-[12px] text-ink-3">{t('m24.lc.skillsNote')}</p>
          </Card>
          {(related.length > 0 || relatedAssets.length > 0) && (
            <Card title={t('m24.lc.related')}>
              <ul className="space-y-1.5 text-[13.5px]" data-testid="m24-lc-related">
                {related.map((x) => <li key={x.id} className="flex items-center gap-2"><Icon name="book" size={14} className="text-ink-3" /><L to={`/knowledge/lectures/${x.id}`} className="link">{pick(x, 'title')}</L><span className="text-[12px] text-ink-3">{t('m24.lc.relatedWhy', { n: f.num((x.skill_ids ?? []).filter((k: string) => skillSet.has(k)).length) })}</span></li>)}
                {relatedAssets.map((a) => <li key={a.id} className="flex items-center gap-2"><Icon name="sparkle" size={14} className="text-ink-3" /><L to={`/knowledge/assets/${a.id}`} className="link">{pick(a, 'title')}</L><span className="text-[12px] text-ink-3">{t('m24.lc.relatedAsset')}</span></li>)}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card title={t('m24.lc.facts')}>
            <KeyValue items={[
              [t('m24.lc.form.format'), t(`m24.lc.format.${l.format}`)],
              [t('m24.lc.form.delivered'), f.date(l.delivered_on)],
              [t('m24.lc.form.duration'), minutes(t, f, Number(l.duration_min))],
              [t('m24.lc.form.lang'), t(`m24.lc.lang.${l.lang}`)],
              [t('m24.lc.form.family'), t(`m24.family.${l.system_family}`)],
              [t('m24.lc.form.recording'), <span key="r" className="font-mono">{l.recording_code ?? '—'}</span>],
            ]} />
          </Card>
          <Card title={t('m24.lc.protectsTitle')}>
            {l.position_id ? (
              <div className="space-y-2 text-[13px]" data-testid="m24-lc-position">
                <p><Icon name="shield" size={14} className="me-1 inline text-accent" />{t('m24.lc.protects', { role: pick({ p_en: l.position_title_en, p_ar: l.position_title_ar }, 'p') })}</p>
                <p className="text-[12px] text-ink-3">{t('m24.lc.protectsNote')}</p>
                {klraReader && <L to={`/knowledge/klra/${l.position_id}`} className="link text-[12.5px]" data-testid="m24-lc-klra-link">{t('m24.lc.openKlra')}</L>}
              </div>
            ) : <p className="text-[13px] text-ink-3" data-testid="m24-lc-position-none">{t('m24.lc.noPosition')}</p>}
          </Card>
          {isSpeaker && (
            <Card title={t('m24.lc.myContribution')}>
              {c ? (
                <div className="space-y-2 text-[13px]" data-testid="m24-lc-my-ctb" data-status={c.status}>
                  <div className="flex items-center justify-between gap-2"><ContribPill status={c.status} /><WhyThis reasons={contributionReasons(c as never, evidenceSkills(c.skill_ids ?? [], skills, new Set()).length, !!l.position_id) as never} /></div>
                  {c.note && <p className="text-ink-2">{c.note}</p>}
                  {c.status === 'validated' && <L to="/my/skills" className="link text-[12.5px]">{t('m24.lc.seeSkills')}</L>}
                </div>
              ) : <p className="text-[13px] text-ink-3">{t(l.status === 'published' ? 'm24.lc.ctbSoon' : 'm24.lc.ctbAfterPublish')}</p>}
            </Card>
          )}
          {(isSpeaker || owner) && (l.status === 'published' || l.status === 'review') && (
            <button className="btn-outline btn-sm w-full" onClick={() => setWithdraw(true)} data-testid="m24-lc-withdraw"><Icon name="close" size={14} /> {t('m24.lc.withdraw')}</button>
          )}
          {l.status === 'withdrawn' && <Callout tone="bad" title={t('m24.lc.withdrawnTitle')}>{l.withdrawn_reason}</Callout>}
        </div>
      </div>
      <LibrarySources />
      <ConfirmDialog open={withdraw} onClose={() => setWithdraw(false)} title={t('m24.lc.withdraw')} consequence={t('m24.lc.withdrawConsequence')} requireReason danger
        reasonLabel={t('m24.lc.withdrawReason')} onConfirm={async (reason) => { setWithdraw(false); const r = await act(() => repo.rpc.withdrawLecture(l.id, reason)); if (r.ok) reload(); }} />
    </div>
  );
}
