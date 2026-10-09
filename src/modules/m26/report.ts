// M26 printable reports, built as standalone HTML documents (shown in a frame, printed or saved as PDF from the browser, or
// downloaded as .html) in English or Arabic whatever the reader's current language:
//  - traceabilityHtml(): the F27 traceability report of a role (task -> DIF -> decision -> objectives -> courses, modules, JPMs),
//    restricted tasks printed as "restricted" only.
//  - selfEvalHtml(): the F29 self-evaluation report, which carries "Demo / not an accreditation decision" in its header, on every
//    page footer and in the title.
// `tr(key, vars)` translates in the report's language (translate(lang, ...) from src/i18n). No people are named except the role
// cards who authored and finalised a self-evaluation.
export type Tr = (key: string, vars?: Record<string, string | number>) => string;
type Bi = { en: string; ar: string };

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const fmtDate = (lang: 'en' | 'ar', d: string | null | undefined) => (d ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(d.length === 10 ? `${d}T00:00:00Z` : d)) : '—');
const B = (x: Bi, lang: 'en' | 'ar') => (lang === 'ar' ? x.ar || x.en : x.en);

const STYLE = `@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:10.5px/1.45 system-ui,"Segoe UI","IBM Plex Sans Arabic",sans-serif;color:#111;margin:0}
h1{font-size:18px;margin:0}h2{font-size:12.5px;margin:12px 0 4px;border-bottom:1px solid #999;padding-bottom:2px}h3{font-size:11px;margin:8px 0 2px}
.head{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid #111;padding-bottom:6px}.muted{color:#555}
.demo{border:2px solid #b45309;color:#7c2d12;background:#fff7ed;padding:4px 8px;font-weight:700;margin:6px 0;text-align:center}
table{width:100%;border-collapse:collapse;margin-top:2px}td,th{border-bottom:1px solid #ddd;padding:3px 4px;text-align:start;vertical-align:top}th{font-size:9px;text-transform:uppercase;color:#444}
.chip{display:inline-block;border:1px solid #999;border-radius:8px;padding:0 5px;font-size:9px}.gap{color:#9f1239;font-weight:600}.ok{color:#166534}
ul{margin:0;padding-inline-start:14px}footer{margin-top:12px;border-top:1px solid #999;padding-top:6px;font-size:9px;color:#333}
.kv{display:grid;grid-template-columns:auto 1fr;gap:2px 10px}.bar{display:inline-block;height:6px;background:#111;vertical-align:middle}`;

// ───────────── F27 traceability report
export interface TraceRow {
  code: string; title: Bi; restricted: boolean; source: string; critical: boolean; n: number; dif: { d: number; i: number; f: number } | null;
  proposal: string | null; decision: string; override: boolean; note: string | null; objectives: { code: string; text: Bi }[];
  courses: { code: string; title: Bi; module: Bi | null }[]; jpms: { code: string; title: Bi }[]; state: 'gap' | 'no_refresher' | 'covered' | 'not_selected';
}
export interface TraceModel {
  role: Bi; status: string; version: number; approved_on: string | null; generated_on: string;
  summary: { tasks: number; selected: number; covered: number; gaps: number; orphans: number; pct: number | null };
  rows: TraceRow[]; orphans: { code: string; text: Bi; course: Bi | null }[];
}

function trainList(r: TraceRow, lang: 'en' | 'ar', tr: Tr): string {
  const li = [...r.courses.map((c) => `<li>${esc(c.code)} · ${esc(B(c.title, lang))}${c.module ? ` <span class="muted">(${esc(B(c.module, lang))})</span>` : ''}</li>`), ...r.jpms.map((j) => `<li>${esc(tr('m26.matrix.jpm'))}: ${esc(j.code)}</li>`)];
  return li.length ? `<ul>${li.join('')}</ul>` : '—';
}

