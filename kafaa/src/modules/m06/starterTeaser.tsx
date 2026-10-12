// FS77 (fsHe5): the future-skills starter teaser on the F34 journey page. Static links and one sample self-check (client state only:
// nothing is sent or stored); the full starter lives at /pathways/journey/starter.
import { BenchmarkChips, Card, Icon } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { STARTER_TRACKS } from './starter';
import { LessonCard, useStarterRefs } from './starterUi';

export function StarterTeaser() {
  const t = useT();
  const f = useFormat();
  const refs = useStarterRefs();
  const first = refs.lessons.find((l) => l.track === 'ai');
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" data-testid="m06-journey-starter">
      <div className="space-y-3">
        {STARTER_TRACKS.map((track) => (
          <Card key={track} title={t(`m06.starter.track.${track}`)} eyebrow={t('m06.starter.lessonsN', { n: f.num(refs.lessons.filter((l) => l.track === track).length) })}>
            <p className="text-[13px] text-ink-2">{t(`m06.starter.trackHint.${track}`)}</p>
            {track === 'smr' && <p className="mt-1 text-[12px] text-ink-3">{t('m06.starter.noDeployShort')}</p>}
            <div className="mt-3">
              <L to={`/pathways/journey/starter#${track}`} className="btn-primary btn-sm" data-testid={`m06-journey-starter-open-${track}`}>
                {t('m06.starter.teaserOpen')}
                <Icon name="chevron" size={13} className="rtl:-scale-x-100" />
              </L>
            </div>
          </Card>
        ))}
        <BenchmarkChips feature="FS77" />
      </div>
      {first && (
        <ul className="space-y-3">
          <LessonCard lesson={first} done={false} onChecked={() => undefined} />
        </ul>
      )}
    </div>
  );
}
