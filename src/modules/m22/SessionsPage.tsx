// /communities/sessions (M22 · F17): the knowledge-sharing session catalogue. BM25 search (F02 SearchEngine) over titles,
// summaries and keywords in English and Arabic, topic filter, recordings as synthetic links and upcoming sessions as events.
// The topics follow the 2024 knowledge-sharing sessions listed in the CNS national report; titles and recordings are synthetic.
import { useMemo, useState } from 'react';
import { Page, Async, EmptyState, Callout, Drawer, SimChip, EngineBadge, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { L, useFormat, usePick, useT } from '../../i18n';
import { sessionDoc } from './domain';
import { M22Pill, Sources } from './ui';

export default function SessionsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const eng = useEngine('search');
  const q = useQuery(['ks_sessions', 'communities'], async () => {
    const [sessions, communities] = await Promise.all([repo.list('ks_sessions', { order: [['held_on', 'desc']] }), repo.list('communities', { order: [['sort', 'asc']] })]);
    return { sessions, communities };
  }, []);
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [rec, setRec] = useState<string | null>(null);
  const index = useMemo(() => eng.search((q.data?.sessions ?? []).map(sessionDoc)), [eng, q.data]);
  const rows = useMemo(() => {
    const all = q.data?.sessions ?? [];
    const hits = text.trim() ? index.search(text, 50).map((h) => all.find((s) => s.id === h.doc.id)!).filter(Boolean) : all;
    return hits.filter((s) => !topic || s.topic === topic);
  }, [q.data, text, topic, index]);
  const topics = [...new Set((q.data?.sessions ?? []).map((s) => s.topic))].sort();
  const current = q.data?.sessions.find((s) => s.id === rec);
  return (
    <Page title={t('m22.routes.communities-sessions.title')} intro={t('m22.sessions.intro')} eyebrow={<L to="/communities">{t('m22.cop.back')}</L>} wide>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[240px] flex-1"><span className="caps">{t('common.search')}</span><input className="input mt-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('m22.sessions.searchHint')} data-testid="m22-session-search" /></label>
        <label className="block"><span className="caps">{t('m22.sessions.topic')}</span>
          <select className="input mt-1" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {topics.map((x) => <option key={x} value={x}>{t(`m22.topic.${x}`)}</option>)}
          </select>
        </label>
        <EngineBadge engine={eng} />
      </div>
      <Async state={q} isEmpty={() => rows.length === 0} empty={<EmptyState icon="search" title={t('m22.sessions.noMatch')} />}>
        {(d) => (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m22-sessions">
            {rows.map((s) => {
              const c = d.communities.find((x) => x.id === s.community_id);
              return (
                <li key={s.id} className="card flex flex-col p-4" data-testid="m22-session">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{pick(s, 'title')}</span>
                    <M22Pill kind="session" status={s.status} />
                  </div>
                  <p className="mt-1 text-[13px] text-ink-2">{pick(s, 'summary')}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
                    <span className="inline-flex items-center gap-1"><Icon name="calendar" size={13} />{f.date(s.held_on)}</span>
                    <span>{t('m22.sessions.minutes', { n: f.num(s.duration_min) })}</span>
                    <span>{t(`m22.topic.${s.topic}`)}</span>
                    {c && <L to={`/communities/${c.id}`}>{pick(c, 'name')}</L>}
                  </div>
                  <div className="text-[12px] text-ink-3">{pick(s, 'presenter_role')}</div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    {s.recording_ref ? <button className="btn-outline btn-sm" onClick={() => setRec(s.id)} data-testid="m22-recording"><Icon name="link" size={14} />{t('m22.sessions.recording')}</button> : <span className="text-[12px] text-ink-3">{t('m22.sessions.upcomingNote')}</span>}
                    {s.synthetic && <SimChip label={t('m22.sessions.synthetic')} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      <div className="mt-6"><Callout title={t('m22.sessions.factTitle')}>{t('m22.sessions.factBody')} <Sources sources={q.data?.sessions[0]?.sources} /></Callout></div>
      <Drawer open={!!current} onClose={() => setRec(null)} title={current ? pick(current, 'title') : ''}>
        {current && (
          <div className="space-y-3">
            <SimChip label={t('m22.sessions.synthetic')} />
            <p className="text-[13.5px]">{t('m22.sessions.recordingBody', { ref: current.recording_ref ?? '' })}</p>
            <code className="block rounded bg-sunken p-2 text-[12.5px]">{current.recording_ref}</code>
            <p className="text-[12.5px] text-ink-2">{pick(current, 'summary')}</p>
          </div>
        )}
      </Drawer>
    </Page>
  );
}
