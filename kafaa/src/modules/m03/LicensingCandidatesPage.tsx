// M03 /licensing/candidates (licensing coordinator): licensing programmes with the 60-day candidate-list deadline
// (REG-17 Art. 13), candidates per programme with their REG-17 Art. 4 route and the evidence still open. Clearance shows
// as confirmed or pending only. Draft candidate lists are exported for a named role to send through official channels.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Grid, Async, EmptyState, StatusPill, Callout, DataTable, Modal, SelectField, ConfirmDialog, downloadText, toCsv, Icon, type Column } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useT, usePick, useFormat, useLang } from '../../i18n';
import { RULES } from '../../auth/policy';
import { candidateListDue, daysBetween, routeChecks, todayIso } from '../../domain/rules';
import { PersonLabel } from './shared';

type Cand = RowOf<'licence_candidates'>;
type Evidence = { item: string; item_ar?: string; status: 'verified' | 'open' | 'pending' | 'confirmed' };
const ROUTES = { coit_ro: ['ro_lo36', 'ro_other_plant', 'ro_fossil'], sro_upgrade: ['sro_ro24', 'sro_bsc', 'sro_other_plant'], coit_sro: ['sro_ro24', 'sro_bsc', 'sro_other_plant'], asip: ['sro_ro24'], requal: ['ro_lo36', 'sro_ro24'] } as Record<string, string[]>;

async function load(repo: ReturnType<typeof useRepo>) {
  const [progs, cands, people, obligations] = await Promise.all([
    repo.list('licence_programmes', { order: [['start_on', 'asc']] }),
    repo.list('licence_candidates'),
    repo.list('people', { filter: { kind: 'staff' } }),
    repo.list('reporting_obligations', { filter: { kind: 'candidate_list' } }),
  ]);
  return { progs, cands, people, personById: new Map(people.map((p) => [p.id, p])), obligations };
}
type Data = Awaited<ReturnType<typeof load>>;

export default function LicensingCandidatesPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['licence_programmes', 'licence_candidates', 'people', 'reporting_obligations'], () => load(repo));
  return (
    <Page title={t('m03.routes.licensing-candidates.title')} intro={t('m03.cand.intro')} wide>
      <Callout tone="info" title={t('m03.cand.calloutTitle')}>
        {t('m03.cand.calloutBody')}
      </Callout>
      <Async state={q} empty={<EmptyState title={t('m03.cand.noProgrammes')} />} isEmpty={(d) => d.progs.length === 0}>
        {(d) => <Candidates d={d} />}
      </Async>
    </Page>
  );
}

