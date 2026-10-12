// FS74 /my/future-wallet (skills_profile Own): my core-five Future Skills Wallet, computed from evidence only (a self-rating never
// counts): AI fluency rung 2, cyber hygiene, plant-data basics, one critical core skill, CleanEnergyComp L1. Each item shows its rule,
// its evidence, where to earn it and whether it already sits in my development plan; the open items can be added to the plan in one
// confirmed step (addWalletToPlan), so goals and evidence travel together. The organisation target is shown as the leadership
// parameter it is, with who set it and when.
import { useState } from 'react';
import { Page, Section, Async, BenchmarkChips, Callout, Card, ConfirmDialog, EmptyState, Icon, ProgressRing, SourceLink, StatusPill, WhyThis } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ITEM_ROUTE, WALLET_ITEMS, WALLET_RULE, itemReasons, type MyWallet, type TargetView, type WalletItem, type WalletKey } from './wallet';
import type { Row } from './ui';

export const ITEM_ICON: Record<WalletKey, string> = { ai_rung2: 'sparkle', cyber_hygiene: 'shield', plant_data: 'chart', core_skill: 'users', cec_l1: 'globe' };

export default function FutureWalletPage() {
  const t = useT();
  const repo = useRepo();
  const w = useQuery(['person_skills', 'microcred_awards', 'dev_plans', 'plan_activities', 'wallet_targets'], () => repo.rpc.myFutureWallet(), []);
  const ref = useQuery(['core_skills', 'skills'], async () => {
    const [core, skills] = await Promise.all([repo.list('core_skills' as never).catch(() => []), repo.list('skills', { filter: { id: WALLET_RULE.plant_skill } }).catch(() => [])]);
    return { core: core as unknown as Row[], skills: skills as unknown as Row[] };
  }, []);
  return (
    <Page title={t('m37.routes.my-future-wallet.title')} intro={t('m37.fw.intro')} wide eyebrow={<BenchmarkChips feature="FS74" />}
      actions={<L to="/my/plan" className="btn-outline btn-sm no-underline" data-testid="m37-fw-to-plan">{t('m37.fw.toPlan')}</L>}>
      <Async state={ref}>{(rf) => (
        <Async state={w} isEmpty={(x) => !x} empty={<EmptyState title={t('m37.fw.none')} />}>{(d) => (d ? <Wallet d={d} rf={rf} /> : null)}</Async>
      )}</Async>
    </Page>
  );
}

function Wallet({ d, rf }: { d: MyWallet; rf: { core: Row[]; skills: Row[] } }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [confirm, setConfirm] = useState(false);
  const open = d.status.items.filter((i) => !i.met);
  const toAdd = open.filter((i) => !d.in_plan[i.key]);
  return (
    <div className="space-y-6" data-testid="m37-fw" data-met={d.status.met} data-complete={d.status.complete ? 'true' : 'false'}>
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <ProgressRing value={(100 * d.status.met) / WALLET_ITEMS.length} size={88} label={t('m37.fw.ringLabel', { n: f.num(d.status.met), of: f.num(WALLET_ITEMS.length) })} tone={d.status.complete ? 'ok' : 'accent'} />
          <div className="min-w-0 flex-1 basis-56 space-y-1.5">
            <h2 className="text-lg font-semibold" data-testid="m37-fw-headline">{d.status.complete ? t('m37.fw.complete') : t('m37.fw.progress', { n: f.num(d.status.met), of: f.num(WALLET_ITEMS.length) })}</h2>
            <p className="text-[13px] text-ink-2">{t('m37.fw.evidenceOnly')}</p>
            {d.target && <p className="text-[13px] text-ink-2" data-testid="m37-fw-target-line">{t('m37.fw.targetLine', { pct: f.pct(d.target.pct, 0), date: f.date(d.target.due_on) })}</p>}
          </div>
          <div className="flex flex-col items-stretch gap-2">
            {s.can('dev_plans', ['Own', 'Scope']) && !d.status.complete && (
              <button type="button" className="btn-primary btn-sm" disabled={!toAdd.length} onClick={() => setConfirm(true)} data-testid="m37-fw-add-plan">
                <Icon name="plus" size={14} />{toAdd.length ? t('m37.fw.addPlan', { n: f.num(toAdd.length) }) : t('m37.fw.allInPlan')}
              </button>
            )}
            {d.plan ? <span className="text-[12px] text-ink-3" data-testid="m37-fw-plan">{t('m37.fw.planIs', { status: t(`m37.fw.planStatus.${d.plan.status}`) })}</span>
              : <span className="text-[12px] text-ink-3" data-testid="m37-fw-plan">{t('m37.fw.noPlanYet')}</span>}
          </div>
        </div>
      </Card>

      <Section title={t('m37.fw.itemsTitle')} description={t('m37.fw.itemsIntro')}>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="m37-fw-items">
          {d.status.items.map((it) => <ItemCard key={it.key} it={it} plan={d.in_plan[it.key] ?? null} rf={rf} />)}
        </ul>
      </Section>

      {d.target && <TargetCard tv={d.target} />}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m37.fw.confirmTitle')}
        consequence={t('m37.fw.confirmBody', { n: f.num(toAdd.length), date: d.target ? f.date(d.target.due_on) : '—' })}
        onConfirm={async () => { await run(() => repo.rpc.addWalletToPlan()); setConfirm(false); }} />
    </div>
  );
}

