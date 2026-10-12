/**
 * Dalil conversation state for /ask: builds the approved corpus through the repository (RLS decides what the caller
 * can reach), answers with the guarded engine, and logs each turn through rpc.dalilTurn (server-side kill switch,
 * mode gate and rate limit). A refusal from the log RPC replaces the answer, so limits hold even if the browser is
 * modified. Concern text is never logged.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRepo, useQuery } from '../../data';
import { useSession } from '../../auth/session';
import type { DalilMode, Result, DalilTurnResult } from '../../data/types';
import { buildCorpus } from './dalil/corpus';
import { createEngine, GuardedEngine, ModelGatewayEngine, RetrievalEngine } from './dalil/engine';
import { CareerEngine } from './career/engine';
import { CAREER_TABLES, loadCareerCtx, type CareerCtx } from './career/context';
import { FUTURE_PERSONAL_TABLES, FUTURE_PUBLIC_TABLES, loadFuturePersonal, loadFuturePublic } from './career/future'; // FS76
import { intentBase } from './career/futureIntents';
import { todayIso } from '../../domain/rules';
import { detectLang, type Lang } from './dalil/text';
import type { Corpus, DalilAnswer } from './dalil/types';
import { availableDalilModes, dalilModeAllowed, defaultDalilMode } from '../../domain/g5rules';

/** W5E5 (F37): the UI modes; 'career' is logged as mode 'staff' + submode 'career' (rpc.dalilCareerTurn).
 *  FS76: 'future' (future-skills mode) is open to everyone: anonymous visitors get public answers (logged by rpc.dalilTurn, public mode);
 *  signed-in callers log through rpc.dalilFutureTurn (staff as career turns, everyone else in their own mode). */
export type AskMode = DalilMode | 'career' | 'future';

export interface Turn {
  id: string;
  role: 'user' | 'dalil' | 'system';
  text: string;
  answer?: DalilAnswer;
  code?: string;
}
const KEY = 'kafaa.dalil.client';
function clientKey(): string {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = `anon-${crypto.randomUUID()}`;
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return `anon-${Math.random().toString(36).slice(2)}`;
  }
}

