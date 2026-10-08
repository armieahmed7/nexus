/** G5 feature flags (M16): read by pages to hide features; written only from /admin (audited, locked flags never change). */
import { useCallback } from 'react';
import { useQuery, useRepo } from '../../data';

export function useFlags() {
  const repo = useRepo();
  const q = useQuery('feature_flags', () => repo.list('feature_flags').catch(() => []));
  const isOn = useCallback((key: string, dflt = true) => (q.data ? (q.data.find((f) => f.key === key)?.enabled ?? dflt) : dflt), [q.data]);
  return { isOn, rows: q.data, loading: q.loading, error: q.error, reload: q.reload };
}
