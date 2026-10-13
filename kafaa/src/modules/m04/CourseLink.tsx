// Audit 2026-10-13 (finding 3): links to a course from public pages. Five courses that public pages point at are internal
// (kafaa_courses.public_summary = false: c-adv-smr, c-ai-gov, c-hu-ref, c-et-esg-clinic, c-et-ghg-mgr), so a signed-out visitor who
// followed the link landed on "Course not found". A course is linked only when the viewer can read it (the course read rule: public
// summary for everyone, internal courses for staff); otherwise a signed-out visitor gets "Staff: sign in to open" (sign-in with
// next=/learn/course/<id>) and a signed-in reader without access gets plain text. Used by M11 (future tracks), M32 (CleanEnergyComp
// learning) and M33 (core-skill routes).
import { useEffect, useState, type ReactNode } from 'react';
import { useRepo } from '../../data';
import { L, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { Repository } from '../../data/types';

export type CourseHref = { kind: 'link'; to: string } | { kind: 'signin'; to: string } | { kind: 'text' };

/** Pure rule: where a course reference may point for this viewer. `visible` = the viewer can read the course row. */
export function publicCourseHref(courseId: string, opts: { visible: boolean; signedIn: boolean }): CourseHref {
  const to = `/learn/course/${courseId}`;
  if (opts.visible) return { kind: 'link', to };
  if (!opts.signedIn) return { kind: 'signin', to: `/sign-in?next=${encodeURIComponent(to)}` };
  return { kind: 'text' };
}

// One batched lookup per tick and per viewer: which of the requested course ids the viewer can read (RLS filters the rows).
const cache = new WeakMap<Repository, Map<string, Promise<boolean>>>();
const pending = new WeakMap<Repository, Map<string, { ids: Map<string, (v: boolean) => void> }>>();
function lookup(repo: Repository, viewer: string, id: string): Promise<boolean> {
  let byKey = cache.get(repo);
  if (!byKey) cache.set(repo, (byKey = new Map()));
  const key = `${viewer}|${id}`;
  const hit = byKey.get(key);
  if (hit) return hit;
  let perViewer = pending.get(repo);
  if (!perViewer) pending.set(repo, (perViewer = new Map()));
  let batch = perViewer.get(viewer);
  if (!batch) {
    const b = { ids: new Map<string, (v: boolean) => void>() };
    perViewer.set(viewer, (batch = b));
    queueMicrotask(() => {
      perViewer!.delete(viewer);
      const ids = [...b.ids.keys()];
      repo.list('courses', { filter: { id: ids } }).then(
        (rows) => { const seen = new Set(rows.map((r) => r.id)); for (const [i, done] of b.ids) done(seen.has(i)); },
        () => { for (const [i, done] of b.ids) { byKey!.delete(`${viewer}|${i}`); done(false); } },
      );
    });
  }
  const p = new Promise<boolean>((resolve) => batch!.ids.set(id, resolve));
  byKey.set(key, p);
  return p;
}

/** true / false once known; undefined while loading. */
export function useCourseVisible(courseId: string | null | undefined): boolean | undefined {
  const repo = useRepo();
  const s = useSession();
  const viewer = s.status === 'signed_in' ? (s.identity.personaId ?? 'signed-in') : s.status;
  const [v, setV] = useState<{ key: string; value: boolean } | null>(null);
  const key = `${viewer}|${courseId ?? ''}`;
  useEffect(() => {
    if (!courseId || s.status === 'loading') return;
    let alive = true;
    void lookup(repo, viewer, courseId).then((value) => alive && setV({ key, value }));
    return () => { alive = false; };
  }, [repo, viewer, courseId, key, s.status]);
  return v && v.key === key ? v.value : undefined;
}

/**
 * A course reference on a public page. `children` is the link text. With `title` (the course's own name) the name stays visible
 * when the course cannot be opened; without it (an "Open course" action) only the staff sign-in hint is shown.
 */
export function CourseLink({ courseId, children, title, className, testId }: { courseId: string; children: ReactNode; title?: ReactNode; className?: string; testId?: string }) {
  const t = useT();
  const s = useSession();
  const visible = useCourseVisible(courseId);
  if (visible === undefined) return <span className={className} data-testid={testId}>{title ?? children}</span>;
  const href = publicCourseHref(courseId, { visible, signedIn: s.status === 'signed_in' });
  if (href.kind === 'link') return <L to={href.to} className={className} data-testid={testId}>{children}</L>;
  if (href.kind === 'signin') {
    return (
      <span className={className} data-testid={testId} data-course-internal={courseId}>
        {title != null && <>{title} · </>}
        <L to={href.to} className="text-[12px]" data-testid="course-staff-signin">{t('m04.courseLink.staffSignIn')}</L>
      </span>
    );
  }
  return <span className={className} data-testid={testId} data-course-internal={courseId}>{title ?? <span className="text-ink-3">{t('m04.courseLink.internal')}</span>}</span>;
}
