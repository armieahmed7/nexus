// M02 /competencies: public competency library. Two layers (development vs authorisation), the four proficiency levels with
// nuclear meanings, competency domains with level descriptors and the roles that need each competency, plus a domain x
// family heatmap of the highest level required.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Grid, Async, EmptyState, FilterBar, useFilters, Heatmap, Callout, StatusPill, SourceLink } from '../../ui';
import { useQuery, useRepo, type Repository } from '../../data';
import { useT, usePick, L, useFormat } from '../../i18n';

export default function CompetenciesPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['competencies', 'proficiency_levels', 'role_competencies', 'job_roles', 'job_families', 'sources', 'skills', 'skill_descriptors'], () => load(repo));
  return (
    <Page title={t('m02.routes.competencies.title')} intro={t('m02.lib.intro')}
      actions={<><L to="/competencies/levels" className="btn-outline" data-testid="m02-to-levels">{t('m02.lib.toLevels')}</L><L to="/competencies/scale" className="btn-ghost">{t('m02.lib.toScale')}</L></>}>
      <Async state={q}>{(d) => <Library d={d} />}</Async>
    </Page>
  );
}

async function load(repo: Repository) {
  {
    const [comps, levels, rc, roles, fams, sources, coreSkills, descs] = await Promise.all([
      repo.list('competencies', { order: [['code', 'asc']] }),
      repo.list('proficiency_levels', { order: [['level', 'asc']] }),
      repo.list('role_competencies'),
      repo.list('job_roles', { filter: { status: 'published' }, order: [['sort', 'asc']] }),
      repo.list('job_families', { order: [['sort', 'asc']] }),
      repo.list('sources', { filter: { id: ['fanr-reg17', 'cns10', 'ssg75'] } }),
      repo.list('skills', { filter: { core: true } }).catch(() => []), // FS23: the core skill of each competency
      repo.list('skill_descriptors', { filter: { status: 'published' } }).catch(() => []),
    ]);
    const coreOf = new Map(coreSkills.map((s) => [s.competency_id as string, s.id as string]));
    const descOf = new Map(descs.map((x) => [`${x.skill_id}|${x.level}`, x]));
    return { comps, levels, rc, roles, fams, sources, roleById: new Map(roles.map((r) => [r.id, r])), coreOf, descOf };
  }
}

type D = Awaited<ReturnType<typeof load>>;

