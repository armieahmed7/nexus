// M02 /team: team readiness for a line manager / shift supervisor (direct scope only, RLS). Tiles, expiry calendar,
// supervisor acknowledgements awaiting me (rpc.ackEvaluation), the expiry-notice sweep (rpc.qualExpirySweep) and, for shift
// supervisors, crew licence validity and proficiency with availability only (rpc.crewAvailability; never medical detail).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Grid, Async, EmptyState, StatTile, Callout, StatusPill, ConfirmDialog, DataTable, BarChart, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { licenceView, proficiency, quarterOf, todayIso, daysBetween } from '../../domain/rules';
import { displayView, ackState, type EvalLite } from './quals';
import { useQualData, PersonName, QualPill, type QualData, type Ev } from './shared';
import { scopeAssignments, scopePeople } from '../../data/scope'; // MGR-01: the team is the people RLS puts in my scope
import type { Identity } from '../../data/types';

export default function TeamPage() {
  const t = useT();
  const s = useSession();
  const q = useQualData();
  return (
    <Page
      title={t('m02.routes.team.title')}
      intro={t('m02.team.intro')}
      actions={
        <L to="/team/quals" className="btn-outline" data-testid="m02-to-matrix">
          {t('m02.team.toMatrix')}
        </L>
      }
    >
      <Async state={q}>{(d) => <Team d={d} me={s.identity.personId ?? ''} identity={s.identity} />}</Async>
      {s.can('licence', ['Scope']) && <CrewLicences />}
    </Page>
  );
}

