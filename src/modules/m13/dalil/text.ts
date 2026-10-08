/**
 * Dalil text utilities: language detection, English and Arabic normalisation, light stemming, stop words and a small
 * domain synonym table. Pure functions (no React), shared by the engine, the admin console and unit tests.
 */
export type Lang = 'en' | 'ar';

const AR_RE = /[؀-ۿ]/;
export const isArabic = (s: string) => AR_RE.test(s);
export const detectLang = (s: string, fallback: Lang = 'en'): Lang => (isArabic(s) ? 'ar' : /[a-z]/i.test(s) ? 'en' : fallback);

/** Arabic normalisation: strip diacritics and tatweel, unify alef/ya/ta marbuta/hamza forms, Arabic-Indic digits to Latin. */
export function normAr(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

const EN_STOP = new Set(
  'a an the and or of to in on for at by with from about into is are was were be been being do does did can could should would will shall may might must i me my we our you your it its this that these those there here what which who whom whose how when where why tell please some any all as if than then so not no yes also just get got have has had need want know like give show explain'.split(' '),
);
const AR_STOP = new Set(
  'في من على الى إلى عن مع هل ما ماذا كيف متى اين أين لماذا هو هي هم انا أنا نحن انت أنت هذا هذه ذلك تلك التي الذي الذين او أو و ثم كل اي أي لي لك عند قد كان كانت يكون تكون اريد أريد ممكن يمكن ارجو أرجو من فضلك'
    .split(' ')
    .map(normAr),
);

/** Very light English stemmer: enough to match plural and -ing/-ed forms of domain words. */
export function stemEn(input: string): string {
  let w = input;
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  // second pass: derivational suffixes on longer words (regulation, regulator, regulatory -> regul)
  if (w.length > 6) {
    for (const suf of ['ation', 'ator', 'atory', 'ory', 'ate', 'ion', 'er']) {
      if (w.endsWith(suf) && w.length - suf.length >= 4) return w.slice(0, -suf.length);
    }
  }
  return w;
}
/** Light Arabic stemmer: definite article and common one-letter prefixes, and plural/feminine suffixes. */
export function stemAr(w: string): string {
  let x = w;
  for (const p of ['وال', 'بال', 'كال', 'فال', 'لل', 'ال']) {
    if (x.startsWith(p) && x.length - p.length >= 3) {
      x = x.slice(p.length);
      break;
    }
  }
  if (x.length > 4 && /^[وفب]/.test(x)) x = x.slice(1);
  for (const s of ['ات', 'ون', 'ين', 'ها', 'ه', 'ي']) {
    if (x.endsWith(s) && x.length - s.length >= 3) {
      x = x.slice(0, -s.length);
      break;
    }
  }
  return x;
}

/** Domain synonyms: each group maps to one canonical token so "RO", "reactor operator" and "مشغل المفاعل" meet. */
const PHRASES: [RegExp, string][] = [
  [/\bsenior reactor operators?\b|\bsros?\b|مشغل المفاعل الاول|المشغل الاول|المشغلين الاوائل/g, ' qsro '],
  [/\breactor operators?\b|\bros?\b(?![-\w])|مشغل المفاعل|مشغلي المفاعل/g, ' qro '],
  [/\blocal operators?\b|\blos?\b(?![-\w])|المشغل المحلي|مشغل محلي/g, ' qlo '],
  [/\bshift supervisors?\b|\bshift managers?\b|مشرف الورديه|مدير الورديه/g, ' qshiftsup '],
  [/\bdiploma in nuclear technology\b|\bdnt\b|دبلوم التكنولوجيا النوويه/g, ' qdnt '],
  [/\bgraduate plant operators?\b|\bgpo\b|مشغل المحطه للخريجين/g, ' qgpo '],
  [/\bgraduate development program(me)?\b|\bgdp\b|برنامج تطوير الخريجين/g, ' qgdp '],
  [/\benergy pioneers\b|رواد الطاقه/g, ' qpioneers '],
  [/\bmustaqbali\b|مستقبلي/g, ' qmustaqbali '],
  [/\bmawaheb\b|مواهب/g, ' qmawaheb '],
  [/\btrain for work\b|التدريب من اجل العمل/g, ' qtrainforwork '],
  [/\bin-country value\b|\bicv\b|القيمه المحليه المضافه/g, ' qicv '],
  [/\bfanr-reg-?17\b|\breg-?17\b|اللائحه 17/g, ' qreg17 '],
  [/\bfanr\b|\bregulat\w*|الهيئه الاتحاديه للرقابه النوويه|الهيئه|الجهه الرقابيه|ينظم/g, ' qfanr '],
  [/\bscholarships?\b|منح دراسيه|منحه|المنح/g, ' qscholarship '],
  [/\bsuppliers?\b|\bvendors?\b|موردين|مورد|الموردين/g, ' qsupplier '],
  [/\binternships?\b|\binterns?\b|تدريب داخلي|التدريب الداخلي/g, ' qinternship '],
  [/\bsafety culture\b|ثقافه السلامه/g, ' qsafetyculture '],
  [/\bhuman performance\b|\bhu tools?\b|الاداء البشري/g, ' qhu '],
  [/\boperating experience\b|\boe\b(?![-\w])|الخبره التشغيليه/g, ' qoe '],
  [/\bentry requirements?\b|\brequirements?\b|\beligibility\b|\bentry routes?\b|\bqualify\b|متطلبات الالتحاق|متطلبات|شروط|الاهليه/g, ' qrequire '],
  [/\bemiratisation\b|\bemiratization\b|التوطين/g, ' qemiratization '],
  [/\bbarakah\b|براكه/g, ' qbarakah '],
  [/\belectricity\b|الكهرباء/g, ' qelectricity '],
  [/\bemployees?\b|\bstaff\b|\bworkforce\b|الموظفين|القوي العامله/g, ' qworkforce '],
];

export function tokenize(raw: string): string[] {
  const ar = isArabic(raw);
  let s = raw.toLowerCase();
  if (ar) s = normAr(s);
  for (const [re, tok] of PHRASES) s = s.replace(re, tok);
  const parts = s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p.startsWith('q') && /^q[a-z0-9]+$/.test(p) && p.length > 2 && PHRASE_TOKENS.has(p)) {
      out.push(p);
      continue;
    }
    if (isArabic(p)) {
      const n = normAr(p);
      if (AR_STOP.has(n) || n.length < 2) continue;
      out.push(stemAr(n));
    } else {
      if (EN_STOP.has(p) || (p.length < 2 && !/\d/.test(p))) continue;
      out.push(stemEn(p));
    }
  }
  return out;
}
const PHRASE_TOKENS = new Set(PHRASES.map(([, t]) => t.trim()));

/** Normalised lower-case text for pattern matching (Arabic normalised, punctuation kept as spaces). */
export function normText(s: string): string {
  const lower = s.toLowerCase();
  return ` ${(isArabic(lower) ? normAr(lower) : lower).replace(/[^\p{L}\p{N}\-]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;
}
/** Does normalised text contain any of the patterns (patterns are normalised the same way; prefix match on words). */
export function hasAny(norm: string, patterns: readonly string[]): string | null {
  for (const p of patterns) {
    const q = normText(p).trim();
    if (!q) continue;
    if (norm.includes(` ${q}`)) return p;
  }
  return null;
}

/** Split text into sentences (EN and AR punctuation). */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?؟])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 2);
}
