/** M10 shared pieces: curriculum alignment (competencies for target roles, CSV export), challenge card, IP routes. */
import { useMemo, useState, type ReactNode } from 'react';
import { useRepo, useQuery } from '../../data';
import type { ResearchChallengesRow } from '../../data/types';
import { Card, Async, EmptyState, DataTable, StatusPill, Icon, toCsv, downloadText, SourceLink, type Column } from '../../ui';
import { hasKey, useFormat, usePick, useT } from '../../i18n';

export const IP_ROUTES = ['moet', 'none'] as const;
export const IP_ROUTE_VALUE: Record<(typeof IP_ROUTES)[number], string> = { moet: 'MoET patents route (May 2026 MoU)', none: 'No invention expected' };
export const MOET_URL = 'https://www.enec.ae/en/news/latest-news/uae-ministry-of-economy-and-tourism-and-enec-partner-to-protect-intellectual-property/';

/** Universities browse the competency library and export the competencies for the roles their graduates target. */
export function CurriculumAlignment() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['job_roles', 'competencies', 'role_competencies', 'proficiency_levels'], async () => {
    const [roles, comps, links, levels] = await Promise.all([
      repo.list('job_roles', { order: [['sort', 'asc']] }),
      repo.list('competencies'),
      repo.list('role_competencies'),
      repo.list('proficiency_levels', { order: [['level', 'asc']] }),
    ]);
    return { roles, comps, links, levels };
  });
  const [sel, setSel] = useState<string[]>(['local-operator']);
  const rows = useMemo(() => {
    const d = q.data;
    if (!d) return [];
    const m = new Map<string, { id: string; code: string; domain: string; name: string; level: number; importance: string; roles: string[] }>();
    for (const l of d.links.filter((x) => sel.includes(x.role_id))) {
      const c = d.comps.find((x) => x.id === l.competency_id);
      if (!c) continue;
      const cur = m.get(c.id);
      const roleName = pick(d.roles.find((r) => r.id === l.role_id), 'title');
      if (cur) {
        cur.level = Math.max(cur.level, l.required_level);
        cur.roles.push(roleName);
        if (l.importance === 'core') cur.importance = 'core';
      } else m.set(c.id, { id: c.id, code: c.code, domain: pick(c, 'domain'), name: pick(c, 'name'), level: l.required_level, importance: l.importance, roles: [roleName] });
    }
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [q.data, sel, pick]);
  const levelName = (n: number) => pick(q.data?.levels.find((l) => l.level === n), 'name') || String(n);
  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'code', header: t('m10.curr.code'), value: (r) => r.code, sortable: true, render: (r) => <span className="num">{r.code}</span> },
    { key: 'domain', header: t('m10.curr.domain'), value: (r) => r.domain, sortable: true },
    { key: 'name', header: t('m10.curr.competency'), value: (r) => r.name, sortable: true },
    { key: 'level', header: t('m10.curr.level'), value: (r) => `${r.level} · ${levelName(r.level)}`, sortable: true },
    { key: 'imp', header: t('m10.curr.importance'), value: (r) => t(`m10.curr.imp.${r.importance}`), render: (r) => <StatusPill tone={r.importance === 'core' ? 'accent' : 'neutral'}>{t(`m10.curr.imp.${r.importance}`)}</StatusPill> },
    { key: 'roles', header: t('m10.curr.roles'), value: (r) => r.roles.join('; ') },
  ];
  return (
    <Card title={t('m10.curr.title')} eyebrow={t('m10.curr.eyebrow')}>
      <p className="mb-3 text-[13px] text-ink-2">{t('m10.curr.intro')}</p>
      <Async state={q} empty={<EmptyState />} isEmpty={(d) => d.roles.length === 0}>
        {(d) => (
          <div className="space-y-3">
            <fieldset>
              <legend className="caps mb-1">{t('m10.curr.targetRoles')}</legend>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-auto" data-testid="m10-roles">
                {d.roles.filter((r) => !r.security_sensitive).map((r) => (
                  <label key={r.id} className={`chip cursor-pointer ${sel.includes(r.id) ? 'border-accent/40 bg-accent-soft text-eyebrow' : 'border-line bg-sunken text-ink-2'}`}>
                    <input type="checkbox" className="sr-only" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} />
                    {pick(r, 'title')}
                  </label>
                ))}
              </div>
            </fieldset>
            {sel.length === 0 ? (
              <EmptyState title={t('m10.curr.pick')} />
            ) : (
              <div data-testid="m10-curriculum">
                <DataTable
                  rows={rows}
                  rowKey={(r) => r.id}
                  columns={columns}
                  toolbar={
                    <button className="btn-outline btn-sm" onClick={() => downloadText(`curriculum-alignment-${sel.join('+')}.csv`, toCsv(rows, columns))} data-testid="m10-curriculum-csv">
                      <Icon name="download" size={14} />
                      {t('m10.curr.export')}
                    </button>
                  }
                />
              </div>
            )}
            <p className="text-[12px] text-ink-3">{t('m10.curr.note')}</p>
          </div>
        )}
      </Async>
    </Card>
  );
}

/** Research themes are stored in English; known themes are translated, new ones show as entered. */
export function useThemeLabel() {
  const t = useT();
  return (theme: string) => {
    const key = `m10.theme.${theme.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '')}`;
    return hasKey(key) ? t(key) : theme;
  };
}

export function ChallengeCard({ c, action }: { c: ResearchChallengesRow; action?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const theme = useThemeLabel();
  return (
    <Card as="article" eyebrow={theme(c.theme)} title={pick(c, 'title')} actions={c.is_published ? <StatusPill status="published">{t('m10.ch.screened')}</StatusPill> : <StatusPill status={c.status}>{t(`m10.ch.st.${c.status}`)}</StatusPill>} className="flex h-full flex-col">
      <p className="text-[13.5px] text-ink-2">{pick(c, 'summary')}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
        {c.closes_on && <span>{t('m10.ch.closes', { date: f.date(c.closes_on) })}</span>}
        {c.screening_signed_at && <span>{t('m10.ch.signedOn', { date: f.date(c.screening_signed_at) })}</span>}
      </div>
      {action && <div className="mt-auto pt-3">{action}</div>}
    </Card>
  );
}

export function MoetLink() {
  const t = useT();
  return <SourceLink href={MOET_URL}>{t('m10.ip.source')}</SourceLink>;
}
