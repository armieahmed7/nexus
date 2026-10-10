// M01 /careers: Career Map home. Job family tiles by group, search, filters (entry level, regulated, education, level, basis),
// role cards with basis / regulated / reserved badges, and a compare tray (up to three roles).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, FilterBar, useFilters, Icon, Callout } from '../../ui';
import { useT, usePick, L, useNav, useFormat } from '../../i18n';
import { useCareerData, RoleBadges, CareerSourcesFooter, GROUPS, LEVELS, EDUCATION, type CareerData, type Role } from './shared';
import { ConceptBanner } from './horizons';

export default function CareersPage() {
  const t = useT();
  const q = useCareerData();
  return (
    <Page
      title={t('m01.routes.careers.title')}
      eyebrow={t('m01.careers.eyebrow')}
      intro={t('m01.careers.intro')}
      actions={
        <>
          <L to="/careers/paths" className="btn-outline" data-testid="m01-to-paths">
            {t('m01.careers.toPaths')}
          </L>
          <L to="/careers/plan" className="btn-primary" data-testid="m01-to-plan">
            {t('m01.careers.toPlan')}
          </L>
        </>
      }
    >
      <Async state={q}>{(d) => <CareerMap data={d} />}</Async>
    </Page>
  );
}

function CareerMap({ data }: { data: CareerData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const nav = useNav();
  const [flt, setFlt] = useFilters({ q: '', group: '', family: '', level: '', education: '', regulated: '', entry: '', basis: '' }, true);
  const [cmp, setCmp] = useState<string[]>([]);

  const families = data.families.filter((fam) => !flt.group || fam.grp === flt.group);
  const roles = useMemo(() => {
    const term = flt.q.trim().toLowerCase();
    return data.roles.filter((r) => {
      const fam = data.familyById.get(r.family_id);
      if (flt.group && fam?.grp !== flt.group) return false;
      if (flt.family && r.family_id !== flt.family) return false;
      if (flt.level && r.level !== flt.level) return false;
      if (flt.education && r.education !== flt.education) return false;
      if (flt.regulated && String(r.regulated) !== flt.regulated) return false;
      if (flt.entry && String(r.entry_level) !== flt.entry) return false;
      if (flt.basis && r.basis !== flt.basis) return false;
      if (!term) return true;
      return [r.title_en, r.title_ar, r.summary_en, r.summary_ar, r.function_en, r.function_ar, fam?.name_en, fam?.name_ar].some((s) => String(s ?? '').toLowerCase().includes(term));
    });
  }, [data, flt]);
  const countIn = (fid: string) => data.roles.filter((r) => r.family_id === fid).length;
  const toggle = (id: string) => setCmp((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));
  const yesNo = [
    { value: 'true', label: t('common.yes') },
    { value: 'false', label: t('common.no') },
  ];

  return (
    <>
      <Callout tone="info" title={t('m01.careers.calloutTitle')}>
        {t('m01.careers.calloutBody')}
      </Callout>

      <Section title={t('m01.careers.familiesTitle')} description={t('m01.careers.familiesDesc', { n: data.families.length })}>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('m01.careers.groupsLabel')} data-testid="m01-groups">
          {['', ...GROUPS].map((g) => (
            <button key={g || 'all'} role="tab" aria-selected={flt.group === g} className={`chip ${flt.group === g ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`} onClick={() => setFlt({ group: g, family: '' })}>
              {g ? t(`m01.groups.${g}`) : t('m01.careers.allGroups', { n: data.roles.length })}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" data-testid="m01-family-tiles">
          {families.map((fam) => {
            const on = flt.family === fam.id;
            return (
              <button key={fam.id} className={`card p-3 text-start transition hover:border-accent ${on ? 'border-accent bg-accent-soft' : ''}`} aria-pressed={on} onClick={() => setFlt({ family: on ? '' : fam.id })} title={pick(fam, 'description')}>
                <div className="font-semibold leading-snug">{pick(fam, 'name')}</div>
                <div className="num mt-1 text-[12px] text-ink-3">{t('m01.careers.rolesCount', { n: f.num(countIn(fam.id)) })}</div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={t('m01.careers.rolesTitle')} description={t('m01.careers.showing', { n: f.num(roles.length), total: f.num(data.roles.length) })}>
        <FilterBar
          value={flt}
          onChange={setFlt}
          search="q"
          fields={[
            { key: 'family', label: t('m01.f.family'), options: data.families.map((x) => ({ value: x.id, label: pick(x, 'name') })) },
            { key: 'entry', label: t('m01.f.entry'), options: yesNo },
            { key: 'regulated', label: t('m01.f.regulated'), options: yesNo },
            { key: 'education', label: t('m01.f.education'), options: EDUCATION.map((e) => ({ value: e, label: t(`m01.education.${e}`) })) },
            { key: 'level', label: t('m01.f.level'), options: LEVELS.map((e) => ({ value: e, label: t(`m01.level.${e}`) })) },
            { key: 'basis', label: t('m01.f.basis'), options: ['barakah', 'generic', 'uncertain'].map((e) => ({ value: e, label: t(`m01.basis.${e}`) })) },
          ]}
        />
        {roles.length === 0 ? (
          <EmptyState title={t('m01.careers.noRoles')} action={<button className="btn-outline btn-sm" onClick={() => setFlt({ q: '', group: '', family: '', level: '', education: '', regulated: '', entry: '', basis: '' })}>{t('common.clearFilters')}</button>} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m01-role-list">
            {roles.map((r) => (
              <RoleCard key={r.id} role={r} data={data} selected={cmp.includes(r.id)} onToggle={() => toggle(r.id)} full={cmp.length >= 3} />
            ))}
          </ul>
        )}
      </Section>

      {data.concepts.length > 0 && (
        <Section
          title={t('m01.fs05.careers.futureTitle')}
          description={t('m01.fs05.careers.futureDesc', { n: f.num(data.concepts.length) })}
          actions={
            <L to="/careers/horizons" className="btn-outline btn-sm" data-testid="m01-to-horizons">
              {t('m01.fs05.careers.toHorizons')}
            </L>
          }
        >
          <ConceptBanner />
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m01-concept-list">
            {data.concepts.map((r) => (
              <Card as="li" key={r.id} className="flex flex-col">
                <div className="caps mb-1">
                  {pick(data.familyById.get(r.family_id), 'name')} · {t('m01.fs05.concept.pill')}
                </div>
                <h3 className="text-[15px] font-semibold leading-snug">
                  <L to={`/careers/roles/${r.id}`} data-testid="m01-concept-link">
                    {pick(r, 'title')}
                  </L>
                </h3>
                <p className="mt-1 line-clamp-3 flex-1 text-[13px] text-ink-2">{pick(r, 'summary')}</p>
                <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-2 text-[12px]">
                  <span className="text-ink-3">{t('m01.fs05.overview.from')}</span>
                  {data.futurePaths
                    .filter((e) => e.to_role_id === r.id)
                    .map((e) => (
                      <span key={e.id} className="chip border-line bg-sunken">
                        {pick(data.roleById.get(e.from_role_id!), 'title')}
                      </span>
                    ))}
                </div>
              </Card>
            ))}
          </ul>
        </Section>
      )}

      <CareerSourcesFooter data={data} ids={['fanr-reg17', 'ssg75', 'sr2024', 'cns10']} />

      {cmp.length > 0 && (
        <div className="sticky bottom-3 z-20" data-testid="m01-compare-tray">
          <div className="card flex flex-wrap items-center justify-between gap-2 border-accent p-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="caps">{t('m01.compare.tray', { n: cmp.length })}</span>
              {cmp.map((id) => (
                <button key={id} className="chip border-line bg-sunken" onClick={() => toggle(id)} aria-label={t('m01.compare.remove', { role: pick(data.roleById.get(id), 'title') })}>
                  {pick(data.roleById.get(id), 'title')} <Icon name="close" size={11} className="ms-1 inline" />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => setCmp([])}>
                {t('m01.compare.clear')}
              </button>
              <button className="btn-primary btn-sm" disabled={cmp.length < 2} onClick={() => nav(`/careers/compare?roles=${cmp.join(',')}`)} data-testid="m01-compare-go">
                {t('m01.compare.go')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RoleCard({ role, data, selected, onToggle, full }: { role: Role; data: CareerData; selected: boolean; onToggle: () => void; full: boolean }) {
  const t = useT();
  const pick = usePick();
  const fam = data.familyById.get(role.family_id);
  return (
    <Card as="li" className={`flex flex-col ${selected ? 'border-accent' : ''}`}>
      <div className="caps mb-1">
        {pick(fam, 'name')} · {t(`m01.level.${role.level}`)}
      </div>
      <h3 className="text-[15px] font-semibold leading-snug">
        <L to={`/careers/roles/${role.id}`} data-testid="m01-role-link">
          {pick(role, 'title')}
        </L>
      </h3>
      <p className="mt-1 line-clamp-3 flex-1 text-[13px] text-ink-2">{pick(role, 'summary')}</p>
      <div className="mt-3">
        <RoleBadges role={role} compact />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[12.5px]">
        <span className="text-ink-3">{t(`m01.education.${role.education}`)}</span>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={selected} disabled={!selected && full} onChange={onToggle} data-testid="m01-compare-check" />
          {t('m01.compare.add')}
        </label>
      </div>
    </Card>
  );
}
