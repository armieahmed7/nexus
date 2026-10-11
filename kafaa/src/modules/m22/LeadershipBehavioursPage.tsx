// /leadership/behaviours (M22 · FS46): the leadership-behaviour catalogue of the 360. Form 1 (eight behaviours, INPO 12-012 traits)
// stays readable for older cycles; form 2 adds four future behaviours (leading digital change, AI-augmented teams including when to
// override a tool, intrapreneurship, inclusion). Every behaviour has an anchor at each rating point in EN and AR, a coach card with
// practice and links, and its framework sources. My coach cards are ordered by coachFocus() from my latest 360 with "Why this?".
import { useMemo, useState } from 'react';
import { Page, Section, Async, EmptyState, Callout, WhyThis, BenchmarkChips, Icon, SourceLink, StatusPill } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useT } from '../../i18n';
import { coachFocus } from './future';
import { useAnchor, useBehaviours, useBi, type Behaviour } from './fsui';
import type { Source } from './ui';

export default function LeadershipBehavioursPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const me = s.identity.personId;
  const beh = useBehaviours();
  const mine = useQuery(['leadership_360_requests', 'leadership_360'], () => (s.can('skills_profile', ['Own']) ? repo.rpc.my360(null) : Promise.resolve(null)), [me]);
  const [filter, setFilter] = useState<'all' | 'future'>('all');
  return (
    <Page title={t('m22.routes.leadership-behaviours.title')} intro={t('m22.beh.intro')} eyebrow={<L to="/leadership">{t('m22.programme.back')}</L>} wide>
      <div className="space-y-8">
        <BenchmarkChips feature="FS46" />
        <Async state={beh} isEmpty={(rows) => rows.length === 0} empty={<EmptyState icon="sparkle" title={t('m22.beh.empty')} />}>
          {(rows) => (
            <>
              {mine.data !== undefined && <Coach rows={rows} my={mine.data} />}
              <Section title={t('m22.beh.catalogue')} description={t('m22.beh.catalogueSub')}
                actions={<div className="flex gap-1.5" role="group" aria-label={t('m22.beh.filter')}>
                  {(['all', 'future'] as const).map((k) => <button key={k} className={`chip ${filter === k ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`} aria-pressed={filter === k} onClick={() => setFilter(k)} data-testid={`m22-beh-filter-${k}`}>{t(`m22.beh.filter_${k}`)}</button>)}
                </div>}>
                <ul className="space-y-4" data-testid="m22-beh-list">
                  {rows.filter((b) => filter === 'all' || b.form_from === 2).map((b) => <BehaviourCard key={b.id} b={b} />)}
                </ul>
              </Section>
            </>
          )}
        </Async>
        <Callout title={t('m22.beh.versionTitle')}>{t('m22.beh.versionBody')}</Callout>
      </div>
    </Page>
  );
}

