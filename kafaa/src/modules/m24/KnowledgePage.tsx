// /knowledge (M24 · F21): the knowledge base. BM25 search (F02 SearchEngine) across published knowledge assets, OE lessons and
// courses, filtered by skill and system family, with a citation on every result. An asset pulls in the OE lessons its reviewer
// linked. "Used by N" shows from 10 people. Also the SME directory (opted-in, listed profiles) and the read-before-requalification
// list. Withdrawn assets are not readable, so they leave the index at the next refresh.
import { useMemo, useState } from 'react';
import { Page, Async, EmptyState, Tabs, Card, EngineBadge, Icon, Callout, SourceLink } from '../../ui';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { SYSTEM_FAMILIES, showUsedBy } from './capture';
import { kbDocs, searchKb, type AssetLite, type KbHit } from './kb';
import { Chips, Sources, CAPTURE_SOURCES, useKcLabels, useKcRefs, type KcRefs } from './ui';

export default function KnowledgePage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const refs = useKcRefs();
  const q = useQuery(['knowledge_assets', 'sme_profiles'], async () => {
    const [assets, smes] = await Promise.all([
      repo.list('knowledge_assets', { filter: { published: true }, order: [['published_at', 'desc']] }).catch(() => [] as RowOf<'knowledge_assets'>[]),
      repo.list('sme_profiles', { filter: { listed: true } }).catch(() => [] as RowOf<'sme_profiles'>[]),
    ]);
    return { assets, smes };
  }, [s.identity.personId]);
  return (
    <Page title={t('m24.routes.knowledge.title')} intro={t('m24.kb.intro')} wide
      actions={<span className="flex flex-wrap gap-2"><L to="/knowledge/lectures" className="btn-outline btn-sm" data-testid="m24-kb-to-lectures">{t('m24.routes.knowledge-lectures.title')}</L><L to="/knowledge/localisation" className="btn-outline btn-sm">{t('m24.routes.knowledge-localisation.title')}</L><L to="/knowledge/capture" className="btn-outline btn-sm">{t('m24.kb.toCapture')}</L>{s.can('knowledge', ['W', 'A']) && <L to="/knowledge/review" className="btn-outline btn-sm">{t('m24.kb.toReview')}</L>}</span>}>
      <Async state={refs}>
        {(r) => (
          <Async state={q}>
            {(d) => (
              <Tabs tabs={[
                { id: 'search', label: t('m24.kb.tabSearch'), content: <Search refs={r} assets={d.assets} /> },
                { id: 'experts', label: t('m24.kb.tabExperts'), content: <Experts refs={r} smes={d.smes} /> },
                { id: 'requal', label: t('m24.kb.tabRequal'), content: <Requal refs={r} assets={d.assets} /> },
              ]} />
            )}
          </Async>
        )}
      </Async>
    </Page>
  );
}

