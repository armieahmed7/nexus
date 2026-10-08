import { Page } from '../ui/Page';
import { L, useT } from '../i18n';

export function NotFound() {
  const t = useT();
  return (
    <Page title={t('shell.notFound.title')} intro={t('shell.notFound.body')}>
      <div data-testid="not-found" className="flex gap-2">
        <L to="/" className="btn-primary">
          {t('shell.guard.goHome')}
        </L>
        <L to="/ask" className="btn-outline">
          {t('shell.dalil.launch')}
        </L>
      </div>
    </Page>
  );
}
