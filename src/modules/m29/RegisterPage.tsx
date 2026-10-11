// FS36 /workspace/ai-register (ai_literacy R: staff and auditors): the AI-literacy register. Every AI system (synthetic examples) with
// ENEC's role (provider or deployer), approved-use class, maturity label, owner and literacy measures; coverage per system computed from
// FS09 rungs by rpc.aiLiteracyCoverage (Agg/A/auditors, or the system's owner), suppressed under 10, with the 80% line behind
// "fully implemented"; and, for every staff member, the systems they use and whether their own rung meets each group's requirement.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, Icon, StatusPill, WhyThis } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { isMember, isCovered } from './register';
import type { AiFluencyView } from './backend/rpc';
import { CoverageBar, CoverageWhy, GroupRequirement, LabelCheck, SystemChips, useRegister, type RegisterData } from './fs36ui';
import { RungPill, type Row } from './ui';

const ROLE_FILTERS = ['all', 'provider', 'deployer'] as const;

export default function RegisterPage() {
  const t = useT();
  const s = useSession();
  const q = useRegister();
  const repo = useRepo();
  const mine = useQuery(['person_skills'], () => repo.rpc.aiFluency().catch(() => null), [s.identity.personId]);
  const canPack = s.roles.some((r) => ['admin', 'auditor', 'hr_analyst', 'hr_director'].includes(r));
  return (
    <Page title={t('m29.routes.workforce-ai-register.title')} intro={t('m29.reg.intro')} wide eyebrow={<BenchmarkChips feature="FS36" />}
      actions={<span className="flex flex-wrap gap-2">
        {canPack && <L to="/workforce/ai-literacy-pack" className="btn-primary btn-sm no-underline" data-testid="m29-reg-to-pack"><Icon name="download" size={14} /> {t('m29.reg.toPack')}</L>}
        {s.can('ai_literacy', ['A']) && <L to="/admin/ai-register" className="btn-outline btn-sm no-underline" data-testid="m29-reg-to-admin">{t('m29.reg.toAdmin')}</L>}
      </span>}>
      <Async state={q}>{(d) => (d.systems.length ? <Body d={d} me={mine.data ?? null} /> : <EmptyState title={t('m29.reg.none')} />)}</Async>
    </Page>
  );
}

