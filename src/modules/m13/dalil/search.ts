// Promoted to src/domain/search.ts by F02 (engine kernel). Re-exported here, typed to the Dalil corpus, so Dalil is unchanged.
import { SearchIndex as DomainSearchIndex, type Hit as DomainHit } from '../../../domain/search';
import type { CorpusDoc } from './types';
export { bestSentences, pickLang } from '../../../domain/search';
export type Hit = DomainHit<CorpusDoc>;
export class SearchIndex extends DomainSearchIndex<CorpusDoc> {}
