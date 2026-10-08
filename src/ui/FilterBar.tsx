/**
 * FilterBar: a row of selects and a search box bound to a plain object. Keeps state in the URL query string
 * when `urlSync` is set so filtered views can be shared.
 *   const [f, setF] = useFilters({ family: '', level: '' }, true);
 *   <FilterBar value={f} onChange={setF} search="q" fields={[{ key: 'family', label: t('..'), options: [...] }]} />
 */
import { useCallback, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from './Icon';
import { useT } from '../i18n';

export interface FilterField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}
export function useFilters<T extends Record<string, string>>(defaults: T, urlSync = false): [T, (next: Partial<T>) => void] {
  const [params, setParams] = useSearchParams();
  const value = useMemo(() => {
    if (!urlSync) return defaults;
    const v = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const p = params.get(k);
      if (p !== null) (v as Record<string, string>)[k] = p;
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, urlSync, JSON.stringify(defaults)]);
  const set = useCallback(
    (next: Partial<T>) => {
      const p = new URLSearchParams(params);
      for (const [k, v] of Object.entries(next)) {
        if (v) p.set(k, v as string);
        else p.delete(k);
      }
      setParams(p, { replace: true });
    },
    [params, setParams],
  );
  return [value, set];
}

export function FilterBar<T extends Record<string, string>>({ value, onChange, fields, search, extra }: { value: T; onChange: (v: Partial<T>) => void; fields: FilterField[]; search?: keyof T & string; extra?: ReactNode }) {
  const t = useT();
  const active = Object.values(value).some(Boolean);
  return (
    <div className="flex flex-wrap items-end gap-2" role="search" data-testid="filter-bar">
      {search && (
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">{t('common.search')}</span>
          <Icon name="search" size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="input ps-8" value={value[search] ?? ''} placeholder={t('common.search')} onChange={(e) => onChange({ [search]: e.target.value } as Partial<T>)} />
        </label>
      )}
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="caps">{f.label}</span>
          <select className="input min-w-[160px]" value={value[f.key] ?? ''} onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<T>)}>
            <option value="">{t('common.all')}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {extra}
      {active && (
        <button className="btn-ghost btn-sm" onClick={() => onChange(Object.fromEntries(Object.keys(value).map((k) => [k, ''])) as Partial<T>)}>
          {t('common.clearFilters')}
        </button>
      )}
    </div>
  );
}
