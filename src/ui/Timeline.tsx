/** Vertical timeline (application history, audit trail, standard versions). */
import type { ReactNode } from 'react';
import type { PillTone } from './Page';

export interface TimelineItem {
  id: string;
  when: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  tone?: PillTone;
}
const dot: Record<string, string> = { ok: 'bg-ok', bad: 'bg-bad', info: 'bg-info', sim: 'bg-sim', reserved: 'bg-reserved', neutral: 'bg-line-strong', accent: 'bg-accent' };
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-4 border-s border-line ps-5">
      {items.map((it) => (
        <li key={it.id} className="relative">
          <span className={`absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-bg ${dot[it.tone ?? 'accent']}`} aria-hidden />
          <div className="caps">{it.when}</div>
          <div className="font-semibold">{it.title}</div>
          {it.detail && <div className="text-[13px] text-ink-2">{it.detail}</div>}
        </li>
      ))}
    </ol>
  );
}

/** Horizontal stepper (application stages, supplier readiness, onboarding). */
export function Stepper({ steps, current, failedAt }: { steps: { id: string; label: ReactNode }[]; current: number; failedAt?: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2" data-testid="stepper">
      {steps.map((s, i) => {
        const state = failedAt === i ? 'bad' : i < current ? 'done' : i === current ? 'cur' : 'todo';
        const cls = { done: 'bg-ok text-white', cur: 'bg-accent text-accent-ink', todo: 'bg-sunken text-ink-3 border border-line', bad: 'bg-bad text-white' }[state];
        return (
          <li key={s.id} className="flex items-center" aria-current={i === current ? 'step' : undefined}>
            <span className={`num grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${cls}`}>{state === 'done' ? '✓' : i + 1}</span>
            <span className={`ms-2 text-[13px] ${i === current ? 'font-semibold text-ink' : 'text-ink-2'}`}>{s.label}</span>
            {i < steps.length - 1 && <span className="mx-3 h-px w-6 bg-line-strong sm:w-10" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
