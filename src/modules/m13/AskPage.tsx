// M13 · Ask Dalil: the governed guide. Answers only from Kafa'a's approved corpus with citations, role-aware modes,
// refusals for out-of-scope topics, concern stop with the ECP channels, rate limits, and a human hand-off.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAction, useRepo } from '../../data';
import { L, useFormat, useI18n, useT } from '../../i18n';
import { Callout, CheckboxField, EmptyState, Icon, Page, Skeleton, SourceLink, StatusPill } from '../../ui';
import { useFlags } from '../m16/flags';
import { useDalil, type Turn } from './useDalil';
import type { DalilAnswer } from './dalil/types';
import { pickLang } from './dalil/search';

const STARTERS: Record<string, string[]> = {
  public: ['s1', 's2', 's3', 's4'],
  applicant: ['a1', 's2', 's3', 's4'],
  staff: ['st1', 'st2', 'st3', 's1'],
  partner: ['p1', 'p2', 'p3', 's1'],
};

export default function AskPage() {
  const t = useT();
  const f = useFormat();
  const { lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const page = params.get('from');
  const { isOn, loading: flagsLoading } = useFlags();
  const d = useDalil(lang, page);
  const [q, setQ] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), [d.turns.length]);
  // Deep link: /ask?q=... asks once the corpus is ready.
  useEffect(() => {
    const pre = params.get('q');
    if (pre && d.corpus.data && d.enabled && d.turns.length === 0) {
      void d.ask(pre);
      const p = new URLSearchParams(params);
      p.delete('q');
      setParams(p, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.corpus.data, d.enabled]);

  const submit = (text: string) => {
    if (!text.trim()) return;
    void d.ask(text);
    setQ('');
  };
  const signInNeeded = !flagsLoading && !d.signedIn && !isOn('dalil_public');

  return (
    <Page title={t('m13.routes.ask.title')} eyebrow={t('m13.ask.eyebrow')} intro={t('m13.ask.intro')} actions={d.turns.length > 0 ? <button className="btn-outline btn-sm" onClick={d.reset} data-testid="m13-new-chat"><Icon name="reset" />{t('m13.ask.newChat')}</button> : undefined}>
      {!d.settings.data ? (
        <Skeleton lines={4} />
      ) : !d.enabled ? (
        <EmptyState icon="lock" title={t('m13.ask.offTitle')}>
          {t('m13.ask.offBody')} <L to="/faq">{t('m13.ask.faq')}</L> · <L to="/contact">{t('m13.ask.contact')}</L>
        </EmptyState>
      ) : signInNeeded ? (
        <EmptyState icon="lock" title={t('m13.ask.signInTitle')} action={<L to="/sign-in?next=/ask" className="btn-primary btn-sm">{t('shell.signIn')}</L>}>
          {t('m13.ask.signInBody')}
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="card flex min-h-[460px] flex-col" aria-label={t('m13.ask.conversation')}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <span className="caps">{t('m13.ask.mode')}</span>
              <div role="radiogroup" aria-label={t('m13.ask.mode')} className="flex flex-wrap gap-1" data-testid="m13-modes">
                {d.modes.map((m) => (
                  <button key={m} role="radio" aria-checked={d.mode === m} className={d.mode === m ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => d.setMode(m)} data-testid={`m13-mode-${m}`}>
                    {t(`m13.modes.${m}`)}
                  </button>
                ))}
              </div>
              {d.quota && (
                <span className="ms-auto text-[12px] text-ink-3" data-testid="m13-quota">
                  {t('m13.ask.quota', { n: f.num(d.quota.remaining), limit: f.num(d.quota.limit) })}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" data-testid="m13-turns">
              {d.turns.length === 0 && (
                <div className="space-y-3">
                  <p className="text-[14px] text-ink-2">{t(`m13.engine.hello.${d.mode}`)}</p>
                  <div className="flex flex-wrap gap-2">
                    {STARTERS[d.mode].map((k) => (
                      <button key={k} className="rounded-full border border-line px-3 py-1.5 text-[13px] hover:border-accent hover:bg-accent-soft" onClick={() => submit(t(`m13.ask.starters.${k}`))} disabled={!d.corpus.data} data-testid="m13-starter">
                        {t(`m13.ask.starters.${k}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {d.turns.map((turn) => (
                <TurnView key={turn.id} turn={turn} onFollow={submit} sessionId={d.sessionId} handoffOn={isOn('dalil_handoff')} signedIn={d.signedIn} />
              ))}
              {d.busy && <Skeleton lines={2} className="max-w-md" />}
              <div ref={end} />
            </div>
            <form
              className="border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit(q);
              }}
            >
              <label className="sr-only" htmlFor="dalil-q">{t('m13.ask.placeholder')}</label>
              <div className="flex gap-2">
                <textarea
                  id="dalil-q"
                  className="input min-h-[44px] flex-1 resize-y py-2"
                  rows={1}
                  maxLength={2000}
                  value={q}
                  placeholder={t('m13.ask.placeholder')}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit(q);
                    }
                  }}
                  data-testid="m13-input"
                />
                <button className="btn-primary self-end" disabled={d.busy || !q.trim() || !d.corpus.data} data-testid="m13-send">
                  {t('m13.ask.send')}
                </button>
              </div>
              <p className="mt-1.5 text-[11.5px] text-ink-3">{t('m13.ask.disclaimer')}</p>
            </form>
          </section>
          <aside className="space-y-3">
            <div className="card p-4 text-[13px]">
              <div className="font-semibold">{t('m13.ask.howTitle')}</div>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-ink-2">
                <li>{t('m13.ask.how.1')}</li>
                <li>{t('m13.ask.how.2')}</li>
                <li>{t('m13.ask.how.3')}</li>
                <li>{t('m13.ask.how.4')}</li>
              </ul>
            </div>
            <Callout tone="info" title={t('m13.ask.concernTitle')}>
              {t('m13.ask.concernBody')} <L to="/speak-up">{t('m13.ask.concernLink')}</L>
            </Callout>
            <div className="text-[12px] text-ink-3">
              {d.corpus.data ? t('m13.ask.corpusInfo', { n: f.num(d.corpus.data.docs.filter((x) => x.modes.includes(d.mode)).length), mode: t(`m13.modes.${d.mode}`) }) : t('m13.ask.loadingCorpus')}
              {d.setting && <div className="mt-1">{t('m13.ask.retention', { n: f.num(d.setting.retention_days) })}</div>}
            </div>
          </aside>
        </div>
      )}
    </Page>
  );
}

function TurnView({ turn, onFollow, sessionId, handoffOn, signedIn }: { turn: Turn; onFollow: (q: string) => void; sessionId: () => string | null; handoffOn: boolean; signedIn: boolean }) {
  const t = useT();
  if (turn.role === 'user')
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-card bg-accent-soft px-3 py-2 text-[14px]" data-testid="m13-user-turn">{turn.text}</div>
      </div>
    );
  if (turn.role === 'system')
    return (
      <div role="alert" className="rounded-card border border-sim-line bg-sim-bg p-3 text-[13px] text-sim" data-testid="m13-system-turn" data-code={turn.code}>
        {turn.code === 'rate_limited' ? t('m13.ask.limited') : turn.code === 'disabled' ? t('m13.ask.offBody') : turn.text}
      </div>
    );
  return <AnswerView a={turn.answer!} onFollow={onFollow} sessionId={sessionId} handoffOn={handoffOn} signedIn={signedIn} />;
}

function AnswerView({ a, onFollow, sessionId, handoffOn, signedIn }: { a: DalilAnswer; onFollow: (q: string) => void; sessionId: () => string | null; handoffOn: boolean; signedIn: boolean }) {
  const t = useT();
  const internal = (u: string) => u.startsWith('/');
  return (
    <article className={`rounded-card border p-3 ${a.stop ? 'border-accent bg-accent-soft' : a.refused ? 'border-sim-line bg-panel' : 'border-line bg-panel'}`} data-testid="m13-answer" data-intent={a.intent} data-refused={a.refused ? a.refusalCategory : undefined}>
      <div className="mb-1 flex items-center gap-2">
        <Icon name="sparkle" size={14} className="text-accent" />
        <span className="caps">{t('m13.ask.dalil')}</span>
        {a.refused && !a.stop && <StatusPill tone="sim">{t('m13.ask.outOfScope')}</StatusPill>}
        {a.stop && <StatusPill tone="accent">{t('m13.ask.concernStop')}</StatusPill>}
        {a.personal && <StatusPill tone="info">{t('m13.ask.yourRecords')}</StatusPill>}
      </div>
      <p className="text-[14px] leading-relaxed" lang={a.lang} dir={a.lang === 'ar' ? 'rtl' : 'ltr'}>{a.text}</p>
      {!!a.bullets?.length && (
        <ul className="mt-2 list-disc space-y-1 ps-5 text-[13.5px]" lang={a.lang} dir={a.lang === 'ar' ? 'rtl' : 'ltr'}>
          {a.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {a.channels && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="m13-ecp-channels">
          {a.channels.map((c) => (
            <li key={c.id} className="rounded-btn border border-line bg-panel p-2 text-[13px]">
              <div className="font-semibold">{pickLang(c.label, a.lang)}</div>
              <div className="text-ink-2">{pickLang(c.detail, a.lang)}</div>
            </li>
          ))}
        </ul>
      )}
      {a.citations.length > 0 && (
        <div className="mt-3 border-t border-line pt-2" data-testid="m13-citations">
          <div className="caps mb-1">{t('m13.ask.sources')}</div>
          <ol className="space-y-0.5 text-[12.5px]">
            {a.citations.map((c, i) => (
              <li key={c.url + i} className="flex gap-1">
                <span className="num text-ink-3">[{i + 1}]</span>
                {internal(c.url) ? <L to={c.url}>{c.label}</L> : <SourceLink href={c.url}>{c.label}</SourceLink>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {!!a.links?.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {a.links.map((l) => (
            <L key={l.to} to={l.to} className="btn-outline btn-sm">
              {l.label}
            </L>
          ))}
        </div>
      )}
      {!a.stop && a.followUps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label={t('m13.ask.followUps')}>
          {a.followUps.map((x) => (
            <button key={x} className="rounded-full border border-line px-2.5 py-1 text-[12.5px] hover:border-accent" onClick={() => onFollow(x)}>
              {x}
            </button>
          ))}
        </div>
      )}
      {a.handoff && handoffOn && signedIn && <Handoff sessionId={sessionId} />}
    </article>
  );
}

function Handoff({ sessionId }: { sessionId: () => string | null }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [target, setTarget] = useState<'careers' | 'training' | 'partner_desk'>('careers');
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const sid = sessionId();
  if (!sid) return null;
  if (done) return <p className="mt-3 text-[13px] text-ok" role="status">{t('m13.ask.handoffDone')}</p>;
  return (
    <div className="mt-3 space-y-2 rounded-btn border border-line bg-raised p-3" data-testid="m13-handoff">
      <div className="text-[13px] font-semibold">{t('m13.ask.handoffTitle')}</div>
      <div className="flex flex-wrap gap-1.5">
        {(['careers', 'training', 'partner_desk'] as const).map((x) => (
          <button key={x} className={target === x ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setTarget(x)} aria-pressed={target === x}>
            {t(`m13.handoff.${x}`)}
          </button>
        ))}
      </div>
      <label className="block text-[12.5px]">
        <span className="font-semibold">{t('m13.ask.handoffNote')}</span>
        <input className="input mt-1 h-8" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <CheckboxField label={t('m13.ask.handoffConsent')} hint={t('m13.ask.handoffConsentHint')} checked={consent} onChange={setConsent} />
      <button
        className="btn-primary btn-sm"
        onClick={async () => {
          const r = await run(() => repo.rpc.dalilHandoff(sid, target, consent, note));
          if (r.ok) setDone(true);
        }}
        data-testid="m13-handoff-send"
      >
        {t('m13.ask.handoffSend')}
      </button>
    </div>
  );
}
