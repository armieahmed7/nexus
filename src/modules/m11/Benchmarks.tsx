// [FS04] Benchmark ties for M11 future-skills pages. Reads the FS01 registry (kafaa_benchmarks) when it exists and falls back to the
// sourced rows below, so the page shows its benchmarks before and after the FS01 merge. When <BenchmarkChip> lands in src/ui the
// integration lead can swap this component for it; the ids are the PLAN section 4 ids (the kafaa_benchmarks primary keys).
import { useState } from 'react';
import { Drawer, SourceLink } from '../../ui';
import { useLang, useT } from '../../i18n';
import { useQuery, useRepo } from '../../data';

interface Bench { id: string; name_en: string; name_ar: string; owner: string; year: string; urls: string[]; borrow_en: string; borrow_ar: string; as_of: string }

/** Fallback rows, copied from PLAN.md section 4 (research pack sources, read 10 Oct 2026). */
export const FALLBACK: Record<string, Omit<Bench, 'name_ar' | 'borrow_ar'>> = {
  'IAEA-WFP': {
    id: 'IAEA-WFP', name_en: 'IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework', owner: 'IAEA', year: '2011',
    urls: ['https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf', 'https://www.iaea.org/sites/default/files/20/11/nicf.pdf'],
    borrow_en: 'Scenario bands rather than point estimates, a fill plan per gap, and a "why this competency exists" link to its activity.', as_of: '2026-10-10',
  },
  ESCO: {
    id: 'ESCO', name_en: 'ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations)', owner: 'European Commission', year: '2025',
    urls: ['https://esco.ec.europa.eu/en/about-esco/what-esco', 'https://esco.ec.europa.eu/en/classification/skill_main'],
    borrow_en: 'Reusability level on every skill, Arabic preferred and alternative labels, obsolete-not-deleted, and a published crosswalk.', as_of: '2026-10-10',
  },
};

function useBenchmarks(ids: readonly string[]) {
  const repo = useRepo();
  return useQuery([] as never, async () => {
    let rows: Record<string, unknown>[] = [];
    try { rows = (await repo.list('benchmarks' as never)) as unknown as Record<string, unknown>[]; } catch { rows = []; }
    return ids.map((id) => {
      const r = rows.find((x) => x.id === id);
      return r ? ({ ...FALLBACK[id], ...r, urls: (r.urls as string[]) ?? FALLBACK[id]?.urls ?? [] } as Partial<Bench> & { id: string }) : ({ ...FALLBACK[id], id } as Partial<Bench> & { id: string });
    });
  });
}

/** Chips naming the international benchmarks a page follows; each opens a drawer with owner, year, what Kafa'a borrows and sources. */
export function BenchmarkChips({ ids }: { ids: readonly string[] }) {
  const t = useT();
  const lang = useLang();
  const q = useBenchmarks(ids);
  const [open, setOpen] = useState<string | null>(null);
  const list: (Partial<Bench> & { id: string })[] = q.data ?? ids.map((id) => ({ ...FALLBACK[id], id }));
  const cur = list.find((b) => b.id === open);
  const name = (b: Partial<Bench> & { id: string }) => (lang === 'ar' ? b.name_ar || t(`m11.bench.${b.id}.name`) : b.name_en || t(`m11.bench.${b.id}.name`));
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="m11-benchmarks">
      <span className="caps">{t('m11.bench.follows')}</span>
      {list.map((b) => (
        <button key={b.id} type="button" className="chip border-info-line bg-info-bg text-info hover:underline" onClick={() => setOpen(b.id)} data-testid={`m11-bench-${b.id}`}>
          <span className="font-semibold">{b.id}</span>
          {b.year && <span className="num opacity-80">· {b.year}</span>}
        </button>
      ))}
      {cur && (
        <Drawer open onClose={() => setOpen(null)} title={name(cur)}>
          <div className="space-y-3 text-[13.5px]" data-testid="m11-bench-drawer">
            <p className="text-ink-2"><span className="font-semibold">{t('m11.bench.owner')}:</span> {cur.owner} · <span className="num">{cur.year}</span></p>
            <div>
              <div className="caps mb-1">{t('m11.bench.borrow')}</div>
              <p>{lang === 'ar' ? cur.borrow_ar || t(`m11.bench.${cur.id}.borrow`) : cur.borrow_en}</p>
            </div>
            <div>
              <div className="caps mb-1">{t('m11.bench.applied')}</div>
              <p>{t(`m11.bench.${cur.id}.applied`)}</p>
            </div>
            <ul className="space-y-1">
              {(cur.urls ?? []).map((u) => <li key={u}><SourceLink href={u} date={cur.as_of}>{u.replace(/^https:\/\/(www\.)?/, '').split('/')[0]}</SourceLink></li>)}
            </ul>
          </div>
        </Drawer>
      )}
    </div>
  );
}
