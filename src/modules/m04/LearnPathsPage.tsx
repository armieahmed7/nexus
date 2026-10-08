// /learn/paths (M04, public): the training and qualification paths of spec Section 8, with "your track" for signed-in staff.
import { Page, Grid, Card, Callout, Icon, ProgressRing } from '../../ui';
import { L, useFormat, useLang, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { TRAINING_PATHS, pathProgress, trackForRole } from './paths';
import { SourceIds, useMyEvidence, Chip } from './ui';

export default function LearnPathsPage() {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const s = useSession();
  const ev = useMyEvidence();
  const mine = trackForRole(s.person?.job_role_id);
  const allSources = [...new Set(TRAINING_PATHS.flatMap((p) => p.stages.flatMap((x) => x.sources)))];
  return (
    <Page title={t('m04.routes.learn-paths.title')} eyebrow={t('m04.paths.eyebrow')} intro={t('m04.paths.intro')}>
      {s.status !== 'signed_in' && <Callout title={t('m04.paths.signInTitle')}>{t('m04.paths.signInBody')} <L to="/sign-in?next=/learn/paths">{t('m04.course.signIn')}</L></Callout>}
      <Grid cols={3}>
        {TRAINING_PATHS.map((p) => {
          const prog = ev.data ? pathProgress(p, ev.data) : null;
          const isMine = mine?.id === p.id;
          return (
            <Card key={p.id} as="article" className={isMine ? 'border-accent' : ''} eyebrow={<span className="inline-flex items-center gap-1.5"><Icon name={p.icon} size={14} />{t('m04.paths.stages', { n: f.num(p.stages.length) })}</span>}
              title={<L to={`/learn/paths/${p.id}`} data-testid={`m04-path-${p.id}`}>{p.title[lang]}</L>}
              actions={prog && (isMine || prog.pct > 0) ? <ProgressRing value={prog.pct} size={48} tone={prog.pct === 100 ? 'ok' : 'accent'} /> : undefined}>
              <p className="text-[13.5px] text-ink-2">{p.summary[lang]}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {isMine && <Chip tone="accent">{t('m04.paths.yourTrack')}</Chip>}
                {p.careerOnly && <Chip tone="sim">{t('m04.paths.careerOnly')}</Chip>}
              </div>
              <ol className="mt-3 flex flex-wrap items-center gap-1 text-[12px] text-ink-3" aria-label={t('m04.paths.stageList')}>
                {p.stages.map((st, i) => (
                  <li key={st.id} className="inline-flex items-center gap-1">
                    <span className={prog?.stages[i].state === 'done' ? 'text-ok' : prog?.stages[i].state === 'current' && prog.onTrack ? 'font-semibold text-ink' : ''}>{st.title[lang]}</span>
                    {i < p.stages.length - 1 && <Icon name="chevron" size={12} />}
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </Grid>
      <Card><SourceIds ids={allSources} /></Card>
    </Page>
  );
}