function Library({ d }: { d: D }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const [flt, setFlt] = useFilters({ q: '', domain: '', role: '' }, true);
  const [open, setOpen] = useState<string | null>(null);
  const domains = useMemo(() => [...new Map(d.comps.map((c) => [c.domain, c])).values()], [d.comps]);
  const list = d.comps.filter((c) => {
    if (flt.domain && c.domain !== flt.domain) return false;
    if (flt.role && !d.rc.some((r) => r.role_id === flt.role && r.competency_id === c.id)) return false;
    const term = flt.q.trim().toLowerCase();
    return !term || [c.code, c.name_en, c.name_ar, c.description_en, c.description_ar].some((s) => s.toLowerCase().includes(term));
  });
  const famsUsed = d.fams.filter((fam) => d.roles.some((r) => r.family_id === fam.id));
  const maxLevel = (domain: string, fam: string) => {
    const ids = new Set(d.comps.filter((c) => c.domain === domain).map((c) => c.id));
    return d.rc.filter((r) => ids.has(r.competency_id) && d.roleById.get(r.role_id)?.family_id === fam).reduce((m, r) => Math.max(m, r.required_level), 0);
  };
  return (
    <>
      <Grid cols={2}>
        <Card title={t('m02.lib.layer1Title')} eyebrow={t('m02.lib.layer1Eyebrow')}>
          <p className="text-[14px]">{t('m02.lib.layer1Body')}</p>
        </Card>
        <Card title={t('m02.lib.layer2Title')} eyebrow={t('m02.lib.layer2Eyebrow')}>
          <p className="text-[14px]">{t('m02.lib.layer2Body')}</p>
        </Card>
      </Grid>
      <Callout tone="info" title={t('m02.lib.satTitle')}>
        {t('m02.lib.satBody')}{' '}
        {d.sources.map((s) => (
          <span key={s.id} className="me-2 inline-block">
            <SourceLink href={s.url} date={s.accessed}>
              {s.label}
            </SourceLink>
          </span>
        ))}
      </Callout>

      <Section title={t('m02.lib.levelsTitle')}>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m02-levels">
          {d.levels.map((l) => (
            <li key={l.id} className="card p-4">
              <div className="num text-[22px] font-semibold text-accent">{f.num(l.level)}</div>
              <div className="font-semibold">{pick(l, 'name')}</div>
              <p className="mt-1 text-[13px] text-ink-2">{pick(l, 'description')}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t('m02.lib.compsTitle')} description={t('m02.lib.compsDesc', { n: f.num(d.comps.length), d: f.num(domains.length) })}>
        <FilterBar
          value={flt}
          onChange={setFlt}
          search="q"
          fields={[
            { key: 'domain', label: t('m02.lib.domain'), options: domains.map((c) => ({ value: c.domain, label: pick(c, 'domain') })) },
            { key: 'role', label: t('m02.lib.role'), options: d.roles.map((r) => ({ value: r.id, label: pick(r, 'title') })) },
          ]}
        />
        {list.length === 0 ? (
          <EmptyState title={t('m02.lib.none')} />
        ) : (
          <ul className="space-y-2" data-testid="m02-competency-list">
            {list.map((c) => {
              const roles = d.rc.filter((r) => r.competency_id === c.id).sort((a, b) => b.required_level - a.required_level);
              const lv = Array.isArray(c.levels) ? (c.levels as { level: number; en: string; ar: string }[]) : [];
              const isOpen = open === c.id;
              return (
                <li key={c.id} className="card p-0">
                  <button className="flex w-full items-start justify-between gap-3 p-4 text-start" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)}>
                    <span>
                      <span className="caps">
                        {c.code} · {pick(c, 'domain')}
                      </span>
                      <span className="block font-semibold">{pick(c, 'name')}</span>
                    </span>
                    <StatusPill tone="neutral">{t('m02.lib.rolesN', { n: f.num(roles.length) })}</StatusPill>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-1 gap-4 border-t border-line p-4 md:grid-cols-2">
                      <div>
                        <div className="caps mb-1">{t('m02.lib.descriptors')}</div>
                        {/* FS23: behaviourally anchored descriptors of the competency's core skill (the old template text only as a fallback) */}
                        <ol className="space-y-1.5 text-[13px]" data-testid={`m02-lib-desc-${c.id}`}>
                          {lv.map((x) => {
                            const sk = d.coreOf.get(c.id);
                            const fs = sk ? d.descOf.get(`${sk}|${x.level}`) : undefined;
                            return (
                              <li key={x.level}>
                                <span className="font-semibold">{pick(d.levels.find((l) => l.level === x.level), 'name')}: </span>
                                {fs ? pick(fs, 'essence') : sk ? <span className="text-ink-3">{t('m02.lib.notDefined')}</span> : pick({ v_en: x.en, v_ar: x.ar }, 'v')}
                              </li>
                            );
                          })}
                        </ol>
                        {d.coreOf.get(c.id) && <L to={`/competencies/descriptors/${d.coreOf.get(c.id)}`} className="mt-1 inline-block text-[12.5px]">{t('m02.lib.seeIndicators')}</L>}
                      </div>
                      <div>
                        <div className="caps mb-1">{t('m02.lib.linkedRoles')}</div>
                        {roles.length === 0 ? (
                          <p className="text-ink-3">—</p>
                        ) : (
                          <ul className="space-y-1 text-[13px]">
                            {roles.map((r) => (
                              <li key={r.role_id} className="flex items-center justify-between gap-2">
                                <L to={`/careers/roles/${r.role_id}`}>{pick(d.roleById.get(r.role_id), 'title')}</L>
                                <span className="num text-ink-3">{t('m02.lib.levelN', { n: f.num(r.required_level) })}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t('m02.lib.heatTitle')} description={t('m02.lib.heatDesc')}>
        <Card>
          <Heatmap
            title={t('m02.lib.heatTitle')}
            rows={domains.map((c) => c.domain)}
            cols={famsUsed.map((x) => x.id)}
            rowLabel={(r) => pick(domains.find((c) => c.domain === r), 'domain')}
            colLabel={(c) => pick(famsUsed.find((x) => x.id === c), 'name')}
            value={(r, c) => {
              const v = maxLevel(r, c);
              return { v: v || null };
            }}
          />
        </Card>
      </Section>
    </>
  );
}