function Team({ d, me, identity }: { d: QualData; me: string; identity: Identity }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [sweep, setSweep] = useState(false);
  const [ack, setAck] = useState<Ev | null>(null);
  // MGR-01: the directory (people) is readable far beyond a manager's scope, so "every person I can read" counted the whole company
  // (106 for a 7-person crew). The team is the people kafaa_scope_people('qual_records') admits, the same set RLS returns records for.
  const scope = useMemo(() => scopePeople(identity, d.people, 'qual_records'), [identity, d.people]);
  const scopeName = useScopeName(identity);
  const team = d.people.filter((p) => p.id !== me && p.kind === 'staff' && (scope === 'all' || scope.has(p.id)));
  const ids = new Set(team.map((p) => p.id));
  const recs = d.records.filter((r) => ids.has(r.person_id));
  const v = recs.map((r) => ({ r, v: displayView(r) }));
  const today = todayIso();
  const horizon = 120;
  const upcoming = v
    .filter((x) => !x.v.masked && x.r.expires_on && ['qualified', 'due', 'renewed'].includes(x.r.status) && daysBetween(today, x.r.expires_on) <= horizon)
    .sort((a, b) => a.r.expires_on!.localeCompare(b.r.expires_on!));
  const byMonth = useMemo(() => {
    const m = new Map<string, typeof upcoming>();
    for (const x of upcoming) {
      const k = x.r.expires_on!.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return [...m.entries()];
  }, [upcoming]);
  const pendingAcks = d.evals.filter((e) => ids.has(e.person_id) && e.evaluator_person_id !== me && ackState(e as EvalLite, d.acks) === 'awaiting');
  const disciplines = [...new Set(recs.map((r) => d.stdById.get(r.standard_id)?.discipline ?? ''))].filter(Boolean);
  if (!team.length)
    return (
      <EmptyState title={t('m02.team.noTeam')}>{t('m02.team.noTeamBody')}</EmptyState>
    );
  const pct = recs.length ? (v.filter((x) => x.v.view === 'qualified' || x.v.view === 'renewed').length * 100) / recs.length : 0;
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m02.team.tPeople')} value={f.num(team.length)} sub={scopeName ? t('m02.team.tPeopleScope', { scope: scopeName, n: f.num(recs.length) }) : t('m02.team.tPeopleSub', { n: f.num(recs.length) })} />
        <StatTile label={t('m02.team.tQualified')} value={f.pct(pct, 0)} tone="ok" />
        <StatTile label={t('m02.team.tDue')} value={f.num(v.filter((x) => x.v.view === 'due').length)} sub={t('m02.team.tDueSub')} tone="sim" />
        <StatTile label={t('m02.team.tExpired')} value={f.num(v.filter((x) => x.v.view === 'expired' || x.v.view === 'not_qualified').length)} sub={t('m02.team.tReview', { n: f.num(recs.filter((r) => r.needs_review).length) })} tone="bad" />
      </Grid>

      <Grid cols={2}>
        <Card title={t('m02.team.byDiscipline')}>
          <BarChart
            title={t('m02.team.byDiscipline')}
            unit="%"
            max={100}
            data={disciplines.map((dsc) => {
              const rs = v.filter((x) => d.stdById.get(x.r.standard_id)?.discipline === dsc);
              return { label: dsc, value: rs.length ? Math.round((rs.filter((x) => x.v.view === 'qualified' || x.v.view === 'renewed').length * 100) / rs.length) : 0 };
            })}
          />
        </Card>
        <Card
          title={t('m02.team.noticesTitle')}
          actions={
            <button className="btn-primary btn-sm" onClick={() => setSweep(true)} data-testid="m02-run-sweep">
              <Icon name="bell" size={13} className="me-1 inline" />
              {t('m02.team.runSweep')}
            </button>
          }
        >
          <p className="text-[13.5px] text-ink-2">{t('m02.team.noticesBody')}</p>
        </Card>
      </Grid>

      <Section title={t('m02.team.calendarTitle')} description={t('m02.team.calendarDesc', { n: horizon })}>
        {byMonth.length === 0 ? (
          <EmptyState title={t('m02.team.noUpcoming')} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4" data-testid="m02-expiry-calendar">
            {byMonth.map(([month, xs]) => (
              <Card key={month} title={new Intl.DateTimeFormat(f.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))} eyebrow={t('m02.team.nExpiring', { n: f.num(xs.length) })}>
                <ul className="space-y-1.5 text-[13px]">
                  {xs.map((x) => (
                    <li key={x.r.id} className="flex items-start justify-between gap-2">
                      <span>
                        <PersonName p={d.personById.get(x.r.person_id)} />
                        <span className="block text-[12px] text-ink-3">
                          {d.stdById.get(x.r.standard_id)?.code} · {f.date(x.r.expires_on)}
                        </span>
                      </span>
                      <QualPill rec={x.r} />
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title={t('m02.team.acksTitle')} description={t('m02.team.acksDesc')}>
        {pendingAcks.length === 0 ? (
          <EmptyState title={t('m02.team.noAcks')} icon="check" />
        ) : (
          <div data-testid="m02-pending-acks">
            <DataTable
              rows={pendingAcks}
              rowKey={(e) => e.id}
              searchable={false}
              columns={[
                { key: 'person', header: t('m02.team.person'), value: (e) => d.personById.get(e.person_id)?.display_name ?? e.person_id, render: (e) => <PersonName p={d.personById.get(e.person_id)} />, sortable: true },
                { key: 'task', header: t('m02.task.task'), value: (e) => d.tasks.find((x) => x.id === e.task_id)?.code ?? '—', render: (e) => { const tk = d.tasks.find((x) => x.id === e.task_id); return tk ? <span><span className="num me-1 text-ink-3">{tk.code}</span>{pick(tk, 'statement')}</span> : '—'; } },
                { key: 'result', header: t('m02.eval.result'), value: (e) => e.result, render: (e) => <StatusPill status={e.result} /> },
                { key: 'evaluator', header: t('m02.task.evaluator'), value: (e) => e.evaluator_role },
                { key: 'date', header: t('m02.task.date'), value: (e) => e.date, render: (e) => f.date(e.date), sortable: true },
                { key: 'act', header: '', csv: false, render: (e) => <button className="btn-outline btn-sm" onClick={() => setAck(e)} data-testid="m02-ack">{t('m02.team.ack')}</button> },
              ]}
            />
          </div>
        )}
      </Section>

      <ConfirmDialog
        open={sweep}
        onClose={() => setSweep(false)}
        title={t('m02.team.runSweep')}
        consequence={t('m02.team.sweepConsequence')}
        onConfirm={() => act(() => repo.rpc.qualExpirySweep())}
      />
      <ConfirmDialog
        open={!!ack}
        onClose={() => setAck(null)}
        title={t('m02.team.ackTitle')}
        consequence={t('m02.team.ackConsequence', { person: d.personById.get(ack?.person_id ?? '')?.display_name ?? '', task: d.tasks.find((x) => x.id === ack?.task_id)?.code ?? '' })}
        actingAs={t('m02.team.actingAs')}
        requireReason
        reasonLabel={t('m02.team.ackNote')}
        onConfirm={(note) => act(() => repo.rpc.ackEvaluation(ack!.id, note))}
      />
    </>
  );
}

function CrewLicences() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const q = useQuery(['licences', 'shift_proficiency', 'people', 'medical_due'], async () => {
    const [lic, sp, people, av] = await Promise.all([repo.list('licences'), repo.list('shift_proficiency', { filter: { quarter: quarterOf(new Date()) } }), repo.list('people'), repo.rpc.crewAvailability()]);
    return { lic, sp, people: new Map(people.map((p) => [p.id, p])), av: new Map(av.map((a) => [a.person_id, a.available])) };
  });
  return (
    <Section title={t('m02.crew.title')} description={t('m02.crew.desc')}>
      <Callout tone="info">{t('m02.crew.note')}</Callout>
      <Async state={q} empty={<EmptyState title={t('m02.crew.none')} />} isEmpty={(x) => x.lic.length === 0}>
        {(x) => (
          <div data-testid="m02-crew-licences">
            <DataTable
              rows={x.lic}
              rowKey={(l) => l.id}
              searchable={false}
              csvName="crew-licences"
              columns={[
                { key: 'person', header: t('m02.team.person'), value: (l) => x.people.get(l.person_id)?.display_name ?? l.person_id, render: (l) => <PersonName p={x.people.get(l.person_id)} />, sortable: true },
                { key: 'type', header: t('m03.cert.type'), value: (l) => l.type, render: (l) => t(`m03.type.${l.type}`) },
                { key: 'view', header: t('m03.cert.status'), value: (l) => licenceView(l).view, render: (l) => <StatusPill status={licenceView(l).view === 'renewal_due' ? 'due_soon' : licenceView(l).view}>{t(`m03.view.${licenceView(l).view}`)}</StatusPill> },
                { key: 'exp', header: t('m03.cert.expires'), value: (l) => l.expires_on, render: (l) => f.date(l.expires_on), sortable: true },
                {
                  key: 'prof',
                  header: t('m03.prof.title'),
                  value: (l) => {
                    const sp = x.sp.find((s) => s.person_id === l.person_id);
                    if (!sp) return '';
                    const p = proficiency(sp, l.type !== 'RO');
                    return p.atRisk || p.sroAtRisk ? 'at_risk' : p.met && p.sroMet !== false ? 'met' : 'on_track';
                  },
                  render: (l) => {
                    const sp = x.sp.find((s) => s.person_id === l.person_id);
                    if (!sp) return '—';
                    const p = proficiency(sp, l.type !== 'RO');
                    const k = p.atRisk || p.sroAtRisk ? 'at_risk' : p.met && p.sroMet !== false ? 'met' : 'on_track';
                    return <StatusPill tone={k === 'at_risk' ? 'bad' : k === 'met' ? 'ok' : 'info'}>{t(`m03.prof.${k}`)}</StatusPill>;
                  },
                },
                {
                  key: 'avail',
                  header: t('m02.crew.availability'),
                  value: (l) => String(x.av.get(l.person_id)),
                  render: (l) => {
                    const a = x.av.get(l.person_id);
                    return <StatusPill tone={a == null ? 'sim' : a ? 'ok' : 'bad'}>{a == null ? t('m02.crew.unknown') : a ? t('m02.crew.available') : t('m02.crew.notAvailable')}</StatusPill>;
                  },
                },
              ]}
            />
          </div>
        )}
      </Async>
    </Section>
  );
}

/** MGR-01: what my scope is made of, by name ("Crew B", "Operations", "ENEC Operations"), shown under "People in scope". */
function useScopeName(identity: Identity): string | null {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const parts = scopeAssignments(identity, 'qual_records');
  const needsNames = parts.some((p) => p.type === 'family' || p.type === 'entity' || p.type === 'org');
  const names = useQuery(['job_families', 'organisations'], async () => {
    if (!needsNames) return null;
    const [families, orgs] = await Promise.all([repo.list('job_families').catch(() => []), repo.list('organisations').catch(() => [])]);
    return { families, orgs };
  }, [needsNames]);
  if (!parts.length) return null;
  const label = (p: { type: string; value: string | null }) => {
    const v = p.value ?? '';
    if (p.type === 'all') return t('m02.team.scopeAll');
    if (p.type === 'crew') return t('m02.team.scopeCrew', { c: v });
    if (p.type === 'family') return pick(names.data?.families.find((x) => x.id === v), 'name') || v;
    if (p.type === 'entity' || p.type === 'org') return pick(names.data?.orgs.find((x) => x.id === v), 'name') || v;
    return ''; // team ids (ops-wc) have no display name: keep the plain subtitle
  };
  return parts.map(label).filter(Boolean).join(' · ') || null;
}
