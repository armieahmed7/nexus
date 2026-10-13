// FS80 /admin/ai-automations (ai_literacy A: admin / AI governance): review the gallery. The queue of submitted entries with a
// governance checklist (register row published, human check named, personal data flagged, minimum rung against the register's user
// groups, metadata only), decisions approve / return / reject (rpc.decideAutomation behind a ConfirmDialog; a reason for return and
// reject; maker-checker: never an entry I built or own), every entry with retire for approved ones, and statistics (adopters by family,
// people counts suppressed under 10; security, safeguards and cyber never broken out).
import { useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, ConfirmDialog, DataTable, BarChart, Icon, StatusPill, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { looksLikeCode, builderLevel } from './automations';
import { AtmStatus, Counter, DataClassChips, KindChip, MetadataNotice, Plain, SystemLink, useAtmRun, useGallery, type GalleryData } from './fs80ui';
import { RungPill, type Row } from './ui';
import type { AutomationStatsView } from './backend/rpc';

export default function GalleryAdminPage() {
  const t = useT();
  const q = useGallery();
  const repo = useRepo();
  const st = useQuery(['automations', 'automation_adoptions'], () => repo.rpc.automationStats().catch(() => null), []);
  const groups = useQuery(['ai_system_users'], () => (repo.list('ai_system_users' as never) as Promise<Row[]>).catch(() => [] as Row[]), []);
  const families = useQuery(['job_families'], () => (repo.list('job_families') as Promise<Row[]>).catch(() => [] as Row[]), []);
  return (
    <Page title={t('m29.routes.admin-ai-automations.title')} intro={t('m29.atm.adm.intro')} wide eyebrow={<BenchmarkChips feature="FS80" />}
      actions={<L to="/workforce/ai-automations" className="btn-outline btn-sm no-underline">{t('m29.atm.my.toGallery')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Body d={d} stats={st.data ?? null} groups={groups.data ?? []} families={families.data ?? []} reload={() => { q.reload?.(); st.reload?.(); }} />}</Async>
    </Page>
  );
}

type Pending = { a: Row; decision: 'approve' | 'return' | 'reject' | 'retire' };

function Body({ d, stats, groups, families, reload }: { d: GalleryData; stats: AutomationStatsView | null; groups: Row[]; families: Row[]; reload: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAtmRun();
  const [pending, setPending] = useState<Pending | null>(null);
  const queue = d.entries.filter((a: Row) => a.status === 'submitted');
  const sysOf = (id: string) => d.systems.find((s: Row) => s.id === id);
  const mine = (a: Row) => a.builder_person_id === d.pid || a.owner_person_id === d.pid;
  const cols: Column<Row>[] = [
    { key: 'title', header: t('m29.atm.adm.col.title'), value: (a) => pick(a, 'title'), render: (a) => <L to={`/workforce/ai-automations/${a.id}`} className="font-semibold">{pick(a, 'title')}</L>, sortable: true },
    { key: 'status', header: t('m29.atm.adm.col.status'), value: (a) => a.status, render: (a) => <AtmStatus status={a.status} />, sortable: true },
    { key: 'kind', header: t('m29.atm.adm.col.kind'), value: (a) => a.kind, render: (a) => <KindChip kind={a.kind} /> },
    { key: 'builder', header: t('m29.atm.adm.col.builder'), value: (a) => pick(a, 'builder') },
    { key: 'system', header: t('m29.atm.adm.col.system'), value: (a) => a.system_id, render: (a) => <SystemLink sys={sysOf(a.system_id)} /> },
    { key: 'n', header: t('m29.atm.adm.col.adopters'), value: (a) => Number(a.adoption_count), render: (a) => f.num(Number(a.adoption_count)), align: 'end', sortable: true },
    { key: 'lvl', header: t('m29.atm.adm.col.credit'), value: (a) => builderLevel(a.status, Number(a.adoption_count)), render: (a) => { const l = builderLevel(a.status, Number(a.adoption_count)); return l ? t('m29.atm.credit.levelShort', { n: f.num(l) }) : '—'; } },
    { key: 'act', header: '', value: () => '', render: (a) => a.status === 'approved' ? <button type="button" className="btn-ghost btn-sm" data-testid="m29-atm-retire" disabled={mine(a)} onClick={() => setPending({ a, decision: 'retire' })}>{t('m29.atm.adm.retire')}</button> : null },
  ];
  const famName = (id: string) => { const x = families.find((j) => j.id === id); return id === 'other' ? t('m29.atm.adm.otherFamilies') : x ? pick(x, 'name') : id; };
  const fam = (stats?.families ?? []).map((x) => ({ label: famName(x.family_id), value: x.adopters, suppressed: x.adopters == null }));
  return (
    <div className="space-y-6">
      <MetadataNotice />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m29-atm-adm-tiles">
        <StatTile label={t('m29.atm.adm.tile.queue')} value={f.num(queue.length)} tone={queue.length ? 'info' : undefined} />
        <StatTile label={t('m29.atm.adm.tile.approved')} value={f.num(stats?.approved ?? 0)} tone="ok" />
        <StatTile label={t('m29.atm.adm.tile.adoptions')} value={f.num(stats?.adoptions ?? 0)} sub={t('m29.atm.adm.tile.adopters', { n: stats?.adopters == null ? t('common.suppressedShort') : f.num(stats.adopters) })} />
        <StatTile label={t('m29.atm.adm.tile.credited')} value={stats?.credited == null ? t('common.suppressedShort') : f.num(stats.credited)} sub={t('m29.atm.adm.tile.creditedSub')} />
      </div>
      <Section title={t('m29.atm.adm.queue.title')} description={t('m29.atm.adm.queue.intro')}>
        {queue.length ? (
          <ul className="space-y-3" data-testid="m29-atm-queue">
            {queue.map((a: Row) => {
              const sys = sysOf(a.system_id);
              const gs = groups.filter((g) => g.system_id === a.system_id && g.active);
              const minGroup = gs.length ? Math.min(...gs.map((g) => Number(g.required_rung))) : null;
              const checks: [string, boolean, string][] = [
                ['register', sys?.status === 'published', t('m29.atm.adm.chk.register')],
                ['oversight', !!String(a.oversight_en ?? '').trim(), t('m29.atm.adm.chk.oversight')],
                ['metadata', !!a.metadata_only && ![a.purpose_en, a.how_en, a.data_used_en, a.purpose_ar, a.how_ar].some((x) => looksLikeCode(String(x ?? ''))), t('m29.atm.adm.chk.metadata')],
                ['personal', !(a.data_classes ?? []).includes('personal'), t('m29.atm.adm.chk.personal')],
                ['rung', minGroup == null || Number(a.min_rung) >= minGroup, t('m29.atm.adm.chk.rung', { n: minGroup ?? 1 })],
                ['maker_checker', !mine(a), t('m29.atm.adm.chk.maker')],
              ];
              return (
                <li key={a.id} className="card space-y-3 p-4" data-testid="m29-atm-queue-item" data-id={a.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5"><KindChip kind={a.kind} /><L to={`/workforce/ai-automations/${a.id}`} className="min-w-0 break-words font-semibold">{pick(a, 'title')}</L></span>
                    <span className="text-[12px] text-ink-3">{t('m29.atm.adm.submittedBy', { name: pick(a, 'builder'), date: a.submitted_at ? f.date(String(a.submitted_at)) : '—' })}</span>
                  </div>
                  <Plain>{pick(a, 'purpose')}</Plain>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="space-y-2 text-[13px]">
                      <SystemLink sys={sys} />
                      <DataClassChips classes={a.data_classes} />
                      <p className="text-ink-2"><span className="font-semibold">{t('m29.atm.one.oversight')}: </span>{pick(a, 'oversight')}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-ink-3">{t('m29.atm.one.minRung')} <RungPill rung={Number(a.min_rung)} /> · {t('m29.atm.one.owner')}: {pick(a, 'owner')}</p>
                    </div>
                    <ul className="space-y-1 text-[13px]" data-testid="m29-atm-checklist">
                      {checks.map(([k, okc, label]) => (
                        <li key={k} className={`flex items-start gap-1.5 ${okc ? 'text-ok' : 'text-bad'}`} data-check={k} data-ok={okc ? 'yes' : 'no'}><Icon name={okc ? 'check' : 'alert'} size={14} className="mt-0.5" /><span>{label}</span></li>
                      ))}
                    </ul>
                  </div>
                  {mine(a) && <Callout tone="sim" title={t('m29.atm.adm.ownTitle')}>{t('m29.atm.adm.ownBody')}</Callout>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary btn-sm" data-testid="m29-atm-approve" disabled={mine(a)} onClick={() => setPending({ a, decision: 'approve' })}><Icon name="check" size={14} /> {t('m29.atm.adm.approve')}</button>
                    <button type="button" className="btn-outline btn-sm" data-testid="m29-atm-return" disabled={mine(a)} onClick={() => setPending({ a, decision: 'return' })}>{t('m29.atm.adm.return')}</button>
                    <button type="button" className="btn-ghost btn-sm" data-testid="m29-atm-reject" disabled={mine(a)} onClick={() => setPending({ a, decision: 'reject' })}>{t('m29.atm.adm.reject')}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title={t('m29.atm.adm.queue.none')} />}
      </Section>
      <Section title={t('m29.atm.adm.all.title')}>
        <div data-testid="m29-atm-adm-table">
          {d.entries.length ? <DataTable rows={d.entries} columns={cols} rowKey={(a) => a.id} searchable caption={t('m29.atm.adm.all.title')} csvName="automation-gallery.csv" /> : <EmptyState title={t('m29.atm.gal.none')} />}
        </div>
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m29.atm.adm.fam.title')} eyebrow={t('m29.atm.adm.fam.eyebrow')}>
          {fam.length ? <BarChart title={t('m29.atm.adm.fam.title')} data={fam} /> : <p className="text-[13px] text-ink-3">{t('m29.atm.adm.fam.none')}</p>}
        </Card>
        <Card title={t('m29.atm.adm.sys.title')}>
          <ul className="space-y-1.5 text-[13px]" data-testid="m29-atm-adm-systems">
            {(stats?.systems ?? []).map((x) => <li key={x.system_id} className="flex flex-wrap items-center justify-between gap-2"><SystemLink sys={sysOf(x.system_id)} /><span className="flex items-center gap-2"><StatusPill tone="neutral">{t('m29.atm.adm.sys.entries', { n: f.num(x.entries) })}</StatusPill><Counter n={x.adoptions} /></span></li>)}
          </ul>
        </Card>
      </div>
      {pending && (
        <ConfirmDialog open onClose={() => setPending(null)} title={t(`m29.atm.adm.confirm.${pending.decision}Title`)} consequence={t(`m29.atm.adm.confirm.${pending.decision}`)}
          requireReason={pending.decision !== 'approve'} reasonLabel={t('m29.atm.adm.reason')} danger={pending.decision === 'reject' || pending.decision === 'retire'}
          onConfirm={async (reason) => { const r = await run(() => repo.rpc.decideAutomation({ id: pending.a.id, decision: pending.decision, note: reason }), `m29.atm.ok.${pending.decision}`); setPending(null); if (r.ok) reload(); }} />
      )}
    </div>
  );
}