export function traceabilityHtml(m: TraceModel, lang: 'en' | 'ar', tr: Tr): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const k = (x: string) => tr(`m26.report.${x}`);
  const rows = m.rows.map((r) => r.restricted
    ? `<tr><td>${esc(r.code)}</td><td colspan="6"><span class="chip">${esc(tr('m26.restricted.chip'))}</span></td></tr>`
    : `<tr><td>${esc(r.code)}${r.critical ? ` <span class="chip">${esc(tr('m26.task.critical'))}</span>` : ''}</td><td>${esc(B(r.title, lang))}<div class="muted">${esc(tr(`m26.source.${r.source}`))}</div></td>
<td>${r.dif ? `${tr('m26.dif.d1')} ${r.dif.d} · ${tr('m26.dif.i1')} ${r.dif.i} · ${tr('m26.dif.f1')} ${r.dif.f}<div class="muted">${esc(tr('m26.report.raters', { n: r.n }))}</div>` : '—'}</td>
<td>${esc(tr(`m26.decision.${r.decision}`))}${r.override ? ` <span class="chip">${esc(tr('m26.decision.override'))}</span>` : ''}${r.proposal && r.proposal !== r.decision ? `<div class="muted">${esc(tr('m26.report.rule', { d: tr(`m26.decision.${r.proposal}`) }))}</div>` : ''}${r.note ? `<div class="muted">${esc(r.note)}</div>` : ''}</td>
<td>${r.objectives.length ? `<ul>${r.objectives.map((o) => `<li><b>${esc(o.code)}</b> ${esc(B(o.text, lang))}</li>`).join('')}</ul>` : '—'}</td>
<td>${trainList(r, lang, tr)}</td>
<td class="${r.state === 'gap' ? 'gap' : r.state === 'covered' ? 'ok' : ''}">${esc(tr(`m26.matrix.state_${r.state}`))}</td></tr>`).join('');
  const orphans = m.orphans.map((o) => `<li><b>${esc(o.code)}</b> ${esc(B(o.text, lang))}${o.course ? ` <span class="muted">· ${esc(B(o.course, lang))}</span>` : ''}</li>`).join('');
  const s = m.summary;
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(k('traceTitle'))} · ${esc(B(m.role, lang))}</title><style>${STYLE}</style></head><body>
<div class="head"><div><h1>${esc(k('traceTitle'))}</h1><div class="muted">${esc(B(m.role, lang))}</div></div>
<div style="text-align:end"><div>${esc(tr(`m26.analysis.${m.status}`))} · ${esc(tr('m26.role.version', { n: m.version }))}</div>${m.approved_on ? `<div class="muted">${esc(tr('m26.role.approvedOn', { date: fmtDate(lang, m.approved_on) }))}</div>` : ''}<div class="muted">${esc(k('generated'))}: ${esc(fmtDate(lang, m.generated_on))}</div></div></div>
<h2>${esc(k('summary'))}</h2><div class="kv"><span>${esc(k('sumTasks'))}</span><b>${s.tasks}</b><span>${esc(k('sumSelected'))}</span><b>${s.selected}</b><span>${esc(k('sumCovered'))}</span><b>${s.covered}${s.pct == null ? '' : ` (${s.pct}%)`}</b><span>${esc(k('sumGaps'))}</span><b class="${s.gaps ? 'gap' : ''}">${s.gaps}</b><span>${esc(k('sumOrphans'))}</span><b>${s.orphans}</b></div>
<h2>${esc(k('matrix'))}</h2><table><thead><tr><th>${esc(tr('m26.task.code'))}</th><th>${esc(tr('m26.task.title'))}</th><th>${esc(k('dif'))}</th><th>${esc(tr('m26.task.decision'))}</th><th>${esc(tr('m26.matrix.objectives'))}</th><th>${esc(tr('m26.matrix.training'))}</th><th>${esc(tr('m26.matrix.state'))}</th></tr></thead><tbody>${rows}</tbody></table>
<h2>${esc(k('orphans'))}</h2>${orphans ? `<ul>${orphans}</ul>` : `<div class="muted">—</div>`}
<footer>${esc(k('traceFooter'))}</footer></body></html>`;
}

// ───────────── F29 self-evaluation report
export interface SerCriterion { code: string; title: Bi; rating: number | null; prev: number | null; evidence: Bi[]; gap: string; owner_role: string | null; due_on: string | null; note: string }
export interface SerModel {
  programme: Bi; code: string; cycle: string; status: string; readiness: number; rated: number; total: number; gaps: number;
  authors: Bi[]; finalised_by: Bi | null; finalised_at: string | null; generated_on: string;
  areas: { area: string; criteria: SerCriterion[] }[]; trend: { cycle: string; readiness: number | null }[];
  sources: { label: string; url: string }[];
}

export function selfEvalHtml(m: SerModel, lang: 'en' | 'ar', tr: Tr, demo: Bi): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const k = (x: string, v?: Record<string, string | number>) => tr(`m26.report.${x}`, v);
  const notice = B(demo, lang);
  const areas = m.areas.map((a) => `<h3>${esc(tr(`m26.area.${a.area}`))}</h3><table><thead><tr><th>${esc(k('criterion'))}</th><th>${esc(k('rating'))}</th><th>${esc(k('evidence'))}</th><th>${esc(k('gapOwner'))}</th></tr></thead><tbody>${a.criteria.map((c) => `<tr>
<td><b>${esc(c.code)}</b> ${esc(B(c.title, lang))}</td>
<td>${c.rating == null ? esc(tr('m26.rating.unrated')) : `${c.rating} · ${esc(tr(`m26.rating.r${c.rating}`))}`}${c.prev != null ? `<div class="muted">${esc(k('previous', { r: c.prev }))}</div>` : ''}</td>
<td>${c.evidence.length ? `<ul>${c.evidence.map((e) => `<li>${esc(B(e, lang))}</li>`).join('')}</ul>` : `<span class="muted">${esc(tr('m26.se.noEvidence'))}</span>`}${c.note ? `<div class="muted">${esc(c.note)}</div>` : ''}</td>
<td>${c.rating != null && c.rating <= 2 ? `<span class="gap">${esc(c.gap || tr('m26.se.gap'))}</span><div>${c.owner_role ? esc(tr(`m26.owner.${c.owner_role}`)) : '—'} · ${esc(fmtDate(lang, c.due_on))}</div>` : '—'}</td></tr>`).join('')}</tbody></table>`).join('');
  const trend = m.trend.map((x) => `<tr><td>${esc(x.cycle)}</td><td>${x.readiness == null ? '—' : `<span class="bar" style="width:${Math.max(2, x.readiness)}px"></span> ${x.readiness}%`}</td></tr>`).join('');
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(k('serTitle'))} · ${esc(B(m.programme, lang))} · ${esc(notice)}</title><style>${STYLE}</style></head><body>
<div class="head"><div><h1>${esc(k('serTitle'))}</h1><div class="muted">${esc(B(m.programme, lang))} (${esc(m.code)}) · ${esc(m.cycle)}</div></div>
<div style="text-align:end"><div>${esc(tr(`m26.se.${m.status}`))}</div><div class="muted">${esc(k('generated'))}: ${esc(fmtDate(lang, m.generated_on))}</div></div></div>
<div class="demo" data-testid="demo-notice">${esc(notice)}</div>
<h2>${esc(k('summary'))}</h2><div class="kv"><span>${esc(k('readiness'))}</span><b>${m.readiness}%</b><span>${esc(k('rated'))}</span><b>${m.rated} / ${m.total}</b><span>${esc(k('gaps'))}</span><b class="${m.gaps ? 'gap' : ''}">${m.gaps}</b>
<span>${esc(k('authors'))}</span><b>${esc(m.authors.map((a) => B(a, lang)).join(', ') || '—')}</b><span>${esc(k('finalisedBy'))}</span><b>${m.finalised_by ? `${esc(B(m.finalised_by, lang))} · ${esc(fmtDate(lang, m.finalised_at))}` : esc(k('notFinalised'))}</b></div>
<h2>${esc(k('trend'))}</h2><table><tbody>${trend}</tbody></table>
<h2>${esc(k('criteria'))}</h2>${areas}
<h2>${esc(k('method'))}</h2><p>${esc(k('methodBody'))}</p><ul>${m.sources.map((s) => `<li>${esc(s.label)} — ${esc(s.url)}</li>`).join('')}</ul>
<footer><b>${esc(notice)}</b> · ${esc(k('serFooter'))}</footer></body></html>`;
}
