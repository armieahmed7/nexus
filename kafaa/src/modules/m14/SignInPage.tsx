/**
 * Sign-in (foundation, M14). Demo role cards, no passwords. Opening a URL never signs anyone in (B-01): a persona
 * is chosen explicitly here. Local mode: any of the 57 personas. Supabase mode: the 43 NEXUS role cards via the
 * NEXUS session, and the 14 Kafa'a-only personas via the kafaa-persona-signin Edge Function (src/auth/personaSession.ts).
 */
import { landing } from './landing';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession, roleLabel, type PersonaCard } from '../../auth/session';
import { ROLE_LABELS, type PlatformRole } from '../../auth/policy';
import { L, useLang, useNav, useT } from '../../i18n';
import { Page, Callout } from '../../ui/Page';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { config } from '../../config';

const GROUPS: { id: string; match: (p: PersonaCard) => boolean }[] = [
  { id: 'kafaa', match: (p) => !p.nexus && p.kind === 'staff' },
  { id: 'staff', match: (p) => p.nexus && p.kind === 'staff' && p.roles.some((r) => ROLE_LABELS[r]?.tier === 'elevated' || ROLE_LABELS[r]?.tier === 'admin') },
  { id: 'staffBasic', match: (p) => p.nexus && p.kind === 'staff' && !p.roles.some((r) => ROLE_LABELS[r]?.tier === 'elevated' || ROLE_LABELS[r]?.tier === 'admin') },
  { id: 'partners', match: (p) => p.kind === 'partner' || p.kind === 'contractor' || p.roles.includes('university') },
  { id: 'public', match: (p) => p.kind === 'applicant' },
  { id: 'oversight', match: (p) => p.kind === 'observer' || (p.roles.length === 1 && p.roles[0] === 'auditor') },
];

export default function SignInPage() {
  const t = useT();
  const lang = useLang();
  const s = useSession();
  const nav = useNav();
  const toast = useToast();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = s.personas.filter((p) => !term || [p.title_en, p.title_ar, p.persona, ...p.roles.map((r) => ROLE_LABELS[r]?.en ?? r)].join(' ').toLowerCase().includes(term));
    const used = new Set<string>();
    return GROUPS.map((g) => {
      const items = list.filter((p) => !used.has(p.persona) && g.match(p));
      items.forEach((p) => used.add(p.persona));
      return { id: g.id, items };
    }).filter((g) => g.items.length);
  }, [s.personas, q]);

  const choose = async (p: PersonaCard) => {
    setError(null);
    setBusy(p.persona);
    const r = await s.signIn(p.persona);
    setBusy(null);
    if (!r.ok) {
      setError(r.code ? t(`m14.signIn.errors.${r.code}`) : r.message ?? t('m14.signIn.failed'));
      return;
    }
    toast.push({ tone: 'ok', title: t('m14.signIn.signedInAs', { who: lang === 'ar' ? p.title_ar : p.title_en }) });
    const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : landing(p.roles);
    nav(dest);
  };

  return (
    <Page title={t('m14.signIn.title')} intro={t('m14.signIn.intro')} eyebrow={t('shell.brand')}>
      {s.backend === 'supabase' ? <Callout tone="info" title={t('m14.signIn.liveTitle')}>{t('m14.signIn.liveBody')} <a href={config.nexusSignIn}>{t('m14.signIn.openNexus')}</a></Callout> : <Callout tone="sim" title={t('m14.signIn.localTitle')}>{t('m14.signIn.localBody')}</Callout>}
      {error && (
        <div role="alert" className="rounded-card border border-bad-line bg-bad-bg p-3 text-bad">
          {error}
          {s.backend === 'supabase' && (
            <button className="btn-outline btn-sm ms-2" onClick={() => s.switchBackend('local')}>
              {t('shell.backend.useLocal')}
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">{t('m14.signIn.filter')}</span>
          <Icon name="search" size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="input ps-8" placeholder={t('m14.signIn.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <L to="/" className="btn-outline" data-testid="browse-anonymously">
          {t('m14.signIn.anonymous')}
        </L>
        {s.status === 'signed_in' && (
          <button className="btn-ghost" onClick={() => s.signOut()}>
            {t('shell.signOut')}
          </button>
        )}
      </div>
      {grouped.map((g) => (
        <section key={g.id} className="space-y-2">
          <h2 className="text-[16px] font-semibold">{t(`m14.signIn.groups.${g.id}`)}</h2>
          <p className="text-[13px] text-ink-2">{t(`m14.signIn.groupHelp.${g.id}`)}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((p) => {
              const current = s.identity.personaId === p.persona;
              return (
                <li key={p.persona}>
                  <button
                    className={`card flex h-full w-full flex-col items-start gap-2 p-3 text-start transition hover:border-accent ${current ? 'border-accent ring-2 ring-accent/20' : ''}`}
                    onClick={() => choose(p)}
                    disabled={busy !== null}
                    data-testid={`persona-${p.persona}`}
                    aria-describedby={`pd-${p.persona}`}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="font-semibold">{lang === 'ar' ? p.title_ar : p.title_en}</span>
                      {p.nexus ? <span className="chip border-accent/30 bg-accent-soft text-eyebrow">NEXUS</span> : <span className="chip border-accent/30 bg-accent-soft text-eyebrow" data-testid={`persona-badge-${p.persona}`}>{t('m14.signIn.kafaaBadge')}</span>}
                    </div>
                    <div id={`pd-${p.persona}`} className="flex flex-wrap gap-1">
                      {p.roles.map((r: PlatformRole) => (
                        <span key={r} className="chip border-line bg-sunken text-ink-2">
                          {roleLabel(r, lang)}
                        </span>
                      ))}
                    </div>
                    <div className="caps mt-auto">{busy === p.persona ? t('common.working') : current ? t('m14.signIn.current') : (p.scopes.filter((x) => !x.endsWith(':self')).join(' · ') || ' ')}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Page>
  );
}