export function useDalil(uiLang: Lang, page: string | null, wanted: AskMode | null = null) {
  const repo = useRepo();
  const s = useSession();
  const signedIn = s.status === 'signed_in';
  // W5E5 (F37): career mode for signed-in staff with a person record (skills profile); anonymous visitors keep the public mode
  const careerOk = signedIn && !!s.identity.personId && dalilModeAllowed('staff', s.roles, signedIn);
  const modes = useMemo<AskMode[]>(() => [...availableDalilModes(s.roles, signedIn), ...(careerOk ? (['career'] as const) : []), 'future'], [s.roles, signedIn, careerOk]);
  const start = (): AskMode => (wanted && (wanted === 'career' ? careerOk : wanted === 'future' ? true : dalilModeAllowed(wanted, s.roles, signedIn)) ? wanted : defaultDalilMode(s.roles, signedIn));
  const [mode, setModeRaw] = useState<AskMode>(start);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setModeRaw(start()), [s.roles, signedIn, careerOk, wanted]);
  const settings = useQuery('dalil_settings', () => repo.list('dalil_settings'));
  const setting = settings.data?.[0];
  const enabled = settings.data ? settings.data.every((x) => x.enabled) : true;
  const corpus = useQuery(['corpus_docs', 'refusal_policies', 'job_roles', 'talent_programmes', 'faqs', 'facts'], () => buildCorpus(repo, { signedIn, personId: s.identity.personId, orgId: s.identity.orgId }), [signedIn, s.identity.personId]);
  // FS76: personal answers (career mode, and future mode for staff with a skills profile) come from the career context plus my future-skills rows
  const personalMode = mode === 'career' || (mode === 'future' && careerOk);
  const staffReader = signedIn && dalilModeAllowed('staff', s.roles, signedIn);
  const career = useQuery(CAREER_TABLES, () => (personalMode && s.identity.personId ? loadCareerCtx(repo, s.identity.personId, todayIso()) : Promise.resolve(null)), [personalMode, s.identity.personId]);
  const futurePub = useQuery(FUTURE_PUBLIC_TABLES, () => loadFuturePublic(repo, staffReader), [staffReader]);
  const futureMe = useQuery(FUTURE_PERSONAL_TABLES, () => (personalMode && s.identity.personId ? loadFuturePersonal(repo, s.identity.personId) : Promise.resolve(null)), [personalMode, s.identity.personId]);
  const careerCtx = useMemo<CareerCtx | null>(() => (career.data ? { ...career.data, future: futurePub.data ? { pub: futurePub.data, me: futureMe.data ?? null } : null } : null), [career.data, futurePub.data, futureMe.data]);
  const corpusData = useMemo<Corpus | undefined>(() => (corpus.data ? { ...corpus.data, future: futurePub.data ? { pub: futurePub.data, me: null } : null } : undefined), [corpus.data, futurePub.data]);
  /** The Dalil mode a turn runs in: career and staff future mode answer as staff; future mode otherwise as the caller's own mode. */
  const askMode: DalilMode = personalMode ? 'staff' : mode === 'future' ? defaultDalilMode(s.roles, signedIn) : (mode as DalilMode);
  const engine = useMemo(() => {
    if (!personalMode) return createEngine(setting?.engine);
    const inner = setting?.engine === 'model-gateway' ? new ModelGatewayEngine(new RetrievalEngine(), null) : new RetrievalEngine();
    return new GuardedEngine(new CareerEngine(careerCtx, inner));
  }, [setting?.engine, personalMode, careerCtx]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const session = useRef<string | null>(null);
  const corpusRef = useRef<Corpus | undefined>(undefined);
  corpusRef.current = corpusData;

  const reset = useCallback(() => {
    session.current = null;
    setTurns([]);
  }, []);
  /** Switching mode starts a new logged session (career turns never append to a staff-mode session and vice versa). */
  const setMode = useCallback((m: AskMode) => {
    session.current = null;
    setModeRaw(m);
  }, []);
  useEffect(reset, [s.identity.personId, reset]);

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      const c = corpusRef.current;
      if (!question || !c || busy) return;
      setBusy(true);
      const uid = `${Date.now()}`;
      setTurns((xs) => [...xs, { id: `u-${uid}`, role: 'user', text: question }]);
      try {
        const lang = detectLang(question, uiLang);
        const history = turns.filter((x) => x.role !== 'system').map((x) => ({ role: x.role as 'user' | 'dalil', text: x.text, intent: x.answer?.intent, stop: x.answer?.stop }));
        const answer = await engine.answer({ question, lang, mode: askMode, page, history }, c);
        const logged = { session_id: session.current, page_context: page, question, answer: [answer.text, ...(answer.bullets ?? [])].join('\n'),
          citations: answer.citations, refused: answer.refused, refusal_category: answer.refusalCategory ?? null, intent: answer.intent, confidence: answer.confidence, redact_question: !!answer.redact };
        const future = !!intentBase(answer.intent);
        const r: Result<DalilTurnResult> = mode === 'career'
          ? await (future ? repo.rpc.dalilFutureTurn({ ...logged, personal: !!answer.personal }) : repo.rpc.dalilCareerTurn(logged))
          : mode === 'future' && signedIn
            ? await repo.rpc.dalilFutureTurn({ ...logged, personal: !!answer.personal, mode: personalMode ? undefined : askMode })
            : await repo.rpc.dalilTurn({ ...logged, client_key: signedIn ? null : clientKey(), mode: askMode });
        if (r.data) setQuota({ used: r.data.used, limit: r.data.limit, remaining: r.data.remaining });
        if (r.ok) {
          session.current = r.data?.session_id ?? session.current;
          setTurns((xs) => [...xs, { id: `d-${uid}`, role: 'dalil', text: answer.text, answer }]);
        } else {
          setTurns((xs) => [...xs, { id: `s-${uid}`, role: 'system', text: r.message, code: r.code }]);
        }
      } catch (e) {
        setTurns((xs) => [...xs, { id: `s-${uid}`, role: 'system', text: e instanceof Error ? e.message : String(e), code: 'error' }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, engine, mode, askMode, personalMode, page, repo, signedIn, turns, uiLang],
  );

  /** F37 role-play: log that a practice answer was checked (the answer text itself never leaves the browser). */
  const logPractice = useCallback(async (prompt: string, result: string): Promise<Result<DalilTurnResult>> => {
    const r = await repo.rpc.dalilCareerTurn({ session_id: session.current, page_context: page, question: prompt, answer: result, citations: [], refused: false, intent: 'career.roleplay_practice', confidence: 1 });
    if (r.data) setQuota({ used: r.data.used, limit: r.data.limit, remaining: r.data.remaining });
    if (r.ok) session.current = r.data?.session_id ?? session.current;
    return r;
  }, [repo, page]);

  return { mode, setMode, modes, enabled, settings, setting, corpus, career, futurePub, turns, ask, busy, quota, reset, logPractice, sessionId: () => session.current, signedIn, careerOk, askMode, personalMode };
}
