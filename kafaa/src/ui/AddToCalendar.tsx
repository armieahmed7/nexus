// SHR-01 · "Add to calendar": a button that saves an .ics file built in the browser (src/domain/ics.ts). No third-party
// service, no network request, no telemetry and nothing stored: the Blob goes straight to a download link (CSP-safe).
import { useCallback } from 'react';
import { buildIcs, countIcsEvents, icsFileName, ICS_MIME, type IcsEvent } from '../domain/ics';
import { config } from '../config';
import { useCount, useLang, useT } from '../i18n';
import { Icon } from './Icon';
import { useToast } from './Toast';

/** Absolute link to a page in the reader's language, for the event description ("open in Kafa'a"). */
export function useCalendarLink() {
  const lang = useLang();
  return useCallback((path: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}${config.basename}${lang === 'ar' ? '/ar' : ''}${path === '/' ? '' : path}`, [lang]);
}

/** The line every exported event carries, so a calendar copy is never mistaken for a record. */
export function useCalendarNote() {
  const t = useT();
  return t('common.ics.note');
}

export function saveIcs(fileBase: string, text: string) {
  const blob = new Blob([text], { type: ICS_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = icsFileName(fileBase);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface AddToCalendarProps {
  events: IcsEvent[];
  /** File name stem, e.g. 'my-learning' → kafaa-my-learning.ics */
  file: string;
  /** Calendar name inside the file (page language). */
  calendarName: string;
  /** Visible label; defaults to "Add to calendar" (or "Add all to calendar" for several events). */
  label?: string;
  /** Icon-only button for rows; give `itemTitle` so the accessible name says which item. */
  compact?: boolean;
  itemTitle?: string;
  className?: string;
  testId?: string;
}

export function AddToCalendar({ events, file, calendarName, label, compact, itemTitle, className, testId }: AddToCalendarProps) {
  const t = useT();
  const plural = useCount();
  const lang = useLang();
  const toast = useToast();
  const n = countIcsEvents(events);
  if (n === 0) return null;
  const text = label ?? (n > 1 ? t('common.ics.addAll') : t('common.ics.add'));
  const name = compact && itemTitle ? t('common.ics.addOne', { title: itemTitle }) : `${text} (${plural('common.ics.nEvents', n)})`;
  const onClick = () => {
    saveIcs(file, buildIcs(events, { name: calendarName, lang }));
    toast.push({ tone: 'ok', title: t('common.ics.saved', { n: plural('common.ics.nEvents', n) }), detail: t('common.ics.savedDetail') });
  };
  return (
    <button type="button" className={className ?? (compact ? 'btn-ghost btn-sm' : 'btn-outline btn-sm')} onClick={onClick} aria-label={compact ? undefined : name} title={compact ? name : undefined} data-testid={testId ?? 'ics-download'} data-ics-count={n}>
      <Icon name="calendar" size={14} />
      {compact ? <span className="sr-only">{name}</span> : <span>{text}</span>}
    </button>
  );
}
