/** Dalil engine types. The engine is pluggable: anything implementing AnswerEngine can sit behind the guardrails. */
import type { DalilCitation, DalilMode } from '../../../data/types';
import type { Reason } from '../../../domain/engines/types';
import type { Lang } from './text';

export type DocKind =
  | 'page' | 'news' | 'role' | 'programme' | 'training' | 'course' | 'partner' | 'faq' | 'fact' | 'trait' | 'hu_tool'
  | 'glossary' | 'regulation' | 'internal' | 'technology' | 'personal';

export interface Bi {
  en: string;
  ar: string;
}
export interface CorpusDoc {
  /** Corpus key; structured rows use `cd-<kind>-<row id>` so an unapproved corpus_docs row with that id removes them. */
  id: string;
  kind: DocKind;
  title: Bi;
  text: Bi;
  /** Where the answer came from (internal Kafa'a route or an external public page). */
  cite: DalilCitation;
  /** Internal route to open (without /kafaa and /ar). */
  route?: string | null;
  modes: DalilMode[];
  keywords?: string[];
  /** Structured payload for templated answers (role entry routes, programme criteria, fact value ...). */
  data?: Record<string, unknown>;
}

export interface EcpChannel {
  id: string;
  label: Bi;
  detail: Bi;
}
export interface RefusalPolicy {
  category: string;
  patterns: string[];
  response: Bi;
  enabled: boolean;
  stop: boolean;
}
export interface Corpus {
  docs: CorpusDoc[];
  channels: EcpChannel[];
  policies: RefusalPolicy[];
  /** Records about the signed-in user (own qualifications, licence, learning, plan, applications, partner onboarding). */
  personal: CorpusDoc[];
  signedIn: boolean;
  builtAt: string;
}

export interface DalilLink {
  label: string;
  to: string;
}
/** W5E5 (F37): a result card in a career-mode answer (role, gap, course, opportunity, milestone), with its reasons (<WhyThis>). */
export interface AnswerCard {
  id: string;
  kind: 'role' | 'gap' | 'gate' | 'course' | 'opportunity' | 'milestone';
  title: string;
  sub?: string;
  /** 0..100 (readiness or match); absent when the person opted out of ranking or the role is career-path only. */
  pct?: number | null;
  status?: 'met' | 'pending' | 'not_met' | 'ready_now' | 'ready_in' | 'stretch' | 'path_only' | 'current' | null;
  to?: string;
  reasons?: Reason[];
}
export interface DalilAnswer {
  intent: string;
  lang: Lang;
  /** Main answer paragraph(s). */
  text: string;
  bullets?: string[];
  citations: DalilCitation[];
  followUps: string[];
  links?: DalilLink[];
  refused: boolean;
  refusalCategory?: string | null;
  /** Concern detected: stop the topic and show the ECP channels. */
  stop?: boolean;
  channels?: EcpChannel[];
  /** Offer a human hand-off. */
  handoff?: boolean;
  /** 0..1 retrieval confidence (1 for templated answers from structured records). */
  confidence: number;
  personal?: boolean;
  /** The user's text must not be stored. */
  redact?: boolean;
  /** W5E5 (F37): career-mode result cards, the "indicative, not a decision" note and an offer to start a role-play. */
  cards?: AnswerCard[];
  indicative?: boolean;
  roleplay?: { scenario: 'interview' | 'career_conversation'; role_id: string | null } | null;
  /** W5E5 (F37): the person opted out of ranked suggestions for this surface (F24), so the list is unranked. */
  unranked?: boolean;
}

export interface AskInput {
  question: string;
  mode: DalilMode;
  lang: Lang;
  /** Page the user came from (route path), used to boost nearby content. */
  page?: string | null;
  /** Previous turns in this conversation (for concern topic lock and follow-ups). */
  history?: { role: 'user' | 'dalil'; text: string; intent?: string; stop?: boolean }[];
}

/** Any answer engine. Retrieval today; a model gateway later (it receives retrieved passages and must cite them). */
export interface AnswerEngine {
  readonly id: string;
  answer(input: AskInput, corpus: Corpus): Promise<DalilAnswer>;
}
