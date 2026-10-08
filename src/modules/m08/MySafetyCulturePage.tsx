// M08 · My safety culture: trait-of-the-week learning, HU tool refreshers, reflection prompts and related OE lessons.
// No points, no badges, no scores. Reflection notes stay in this browser only and never reach Kafa'a's database
// (individual safety-culture responses never enter Kafa'a).
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { Async, Callout, Card, Icon, Page, Section, StatusPill, Tabs } from '../../ui';
import type { ScTraitsRow } from '../../data/types';

const NOTES_KEY = 'kafaa.sc.reflections.v1';
type Bi = { en: string; ar: string };

function readNotes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export default function MySafetyCulturePage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const data = useQuery(['sc_traits', 'hu_tools', 'oe_lessons'], async () => {
    const [traits, hu, oe] = await Promise.all([repo.list('sc_traits', { order: [['n', 'asc']] }), repo.list('hu_tools'), repo.list('oe_lessons', { filter: { status: 'published' } }).catch(() => [])]);
    return { traits, hu, oe };
  });
  const week = useMemo(() => {
    const d = new Date();
    const start = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.floor((d.getTime() - start) / (7 * 86_400_000));
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const traits = data.data?.traits ?? [];
  const focus: ScTraitsRow | undefined = traits.find((x) => x.id === selected) ?? traits[week % Math.max(1, traits.length)];
  const [notes, setNotes] = useState<Record<string, string>>(readNotes);
  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(focus ? (notes[focus.id] ?? '') : ''), [focus, notes]);
  const saveNote = () => {
    if (!focus) return;
    const next = { ...notes, [focus.id]: draft };
    setNotes(next);
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(next));
    } catch {
      /* private mode: keep in memory */
    }
  };
  const bi = (x: Bi) => (lang === 'ar' && x.ar ? x.ar : x.en);

  return (
    <Page title={t('m08.routes.my-safety-culture.title')} intro={t('m08.my.intro')}>
      <Async state={data} isEmpty={(d) => d.traits.length === 0}>
        {(d) => (
          <Tabs
            tabs={[
              {
                id: 'traits',
                label: t('m08.my.tabTraits'),
                content: (
                  <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                    <nav aria-label={t('m08.my.traitList')}>
                      <ol className="space-y-1" data-testid="m08-my-traits">
                        {d.traits.map((tr) => (
                          <li key={tr.id}>
                            <button
                              className={`flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-start text-[13px] ${focus?.id === tr.id ? 'bg-accent-soft font-semibold text-ink' : 'text-ink-2 hover:bg-sunken'}`}
                              aria-current={focus?.id === tr.id ? 'true' : undefined}
                              onClick={() => setSelected(tr.id)}
                            >
                              <span className="num w-5 text-ink-3">{f.num(tr.n)}</span>
                              {pick(tr, 'name')}
                            </button>
                          </li>
                        ))}
                      </ol>
                    </nav>
                    {focus && (
                      <div className="space-y-4">
                        <Card eyebrow={focus.id === traits[week % traits.length]?.id ? t('m08.my.thisWeek') : t('m08.my.trait', { n: f.num(focus.n) })} title={pick(focus, 'name')}>
                          <p className="text-[14px] text-ink-2">{pick(focus, 'description')}</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="caps mb-1">{t('m08.my.looksLike')}</div>
                              <ul className="list-disc space-y-1 ps-5 text-[13px]">
                                {(focus.behaviours as Bi[]).map((b, i) => (
                                  <li key={i}>{bi(b)}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="caps mb-1">{t('m08.my.reflect')}</div>
                              <ul className="list-disc space-y-1 ps-5 text-[13px]">
                                {(focus.prompts as Bi[]).map((b, i) => (
                                  <li key={i}>{bi(b)}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </Card>
                        <Card title={t('m08.my.notesTitle')}>
                          <label className="block">
                            <span className="sr-only">{t('m08.my.notesTitle')}</span>
                            <textarea className="input min-h-[90px]" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('m08.my.notesPlaceholder')} data-testid="m08-reflection" />
                          </label>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button className="btn-outline btn-sm" onClick={saveNote}>{t('m08.my.saveNote')}</button>
                            {notes[focus.id] !== undefined && <span className="text-[12px] text-ok">{t('m08.my.saved')}</span>}
                          </div>
                          <p className="mt-2 text-[12px] text-ink-3">{t('m08.my.notesPrivacy')}</p>
                        </Card>
                        <Section title={t('m08.my.relatedOe')}>
                          {d.oe.filter((o) => o.trait_ids.includes(focus.id)).length === 0 ? (
                            <p className="text-[13px] text-ink-3">{t('m08.my.noOe')}</p>
                          ) : (
                            <ul className="space-y-2">
                              {d.oe.filter((o) => o.trait_ids.includes(focus.id)).map((o) => (
                                <li key={o.id} className="card p-3">
                                  <L to={`/oe?lesson=${o.id}`} className="font-semibold">{pick(o, 'title')}</L>
                                  <div className="text-[12.5px] text-ink-2">{pick(o, 'lesson')}</div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </Section>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                id: 'hu',
                label: t('m08.my.tabHu'),
                content: (
                  <div className="space-y-4">
                    <Callout tone="info">{t('m08.my.huIntro')}</Callout>
                    <div className="grid gap-3 md:grid-cols-2" data-testid="m08-hu-refreshers">
                      {d.hu.map((h) => (
                        <HuCard key={h.id} name={pick(h, 'name')} body={pick(h, 'description')} kind={h.kind} />
                      ))}
                    </div>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Async>
      <Callout tone="info" title={t('m08.sc.noGameTitle')}>
        {t('m08.my.noGame')}
      </Callout>
    </Page>
  );
}

function HuCard({ name, body, kind }: { name: string; body: string; kind: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{name}</div>
        <StatusPill tone={kind === 'core' ? 'accent' : 'neutral'}>{t(`m08.sc.hu.${kind}`)}</StatusPill>
      </div>
      <p className="mt-1 text-[13px] text-ink-2">{body}</p>
      <button className="btn-ghost btn-sm mt-2" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="chevronDown" className={open ? 'rotate-180' : ''} />
        {t('m08.my.whenToUse')}
      </button>
      {open && <p className="mt-1 text-[12.5px] text-ink-2">{t(kind === 'core' ? 'm08.my.coreWhen' : 'm08.my.conditionalWhen')}</p>}
    </div>
  );
}
