// FS62 /national/alignment/:tagId (national_alignment R/Agg/W/A): one national tag. Its definition in EN and AR, horizon and owner,
// every source with its tier (the most official first; a visible flag and the reason when the best source is secondary or indirect), its
// pillars, goals or groups, and the filtered report of the skills, programmes and targets that serve it: live status, how each is linked
// (curated, or derived from the FS02 Jahiz group / FS41 Net Zero data) with <WhyThis>, and measures for HR and admins (suppressed under 10).
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { Page, Section, Card, Async, Callout, KeyValue, StatTile, BenchmarkChips, EmptyState, StatusPill, Tabs } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ITEM_KINDS, tagSourceView, type TagRow } from './national';
import { ReportTable } from './reportUi';
import { NotGovernmentCallout, SourceList, SourceStanding, useNaRef } from './ui';

export default function NationalTagPage() {
  const t = useT();
  const { tagId = '' } = useParams();
  const pick = usePick();
  const ref = useNaRef();
  const tag = ref.data?.tags.find((x) => x.id === tagId);
  return (
    <Page title={tag ? pick(tag, 'name') : t('m37.routes.national-alignment-tag.title')} intro={t('m37.tag.intro')} wide
      eyebrow={<div className="flex flex-wrap gap-2"><BenchmarkChips feature="FS62" />{tag?.benchmark_ids?.length ? <BenchmarkChips ids={tag.benchmark_ids} /> : null}</div>}
      actions={<L to="/national/alignment" className="btn-ghost btn-sm no-underline">{t('m37.tag.back')}</L>}>
      <Async state={ref}>{(d) => {
        const tg = d.tags.find((x) => x.id === tagId);
        return tg ? <TagView tag={tg} tags={d.tags} d={d} /> : <EmptyState title={t('m37.tag.notFound')} />;
      }}</Async>
    </Page>
  );
}

function TagView({ tag, tags, d }: { tag: TagRow; tags: TagRow[]; d: NonNullable<ReturnType<typeof useNaRef>['data']> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const [kind, setKind] = useState('all');
  const rep = useQuery(['national_tags', 'tag_links', 'skills', 'person_skills'], () => repo.rpc.nationalReport({ tag_id: tag.id }), [tag.id]);
  const parent = tag.parent_id ? tags.find((x) => x.id === tag.parent_id) : undefined;
  const kids = tags.filter((x) => x.parent_id === tag.id && x.status === 'active');
  const view = tagSourceView(tag.sources ?? [], tag.source_scope);
  return (
    <div className="space-y-6" data-testid="m37-tag" data-tag={tag.id} data-flagged={view?.flagged ? 'true' : 'false'}>
      {tag.status === 'retired' && <Callout tone="bad" title={t('m37.tag.retired')} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={t('m37.tag.definition')} eyebrow={t(`m37.strategy.${tag.strategy}`)}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m37-tag-bilingual">
              <div><p className="caps mb-1 text-[10.5px] text-ink-3">English</p><p className="font-semibold" lang="en" dir="ltr">{tag.name_en}</p><p className="text-[13px] text-ink-2" lang="en" dir="ltr">{tag.summary_en}</p></div>
              <div><p className="caps mb-1 text-[10.5px] text-ink-3">العربية</p><p className="font-semibold" lang="ar" dir="rtl">{tag.name_ar}</p><p className="text-[13px] text-ink-2" lang="ar" dir="rtl">{tag.summary_ar}</p></div>
            </div>
            <KeyValue items={[
              [t('m37.tag.kind'), t(`m37.tagKind.${tag.kind}`)],
              [t('m37.tag.code'), <span key="c" className="num">{tag.code}</span>],
              [t('m37.tag.horizon'), tag.horizon_year == null ? '—' : f.num(tag.horizon_year, { useGrouping: false })],
              [t('m37.tag.owner'), pick(tag, 'owner') || '—'],
              ...(parent ? [[t('m37.tag.parent'), <L key="p" to={`/national/alignment/${parent.id}`}>{pick(parent, 'name')}</L>] as [string, JSX.Element]] : []),
              ...(tag.derive ? [[t('m37.tag.derived'), t(`m37.derive.${tag.derive}`)] as [string, string]] : []),
            ]} />
          </div>
        </Card>
        <Card title={t('m37.tag.sources')}>
          <div className="space-y-3">
            <SourceStanding tag={tag} />
            <SourceList sources={tag.sources ?? []} />
          </div>
        </Card>
      </div>
      {kids.length > 0 && (
        <Section title={t('m37.tag.children')}>
          <ul className="flex flex-wrap gap-2" data-testid="m37-tag-children">
            {kids.map((k) => <li key={k.id}><L to={`/national/alignment/${k.id}`} className="chip border-line bg-panel normal-case tracking-normal no-underline">{pick(k, 'name')}</L></li>)}
          </ul>
        </Section>
      )}
      <Section title={t('m37.tag.reportTitle')} description={t('m37.tag.reportIntro')}>
        <Async state={rep} isEmpty={(x) => !x} empty={<EmptyState title={t('m37.none')} />}>{(r) => {
          if (!r) return null;
          const s = r.tags.find((x) => x.tag_id === tag.id);
          const shown = { ...r, items: kind === 'all' ? r.items : r.items.filter((i) => i.kind === kind) };
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m37-tag-tiles">
                <StatTile label={t('m37.count.skills')} value={f.num(s?.skills ?? 0)} />
                <StatTile label={t('m37.count.programmes')} value={f.num(s?.programmes ?? 0)} />
                <StatTile label={t('m37.count.targets')} value={f.num(s?.targets ?? 0)} tone="ok" />
                <StatTile label={t('m37.hub.reach')} value={!r.measures ? '—' : s?.reach == null ? t('common.suppressedShort') : f.num(s.reach)} sub={r.measures ? t('m37.tag.reachSub') : t('m37.tag.reachHidden')} tone="info" />
              </div>
              <Tabs value={kind} onChange={setKind} tabs={[{ id: 'all', label: t('m37.kind.all'), content: null }, ...ITEM_KINDS.map((k) => ({ id: k, label: t(`m37.kind.${k}`), content: null }))]} />
              {shown.items.length ? <ReportTable r={shown} d={d} showTag={kids.length > 0} fileBase={`kafaa-national-${tag.code.toLowerCase()}`} /> : <EmptyState title={t('m37.tag.noItems')} />}
              {!r.measures && <p className="text-[12.5px] text-ink-3">{t('m37.report.noMeasures')}</p>}
            </div>
          );
        }}</Async>
      </Section>
      <div className="flex flex-wrap items-center gap-2"><StatusPill tone="neutral">{t('m37.tag.version', { n: f.num(tag.version ?? 1) })}</StatusPill></div>
      <NotGovernmentCallout />
    </div>
  );
}
