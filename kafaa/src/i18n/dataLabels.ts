// Display labels for single-language data values from small, closed vocabularies (2026-10-17, Arabic parity). The database keeps
// these columns in English only: organisations.country ("France / Italy"), skill_frameworks.version_label ("current references")
// and adv_technologies.designs ("AP1000 and others"). Rather than adding Arabic columns for a handful of fixed values, pages show
// them through these helpers, which look the stored value up in common.{countries,fwVersion,designs}. Anything not in the list
// (a value an admin typed later, a design code such as "BWRX-300", a version such as "2.2") is returned exactly as stored.

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Stored country spellings -> common.countries key. "AE" and "UAE" both occur in the seed. */
const COUNTRY: Record<string, string> = {
  UAE: 'ae', AE: 'ae', Korea: 'kr', USA: 'us', France: 'fr', UK: 'gb', Canada: 'ca', Russia: 'ru', Kazakhstan: 'kz', Spain: 'es',
  Japan: 'jp', Italy: 'it', China: 'cn', Romania: 'ro', Poland: 'pl', Egypt: 'eg', India: 'in', International: 'intl',
};
const parts = (v: string) => v.split('/').map((p) => p.trim());

/**
 * Language-neutral key for a stored country value ("France / Italy" -> "fr/it", "AE" and "UAE" -> "ae"), used as a filter value so
 * a filter keeps working across languages and the two UAE spellings fall together. Unknown values are returned as stored.
 */
export function countryKey(v: string | null | undefined): string {
  if (!v) return '';
  const ks = parts(v).map((p) => COUNTRY[p]);
  return ks.every(Boolean) ? ks.join('/') : v;
}

/** Country (or "A / B" pair) in the reader's language: "France / Italy" -> "فرنسا / إيطاليا" on Arabic pages. */
export function countryName(t: T, v: string | null | undefined): string {
  if (!v) return '';
  const ks = parts(v).map((p) => COUNTRY[p]);
  return ks.every(Boolean) ? ks.map((k) => t(`common.countries.${k}`)).join(' / ') : v;
}

/** Filter options for a list of stored country values: one option per country key, labelled in the reader's language, sorted by label. */
export function countryOptions(t: T, values: (string | null | undefined)[]): { value: string; label: string }[] {
  const m = new Map<string, string>();
  for (const v of values) if (v) m.set(countryKey(v), countryName(t, v));
  return [...m].map(([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label));
}

const FW_VERSION: Record<string, string> = { current: 'current', 'current references': 'currentRefs' };
/** Framework version label: words become the reader's language, numbers and product names stay as stored. */
export function frameworkVersion(t: T, v: string | null | undefined): string {
  if (!v) return '';
  const k = FW_VERSION[v];
  return k ? t(`common.fwVersion.${k}`) : v;
}

const DESIGNS: Record<string, string> = { 'Natrium; lead-cooled fast reactor': 'natrium', 'AP1000 and others': 'ap1000' };
/** Reactor design names of an ADVANCE technology family; the two values with English words get Arabic, codes stay as written. */
export function techDesigns(t: T, v: string | null | undefined): string {
  if (!v) return '';
  const k = DESIGNS[v];
  return k ? t(`common.designs.${k}`) : v;
}