function ItemCard({ it, plan, rf }: { it: WalletItem; plan: string | null; rf: { core: Row[]; skills: Row[] } }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const core = it.ref_table === 'core_skills' ? rf.core.find((c) => c.id === it.ref_id) : undefined;
  const skill = rf.skills.find((x) => x.id === WALLET_RULE.plant_skill);
  const detail = (() => {
    switch (it.key) {
      case 'ai_rung2': return t('m37.fw.detail.ai_rung2', { level: f.num(it.level ?? 0) });
      case 'cyber_hygiene': return it.met ? t('m37.fw.detail.cyberUntil', { date: it.until ? f.date(it.until) : '—' }) : t('m37.fw.detail.cyberNone');
      case 'plant_data': return it.level ? t('m37.fw.detail.plantLevel', { skill: skill ? pick(skill, 'name') : WALLET_RULE.plant_skill, level: f.num(it.level) }) : t('m37.fw.detail.plantNone', { skill: skill ? pick(skill, 'name') : WALLET_RULE.plant_skill });
      case 'core_skill': return core ? t('m37.fw.detail.coreLevel', { skill: pick(core, 'name'), level: f.num(it.level ?? 0) }) : t('m37.fw.detail.coreNone');
      case 'cec_l1': return t('m37.fw.detail.cec_l1', { level: f.num(it.level ?? 0) });
      default: return '';
    }
  })();
  return (
    <Card as="li" className="flex flex-col"
      eyebrow={<span className="inline-flex items-center gap-1.5"><Icon name={ITEM_ICON[it.key]} size={13} />{t('m37.fw.itemN', { n: f.num(WALLET_ITEMS.indexOf(it.key) + 1) })}</span>}
      title={t(`m37.fw.item.${it.key}.title`)}>
      <div className="flex flex-1 flex-col gap-2.5" data-testid="m37-fw-item" data-key={it.key} data-met={it.met ? 'true' : 'false'}>
        <p className="text-[12.5px] text-ink-3">{t(`m37.fw.item.${it.key}.rule`)}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill tone={it.met ? 'ok' : 'neutral'}>{it.met ? t('m37.fw.met') : t('m37.fw.open')}</StatusPill>
          {plan && <span data-testid="m37-fw-in-plan"><StatusPill tone="info">{t('m37.fw.inPlan', { status: t(`m37.fw.actStatus.${plan}`) })}</StatusPill></span>}
          <WhyThis reasons={itemReasons(it)} testId="m37-fw-why" />
        </div>
        <p className="text-[13px] text-ink-2" data-testid="m37-fw-detail">{detail}</p>
        {!it.met && <L to={ITEM_ROUTE[it.key]} className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold" data-testid="m37-fw-next">{t(`m37.fw.item.${it.key}.next`)}<Icon name="chevron" size={13} className="rtl:-scale-x-100" /></L>}
      </div>
    </Card>
  );
}

export function TargetCard({ tv, children }: { tv: TargetView; children?: React.ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <Section title={t('m37.fw.targetTitle')} description={t('m37.fw.targetIntro')}>
      <Card>
        <div className="space-y-3" data-testid="m37-fw-target" data-version={tv.version}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="num text-2xl font-semibold" data-testid="m37-fw-target-value">{f.pct(tv.pct, 0)}</span>
            <span className="text-[13px] text-ink-2">{t('m37.fw.targetBy', { date: f.date(tv.due_on) })}</span>
            <StatusPill tone="sim">{t('m37.fw.parameter')}</StatusPill>
          </div>
          <p className="text-[13px] text-ink-2">{pick(tv as unknown as Row, 'note')}</p>
          <p className="text-[12.5px] text-ink-3" data-testid="m37-fw-target-who">{t('m37.fw.setBy', { who: pick(tv as unknown as Row, 'set_by_name'), date: f.date(tv.set_at.slice(0, 10)), version: f.num(tv.version) })}</p>
          {tv.sources.length > 0 && (
            <ul className="space-y-1 text-[12.5px]">{tv.sources.map((x) => <li key={x.url}><SourceLink href={x.url} date={x.as_of}>{x.label}</SourceLink></li>)}</ul>
          )}
          <Callout tone="sim" title={t('m37.fw.notClaimTitle')}>{t('m37.fw.notClaimBody')}</Callout>
          {children}
        </div>
      </Card>
    </Section>
  );
}
