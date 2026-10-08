// M16 · /admin/nexus: how Kafa'a connects to ENEC NEXUS. The seven integration points (spec section 12) with their
// live status, read-only mirrors of the NEXUS role cards ("Decides" lines) and authority matrix, and the evidence
// ledger entries Kafa'a has appended (domain KAFAA). Kafa'a is not an authority: these are mirrors, never edited here.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { PERSONAS, roleLabel } from '../../auth/session';
import type { PlatformRole } from '../../auth/policy';
import { useFormat, useI18n, useT } from '../../i18n';
import { Async, Callout, Card, DataTable, EmptyState, FilterBar, Icon, Page, SimChip, StatusPill, Tabs, useFilters } from '../../ui';
import type { LedgerEntry } from '../../data/types';
import { syncState } from '../../domain/g5rules';
import { useFlags } from './flags';
import { Metric } from './parts';

const POINTS = [
  { id: 'roles', kafaa: 'M01', nexus: 'personas · authority_matrix', flow: 'reads', route: '/careers' },
  { id: 'quals', kafaa: 'M02', nexus: 'T fleet T1.2, T1.7 · /employee/talent', flow: 'writes', route: '/my/quals' },
  { id: 'catalogue', kafaa: 'M04', nexus: 'training_programs · eco_courses', flow: 'shared', route: '/learn' },
  { id: 'readiness', kafaa: 'M09', nexus: '/partner/readiness', flow: 'writes', route: '/partner/onboarding' },
  { id: 'partners', kafaa: 'M09', nexus: 'organisations · eco_partnerships', flow: 'reads', route: '/partners' },
  { id: 'ledger', kafaa: 'M16', nexus: 'evidence ledger', flow: 'writes', route: '/admin/audit' },
  { id: 'identity', kafaa: 'M14 · M15', nexus: 'profiles · user_prefs', flow: 'shared', route: '/my/profile' },
] as const;

/** Same-origin NEXUS pages (Kafa'a is served under /kafaa on the NEXUS host). */
const NEXUS_LINKS = [
  { id: 'academy', href: '/employee/academy' },
  { id: 'readiness', href: '/partner/readiness' },
  { id: 'directory', href: '/leadership/directory' },
  { id: 'home', href: '/' },
];

