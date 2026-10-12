// /admin/ai-transparency/model-risk (M16 · FS55): the model-risk template, ready for the day a server-side model gateway is approved (the
// ModelGatewayEngine slot is disabled today, so every ranked surface is served by its deterministic engine). Pick an engine card: the
// template pre-fills what the card already states (purpose, decision supported, owner, inputs used and never used, the deterministic
// baseline, fairness outcome, human oversight, opt-out) and lists what a reviewer must still complete. Gate items must be complete before
// any model engine may serve the surface. Downloadable as Markdown; nothing is stored.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { Async, BenchmarkChips, Callout, Card, EmptyState, Icon, Page, SourceLink, StatusPill, downloadText } from '../../ui';
import { modelGatewayUrl } from '../../domain/engines';
import type { EngineCardsRow } from '../../data/types';
import { MODEL_RISK_GATES, MODEL_RISK_SECTIONS, RANKED_SURFACES } from './surfaces';

type Input = { key: string; en: string; ar: string };

export default function ModelRiskPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['engine_cards'], () => repo.list('engine_cards', { order: [['sort', 'asc']] }), []);
  return (
    <Page title={t('m16.routes.admin-model-risk.title')} eyebrow={<BenchmarkChips feature="FS55" />} intro={t('m16.mr.intro')} wide>
      <Async state={q} isEmpty={(d) => d.length === 0} empty={<EmptyState icon="lock" title={t('m16.mr.none')} />}>
        {(cards) => <Template cards={cards} />}
      </Async>
    </Page>
  );
}

function Template({ cards }: { cards: EngineCardsRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const [id, setId] = useState(cards.find((c) => c.id === 'dalil_career')?.id ?? cards[0].id);
  const card = cards.find((c) => c.id === id)!;
  const gateway = modelGatewayUrl();
  const reg = RANKED_SURFACES.find((s) => s.card === card.id);
  const fill = useMemo(() => {
    const inputs = (Array.isArray(card.inputs_used) ? card.inputs_used : []) as Input[];
    const fairness = card.fairness_metric ? t('m16.mr.fill.metric', { metric: t(`m16.reg.metric.${card.fairness_metric}`) }) : card.fairness_none ? t(`m16.reg.none.${card.fairness_none}`) : null;
    const v: Record<string, string | null> = {
      purpose: pick(card, 'purpose'), output: pick(card, 'output'), limitations: pick(card, 'limitations'), owner: pick(card, 'owner'), oversight: pick(card, 'oversight'),
      inputs_used: inputs.map((i) => (lang === 'ar' ? i.ar : i.en)).join('; '),
      inputs_excluded: card.inputs_excluded.map((k) => t(`m16.ai.protected.${k}`)).join(', '),
      scoring_functions: card.scoring_functions.join(', '), fairness_metric: fairness, opt_out: card.opt_out ? t('m16.mr.fill.optOutYes') : t('m16.mr.fill.optOutNo'),
    };
    return v;
  }, [card, pick, lang, t]);
  const value = (from?: string) => (from ? fill[from] ?? null : null);
  const gatesDone = MODEL_RISK_SECTIONS.flatMap((s) => s.fields.filter((x) => x.gate && value(x.from))).length;
  const markdown = () => [
    `# ${t('m16.mr.mdTitle', { card: pick(card, 'title') })}`, '', `${t('m16.mr.mdStatus')}: ${gateway ? t('m16.mr.gatewaySet') : t('m16.mr.gatewayOff')}`, '',
    ...MODEL_RISK_SECTIONS.flatMap((s) => [`## ${t(`m16.mr.section.${s.id}`)}`, ...s.fields.map((x) => `- **${t(`m16.mr.field.${x.id}`)}**${x.gate ? ` (${t('m16.mr.gate')})` : ''}: ${value(x.from) ?? t('m16.mr.todo')}`), '']),
  ].join('\n');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={t('m16.mr.pick')}>
          <label className="flex flex-col gap-1"><span className="caps">{t('m16.mr.card')}</span>
            <select className="input" value={id} onChange={(e) => setId(e.target.value)} data-testid="m16-mr-card">
              {cards.map((c) => <option key={c.id} value={c.id}>{pick(c, 'title')} · {c.feature}</option>)}
            </select>
          </label>
          <p className="mt-2 text-[13px] text-ink-2">{pick(card, 'purpose')}</p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-[11.5px]">
            <span className="chip border-line bg-sunken">{t(`m16.reg.kernel.${card.kernel_surface ?? card.engine_surface}`)}</span>
            {reg && <span className="chip border-line bg-sunken">{t(`m16.reg.ranks.${reg.ranks}`)}</span>}
            <L to={card.route} className="link">{t('m16.mr.open')}</L>
          </p>
        </Card>
        <div className="card flex flex-col justify-center gap-2 p-4" data-testid="m16-mr-status" data-gateway={gateway ? 'set' : 'off'}>
          <span className="caps">{t('m16.mr.statusTitle')}</span>
          {gateway ? <StatusPill tone="sim">{t('m16.mr.gatewaySet')}</StatusPill> : <StatusPill tone="neutral">{t('m16.mr.gatewayOff')}</StatusPill>}
          <p className="text-[12.5px] text-ink-2">{t('m16.mr.gates', { done: f.num(gatesDone), total: f.num(MODEL_RISK_GATES.length) })}</p>
          <button className="btn-outline btn-sm self-start" onClick={() => downloadText(`kafaa-model-risk-${card.id}.md`, markdown(), 'text/markdown;charset=utf-8')} data-testid="m16-mr-download"><Icon name="download" size={14} />{t('m16.mr.download')}</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="m16-mr-sections">
        {MODEL_RISK_SECTIONS.map((s, i) => (
          <Card key={s.id} title={`${f.num(i + 1)}. ${t(`m16.mr.section.${s.id}`)}`}>
            <p className="mb-2 text-[12.5px] text-ink-3">{t(`m16.mr.sectionHelp.${s.id}`)}</p>
            <dl className="space-y-2 text-[13px]">
              {s.fields.map((x) => {
                const v = value(x.from);
                return (
                  <div key={x.id} data-field={`${s.id}.${x.id}`} data-filled={!!v}>
                    <dt className="flex flex-wrap items-center gap-1.5 font-semibold">{t(`m16.mr.field.${x.id}`)}{x.gate && <StatusPill tone={v ? 'ok' : 'sim'}>{t('m16.mr.gate')}</StatusPill>}</dt>
                    <dd className={v ? 'text-ink-2' : 'italic text-ink-3'}>{v ?? t(`m16.mr.prompt.${x.id}`)}</dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        ))}
      </div>
      <Callout title={t('m16.mr.footTitle')}>
        <p>{t('m16.mr.footBody')}</p>
        <p className="mt-2 flex flex-wrap gap-3 text-[12.5px]">
          <SourceLink href="https://www.techwolf.ai/customer-stories/workday" date="2026-10-11">{t('m16.mr.srcTechwolf')}</SourceLink>
          <SourceLink href="https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices" date="2026-10-11">{t('m16.mr.srcAiLit')}</SourceLink>
          <L to="/admin/ai-transparency" className="link">{t('m16.mr.back')}</L>
        </p>
      </Callout>
    </div>
  );
}
