// F37 role-play practice panel (deterministic): Dalil asks scripted interview or career-conversation questions for the person's
// target role, checks each answer against a visible rubric, and closes with a summary and next steps. The guards still apply:
// a concern stops the practice and shows the speak-up channels; security or operating detail is declined. Answers stay in the
// browser; only "practised, N of M criteria" is logged (rpc.dalilCareerTurn: kill switch and rate limit apply).
import { useMemo, useState } from 'react';
import { L, useFormat, useLang, useT } from '../../../i18n';
import { Callout, Icon, ProgressBar, SimChip, StatusPill, Stepper } from '../../../ui';
import type { DalilTurnResult, Result } from '../../../data/types';
import { readinessScore, competencyLevelsOf } from '../../m18/career';
import { defaultTargetRole } from '../../../shell/digest/rules';
import { detectGuard } from '../dalil/guard';
import { ROLE_TOKENS } from './engine';
import { evaluate, keyWords, script, summary, type Criterion, type Scenario } from './roleplay';
import type { CareerCtx } from './context';

const ABBR = Object.fromEntries(Object.entries(ROLE_TOKENS).map(([tok, id]) => [id, tok.slice(1)]));

export function RolePlay({ scenario, roleId, ctx, onLog, onClose }: { scenario: Scenario; roleId: string | null; ctx: CareerCtx | null; onLog: (prompt: string, result: string) => Promise<Result<DalilTurnResult>>; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const setup = useMemo(() => {
    const target = roleId ?? (ctx ? defaultTargetRole(ctx.edges, ctx.person.job_role_id ?? null, ctx.shortlist) : null);
    const role = ctx?.roles.find((r) => r.id === target);
    const gaps = ctx && target ? readinessScore(competencyLevelsOf(ctx.data, ctx.me), ctx.roleComps as never, target).gaps.slice(0, 3) : [];
    const comps = new Map((ctx?.competencies ?? []).map((c) => [c.id, c]));
    const core = ctx && target ? ctx.roleComps.filter((r) => r.role_id === target && r.importance === 'core').map((r) => r.competency_id) : [];
    const starComp = comps.get(gaps[0]?.competency_id ?? core[0] ?? '');
    const pick = (row: Record<string, unknown> | undefined, k: string) => (row ? String((lang === 'ar' ? row[`${k}_ar`] : row[`${k}_en`]) || row[`${k}_en`] || '') : '');
    return {
      target, roleTitle: pick(role, 'title') || t('m13.career.roleplay.yourTarget'), competency: pick(starComp, 'name') || t('m13.career.rp.anyCompetency'),
      roleWords: [...keyWords(role?.title_en, role?.title_ar), ...(target && ABBR[target] ? [ABBR[target]] : [])],
      gapWords: keyWords(...gaps.flatMap((g) => [comps.get(g.competency_id)?.name_en, comps.get(g.competency_id)?.name_ar])),
      gapNames: gaps.map((g) => pick(comps.get(g.competency_id), 'name')),
    };
  }, [ctx, roleId, lang, t]);
  const sc = useMemo(() => script(scenario), [scenario]);
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  const [results, setResults] = useState<(Criterion[] | null)[]>(() => sc.prompts.map(() => null));
  const [notice, setNotice] = useState<{ tone: 'stop' | 'decline' | 'system'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const done = i >= sc.prompts.length;
  const prompt = sc.prompts[Math.min(i, sc.prompts.length - 1)];
  const promptText = (id: string) => t(`m13.career.rp.${scenario}.${id}`, { role: setup.roleTitle, competency: setup.competency });
  const cur = results[i] ?? null;

  const check = async () => {
    const g = detectGuard(text, []);
    if (g?.category === 'concern') { setNotice({ tone: 'stop', msg: t('m13.career.rp.concern') }); setText(''); return; }
    if (g && ['security', 'safeguards', 'cyber', 'operations', 'exam', 'medical', 'personal'].includes(g.category)) { setNotice({ tone: 'decline', msg: t('m13.career.rp.decline') }); return; }
    setNotice(null);
    const crit = evaluate(prompt, text, { roleWords: setup.roleWords, gapWords: setup.gapWords });
    setBusy(true);
    try {
      const r = await onLog(promptText(prompt.id).slice(0, 2000), `Practice answer checked (${scenario}, ${prompt.id}): ${crit.filter((c) => c.pass).length} of ${crit.length} criteria`);
      if (!r.ok) { setNotice({ tone: 'system', msg: r.code === 'rate_limited' ? t('m13.ask.limited') : r.code === 'disabled' ? t('m13.ask.offBody') : r.message }); return; }
      setResults((xs) => xs.map((x, k) => (k === i ? crit : x)));
    } finally {
      setBusy(false);
    }
  };
  const next = () => { setI((x) => x + 1); setText(''); setNotice(null); };
  const restart = () => { setI(0); setText(''); setNotice(null); setResults(sc.prompts.map(() => null)); };
  const total = summary(results.filter(Boolean) as Criterion[][]);
  const missed = Object.entries((results.filter(Boolean) as Criterion[][]).flat().filter((c) => !c.pass).reduce<Record<string, number>>((m, c) => ((m[c.id] = (m[c.id] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <section className="space-y-4" aria-label={t(`m13.career.rp.title.${scenario}`)} data-testid="m13-roleplay" data-scenario={scenario}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="chat" className="text-accent" />
        <h2 className="text-[16px] font-bold">{t(`m13.career.rp.title.${scenario}`)}</h2>
        {scenario === 'interview' && <StatusPill tone="info">{setup.roleTitle}</StatusPill>}
        <SimChip label={t('m13.career.rp.practiceOnly')} />
        <button className="btn-ghost btn-sm ms-auto" onClick={onClose} data-testid="m13-roleplay-close"><Icon name="close" size={14} />{t('m13.career.rp.close')}</button>
      </div>
      <p className="text-[12.5px] text-ink-3">{t('m13.career.rp.privacy')}</p>
      <Stepper steps={sc.prompts.map((p, k) => ({ id: p.id, label: t('m13.career.rp.step', { n: k + 1 }) }))} current={Math.min(i, sc.prompts.length - 1)} />
      {notice?.tone === 'stop' ? (
        <Callout tone="info" title={t('m13.ask.concernStop')}>
          <span data-testid="m13-roleplay-stop">{notice.msg}</span> <L to="/speak-up">{t('m13.ask.concernLink')}</L>
        </Callout>
      ) : done ? (
        <div className="space-y-3 rounded-card border border-line bg-raised p-4" data-testid="m13-roleplay-summary">
          <div className="font-semibold">{t('m13.career.rp.summaryTitle')}</div>
          <div className="flex items-center gap-3">
            <div className="flex-1"><ProgressBar value={total.total ? (100 * total.passed) / total.total : 0} label={t('m13.career.rp.summaryTitle')} tone="ok" /></div>
            <span className="num text-[13px]" data-testid="m13-roleplay-score">{t('m13.career.rp.score', { passed: f.num(total.passed), total: f.num(total.total) })}</span>
          </div>
          {missed.length > 0 && (
            <div>
              <div className="caps mb-1">{t('m13.career.rp.workOn')}</div>
              <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">{missed.map(([id]) => <li key={id}>{t(`m13.career.rp.tip.${id}`)}</li>)}</ul>
            </div>
          )}
          {setup.gapNames.length > 0 && scenario === 'interview' && <p className="text-[12.5px] text-ink-2">{t('m13.career.rp.gapsHint', { gaps: setup.gapNames.join(lang === 'ar' ? '، ' : ', ') })}</p>}
          <div className="flex flex-wrap gap-2">
            {scenario === 'interview' ? (
              <>
                <L to="/my/skills" className="btn-outline btn-sm">{t('m13.career.link.passport')}</L>
                <L to="/my/coach" className="btn-outline btn-sm">{t('m13.career.link.coach')}</L>
                {setup.target && <L to={`/careers/roles/${setup.target}`} className="btn-outline btn-sm">{t('m13.career.link.role', { role: setup.roleTitle })}</L>}
              </>
            ) : (
              <>
                <L to="/my/career/conversations" className="btn-outline btn-sm">{t('m13.career.rp.prepare')}</L>
                <L to="/my/career" className="btn-outline btn-sm">{t('m13.career.link.navigator')}</L>
              </>
            )}
            <button className="btn-ghost btn-sm" onClick={restart} data-testid="m13-roleplay-restart"><Icon name="reset" size={14} />{t('m13.career.rp.again')}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Icon name="sparkle" size={14} className="mt-1 text-accent" />
            <div className="rounded-card border border-line bg-panel p-3 text-[14px]" data-testid="m13-roleplay-prompt">{promptText(prompt.id)}</div>
          </div>
          <p className="text-[12px] text-ink-3">{t(`m13.career.rp.hint.${prompt.id}`)}</p>
          {!cur && (
            <>
              <label className="sr-only" htmlFor="rp-answer">{t('m13.career.rp.answer')}</label>
              <textarea id="rp-answer" className="input min-h-[120px] w-full py-2" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('m13.career.rp.answer')} data-testid="m13-roleplay-answer" />
              <div className="flex items-center gap-2">
                <button className="btn-primary btn-sm" disabled={busy || text.trim().length < 3} onClick={check} data-testid="m13-roleplay-check">{busy ? t('common.working') : t('m13.career.rp.check')}</button>
                <span className="text-[12px] text-ink-3">{t('m13.career.rp.words', { n: f.num(text.trim() ? text.trim().split(/\s+/).length : 0) })}</span>
              </div>
            </>
          )}
          {notice && <div role="alert" className="rounded-card border border-sim-line bg-sim-bg p-3 text-[13px] text-sim" data-testid="m13-roleplay-notice">{notice.msg}</div>}
          {cur && (
            <div className="space-y-2 rounded-card border border-line bg-raised p-3" data-testid="m13-roleplay-rubric">
              <div className="caps">{t('m13.career.rp.rubric')}</div>
              <ul className="space-y-1.5">
                {cur.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-[13px]" data-testid="m13-roleplay-criterion" data-pass={c.pass ? 'yes' : 'no'}>
                    <Icon name={c.pass ? 'check' : 'alert'} size={14} className={c.pass ? 'mt-0.5 text-ok' : 'mt-0.5 text-sim'} />
                    <span><span className="font-semibold">{t(`m13.career.rp.crit.${c.id}`)}</span>{!c.pass && <span className="block text-ink-3">{t(`m13.career.rp.tip.${c.id}`)}</span>}</span>
                  </li>
                ))}
              </ul>
              <button className="btn-primary btn-sm" onClick={next} data-testid="m13-roleplay-next">{i + 1 < sc.prompts.length ? t('m13.career.rp.next') : t('m13.career.rp.finish')}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
