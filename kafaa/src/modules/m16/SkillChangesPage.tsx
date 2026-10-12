// /skills/changes (M16 · FS54, public): the skills catalogue change log. Every change the skills council published (added, renamed,
// split, retired, re-levelled skills), grouped by month, with what changed before and after, the roles that decided it (never names),
// the methodology flag and the dashboards it moves. Retired skills stay readable (obsolete, never removed). Staff can propose a change.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, BarChart, BenchmarkChips, Callout, Card, EmptyState, Icon, Page, SourceLink, StatTile } from '../../ui';
import { todayIso } from '../../domain/rules';
import type { SkillChangesRow } from '../../data/types';
import { CHANGE_KINDS, type ChangeKind } from './taxonomyGov';
import { KindPill, monthLabel, useRoleLabel } from './govUi';
import { MethodologyBanner } from './MethodologyBanner';

const SNAP_SHOWN = ['name_en', 'name_ar', 'key_level', 'lifecycle', 'version', 'obsolete_on', 'replaced_by'] as const;
const DAY = 86_400_000;

export default function SkillChangesPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['skill_changes', 'skills'], async () => ({
    changes: await repo.list('skill_changes', { order: [['effective_on', 'desc']] }),
    skills: await repo.list('skills').catch(() => []),
  }), []);
  return (
    <Page title={t('m16.routes.skills-changes.title')} eyebrow={<BenchmarkChips feature="FS54" />} intro={t('m16.gov.log.intro')} wide>
      <Async state={q} isEmpty={() => false}>
        {(d) => <ChangeLog changes={d.changes} skills={d.skills as { id: string; code: string; name_en: string; name_ar: string; area: string; lifecycle?: string | null }[]} />}
      </Async>
    </Page>
  );
}