function Search({ refs, assets }: { refs: KcRefs; assets: RowOf<'knowledge_assets'>[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const eng = useEngine('search');
  const lab = useKcLabels(refs);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'' | 'asset' | 'oe' | 'course'>('');
  const [skill, setSkill] = useState('');
  const [family, setFamily] = useState('');
  const data = useMemo(() => ({ assets: assets as unknown as AssetLite[], oe: refs.oe as never, courses: refs.safeCourses as never }), [assets, refs]);
  const docs = useMemo(() => kbDocs(data.assets, data.oe, data.courses, (id) => { const s = refs.skills.find((x) => x.id === id); return { en: s?.name_en ?? id, ar: s?.name_ar ?? id }; }), [data, refs.skills]);
  const index = useMemo(() => eng.search(docs), [eng, docs]);
  const comp = refs.skills.find((x) => x.id === skill)?.competency_id;
  const hits = useMemo(() => searchKb(index, docs, text, data, { kind, skillId: skill || undefined, skillCompetency: comp, family: family || undefined }, lang), [index, docs, text, data, kind, skill, comp, family, lang]);
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const browse = assets.filter((a) => (!skill || (a.skill_ids ?? []).includes(skill)) && (!family || a.system_family === family));
  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[260px] flex-[2]"><span className="caps">{t('common.search')}</span>
          <input className="input mt-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('m24.kb.searchHint')} data-testid="m24-kb-search" /></label>
        <label className="block min-w-[180px] flex-1"><span className="caps">{t('m24.kb.skill')}</span>
          <select className="input mt-1" value={skill} onChange={(e) => setSkill(e.target.value)} data-testid="m24-kb-skill"><option value="">{t('m24.common.all')}</option>{refs.safeSkills.map((s) => <option key={s.id} value={s.id}>{pick(s, 'name')}</option>)}</select></label>
        <label className="block min-w-[160px] flex-1"><span className="caps">{t('m24.kb.family')}</span>
          <select className="input mt-1" value={family} onChange={(e) => setFamily(e.target.value)} data-testid="m24-kb-family"><option value="">{t('m24.common.all')}</option>{SYSTEM_FAMILIES.map((x) => <option key={x} value={x}>{t(`m24.family.${x}`)}</option>)}</select></label>
        <EngineBadge engine={eng} />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('m24.kb.kind')}>
        {(['', 'asset', 'oe', 'course'] as const).map((k) => <button key={k || 'all'} className={`chip ${kind === k ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-sunken text-ink-2'}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{t(`m24.kb.kind_${k || 'all'}`)}</button>)}
      </div>
      {text.trim() ? (
        hits.length === 0 ? <EmptyState icon="search" title={t('m24.kb.none')}>{t('m24.kb.noneBody')}</EmptyState> : (
          <ul className="space-y-3" data-testid="m24-kb-results">
            {hits.map((h) => <Hit key={h.id} h={h} asset={h.kind === 'asset' ? assetById.get(h.ref) : undefined} refs={refs} />)}
          </ul>
        )
      ) : (
        <div className="space-y-3">
          <h2 className="caps">{t('m24.kb.latest')}</h2>
          {browse.length === 0 ? <EmptyState icon="book" title={t('m24.kb.noAssets')} /> : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m24-kb-latest">
              {browse.map((a) => (
                <li key={a.id} className="card flex flex-col p-4">
                  <L to={`/knowledge/assets/${a.id}`} className="link font-semibold">{pick(a, 'title')}</L>
                  <p className="mt-1 text-[13px] text-ink-2">{pick(a, 'summary')}</p>
                  <div className="mt-2"><Chips items={(a.skill_ids ?? []).slice(0, 3).map(lab.skill)} /></div>
                  <p className="mt-auto pt-2 text-[12px] text-ink-3">{t('m24.kb.citeAsset', { sme: pick({ name_en: a.sme_name, name_ar: a.sme_name_ar }, 'name'), date: f.date(a.published_at) })} · {showUsedBy(a.used_by) ? t('m24.kb.usedBy', { n: f.num(a.used_by) }) : t('m24.kb.usedByFew')}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="text-[12px] text-ink-3">{t('m24.kb.method')} <Sources list={CAPTURE_SOURCES} /></p>
    </div>
  );
}

function Hit({ h, asset, refs }: { h: KbHit; asset?: RowOf<'knowledge_assets'>; refs: KcRefs }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useKcLabels(refs);
  const oe = h.kind === 'oe' ? refs.oe.find((o) => o.id === h.ref) : undefined;
  const course = h.kind === 'course' ? refs.courses.find((c) => c.id === h.ref) : undefined;
  const icon = h.kind === 'asset' ? 'book' : h.kind === 'oe' ? 'alert' : 'grad';
  return (
    <li className={`card p-4 ${h.via ? 'ms-6 border-dashed' : ''}`} data-testid={`m24-kb-hit-${h.kind}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="chip border-line bg-sunken text-ink-2"><Icon name={icon} size={12} />{t(`m24.kb.kind_${h.kind}`)}</span>
          {h.via && <span className="ms-2 text-[12px] text-ink-3">{t('m24.kb.relatedVia')}</span>}
          <div className="mt-1">
            <L to={h.doc.route ?? '/knowledge'} className="link font-semibold">{pick({ t_en: h.doc.title.en, t_ar: h.doc.title.ar }, 't')}</L>
          </div>
        </div>
        {h.score > 0 && <span className="num text-[11.5px] text-ink-3" title={t('m24.kb.score')}>{f.num(h.score, { maximumFractionDigits: 1 })}</span>}
      </div>
      {h.snippet.length > 0 && <p className="mt-1 text-[13px] text-ink-2">{h.snippet.join(' … ')}</p>}
      <p className="mt-2 text-[12px] text-ink-3" data-testid="m24-kb-citation">
        {asset && <>{t('m24.kb.citeAsset', { sme: pick({ name_en: asset.sme_name, name_ar: asset.sme_name_ar }, 'name'), date: f.date(asset.published_at) })} · {t('m24.kb.citeReviewed')} · {showUsedBy(asset.used_by) ? t('m24.kb.usedBy', { n: f.num(asset.used_by) }) : t('m24.kb.usedByFew')}</>}
        {oe && <>{t('m24.kb.citeOe', { date: f.date(oe.reviewed_on), body: oe.reviewing_body })}</>}
        {course && <>{t('m24.kb.citeCourse', { code: course.code })}</>}
      </p>
      {asset && (asset.oe_ids ?? []).length > 0 && <div className="mt-2"><Chips items={(asset.oe_ids ?? []).map((id) => <L key={id} to="/oe" className="link">{pick(lab.oe(id), 'title') || id}</L>)} /></div>}
    </li>
  );
}

function Experts({ refs, smes }: { refs: KcRefs; smes: RowOf<'sme_profiles'>[] }) {
  const t = useT();
  const pick = usePick();
  const lab = useKcLabels(refs);
  return (
    <div className="space-y-3 pt-4">
      <Callout>{t('m24.kb.expertsNote')}</Callout>
      {smes.length === 0 ? <EmptyState icon="users" title={t('m24.kb.noExperts')} /> : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m24-kb-experts">
          {smes.map((x) => (
            <li key={x.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{pick({ name_en: x.person_name, name_ar: x.person_name_ar }, 'name')}</span>
                <span className={`chip ${x.availability === 'available' ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-2'}`}>{t(`m24.availability.${x.availability}`)}</span>
              </div>
              <div className="text-[12.5px] text-ink-2">{lab.role(x.role_id)} · {t(`m24.smeKind.${x.kind}`)}</div>
              {x.headline && <p className="mt-2 text-[13px]">{x.headline}</p>}
              <div className="mt-2"><Chips items={(x.skill_ids ?? []).map(lab.skill)} /></div>
              {x.departing_band !== 'unspecified' && <p className="mt-2 text-[12px] text-sim">{t(`m24.window.${x.departing_band}`)}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Requal({ refs, assets }: { refs: KcRefs; assets: RowOf<'knowledge_assets'>[] }) {
  const t = useT();
  const pick = usePick();
  const lab = useKcLabels(refs);
  const stds = [...new Set(assets.flatMap((a) => a.requal_standard_ids ?? []))].sort();
  return (
    <div className="space-y-3 pt-4">
      <p className="text-[13px] text-ink-2">{t('m24.kb.requalIntro')}</p>
      {stds.length === 0 ? <EmptyState icon="book" title={t('m24.kb.noRequal')} /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m24-kb-requal">
          {stds.map((sid) => (
            <Card key={sid} title={lab.standard(sid)}>
              <ul className="list-disc space-y-1 ps-4 text-[13px]">
                {assets.filter((a) => (a.requal_standard_ids ?? []).includes(sid)).map((a) => <li key={a.id}><L to={`/knowledge/assets/${a.id}`} className="link">{pick(a, 'title')}</L></li>)}
              </ul>
            </Card>
          ))}
        </div>
      )}
      <p className="text-[12px] text-ink-3">{t('m24.kb.mirrorNote')} <SourceLink href="https://www.fanr.gov.ae/en/Documents/REG-16-English.pdf">FANR-REG-16</SourceLink></p>
    </div>
  );
}
