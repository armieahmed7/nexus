// M03 /my/licence: my RO/SRO certificate as recorded in the licensee's certification records (OCTS mirror): validity
// countdown (never "valid" when the sync is stale), medical due date and flag only (no medical content), this quarter's
// shifts against the REG-17 Art. 11 minimums with an at-risk warning, requalification window and COCT hours, key dates.
import { Page, Section, Card, Grid, Async, EmptyState, Callout, StatusPill, KeyValue, ProgressBar, ProgressRing, Timeline, DataTable, SimChip } from '../../ui';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useT, useFormat, usePick, L, systemName, useCount } from '../../i18n';
import { useSession } from '../../auth/session';
import { RULES } from '../../auth/policy';
import { licenceView, medicalView, proficiency, quarterOf, quarterEnd, withdrawalDate, todayIso } from '../../domain/rules';
import { keyDates, validityElapsedPct } from './licensing';
import { LicencePill, MedicalPill } from './shared';

export default function MyLicencePage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const me = s.identity.personId ?? '-';
  const q = useQuery(['licences', 'medical_due', 'shift_proficiency', 'requal_cycles', 'licensing_tasks', 'exam_milestones'], async () => {
    const [lic, med, sp, rq, tasks, ms] = await Promise.all([
      repo.list('licences', { filter: { person_id: me } }),
      repo.list('medical_due', { filter: { person_id: me } }),
      repo.list('shift_proficiency', { filter: { person_id: me }, order: [['quarter', 'desc']] }),
      repo.list('requal_cycles', { filter: { person_id: me } }),
      repo.list('licensing_tasks', { filter: { person_id: me, status: 'open' } }),
      repo.list('exam_milestones', { filter: { person_id: me }, order: [['due_on', 'asc']] }),
    ]);
    return { lic: lic[0] ?? null, med: med[0] ?? null, sp, rq: rq[0] ?? null, tasks, ms };
  }, [me]);
  return (
    <Page title={t('m03.routes.my-licence.title')} intro={t('m03.my.intro')} actions={<SimChip label={t('m02.mirror.chip')} />}>
      <Async state={q} isEmpty={(d) => !d.lic} empty={<EmptyState title={t('m03.my.none')} action={<L to="/licensing" className="btn-outline btn-sm">{t('m03.my.howItWorks')}</L>}>{t('m03.my.noneBody')}</EmptyState>}>
        {(d) => <Mine d={d} />}
      </Async>
    </Page>
  );
}