export default function AdminNexusPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const flags = useFlags();
  const data = useQuery(['integrations', 'audit_events', 'ledger_local'], async () => {
    const safe = <T,>(p: Promise<T>, d: T) => p.catch(() => d);
    const [personas, authority, programs, courses, partnerships, ledger, ints, audit] = await Promise.all([
      safe(repo.nexus.personas(), []),
      safe(repo.nexus.authority(), []),
      safe(repo.nexus.trainingPrograms(), []),
      safe(repo.nexus.ecoCourses(), []),
      safe(repo.nexus.ecoPartnerships(), []),
      safe(repo.nexus.ledger(), [] as LedgerEntry[]),
      safe(repo.list('integrations'), []),
      safe(repo.list('audit_events', { order: [['seq', 'desc']] }), []),
    ]);
    return { personas, authority, programs, courses, partnerships, ledger, ints, audit };
  });
  const source = repo.nexus.source;
  return (
    <Page title={t('m16.routes.admin-nexus.title')} intro={t('m16.nexus.intro')} actions={source === 'snapshot' ? <SimChip label={t('m16.nexus.snapshot')} /> : <StatusPill tone="ok">{t('m16.nexus.live')}</StatusPill>} wide>
      <Callout tone="info" title={t('m16.nexus.notAuthorityTitle')}>{t('m16.nexus.notAuthority')}</Callout>
      <Async state={data}>
        {(d) => {
          const statusOf = (id: string): { st: string; detail: string } => {
            const int = (k: string) => d.ints.find((i) => i.id === k);
            switch (id) {
              case 'roles': return { st: d.personas.length ? 'ok' : 'error', detail: t('m16.nexus.d.roles', { p: d.personas.length, a: d.authority.length }) };
              case 'quals': return { st: 'proposed', detail: t('m16.nexus.d.quals') };
              case 'catalogue': return { st: d.programs.length || d.courses.length ? 'ok' : 'stale', detail: t('m16.nexus.d.catalogue', { p: d.programs.length, c: d.courses.length }) };
              case 'readiness': { const i = int('int-nexus-partner'); return { st: i ? syncState(i) : 'proposed', detail: t('m16.nexus.d.readiness') }; }
              case 'partners': return { st: 'ok', detail: t('m16.nexus.d.partners', { n: d.partnerships.length }) };
              case 'ledger': { const i = int('int-nexus-ledger'); return { st: i ? syncState(i) : 'ok', detail: t('m16.nexus.d.ledger', { n: d.ledger.length }) }; }
              default: return { st: 'proposed', detail: t('m16.nexus.d.identity') };
            }
          };
          const ledgerCounts = ['written', 'skipped', 'not_applicable'].map((k) => ({ k, n: d.audit.filter((a) => a.ledger_status === k).length }));
          return (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4" data-testid="m16-nexus-metrics">
                <Metric label={t('m16.nexus.mPersonas')} value={f.num(d.personas.length)} />
                <Metric label={t('m16.nexus.mAuthority')} value={f.num(d.authority.length)} />
                <Metric label={t('m16.nexus.mLedger')} value={f.num(d.ledger.length)} sub={t('m16.nexus.mLedgerSub')} />
                <Metric label={t('m16.nexus.mSkipped')} value={f.num(ledgerCounts[1].n)} sub={t('m16.nexus.mSkippedSub')} />
              </div>
              <Tabs
                tabs={[
                  {
                    id: 'points',
                    label: t('m16.nexus.tabPoints'),
                    content: (
                      <div className="space-y-4">
                        <ol className="grid gap-3 md:grid-cols-2" data-testid="m16-nexus-points">
                          {POINTS.map((p, i) => {
                            const s = statusOf(p.id);
                            return (
                              <li key={p.id} className="card p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <div className="caps">{t('m16.nexus.point', { n: i + 1 })} · {t(`m16.nexus.flow.${p.flow}`)}</div>
                                    <div className="mt-0.5 font-semibold">{t(`m16.nexus.points.${p.id}.title`)}</div>
                                  </div>
                                  <StatusPill status={s.st}>{t(`m16.nexus.st.${s.st}`)}</StatusPill>
                                </div>
                                <p className="mt-1 text-[13px] text-ink-2">{t(`m16.nexus.points.${p.id}.body`)}</p>
                                <div className="mt-2 grid gap-1 text-[12px] text-ink-3">
                                  <span>{t('m16.nexus.kafaaSide', { m: p.kafaa })}</span>
                                  <span>{t('m16.nexus.nexusSide')} <code className="ltr">{p.nexus}</code></span>
                                  <span>{s.detail}</span>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                        {flags.isOn('nexus_links') ? (
                          <Card title={t('m16.nexus.linksTitle')}>
                            <ul className="flex flex-wrap gap-2" data-testid="m16-nexus-links">
                              {NEXUS_LINKS.map((l) => (
                                <li key={l.id}>
                                  <a href={l.href} className="btn-outline btn-sm">
                                    <Icon name="external" />
                                    {t(`m16.nexus.links.${l.id}`)}
                                  </a>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-[12px] text-ink-3">{t('m16.nexus.linksNote')}</p>
                          </Card>
                        ) : (
                          <Callout tone="sim">{t('m16.nexus.linksOff')}</Callout>
                        )}
                      </div>
                    ),
                  },
                  { id: 'personas', label: t('m16.nexus.tabPersonas'), content: <PersonasView personas={d.personas} /> },
                  { id: 'authority', label: t('m16.nexus.tabAuthority'), content: <AuthorityView rows={d.authority} /> },
                  { id: 'ledger', label: t('m16.nexus.tabLedger'), content: <LedgerView rows={d.ledger} counts={ledgerCounts} /> },
                ]}
              />
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function PersonasView({ personas }: { personas: { id: string; role: string; title: string; lens: string; org_id: string; plane: string; decides: string }[] }) {
  const t = useT();
  const { lang } = useI18n();
  const [flt, setFlt] = useFilters({ q: '', lens: '' });
  const kafaaRoles = useMemo(() => new Map(PERSONAS.map((p) => [p.persona, p.roles])), []);
  const rows = personas.filter((p) => (!flt.lens || p.lens === flt.lens) && (!flt.q || `${p.title} ${p.role} ${p.decides}`.toLowerCase().includes(flt.q.toLowerCase())));
  return (
    <div className="space-y-3">
      <Callout tone="info">{t('m16.nexus.personasIntro')}</Callout>
      <FilterBar value={flt} onChange={setFlt} search="q" fields={[{ key: 'lens', label: t('m16.nexus.lens'), options: [...new Set(personas.map((p) => p.lens))].map((l) => ({ value: l, label: l })) }]} />
      {rows.length === 0 ? (
        <EmptyState title={t('m16.nexus.none')} />
      ) : (
        <div data-testid="m16-nexus-personas">
          <DataTable
            rows={rows}
            rowKey={(p) => p.id}
            csvName="nexus-role-cards"
            columns={[
              { key: 'title', header: t('m16.nexus.roleCard'), value: (p) => p.title, sortable: true, render: (p) => <div><div className="font-semibold ltr">{p.title}</div><code className="text-[11.5px] text-ink-3">{p.id}</code></div> },
              { key: 'plane', header: t('m16.nexus.plane'), value: (p) => p.plane },
              { key: 'decides', header: t('m16.nexus.decides'), value: (p) => p.decides, render: (p) => <span className="text-[12.5px] ltr">{p.decides || '—'}</span> },
              { key: 'kafaa', header: t('m16.nexus.kafaaRoles'), value: (p) => (kafaaRoles.get(p.id) ?? []).join(' '), render: (p) => <span className="flex flex-wrap gap-1">{(kafaaRoles.get(p.id) ?? []).map((r) => <StatusPill key={r} tone="neutral">{roleLabel(r as PlatformRole, lang)}</StatusPill>)}</span> },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function AuthorityView({ rows }: { rows: { decision_key: string; decision: string; domain: string; authority_role: string; evidence_required: string; authority_ref: string; requires_second: boolean }[] }) {
  const t = useT();
  const [flt, setFlt] = useFilters({ q: '', domain: '', second: '' });
  const vis = rows.filter((r) => (!flt.domain || r.domain === flt.domain) && (!flt.second || String(r.requires_second) === flt.second) && (!flt.q || `${r.decision} ${r.authority_role} ${r.decision_key}`.toLowerCase().includes(flt.q.toLowerCase())));
  return (
    <div className="space-y-3">
      <Callout tone="info">{t('m16.nexus.authorityIntro')}</Callout>
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="q"
        fields={[
          { key: 'domain', label: t('m16.nexus.domain'), options: [...new Set(rows.map((r) => r.domain))].map((x) => ({ value: x, label: x })) },
          { key: 'second', label: t('m16.nexus.second'), options: [{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }] },
        ]}
      />
      {vis.length === 0 ? (
        <EmptyState title={t('m16.nexus.none')} />
      ) : (
        <div data-testid="m16-nexus-authority">
          <DataTable
            rows={vis}
            rowKey={(r) => r.decision_key}
            csvName="nexus-authority-mirror"
            columns={[
              { key: 'decision', header: t('m16.nexus.decision'), value: (r) => r.decision, sortable: true, render: (r) => <div><div className="font-semibold ltr">{r.decision}</div><code className="text-[11.5px] text-ink-3">{r.decision_key}</code></div> },
              { key: 'domain', header: t('m16.nexus.domain'), value: (r) => r.domain },
              { key: 'authority', header: t('m16.nexus.authority'), value: (r) => r.authority_role, render: (r) => <span className="ltr">{r.authority_role}</span> },
              { key: 'evidence', header: t('m16.nexus.evidence'), value: (r) => r.evidence_required, render: (r) => <span className="ltr text-[12.5px]">{r.evidence_required}</span> },
              { key: 'ref', header: t('m16.nexus.ref'), value: (r) => r.authority_ref, render: (r) => <span className="ltr text-[12px] text-ink-3">{r.authority_ref}</span> },
              { key: 'second', header: t('m16.nexus.second'), value: (r) => (r.requires_second ? 'yes' : 'no'), render: (r) => (r.requires_second ? <StatusPill tone="accent">{t('m16.nexus.twoPerson')}</StatusPill> : '—') },
            ]}
          />
        </div>
      )}
      <p className="text-[12px] text-ink-3">{t('m16.nexus.mirrorNote')}</p>
    </div>
  );
}

function LedgerView({ rows, counts }: { rows: LedgerEntry[]; counts: { k: string; n: number }[] }) {
  const t = useT();
  const f = useFormat();
  const [flt, setFlt] = useFilters({ q: '', action: '' });
  const [open, setOpen] = useState<LedgerEntry | null>(null);
  const actions = [...new Set(rows.map((r) => r.action))].sort();
  const vis = rows.filter((r) => (!flt.action || r.action === flt.action) && (!flt.q || `${r.reason ?? ''} ${r.actor} ${r.role}`.toLowerCase().includes(flt.q.toLowerCase())));
  return (
    <div className="space-y-3">
      <Callout tone="info">{t('m16.nexus.ledgerIntro')}</Callout>
      <div className="flex flex-wrap gap-2 text-[12.5px]" data-testid="m16-ledger-status">
        {counts.map((c) => (
          <StatusPill key={c.k} tone={c.k === 'written' ? 'ok' : c.k === 'skipped' ? 'sim' : 'neutral'}>{t(`m16.nexus.ls.${c.k}`, { n: f.num(c.n) })}</StatusPill>
        ))}
      </div>
      <FilterBar value={flt} onChange={setFlt} search="q" fields={[{ key: 'action', label: t('m16.nexus.action'), options: actions.map((a) => ({ value: a, label: a })) }]} />
      {vis.length === 0 ? (
        <EmptyState title={t('m16.nexus.noLedger')}>{t('m16.nexus.noLedgerBody')}</EmptyState>
      ) : (
        <div data-testid="m16-ledger">
          <DataTable
            rows={vis}
            rowKey={(r) => `${r.seq}-${r.hash}`}
            csvName="kafaa-ledger-entries"
            onRowClick={setOpen}
            initialSort={{ key: 'seq', dir: 'desc' }}
            columns={[
              { key: 'seq', header: '#', value: (r) => r.seq, sortable: true, align: 'end' },
              { key: 'ts', header: t('m16.audit.when'), value: (r) => r.ts, sortable: true, render: (r) => f.dateTime(r.ts) },
              { key: 'action', header: t('m16.nexus.action'), value: (r) => r.action, render: (r) => <code className="ltr text-[12px]">{r.action}</code> },
              { key: 'actor', header: t('m16.audit.actor'), value: (r) => `${r.actor} (${r.role})`, render: (r) => <span className="ltr text-[12.5px]">{r.actor} · {r.role}</span> },
              { key: 'reason', header: t('m16.audit.reason'), value: (r) => r.reason ?? '', render: (r) => <span className="line-clamp-2 text-[12.5px]">{r.reason ?? '—'}</span> },
              { key: 'hash', header: t('m16.audit.hash'), value: (r) => r.hash, render: (r) => <code className="ltr text-[11px] text-ink-3">{r.hash.slice(0, 12)}…</code> },
            ]}
          />
        </div>
      )}
      {open && (
        <Card title={t('m16.nexus.entry', { n: open.seq })} actions={<button className="btn-ghost btn-sm" onClick={() => setOpen(null)}>{t('common.close')}</button>}>
          <dl className="grid gap-1 text-[12.5px] sm:grid-cols-[160px_1fr]">
            {(['plane', 'domain', 'evidence_class', 'actor_persona_id', 'prev_hash', 'hash'] as const).map((k) => (
              <div key={k} className="contents">
                <dt className="caps">{k}</dt>
                <dd className="ltr break-all font-mono">{String(open[k] ?? '—')}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