function Body({ d, me }: { d: RegisterData; me: AiFluencyView | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]>('all');
  const published = d.systems.filter((x) => x.status === 'published');
  const others = d.systems.filter((x) => x.status !== 'published');
  const shown = published.filter((x) => role === 'all' || x.ai_role === role);
  const cov = d.cov;
  const covOf = (id: string) => cov?.systems.find((x) => x.system_id === id);
  const fullOk = cov ? cov.systems.filter((x) => x.label_ok === true).length : null;
  const fullLow = cov ? cov.systems.filter((x) => x.label_ok === false).length : null;
  // Systems I use: the groups my job family (or all staff) belongs to, and whether my own rung meets them (my data only).
  const used = useMemo(() => {
    if (!me) return [];
    const p = { person_id: me.person_id, family_id: me.family_id, rung: me.result.rung, met: me.result.cells.filter((c) => c.met).map((c) => c.id) };
    return published.flatMap((sys) => d.groups.filter((g) => g.system_id === sys.id && isMember(g as never, p)).map((g) => ({ sys, g, ok: isCovered(g as never, p) })));
  }, [me, published, d.groups]);
  return (
    <div className="space-y-6">
      <Callout tone="info" title={t('m29.reg.notRegulator.title')}><span data-testid="m29-reg-voluntary">{t('m29.reg.notRegulator.body')}</span></Callout>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m29-reg-tiles">
        <StatTile label={t('m29.reg.tile.systems')} value={f.num(published.length)} sub={t('m29.reg.tile.systemsSub', { p: f.num(published.filter((x) => x.ai_role === 'provider').length), d: f.num(published.filter((x) => x.ai_role === 'deployer').length) })} />
        <StatTile label={t('m29.reg.tile.overall')} value={cov ? (cov.overall.pct == null ? t('common.suppressedShort') : f.pct(cov.overall.pct)) : '—'} sub={cov ? t('m29.reg.tile.overallSub', { scope: t(`m29.reg.scope.${cov.scope}`) }) : t('m29.reg.cov.hidden')} tone="info" />
        <StatTile label={t('m29.reg.tile.full')} value={f.num(published.filter((x) => x.maturity === 'full').length)} sub={fullOk == null ? t('m29.reg.tile.fullSub0') : t('m29.reg.tile.fullSub', { ok: f.num(fullOk), low: f.num(fullLow ?? 0) })} tone={fullLow ? 'bad' : 'ok'} />
        <StatTile label={t('m29.reg.tile.mine')} value={me ? f.num(new Set(used.map((u) => u.sys.id)).size) : '—'} sub={me ? t('m29.reg.tile.mineSub', { n: f.num(used.filter((u) => u.ok).length), of: f.num(used.length) }) : t('m29.reg.tile.mineNone')} />
      </div>

      {me && used.length > 0 && (
        <Section title={t('m29.reg.mine.title')} description={t('m29.reg.mine.intro')}>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="m29-reg-mine">
            {used.map(({ sys, g, ok }) => (
              <li key={g.id} className="card flex flex-col gap-2 p-3" data-testid="m29-reg-mine-row" data-ok={ok ? 'yes' : 'no'}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <L to={`/workforce/ai-register/${sys.id}`} className="font-semibold">{pick(sys, 'name')}</L>
                  <StatusPill tone={ok ? 'ok' : 'sim'}>{ok ? t('m29.reg.mine.met') : t('m29.reg.mine.notYet')}</StatusPill>
                </span>
                <span className="text-[12.5px] text-ink-2">{pick(g, 'label')} · {t(`m29.reg.side.${g.side}`)}</span>
                <span className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="text-ink-3">{t('m29.reg.mine.needs')}</span> <GroupRequirement g={g} cells={d.cells} />
                  <span className="text-ink-3">{t('m29.reg.mine.you')}</span> <RungPill rung={me.result.rung} />
                </span>
                {!ok && <span className="text-[12.5px]"><L to="/my/ai-fluency">{t('m29.reg.mine.close')}</L> · <L to="/my/ai-fluency/drills">{t('m29.reg.mine.drills')}</L></span>}
              </li>
            ))}
          </ul>
          <div className="mt-2"><WhyThis reasons={me.result.reasons} testId="m29-reg-mine-why" /></div>
        </Section>
      )}

      <Section title={t('m29.reg.list.title')} description={t('m29.reg.list.intro')}
        actions={<span className="flex flex-wrap gap-1" role="group" aria-label={t('m29.reg.filter')}>
          {ROLE_FILTERS.map((r) => <button key={r} type="button" className={role === r ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={role === r} onClick={() => setRole(r)} data-testid={`m29-reg-filter-${r}`}>{t(`m29.reg.filterOpt.${r}`)}</button>)}
        </span>}>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m29-reg-list">
          {shown.map((x) => {
            const sc = covOf(x.id);
            const gs = d.groups.filter((g) => g.system_id === x.id);
            return (
              <li key={x.id} className="card flex min-w-0 flex-col gap-3 p-4" data-testid="m29-reg-system" data-id={x.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <L to={`/workforce/ai-register/${x.id}`} className="min-w-0 text-[15px] font-semibold" data-testid="m29-reg-open">{pick(x, 'name')}</L>
                  <LabelCheck sc={sc} />
                </div>
                <SystemChips s={x} />
                <p className="text-[13px] text-ink-2">{pick(x, 'purpose')}</p>
                <dl className="grid grid-cols-1 gap-1 text-[12.5px] sm:grid-cols-2">
                  <div><dt className="caps inline">{t('m29.reg.owner')}</dt> <dd className="inline">{pick(x, 'owner')}</dd></div>
                  <div><dt className="caps inline">{t('m29.reg.groups')}</dt> <dd className="inline">{f.num(gs.length)} · {gs.map((g) => t(`m29.reg.side.${g.side}`)).filter((v, i, a) => a.indexOf(v) === i).join(' / ')}</dd></div>
                </dl>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1"><CoverageBar c={sc ?? (cov ? null : undefined)} label={t('m29.reg.cov.system')} compact /></div>
                  {sc && <CoverageWhy sc={sc} />}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {others.length > 0 && (
        <Section title={t('m29.reg.others.title')} description={t('m29.reg.others.intro')}>
          <ul className="space-y-2" data-testid="m29-reg-others">
            {others.map((x) => (
              <li key={x.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                <L to={`/workforce/ai-register/${x.id}`} className="font-semibold">{pick(x, 'name')}</L>
                <SystemChips s={x} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Card title={t('m29.reg.legend.title')} eyebrow={t('m29.reg.legend.eyebrow')}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] md:grid-cols-3" data-testid="m29-reg-legend">
          {['planned', 'partial', 'full'].map((k) => <div key={k}><dt className="font-semibold">{t(`m29.reg.maturity.${k}`)}</dt><dd className="text-ink-2">{t(`m29.reg.legend.${k}`)}</dd></div>)}
          {['provider', 'deployer'].map((k) => <div key={k}><dt className="font-semibold">{t(`m29.reg.role.${k}`)}</dt><dd className="text-ink-2">{t(`m29.reg.legend.${k}`)}</dd></div>)}
          <div><dt className="font-semibold">{t('m29.reg.legend.covT')}</dt><dd className="text-ink-2">{t('m29.reg.legend.cov')}</dd></div>
        </dl>
      </Card>
    </div>
  );
}

export type { Row };
