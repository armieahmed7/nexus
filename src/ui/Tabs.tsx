/** Accessible tabs (arrow keys move focus, RTL aware). Controlled or uncontrolled. */
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useI18n } from '../i18n';

export interface TabDef {
  id: string;
  label: ReactNode;
  content: ReactNode;
  badge?: ReactNode;
}
export function Tabs({ tabs, value, onChange, initial }: { tabs: TabDef[]; value?: string; onChange?: (id: string) => void; initial?: string }) {
  const { dir } = useI18n();
  const [inner, setInner] = useState(initial ?? tabs[0]?.id);
  const cur = value ?? inner;
  const uid = useId();
  const select = (id: string) => {
    setInner(id);
    onChange?.(id);
  };
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((x) => x.id === cur);
    const fwd = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let n = -1;
    if (e.key === fwd) n = (i + 1) % tabs.length;
    if (e.key === back) n = (i - 1 + tabs.length) % tabs.length;
    if (n >= 0) {
      e.preventDefault();
      select(tabs[n].id);
      document.getElementById(`${uid}-tab-${tabs[n].id}`)?.focus();
    }
  };
  const active = tabs.find((x) => x.id === cur) ?? tabs[0];
  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line" onKeyDown={onKey}>
        {tabs.map((x) => (
          <button
            key={x.id}
            id={`${uid}-tab-${x.id}`}
            role="tab"
            aria-selected={x.id === active?.id}
            aria-controls={`${uid}-panel-${x.id}`}
            tabIndex={x.id === active?.id ? 0 : -1}
            onClick={() => select(x.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-semibold ${x.id === active?.id ? 'border-accent text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
          >
            {x.label}
            {x.badge !== undefined && <span className="ms-1.5 rounded-full bg-sunken px-1.5 text-[11px] text-ink-2">{x.badge}</span>}
          </button>
        ))}
      </div>
      {active && (
        <div role="tabpanel" id={`${uid}-panel-${active.id}`} aria-labelledby={`${uid}-tab-${active.id}`} className="pt-4">
          {active.content}
        </div>
      )}
    </div>
  );
}
