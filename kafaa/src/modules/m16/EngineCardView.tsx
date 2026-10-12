// F24 (W3 · E5): one model and engine card. Used on /admin/ai-transparency (all cards) and in the /my/settings drawer
// ("How this works"). Shows what the engine uses and never uses, its live weights (F02 engine_settings), output, human
// oversight, limitations, owner, version and last change, the scoring functions behind it and its sources.
import type { ReactNode } from 'react';
import { useFormat, useLang, usePick, useT, L } from '../../i18n';
import { EngineBadge, Icon, SourceLink, StatusPill } from '../../ui';
import { DEFAULT_SETTINGS, modelGatewayUrl, resolveEngine, type Surface } from '../../domain/engines';
import type { EngineCardsRow, EngineSettingsRow } from '../../data/types';

type Input = { key: string; en: string; ar: string };
type Src = { label: string; url: string; as_of?: string | null };

export function EngineCardView({ card, setting, optouts, compact, extra }: { card: EngineCardsRow; setting?: EngineSettingsRow | null; optouts?: { n: number | null; suppressed: boolean } | null; compact?: boolean; extra?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const eng = resolveEngine(card.engine_surface as Surface, setting ?? DEFAULT_SETTINGS[card.engine_surface as Surface], modelGatewayUrl());
  const inputs = (Array.isArray(card.inputs_used) ? card.inputs_used : []) as Input[];
  const sources = (Array.isArray(card.sources) ? card.sources : []) as Src[];
  const keys = card.weight_keys.length ? card.weight_keys : [];
  const maxW = Math.max(1, ...keys.map((k) => Number(eng.weights[k] ?? 0)));
  return (
    <article className="card flex min-w-0 flex-col gap-3 p-4" data-testid="m16-engine-card" data-card={card.id}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="chip border-line bg-sunken font-mono text-[11px]" dir="ltr">{card.feature}</span>
            <span className="chip border-line bg-sunken text-[11px]">{t(`common.engines.surface.${card.engine_surface}`)}</span>
            {card.kernel_surface && card.kernel_surface !== card.engine_surface && <span className="chip border-sim-line bg-sim-bg text-[11px] text-sim" data-testid="m16-card-kernel">{t(`m16.reg.kernel.${card.kernel_surface}`)}</span>}
            <StatusPill tone="neutral">{t('m16.ai.card.version', { n: f.num(card.version) })}</StatusPill>
          </div>
          <h3 className="text-[16px] font-semibold leading-snug">{pick(card, 'title')}</h3>
        </div>
        <EngineBadge engine={eng} />
      </header>
      <p className="text-[13.5px] text-ink-2">{pick(card, 'purpose')}</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="caps mb-1">{t('m16.ai.card.uses')}</div>
          <ul className="space-y-1 text-[13px]" data-testid="m16-card-inputs">
            {inputs.map((i) => (
              <li key={i.key} className="flex items-start gap-1.5"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" /><span>{lang === 'ar' ? i.ar : i.en}</span></li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <div className="caps mb-1">{t('m16.ai.card.never')}</div>
          <ul className="flex flex-wrap gap-1.5" data-testid="m16-card-excluded">
            {card.inputs_excluded.map((k) => (
              <li key={k} className="chip border-bad-line bg-bad-bg text-bad"><Icon name="lock" size={12} />{t(`m16.ai.protected.${k}`)}</li>
            ))}
          </ul>
          <p className="mt-1.5 flex items-start gap-1 text-[12px] text-ink-3"><Icon name="shield" size={12} className="mt-0.5 shrink-0" />{t('m16.ai.card.neverTested')}</p>
        </div>
      </div>

      {keys.length > 0 && (
        <div>
          <div className="caps mb-1">{t('m16.ai.card.weights', { surface: t(`common.engines.surface.${card.engine_surface}`) })}</div>
          <ul className="space-y-1" data-testid="m16-card-weights">
            {keys.map((k) => {
              const v = Number(eng.weights[k] ?? 0);
              return (
                <li key={k} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-2 text-[12.5px]">
                  <span className="truncate text-ink-2" title={t(`m16.ai.weight.${k}`)}>{t(`m16.ai.weight.${k}`)}</span>
                  <span className="h-2 rounded-full bg-sunken"><span className="block h-2 rounded-full bg-accent" style={{ width: `${Math.round((v / maxW) * 100)}%` }} /></span>
                  <span className="num text-end font-mono" dir="ltr">{f.num(v)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!compact && (
        <dl className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
          <div className="min-w-0"><dt className="caps">{t('m16.ai.card.output')}</dt><dd className="text-ink-2">{pick(card, 'output')}</dd></div>
          <div className="min-w-0"><dt className="caps">{t('m16.ai.card.oversight')}</dt><dd className="text-ink-2">{pick(card, 'oversight')}</dd></div>
          <div className="min-w-0"><dt className="caps">{t('m16.ai.card.limitations')}</dt><dd className="text-ink-2">{pick(card, 'limitations')}</dd></div>
        </dl>
      )}
      {compact && (
        <div className="space-y-1.5 text-[13px]">
          <p><span className="font-semibold">{t('m16.ai.card.output')}: </span><span className="text-ink-2">{pick(card, 'output')}</span></p>
          <p><span className="font-semibold">{t('m16.ai.card.oversight')}: </span><span className="text-ink-2">{pick(card, 'oversight')}</span></p>
          <p><span className="font-semibold">{t('m16.ai.card.limitations')}: </span><span className="text-ink-2">{pick(card, 'limitations')}</span></p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2 text-[12.5px] text-ink-3">
        <span><Icon name="user" size={12} /> {t('m16.ai.card.owner')}: <span className="text-ink-2">{pick(card, 'owner')}</span></span>
        <span><Icon name="calendar" size={12} /> {t('m16.ai.card.lastChange', { date: f.date(card.last_changed_at) })}{card.last_change_id ? <span className="ms-1 font-mono" dir="ltr">{card.last_change_id}</span> : null}</span>
        <span data-testid="m16-card-optout">
          {card.opt_out ? <StatusPill tone="ok">{t('m16.ai.card.optOutYes')}</StatusPill> : <StatusPill tone="neutral">{t('m16.ai.card.optOutNo')}</StatusPill>}
          {card.opt_out && optouts && <span className="ms-1">{optouts.suppressed ? t('m16.ai.card.optedOutFew') : t('m16.ai.card.optedOutN', { n: f.num(optouts.n ?? 0) })}</span>}
        </span>
        <L to={card.route} className="ms-auto inline-flex items-center gap-1">{t('m16.ai.card.open')}<Icon name="chevron" size={12} className="rtl:-scale-x-100" /></L>
      </div>

      {(card.fairness_metric || card.fairness_none) && (
        <p className="flex items-start gap-1.5 text-[12.5px] text-ink-2" data-testid="m16-card-fairness"><Icon name="users" size={13} className="mt-0.5 shrink-0" />
          <span><span className="font-semibold">{t('m16.reg.col.fairness')}: </span>{card.fairness_metric ? t('m16.reg.metricBasis', { metric: t(`m16.reg.metric.${card.fairness_metric}`) }) : t(`m16.reg.none.${card.fairness_none}`)}</span></p>
      )}
      {(card.kernel_surface === 'transform' || card.kernel_surface === 'assess' || card.kernel_surface === 'rules') && <p className="text-[12px] text-ink-3" data-testid="m16-card-defaults">{t(`m16.reg.kernelNote.${card.kernel_surface}`)}</p>}
      {!compact && (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer font-semibold text-ink-2">{t('m16.ai.card.functions', { n: f.num(card.scoring_functions.length) })}</summary>
          <ul className="mt-1.5 space-y-0.5 font-mono text-[11.5px] text-ink-2" dir="ltr" data-testid="m16-card-functions">
            {card.scoring_functions.map((fn) => <li key={fn} className="break-all">{fn}</li>)}
          </ul>
        </details>
      )}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {sources.map((s) => <SourceLink key={s.url} href={s.url} date={s.as_of}>{s.label}</SourceLink>)}
        </div>
      )}
      {extra}
    </article>
  );
}