function Candidates({ d }: { d: Data }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const act = useAction();
  const [sel, setSel] = useState(() => defaultProgramme(d.progs, todayIso()));
  const [add, setAdd] = useState(false);
  const [statusFor, setStatusFor] = useState<{ c: Cand; to: Cand['status'] } | null>(null);
  const prog = d.progs.find((p) => p.id === sel)!;
  const cands = d.cands.filter((c) => c.programme_id === sel);
  const today = todayIso();
  const ev = (c: Cand) => (Array.isArray(c.evidence) ? (c.evidence as Evidence[]) : []);
  const cycle = (s: Evidence['status']): Evidence['status'] => (s === 'verified' ? 'open' : s === 'open' ? 'pending' : 'verified');
  const setEvidence = (c: Cand, i: number) => {
    const next = ev(c).map((e, j) => (j === i ? { ...e, status: cycle(e.status) } : e));
    return act(() => repo.update('licence_candidates', c.id, { evidence: next }), { success: t('m03.cand.evidenceSaved') });
  };
  const toggleClearance = (c: Cand) => {
    const to = c.clearance === 'confirmed' ? 'pending' : 'confirmed';
    const evidence = ev(c).map((e) => (/clearance/i.test(e.item) ? { ...e, status: to } : e));
    return act(() => repo.update('licence_candidates', c.id, { clearance: to, evidence }), { success: t('m03.cand.clearanceSaved') });
  };
  const obligation = d.obligations.find((o) => o.due_on === prog.candidate_list_due);
  const exportDraft = () => {
    const cols: Column<Cand>[] = [
      { key: 'person', header: 'Person', value: (c) => d.personById.get(c.person_id)?.display_name ?? c.person_id },
      { key: 'route', header: 'REG-17 Art. 4 route', value: (c) => t(`m03.route.${c.route}`) },
      { key: 'status', header: 'Status', value: (c) => c.status },
      { key: 'clearance', header: 'Security clearance', value: (c) => c.clearance },
      { key: 'open', header: 'Open evidence', value: (c) => ev(c).filter((e) => e.status !== 'verified' && e.status !== 'confirmed').map((e) => e.item).join('; ') },
    ];
    const head = `DRAFT candidate list: ${prog.name_en} (start ${prog.start_on}; due to FANR ${prog.candidate_list_due}). Prepared in Kafa'a for the named role to review and send through official channels. Kafa'a sends nothing to FANR.\r\n`;
    downloadText(`DRAFT-candidate-list-${prog.id}.csv`, head + toCsv(cands.filter((c) => c.status !== 'withdrawn'), cols));
  };
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" role="tablist" aria-label={t('m03.cand.programmes')} data-testid="m03-programmes">
        {d.progs.map((p) => {
          const left = daysBetween(today, p.candidate_list_due);
          const on = p.id === sel;
          return (
            <button key={p.id} role="tab" aria-selected={on} className={`card p-4 text-start ${on ? 'border-accent bg-accent-soft' : ''}`} onClick={() => setSel(p.id)}>
              <div className="caps">{t(`m03.prog.kind_${p.kind}`)}</div>
              <div className="font-semibold">{pick(p, 'name')}</div>
              <div className="mt-1 text-[12.5px] text-ink-2">{t('m03.cand.starts', { d: f.date(p.start_on) })}</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusPill status={p.status === 'closed' ? 'closed' : 'open'}>{t(`m03.prog.s_${p.status}`)}</StatusPill>
                {p.status === 'planning' && <StatusPill tone={left < 0 ? 'bad' : left <= 30 ? 'sim' : 'info'}>{left < 0 ? t('m03.cand.listOverdue') : t('m03.cand.listDue', { n: f.num(left) })}</StatusPill>}
              </div>
            </button>
          );
        })}
      </div>

      <Grid cols={4}>
        <Card title={t('m03.cand.tCandidates')}>
          <div className="num text-[26px] font-semibold">{f.num(cands.filter((c) => c.status !== 'withdrawn').length)}</div>
        </Card>
        <Card title={t('m03.cand.tEligible')}>
          <div className="num text-[26px] font-semibold text-ok">{f.num(cands.filter((c) => c.status === 'eligible').length)}</div>
        </Card>
        <Card title={t('m03.cand.tOpen')}>
          <div className="num text-[26px] font-semibold text-sim">{f.num(cands.filter((c) => c.status === 'evidence_open').length)}</div>
        </Card>
        <Card title={t('m03.cand.tListDue')}>
          <div className="text-[15px] font-semibold">{f.date(prog.candidate_list_due)}</div>
          <div className="text-[12px] text-ink-3">{t('m03.cand.listRule', { n: RULES.candidateListDaysBeforeStart, check: candidateListDue(prog.start_on) === prog.candidate_list_due ? '✓' : '' })}</div>
          {obligation && <div className="mt-1"><StatusPill status={obligation.status === 'sent_by_owner' ? 'completed' : obligation.status}>{t(`m03.obl.s_${obligation.status}`)}</StatusPill></div>}
        </Card>
      </Grid>

      <Section
        title={t('m03.cand.listTitle', { name: pick(prog, 'name') })}
        actions={
          <>
            <button className="btn-outline btn-sm" onClick={exportDraft} disabled={!cands.length} data-testid="m03-export-draft">
              <Icon name="download" size={13} className="me-1 inline" />
              {t('m03.cand.exportDraft')}
            </button>
            <button className="btn-primary btn-sm" onClick={() => setAdd(true)} disabled={prog.status === 'closed'} data-testid="m03-add-candidate">
              <Icon name="plus" size={13} className="me-1 inline" />
              {t('m03.cand.add')}
            </button>
          </>
        }
      >
        <div data-testid="m03-candidates">
          <DataTable
            rows={cands}
            rowKey={(c) => c.id}
            searchable={false}
            empty={<EmptyState title={t('m03.cand.none')} />}
            columns={[
              { key: 'person', header: t('m02.team.person'), value: (c) => d.personById.get(c.person_id)?.display_name ?? c.person_id, render: (c) => <PersonLabel p={d.personById.get(c.person_id)} />, sortable: true },
              { key: 'route', header: t('m03.cand.route'), value: (c) => c.route, render: (c) => <div><div className="text-[13px]">{t(`m03.route.${c.route}`)}</div><div className="text-[11.5px] text-ink-3">FANR-REG-17 Art. 4</div></div> },
              {
                key: 'evidence',
                header: t('m03.cand.evidence'),
                value: (c) => ev(c).filter((e) => e.status === 'verified' || e.status === 'confirmed').length,
                render: (c) => (
                  <ul className="space-y-1 text-[12.5px]">
                    {ev(c).map((e, i) =>
                      /clearance/i.test(e.item) ? null : (
                        <li key={i}>
                          <button className="flex items-center gap-1.5 text-start hover:underline" onClick={() => setEvidence(c, i)} title={t('m03.cand.cycle')} data-testid="m03-evidence-item">
                            <StatusPill tone={e.status === 'verified' || e.status === 'confirmed' ? 'ok' : e.status === 'open' ? 'sim' : 'info'}>{t(`m03.cand.ev_${e.status}`)}</StatusPill>
                            <span>{lang === 'ar' && e.item_ar ? e.item_ar : e.item}</span>
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                ),
              },
              { key: 'clearance', header: t('m03.cand.clearance'), value: (c) => c.clearance, render: (c) => <button onClick={() => toggleClearance(c)} title={t('m03.cand.toggleClearance')} data-testid="m03-clearance"><StatusPill status={c.clearance}>{t(`m03.cand.cl_${c.clearance}`)}</StatusPill></button> },
              {
                key: 'status',
                header: t('m02.task.status'),
                value: (c) => c.status,
                render: (c) => (
                  <select className="input py-1 text-[13px]" aria-label={t('m02.task.status')} value={c.status} onChange={(e) => setStatusFor({ c, to: e.target.value as Cand['status'] })} data-testid="m03-candidate-status">
                    {(['proposed', 'eligible', 'evidence_open', 'withdrawn'] as const).map((s) => (
                      <option key={s} value={s}>
                        {t(`m03.cand.st_${s}`)}
                      </option>
                    ))}
                  </select>
                ),
              },
            ]}
          />
        </div>
        <p className="text-[12px] text-ink-3">{t('m03.cand.footnote')}</p>
      </Section>

      <ConfirmDialog
        open={!!statusFor}
        onClose={() => setStatusFor(null)}
        title={t('m03.cand.changeStatus')}
        consequence={t('m03.cand.changeStatusBody', { s: statusFor ? t(`m03.cand.st_${statusFor.to}`) : '' })}
        actingAs={t('m03.val.actingAs')}
        onConfirm={() => act(() => repo.update('licence_candidates', statusFor!.c.id, { status: statusFor!.to }), { success: t('m03.cand.statusSaved') })}
      >
        {statusFor?.to === 'eligible' && ev(statusFor.c).some((e) => e.status !== 'verified' && e.status !== 'confirmed') && <Callout tone="sim">{t('m03.cand.openWarning')}</Callout>}
      </ConfirmDialog>
      {add && <AddCandidate d={d} prog={prog} onClose={() => setAdd(false)} />}
    </>
  );
}

function AddCandidate({ d, prog, onClose }: { d: Data; prog: RowOf<'licence_programmes'>; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const pick = usePick();
  const allowed = ROUTES[prog.kind] ?? ['ro_lo36'];
  const [person, setPerson] = useState('');
  const [route, setRoute] = useState(allowed[0]);
  const already = new Set(d.cands.filter((c) => c.programme_id === prog.id).map((c) => c.person_id));
  const pool = useMemo(() => d.people.filter((p) => !already.has(p.id) && ['local-operator', 'reactor-operator', 'senior-reactor-operator', 'systems-design-plant-engineer', 'nuclear-training-instructor'].includes(p.job_role_id ?? '')), [d.people, already]);
  const items = routeChecks({ highSchool: false, bsc: false, monthsQualifiedLO: 0, monthsROatBarakah: 0, monthsRoSroElsewhere: 0, monthsFossilOrOther: 0, monthsAtBarakah: 0, monthsOnCrewAtBarakah: 0, monthsNuclearAtBarakah: 0, monthsAsLOatBarakah: 0 }).find((r) => r.route === route)!;
  const submit = async () => {
    const evidence: Evidence[] = [...items.met.map((m, i) => ({ item: m.en, item_ar: t(`m03.elig.req.${route}.${i}`), status: 'open' as const })), { item: 'UAE security clearance', item_ar: 'تصريح أمني إماراتي', status: 'pending' }];
    const r = await act(() => repo.insert('licence_candidates', { programme_id: prog.id, person_id: person, route: route as Cand['route'], evidence, clearance: 'pending', status: 'proposed' }), { success: t('m03.cand.added') });
    if (r.ok) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={t('m03.cand.addTitle', { name: pick(prog, 'name') })}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" disabled={!person} onClick={submit} data-testid="m03-add-confirm">
            {t('m03.cand.add')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <SelectField label={t('m02.team.person')} name="person" value={person} onChange={setPerson} placeholder={t('common.choose')} options={pool.map((p) => ({ value: p.id, label: `${p.display_name}${p.crew ? ` · ${p.crew}` : ''}` }))} />
        <SelectField label={t('m03.cand.route')} name="route" value={route} onChange={setRoute} options={allowed.map((r) => ({ value: r, label: t(`m03.route.${r}`) }))} />
        <div>
          <div className="caps mb-1">{t('m03.cand.evidenceToCollect')}</div>
          <ul className="list-disc space-y-0.5 ps-5 text-[13px]">
            {items.met.map((m, i) => (
              <li key={i}>{t(`m03.elig.req.${route}.${i}`)}</li>
            ))}
            <li>{t('m03.elig.plusClearance')}</li>
          </ul>
        </div>
        <Callout tone="info">{t('m03.cand.addNote')}</Callout>
      </div>
    </Modal>
  );
}

/** Readiness fixes 2026-10-13 (finding 9): open on the programme whose candidate list is due next (today or later), not the oldest one
 *  (which was a past class with no candidates); then the open programme whose list was due most recently; then the first one. */
export function defaultProgramme(progs: Pick<RowOf<'licence_programmes'>, 'id' | 'status' | 'candidate_list_due' | 'start_on'>[], today: string): string {
  const open = progs.filter((p) => p.status !== 'closed');
  const upcoming = open.filter((p) => p.candidate_list_due >= today).sort((a, b) => a.candidate_list_due.localeCompare(b.candidate_list_due) || a.start_on.localeCompare(b.start_on));
  if (upcoming.length) return upcoming[0].id;
  const latest = [...open].sort((a, b) => b.candidate_list_due.localeCompare(a.candidate_list_due));
  return latest[0]?.id ?? progs[0].id;
}
