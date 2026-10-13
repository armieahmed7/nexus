// Arabic dictionaries, one chunk (audit 2026-10-13, finding 19: the entry bundle no longer carries both languages; see loadLang).
export default import.meta.glob('./*.ar.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;
