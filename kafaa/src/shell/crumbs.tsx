/** Pages with params set the last breadcrumb label: useCrumbLabel(pick(role, 'title')). */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const Ctx = createContext<{ label: string | null; set: (s: string | null) => void }>({ label: null, set: () => undefined });
export function CrumbProvider({ children }: { children: ReactNode }) {
  const [label, set] = useState<string | null>(null);
  return <Ctx.Provider value={{ label, set }}>{children}</Ctx.Provider>;
}
export function useCrumbLabel(label: string | null | undefined) {
  const { set } = useContext(Ctx);
  useEffect(() => {
    set(label ?? null);
    return () => set(null);
  }, [label, set]);
}
export const useCrumbState = () => useContext(Ctx).label;