type Mine = { lic: RowOf<'licences'> | null; med: RowOf<'medical_due'> | null; sp: RowOf<'shift_proficiency'>[]; rq: RowOf<'requal_cycles'> | null; tasks: RowOf<'licensing_tasks'>[]; ms: RowOf<'exam_milestones'>[] };
function Mine({ d }: { d: Mine }) {
  const t = useT();
  const f = useFormat();
  const plural = useCount();
  const pick = usePick();
  const lic = d.lic!;
  const v = licenceView(lic);
  const isSro = lic.type !== 'RO';
  const q = quarterOf(new Date());
  const cur = d.sp.find((x) => x.quarter === q) ?? null;
  const p = cur ? proficiency(cur, isSro) : null;
  const med = d.med ? medicalView(d.med) : null;
  const pct = validityElapsedPct(lic.issued_on, lic.expires_on);
  const dates = keyDates(lic, d.med, d.rq);
  const today = todayIso();
  return (
    <>
      {v.stale && (
        <Callout tone="sim" title={t('m03.my.staleTitle')}>
          {t('m03.my.staleBody', { h: f.num(Math.round(v.hoursSinceSync)), max: f.num(RULES.staleSyncHours) })}
        </Callout>
      )}
      {lic.status === 'lapsed' && (
        <Callout tone="bad" title={t('m03.my.lapsedTitle')}>
          {t('m03.my.lapsedBody', { date: f.date(lic.lapsed_on), wd: f.date(lic.lapsed_on ? withdrawalDate(lic.lapsed_on) : null) })}
        </Callout>
      )}
      {med === 'overdue' && <Callout tone="bad" title={t('m03.med.overdueTitle')}>{t('m03.med.overdueBody')}</Callout>}
      {p?.messages.map((m) => (
        <Callout key={m.code} tone="bad" title={t(`m03.prof.${m.code}`)}>
          {pick({ x_en: m.en, x_ar: m.ar }, 'x')}
        </Callout>
      ))}

      <Grid cols={2}>
        <Card title={t('m03.cert.title')} eyebrow={t(`m03.type.${lic.type}`)} actions={<LicencePill lic={lic} />} footer={t('m02.mirror.asRecorded', { system: systemName(t, lic.source_system), date: f.dateTime(lic.last_synced) })}>
          <div className="flex items-center gap-4" data-testid="m03-my-certificate">
            <ProgressRing value={100 - pct} name={t('m03.cert.title')} label={v.stale ? '—' : f.num(Math.max(0, v.daysToExpiry))} tone={v.view === 'valid' ? 'ok' : v.view === 'renewal_due' ? 'sim' : 'bad'} size={72} />
            <KeyValue
              items={[
                [t('m03.cert.number'), <span className="num">{lic.cert_no}</span>],
                [t('m03.cert.facility'), lic.facility],
                [t('m03.cert.issued'), f.date(lic.issued_on)],
                [t('m03.cert.expires'), f.date(lic.expires_on)],
                [t('m03.cert.daysLeft'), v.stale ? t('m03.view.stale') : v.daysToExpiry >= 0 ? t('m02.inDays', { days: plural('common.nDays', v.daysToExpiry) }) : t('m02.expiredAgo', { days: plural('common.nDays', -v.daysToExpiry) })],
              ]}
            />
          </div>
          {v.view === 'renewal_due' && <p className="mt-3 text-[13px] text-sim">{t('m03.cert.renewalNote', { n: RULES.licenceRenewalTaskMonths })}</p>}
        </Card>
        <Card title={t('m03.med.title')} actions={d.med ? <MedicalPill med={d.med} /> : null} footer={d.med ? t('m02.mirror.asRecorded', { system: systemName(t, d.med.source_system), date: f.dateTime(d.med.last_synced) }) : undefined}>
          {d.med ? (
            <div data-testid="m03-my-medical">
              <KeyValue items={[[t('m03.med.due'), f.date(d.med.due_on)], [t('m03.med.flag'), t(`m03.med.flag_${d.med.flag}`)]]} />
              <p className="mt-3 text-[12.5px] text-ink-3">{t('m03.med.noContent', { n: RULES.medicalIntervalMonths })}</p>
            </div>
          ) : (
            <p className="text-ink-2">{t('m03.med.none')}</p>
          )}
        </Card>
      </Grid>

      <Section title={t('m03.prof.quarterTitle', { q })} description={t('m03.prof.quarterDesc', { end: f.date(quarterEnd(q)) })}>
        {cur ? (
          <Grid cols={isSro ? 3 : 2}>
            <Card title={t('m03.prof.s8')}>
              <ProgressBar value={Math.min(100, (cur.shifts_8h * 100) / RULES.shiftMin8h)} tone={cur.shifts_8h >= RULES.shiftMin8h ? 'ok' : 'sim'} label={t('m03.prof.ofMin', { n: f.num(cur.shifts_8h), min: f.num(RULES.shiftMin8h) })} />
              <p className="mt-2 text-[12.5px] text-ink-2">{t('m03.prof.scheduled', { n: f.num(cur.scheduled_remaining_8h) })}</p>
            </Card>
            <Card title={t('m03.prof.s12')}>
              <ProgressBar value={Math.min(100, (cur.shifts_12h * 100) / RULES.shiftMin12h)} tone={cur.shifts_12h >= RULES.shiftMin12h ? 'ok' : 'sim'} label={t('m03.prof.ofMin', { n: f.num(cur.shifts_12h), min: f.num(RULES.shiftMin12h) })} />
              <p className="mt-2 text-[12.5px] text-ink-2">{t('m03.prof.scheduled', { n: f.num(cur.scheduled_remaining_12h) })}</p>
            </Card>
            {isSro && (
              <Card title={t('m03.prof.sro')}>
                <ProgressBar value={Math.min(100, (cur.sro_role_shifts * 100) / RULES.sroRoleShiftMin)} tone={cur.sro_role_shifts >= RULES.sroRoleShiftMin ? 'ok' : p?.sroAtRisk ? 'bad' : 'sim'} label={t('m03.prof.ofMin', { n: f.num(cur.sro_role_shifts), min: f.num(RULES.sroRoleShiftMin) })} />
                <p className="mt-2 text-[12.5px] text-ink-2">{t('m03.prof.scheduled', { n: f.num(cur.scheduled_remaining_sro) })}</p>
              </Card>
            )}
          </Grid>
        ) : (
          <EmptyState title={t('m03.prof.noData')} />
        )}
        {p && !p.atRisk && !p.sroAtRisk && <p className="text-[13px] text-ok" data-testid="m03-prof-ok">{p.met && p.sroMet !== false ? t('m03.prof.metMsg') : t('m03.prof.onTrackMsg')}</p>}
        <p className="text-[12px] text-ink-3">{t('m03.prof.rule')}</p>
        {d.sp.length > 1 && (
          <DataTable
            rows={d.sp}
            rowKey={(x) => x.id}
            searchable={false}
            dense
            columns={[
              { key: 'q', header: t('m03.prof.quarter'), value: (x) => x.quarter },
              { key: 's8', header: t('m03.prof.s8'), value: (x) => x.shifts_8h, align: 'end' },
              { key: 's12', header: t('m03.prof.s12'), value: (x) => x.shifts_12h, align: 'end' },
              ...(isSro ? [{ key: 'sro', header: t('m03.prof.sro'), value: (x: (typeof d.sp)[number]) => x.sro_role_shifts, align: 'end' as const }] : []),
              { key: 'res', header: t('m03.prof.result'), value: (x) => { const r = proficiency(x, isSro); return r.atRisk || r.sroAtRisk ? 'at_risk' : r.met && r.sroMet !== false ? 'met' : 'on_track'; }, render: (x) => { const r = proficiency(x, isSro); const k = r.atRisk || r.sroAtRisk ? 'at_risk' : r.met && r.sroMet !== false ? 'met' : 'on_track'; return <StatusPill tone={k === 'at_risk' ? 'bad' : k === 'met' ? 'ok' : 'info'}>{t(`m03.prof.${k}`)}</StatusPill>; } },
            ]}
          />
        )}
      </Section>

      <Grid cols={2}>
        <Card title={t('m03.requal.title')}>
          {d.rq ? (
            <div className="space-y-2" data-testid="m03-my-requal">
              <KeyValue
                items={[
                  [t('m03.requal.window'), `${f.date(d.rq.window_start)} – ${f.date(d.rq.window_end)}`],
                  [t('m03.requal.exam'), <StatusPill status={d.rq.exam_status === 'passed' ? 'passed' : d.rq.exam_status === 'failed' ? 'failed' : d.rq.exam_status === 'scheduled' ? 'scheduled' : 'not_started'}>{t(`m03.requal.exam_${d.rq.exam_status}`)}</StatusPill>],
                ]}
              />
              <ProgressBar value={d.rq.coct_hours_required ? Math.min(100, (d.rq.coct_hours_done * 100) / d.rq.coct_hours_required) : 0} label={t('m03.requal.coct', { n: f.num(d.rq.coct_hours_done), of: f.num(d.rq.coct_hours_required) })} />
            </div>
          ) : (
            <p className="text-ink-2">{t('m03.requal.none')}</p>
          )}
        </Card>
        <Card title={t('m03.my.datesTitle')}>
          <Timeline items={dates.map((k) => ({ id: k.id, when: f.date(k.date), title: t(`m03.dates.${k.kind}`), tone: k.date < today ? 'neutral' : k.kind === 'withdrawal' || k.kind === 'expiry' ? 'bad' : 'accent' }))} />
        </Card>
      </Grid>

      {(d.tasks.length > 0 || d.ms.length > 0) && (
        <Section title={t('m03.my.openItems')} description={t('m03.my.openItemsDesc')}>
          <ul className="space-y-1.5 text-[13.5px]">
            {d.tasks.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2.5">
                <span>{pick(x, 'title')}</span>
                <StatusPill tone="info">{t('m03.tasks.dueOn', { d: f.date(x.due_at) })}</StatusPill>
              </li>
            ))}
            {d.ms.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2.5">
                <span>{t(`m03.ms.${m.kind}`)}{m.note_en ? ` · ${pick(m, 'note')}` : ''}</span>
                <StatusPill status={m.status === 'done' ? 'completed' : m.status === 'missed' ? 'overdue' : 'scheduled'}>{f.date(m.due_on)}</StatusPill>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <p className="text-[12px] text-ink-3">{t('m03.my.footer')}</p>
    </>
  );
}
