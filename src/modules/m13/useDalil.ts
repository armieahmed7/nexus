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
import { createEngine } from './dalil/engine';
import { detectLang, type Lang } from './dalil/text';
import type { Corpus, DalilAnswer } from './dalil/types';
import { availableDalilModes, defaultDalilMode } from '../../domain/g5rules';

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

export function useDalil(uiLang: Lang, page: string | null) {
  const repo = useRepo();
  const s = useSession();
  const signedIn = s.status === 'signed_in';
  const modes = useMemo(() => availableDalilModes(s.roles, signedIn), [s.roles, signedIn]);
  const [mode, setMode] = useState<DalilMode>(() => defaultDalilMode(s.roles, signedIn));
  useEffect(() => setMode(defaultDalilMode(s.roles, signedIn)), [s.roles, signedIn]);
  const settings = useQuery('dalil_settings', () => repo.list('dalil_settings'));
  const setting = settings.data?.[0];
  const enabled = settings.data ? settings.data.every((x) => x.enabled) : true;
  const corpus = useQuery(['corpus_docs', 'refusal_policies', 'job_roles', 'talent_programmes', 'faqs', 'facts'], () => buildCorpus(repo, { signedIn, personId: s.identity.personId, orgId: s.identity.orgId }), [signedIn, s.identity.personId]);
  const engine = useMemo(() => createEngine(setting?.engine), [setting?.engine]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const session = useRef<string | null>(null);
  const corpusRef = useRef<Corpus | undefined>(undefined);
  corpusRef.current = corpus.data;

  const reset = useCallback(() => {
    session.current = null;
    setTurns([]);
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
        const answer = await engine.answer({ question, lang, mode, page, history }, c);
        const r: Result<DalilTurnResult> = await repo.rpc.dalilTurn({
          session_id: session.current, client_key: signedIn ? null : clientKey(), mode, page_context: page, question, answer: [answer.text, ...(answer.bullets ?? [])].join('\n'),
          citations: answer.citations, refused: answer.refused, refusal_category: answer.refusalCategory ?? null, intent: answer.intent, confidence: answer.confidence, redact_question: !!answer.redact,
        });
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
    [busy, engine, mode, page, repo, signedIn, turns, uiLang],
  );

  return { mode, setMode, modes, enabled, settings, setting, corpus, turns, ask, busy, quota, reset, sessionId: () => session.current, signedIn };
}