function Coach({ rows, my }: { rows: Behaviour[]; my: Awaited<ReturnType<ReturnType<typeof useRepo>['rpc']['my360']>> | null }) {
  const t = useT();
  const f = useFormat();
  const bi = useBi();
  const ranked = useMemo(() => {
    const ids = new Set(my?.enough && my.behaviours ? my.behaviours.map((x) => x.id) : rows.map((b) => b.id));
    const list = rows.filter((b) => ids.has(b.id));
    return coachFocus(list, my?.enough && my.behaviours ? my.behaviours.map((x) => ({ id: x.id, self: x.self, others: x.others })) : null).slice(0, 4);
  }, [rows, my]);
  return (
    <Section title={t('m22.beh.coachTitle')} description={my?.enough ? t('m22.beh.coachFromResults', { cycle: my.cycle ?? '', v: f.num(my.form_version) }) : t('m22.beh.coachDefault')}>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m22-coach-cards">
        {ranked.map((r) => {
          const b = rows.find((x) => x.id === r.id)!;
          const coach = (b.coach ?? {}) as { tips?: unknown[]; practice?: unknown; watch?: unknown };
          return (
            <li key={r.id} className="card space-y-2 p-4" data-testid="m22-coach-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-semibold">{t(`m22.behaviours.${b.id}.title`)}</div>
                {b.form_from === 2 && <StatusPill tone="accent">{t('m22.beh.future')}</StatusPill>}
              </div>
              <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">{(coach.tips ?? []).slice(0, 3).map((x, i) => <li key={i}>{bi(x)}</li>)}</ul>
              {coach.practice != null && <p className="text-[12.5px]"><span className="caps me-1">{t('m22.beh.practice')}</span>{bi(coach.practice)}</p>}
              <WhyThis reasons={r.reasons} testId="m22-why-coach" />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function BehaviourCard({ b }: { b: Behaviour }) {
  const t = useT();
  const f = useFormat();
  const bi = useBi();
  const anchor = useAnchor();
  const [open, setOpen] = useState(false);
  const coach = (b.coach ?? {}) as { tips?: unknown[]; practice?: unknown; watch?: unknown };
  const links = (Array.isArray(b.links) ? b.links : []) as { to: string; label_en: string; label_ar: string }[];
  const sources = (Array.isArray(b.sources) ? b.sources : []) as Source[];
  return (
    <li className="card p-4" data-testid="m22-beh-card" data-behaviour={b.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{t(`m22.behaviours.${b.id}.title`)}</div>
          <p className="text-[13px] text-ink-2">{t(`m22.behaviours.${b.id}.statement`)}</p>
          <p className="mt-1 text-[12px] text-ink-3">{bi({ en: b.framework_en, ar: b.framework_ar })}</p>
        </div>
        <span className="flex flex-wrap gap-1.5">
          <StatusPill tone={b.form_from === 2 ? 'accent' : 'neutral'}>{b.form_from === 2 ? t('m22.beh.formFrom2') : t('m22.beh.formBoth')}</StatusPill>
        </span>
      </div>
      <table className="mt-3 w-full text-[12.5px]" data-testid="m22-beh-anchors">
        <caption className="sr-only">{t('m22.beh.anchorsCaption', { behaviour: t(`m22.behaviours.${b.id}.title`) })}</caption>
        <thead><tr><th scope="col" className="w-28 pe-2 text-start font-semibold text-ink-3">{t('m22.beh.point')}</th><th scope="col" className="text-start font-semibold text-ink-3">{t('m22.beh.anchor')}</th></tr></thead>
        <tbody>
          {[1, 2, 3, 4, 5].map((p) => (
            <tr key={p} className="border-t border-line align-top">
              <td className="py-1.5 pe-2"><span className="num font-semibold">{f.num(p)}</span> · {t(`m22.r360.scale.${p}`)}</td>
              <td className="py-1.5">{anchor(b, p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-ghost btn-sm mt-2" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="m22-beh-coach-toggle"><Icon name="chevron" size={14} />{t('m22.beh.coachCard')}</button>
      {open && (
        <div className="mt-2 space-y-2 rounded-card border border-line bg-sunken p-3" data-testid="m22-beh-coach">
          <ul className="list-disc space-y-1 ps-5 text-[13px]">{(coach.tips ?? []).map((x, i) => <li key={i}>{bi(x)}</li>)}</ul>
          {coach.practice != null && <p className="text-[12.5px]"><span className="caps me-1">{t('m22.beh.practice')}</span>{bi(coach.practice)}</p>}
          {coach.watch != null && <p className="text-[12.5px]"><span className="caps me-1">{t('m22.beh.watch')}</span>{bi(coach.watch)}</p>}
          {links.length > 0 && <div className="flex flex-wrap gap-2">{links.map((l) => <L key={l.to} to={l.to} className="btn-outline btn-sm">{bi({ en: l.label_en, ar: l.label_ar })}</L>)}</div>}
        </div>
      )}
      {sources.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="m22-beh-sources">
          {sources.map((x, i) => <SourceLink key={i} href={x.url} date={x.as_of ? f.date(x.as_of) : null}>{x.label}</SourceLink>)}
        </div>
      )}
    </li>
  );
}