function ChangeLog({ changes, skills }: { changes: SkillChangesRow[]; skills: { id: string; code: string; name_en: string; name_ar: string; area: string; lifecycle?: string | null }[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const role = useRoleLabel();
  const [kind, setKind] = useState<'' | ChangeKind>('');
  const [text, setText] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const today = todayIso();
  const tNow = Date.parse(`${today}T00:00:00Z`);
  const year = changes.filter((c) => tNow - Date.parse(`${c.effective_on}T00:00:00Z`) <= 365 * DAY);
  const byId = useMemo(() => new Map(skills.map((x) => [x.id, x])), [skills]);
  const needle = text.trim().toLowerCase();
  const rows = changes.filter((c) => (!kind || c.kind === kind) && (!needle || [c.skill_code, c.skill_name_en, c.skill_name_ar, c.summary_en, c.summary_ar].some((v) => String(v ?? '').toLowerCase().includes(needle))));
  const months = useMemo(() => {
    const m = new Map<string, SkillChangesRow[]>();
    for (const c of rows) { const k = c.effective_on.slice(0, 7); (m.get(k) ?? m.set(k, []).get(k)!).push(c); }
    return [...m.entries()];
  }, [rows]);
  const perMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of changes) m.set(c.effective_on.slice(0, 7), (m.get(c.effective_on.slice(0, 7)) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(-8).map(([k, v]) => ({ label: monthLabel(f.locale, k, true), value: v }));
  }, [changes, f]);
  const canPropose = s.can('skills_taxonomy', ['W']);
  return (
    <div className="space-y-5">
      <MethodologyBanner dashboard="catalogue" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="m16-log-tiles">
        <StatTile label={t('m16.gov.log.tile.year')} value={f.num(year.length)} sub={t('m16.gov.log.tile.yearSub')} />
        <StatTile label={t('m16.gov.log.tile.added')} value={f.num(year.filter((c) => c.kind === 'add').length)} tone="ok" />
        <StatTile label={t('m16.gov.log.tile.retired')} value={f.num(year.filter((c) => c.kind === 'retire' || c.kind === 'split').length)} sub={t('m16.gov.log.tile.retiredSub')} />
        <StatTile label={t('m16.gov.log.tile.methodology')} value={f.num(year.filter((c) => c.methodology).length)} tone="sim" />
        <StatTile label={t('m16.gov.log.tile.last')} value={changes[0] ? f.date(changes[0].effective_on) : '—'} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Callout title={t('m16.gov.log.howTitle')}>
          <ul className="list-disc space-y-1 ps-4" data-testid="m16-log-how">
            {(['inclusion', 'council', 'obsolete', 'methodology'] as const).map((k) => <li key={k}>{t(`m16.gov.log.how.${k}`)}</li>)}
          </ul>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px]">
            <SourceLink href="https://www.jobsandskills.gov.au/australian-skills-classification" date="2026-10-11">{t('m16.gov.log.srcUpkeep')}</SourceLink>
            <L to="/skills/datasheet" className="link" data-testid="m16-log-datasheet">{t('m16.gov.log.toDatasheet')}</L>
          </p>
        </Callout>
        <Card title={t('m16.gov.log.perMonth')}><BarChart title={t('m16.gov.log.perMonth')} data={perMonth} /></Card>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1"><span className="caps">{t('m16.gov.log.filterKind')}</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as ChangeKind | '')} data-testid="m16-log-kind">
              <option value="">{t('m16.gov.log.allKinds')}</option>
              {CHANGE_KINDS.map((k) => <option key={k} value={k}>{t(`m16.gov.kind.${k}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span className="caps">{t('m16.gov.log.search')}</span>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('m16.gov.log.searchPh')} data-testid="m16-log-search" />
          </label>
        </div>
        {canPropose ? <L to="/skills/changes/propose" className="btn-primary btn-sm" data-testid="m16-log-propose"><Icon name="plus" size={14} />{t('m16.gov.log.propose')}</L>
          : <p className="text-[12.5px] text-ink-3">{t('m16.gov.log.proposeHint')}</p>}
      </div>
      {months.length === 0 ? <EmptyState icon="search" title={t('m16.gov.log.none')} /> : (
        <div className="space-y-5" data-testid="m16-change-log">
          {months.map(([month, list]) => (
            <section key={month} aria-labelledby={`m16-month-${month}`}>
              <h2 id={`m16-month-${month}`} className="caps mb-2 flex items-center gap-2"><Icon name="calendar" size={13} />{monthLabel(f.locale, month)} · {t('m16.gov.log.nChanges', { n: f.num(list.length) })}</h2>
              <ul className="space-y-2">
                {list.map((c) => {
                  const sk = byId.get(c.skill_id);
                  const isOpen = open === c.id;
                  return (
                    <li key={c.id} className="card min-w-0 p-3" data-testid="m16-change" data-kind={c.kind} data-id={c.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <KindPill kind={c.kind} />
                            <span className="chip border-line bg-sunken font-mono text-[11px]" dir="ltr">{c.skill_code}</span>
                            {c.methodology && <span className="chip border-sim-line bg-sim-bg text-sim" data-testid="m16-change-methodology"><Icon name="alert" size={11} />{t('m16.gov.log.methodology')}</span>}
                            {sk?.lifecycle === 'obsolete' && <span className="chip border-line bg-sunken text-ink-2"><Icon name="lock" size={11} />{t('m16.gov.log.obsolete')}</span>}
                          </div>
                          <p className="font-semibold">{pick(c, 'summary')}</p>
                          <p className="text-[12px] text-ink-3">{t('m16.gov.log.decided', { date: f.date(c.effective_on), roles: c.decided_roles.map((r) => role(r)).join(t('m16.gov.log.and')) })}{c.proposed_role ? ` · ${t('m16.gov.log.proposedBy', { role: role(c.proposed_role) })}` : ''}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {sk && <L to={`/skills/${sk.id}`} className="link text-[12.5px]">{t('m16.gov.log.openSkill')}</L>}
                          <button className="btn-ghost btn-sm" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)} data-testid="m16-change-toggle">{isOpen ? t('m16.gov.log.hide') : t('m16.gov.log.details')}</button>
                        </div>
                      </div>
                      {isOpen && <ChangeDetail c={c} byId={byId} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangeDetail({ c, byId }: { c: SkillChangesRow; byId: Map<string, { id: string; code: string; name_en: string; name_ar: string }> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const before = (c.before ?? {}) as Record<string, unknown>;
  const after = (c.after ?? {}) as Record<string, unknown>;
  const show = (k: string, v: unknown) => {
    if (v == null || v === '') return '—';
    if (k === 'replaced_by') { const r = byId.get(String(v)); return r ? `${r.code} · ${pick(r, 'name')}` : String(v); }
    if (k === 'obsolete_on') return f.date(String(v));
    if (k === 'lifecycle') return t(`fs.lifecycle.${v}`);
    if (typeof v === 'number') return f.num(v);
    return String(v);
  };
  const keys = SNAP_SHOWN.filter((k) => (k in after || k in before) && JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
  const sources = (Array.isArray(c.sources) ? c.sources : []) as { label: string; url: string }[];
  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3 text-[13px]" data-testid="m16-change-detail">
      {keys.length > 0 && (
        <table className="w-full text-start text-[12.5px]">
          <thead><tr className="text-ink-3"><th className="py-1 text-start font-normal">{t('m16.gov.log.field')}</th><th className="py-1 text-start font-normal">{t('m16.gov.log.before')}</th><th className="py-1 text-start font-normal">{t('m16.gov.log.after')}</th></tr></thead>
          <tbody>{keys.map((k) => <tr key={k} className="border-t border-line"><td className="py-1 pe-2 text-ink-2">{t(`m16.gov.field.${k}`)}</td><td className="py-1 pe-2 text-ink-3 line-through decoration-ink-3/40">{show(k, before[k])}</td><td className="py-1 font-semibold">{show(k, after[k])}</td></tr>)}</tbody>
        </table>
      )}
      {c.new_skill_ids.length > 0 && <p>{t('m16.gov.log.newSkills')}: {c.new_skill_ids.map((id) => { const r = byId.get(id); return <L key={id} to={`/skills/${id}`} className="link me-2">{r ? `${r.code} · ${pick(r, 'name')}` : id}</L>; })}</p>}
      <p className="text-[12px] text-ink-3">{t('m16.gov.log.dashboards')}: {c.dashboards.map((k) => t(`m16.gov.dash.${k}`)).join(' · ')}</p>
      {sources.length > 0 && <p className="flex flex-wrap gap-x-3 gap-y-1">{sources.map((x) => <SourceLink key={x.url} href={x.url}>{x.label}</SourceLink>)}</p>}
    </div>
  );
}
