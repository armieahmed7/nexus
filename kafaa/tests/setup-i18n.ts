// Audit 2026-10-13 (finding 19): dictionaries load per language at runtime (src/i18n/dict.<lang>.ts). Unit tests render pages and call
// translate() directly, so both languages are loaded before every test file, as main.tsx does for the page's language in the app.
import { loadLang } from '../src/i18n';

await Promise.all([loadLang('en'), loadLang('ar')]);
