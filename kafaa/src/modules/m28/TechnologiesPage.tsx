// FS71 /skills/technologies (staff: internal_content R): hot technologies and in-demand badges. "Hot across ENEC" and "in demand for a
// role" are two different badges from the published criteria (src/modules/m28/technologies.ts), each with the counts behind it
// (<WhyThis>); badges are published per quarter and past quarters stay as they were. Only generic technology names are shown: the
// catalogue refuses vendor and product brands. The role picker starts on my role.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, BenchmarkChips, Callout, EmptyState, Page, Section, SelectField, StatTile, WhyThis } from '../../ui';
import type { Reason } from '../../domain/engines/types';
import { BadgeCriteria, QuarterPicker, SkillLink, useQuarterLabel, useRef70, type Ref, type Row } from './fs70ui';

export default function TechnologiesPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const ref = useRef70();
  const q = useQuery(['technology_badges'], () => repo.list('technology_badges' as never) as Promise<Row[]>);
  const admin = s.can('frameworks', ['W', 'A']);
  return (
    <Page title={t('m28.routes.skills-technologies.title')} intro={t('m28.ht.intro')} wide eyebrow={<BenchmarkChips feature="FS71" />}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/skills/rising" className="btn-outline btn-sm no-underline">{t('m28.ht.toRising')}</L>
        {admin && <L to="/admin/skills/technologies" className="btn-outline btn-sm no-underline" data-testid="m28-ht-to-admin">{t('m28.ht.toAdmin')}</L>}
      </div>}>
      <Async state={ref}>{(r) => <Async state={q} isEmpty={(d) => !d.length} empty={<EmptyState title={t('m28.ht.noBadges')} />}>{(rows) => <Badges r={r} rows={rows} />}</Async>}</Async>
    </Page>
  );
}

const reason = (code: string, vars: Record<string, string | number>): Reason => ({ code, key: `m28.ht.reason.${code}`, vars }) as Reason;

