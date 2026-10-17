// M12 · Help centre: shared types for the static, bilingual guides and the future-skills glossary.
// Content is code (typed, reviewed, tested for EN/AR parity in tests/unit/m12-help.test.tsx), not database rows.

/** A string in both languages. Arabic is Modern Standard Arabic, using the terms already in src/i18n/*.ar.json. */
export interface Bi {
  en: string;
  ar: string;
}

/** A link into the app by route id (src/routes/registry.ts), labelled with that route's own title. */
export interface HelpLink {
  route: string;
  params?: Record<string, string>;
  /** Fragment without '#', e.g. a section or glossary anchor. */
  hash?: string;
}

/** A public source for a stated fact or definition. as_of = the date the page was read (ISO yyyy-mm-dd). */
export interface HelpSource {
  title: string;
  url: string;
  as_of: string;
}

export type HelpCategory = 'start' | 'skills' | 'learning' | 'careers' | 'trust' | 'platform';
export type HelpAudience = 'everyone' | 'students' | 'employees' | 'managers' | 'partners';

export interface HelpStep {
  title: Bi;
  body: Bi;
}

export interface HelpGuide {
  /** URL slug: /help/<id>. Lower-case words and hyphens. */
  id: string;
  category: HelpCategory;
  audiences: HelpAudience[];
  title: Bi;
  summary: Bi;
  /** Numbered steps (a how-to) or plain sections. */
  numbered: boolean;
  steps: HelpStep[];
  /** An optional caveat shown as a callout (concept notice, "not an authority" and the like). */
  note?: Bi;
  /** "Go to" buttons: the real pages this guide talks about. */
  links: HelpLink[];
  /** Related guide ids. */
  related: string[];
  sources: HelpSource[];
  /** Last reviewed (ISO date). */
  reviewed: string;
  /** Extra search words in both languages (synonyms, abbreviations). */
  keywords?: Bi;
}

export interface GlossaryTerm {
  /** Anchor: /help/glossary#term-<id>. */
  id: string;
  term: Bi;
  /** Abbreviation or code that people search for (SMR, NQF, RPL ...). */
  abbr?: string;
  /** The general meaning, as the cited source gives it. */
  definition: Bi;
  /** How Kafa'a uses the idea (optional; describes the platform, so it needs no outside source). */
  inKafaa?: Bi;
  /** "Where you meet it": pages that use the term. */
  where: HelpLink[];
  sources: HelpSource[];
  /** Database glossary rows (kafaa_glossary ids) this term replaces in the merged list, so a term is never shown twice. */
  replacesDb?: string[];
}