function Badges({ r, rows }: { r: Ref; rows: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const ql = useQuarterLabel();
  const quarters = useMemo(() => [...new Set(rows.map((x) => String(x.quarter)))].sort().reverse(), [rows]);
  const [quarter, setQuarter] = useState(quarters[0]);
  const myRole = s.person?.job_role_id ?? '';
  const inQ = rows.filter((x) => x.quarter === quarter);
  const hot = inQ.filter((x) => x.scope === 'enec').sort((a, b) => Number(a.rank) - Number(b.rank));
  const roleIds = [...new Set(inQ.filter((x) => x.scope === 'role').map((x) => String(x.role_id)))];
  const [role, setRole] = useState(myRole);
  const roleRows = inQ.filter((x) => x.scope === 'role' && x.role_id === role).sort((a, b) => Number(b.family_opportunities) - Number(a.family_opportunities) || String(a.technology_id).localeCompare(String(b.technology_id)));
  const roleOptions = [...new Set([myRole, ...roleIds].filter(Boolean))]
    .map((id) => ({ value: id, label: `${pick(r.roles.get(id) ?? { title_en: id, title_ar: id }, 'title')}${id === myRole ? ` ${t('m28.ht.myRoleTag')}` : ''}` }))
    .sort((a, b) => (a.value === myRole ? -1 : b.value === myRole ? 1 : a.label.localeCompare(b.label)));
  const tech = (id: string) => r.technologies.find((x) => x.id === id);
  const hotIds = new Set(hot.map((x) => x.technology_id));
  return (
    <div className="space-y-6" data-testid="m28-ht" data-quarter={quarter}>
      <QuarterPicker quarters={quarters} value={quarter} onChange={setQuarter} testId="m28-ht-quarters" />
      <p className="text-[13px] text-ink-2" data-testid="m28-ht-published">{t('m28.ht.published', { q: ql(quarter), date: f.date(inQ[0]?.published_at), v: String(inQ[0]?.criteria ?? '') })}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label={t('m28.ht.tile.hot')} value={f.num(hot.length)} sub={t('m28.ht.tile.hotSub')} tone="info" />
        <StatTile label={t('m28.ht.tile.roles')} value={f.num(roleIds.length)} sub={t('m28.ht.tile.rolesSub')} tone="ok" />
        <StatTile label={t('m28.ht.tile.catalogue')} value={f.num(r.technologies.filter((x) => x.status !== 'retired').length)} sub={t('m28.ht.tile.catalogueSub')} />
      </div>
      <Section title={t('m28.ht.hotTitle')} description={t('m28.ht.hotIntro')}>
        {hot.length ? (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m28-ht-hot">
            {hot.map((b) => (
              <TechCard key={b.id} b={b} tc={tech(b.technology_id)} r={r} kind="hot"
                reasons={[reason('sources', { n: Number(b.sources) }), reason('families', { n: Number(b.families) }), reason('recent', { n: Number(b.recent) })]} />
            ))}
          </ul>
        ) : <EmptyState title={t('m28.ht.noHot')} />}
      </Section>
      <Section title={t('m28.ht.roleTitle')} description={t('m28.ht.roleIntro')}>
        <div className="mb-3 max-w-md" data-testid="m28-ht-role">
          <SelectField name="role" label={t('m28.ht.role')} value={role} onChange={setRole} options={roleOptions} placeholder={t('m28.ht.rolePick')} />
        </div>
        {!role ? <EmptyState title={t('m28.ht.noRole')} />
          : roleRows.length ? (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m28-ht-roles">
              {roleRows.map((b) => (
                <TechCard key={b.id} b={b} tc={tech(b.technology_id)} r={r} kind="role" alsoHot={hotIds.has(b.technology_id)}
                  reasons={[...(b.via_profile ? [reason('profile', {})] : []), ...(Number(b.family_opportunities) > 0 ? [reason('family', { n: Number(b.family_opportunities) })] : [])]} />
              ))}
            </ul>
          ) : <EmptyState title={t('m28.ht.noRoleBadges')} />}
      </Section>
      <Section title={t('m28.ht.criteriaTitle')} description={t('m28.ht.criteriaIntro')}><BadgeCriteria /></Section>
      <Callout tone="info" title={t('m28.ht.brandsTitle')}>{t('m28.ht.brandsBody')}</Callout>
    </div>
  );
}

function TechCard({ b, tc, r, kind, reasons, alsoHot }: { b: Row; tc: Row | undefined; r: Ref; kind: 'hot' | 'role'; reasons: Reason[]; alsoHot?: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <li className="min-w-0 rounded-card border border-line bg-panel p-4" data-testid="m28-ht-badge" data-tech={b.technology_id} data-scope={b.scope}>
      <div className="mb-1 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {kind === 'hot' && <span className="caps me-2">{t('m28.rs.rank', { n: f.num(Number(b.rank)) })}</span>}
          <span className="font-semibold">{tc ? pick(tc, 'name') : b.technology_id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${kind === 'hot' ? 'border-accent/40 text-accent' : 'border-ok-line text-ok'}`}>{kind === 'hot' ? t('m28.ht.hot') : t('m28.ht.inDemand')}</span>
          {alsoHot && <span className="chip">{t('m28.ht.alsoHot')}</span>}
          <WhyThis reasons={reasons} testId="m28-ht-why" />
        </div>
      </div>
      {tc && <p className="text-[13px] text-ink-2">{pick(tc, 'description')}</p>}
      {tc && <p className="mt-1 text-[12px] text-ink-3">{t(`m28.ht.cat.${tc.category}`)}</p>}
      {kind === 'hot' && (
        <p className="mt-2 text-[12.5px] text-ink-2" data-testid="m28-ht-counts">{t('m28.ht.counts', { s: f.num(Number(b.sources)), fam: f.num(Number(b.families)), rec: f.num(Number(b.recent)) })}</p>
      )}
      {tc && (tc.skill_ids ?? []).length > 0 && (
        <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[13px]" aria-label={t('m28.ht.skills')}>
          {(tc.skill_ids as string[]).map((id) => <SkillLink key={id} id={id} r={r} />)}
        </div>
      )}
    </li>
  );
}
