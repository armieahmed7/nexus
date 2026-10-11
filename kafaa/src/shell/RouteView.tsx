/** Renders one registered route: guard → error boundary → lazy page. */
import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { RequireGuard } from '../auth/guards';
import type { RouteDef } from '../routes/types';
import { ErrorState, Skeleton } from '../ui/Page';
import { translate, useLang } from '../i18n';

class Boundary extends Component<{ children: ReactNode; lang: 'en' | 'ar'; routeId: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[kafaa] page ${this.props.routeId} crashed`, error, info.componentStack);
  }
  componentDidUpdate(prev: { routeId: string }) {
    if (prev.routeId !== this.props.routeId && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error)
      return (
        <div className="mx-auto max-w-3xl p-6" data-testid="page-crash">
          <ErrorState title={translate(this.props.lang, 'shell.crash')} error={this.state.error} retry={() => this.setState({ error: null })} />
        </div>
      );
    return this.props.children;
  }
}

export function RouteView({ def }: { def: RouteDef }) {
  const lang = useLang();
  const C = def.component;
  return (
    <RequireGuard guard={def.guard} routeId={def.id}>
      <Boundary lang={lang} routeId={def.id}>
        <Suspense fallback={<div className="mx-auto max-w-6xl p-6"><Skeleton lines={6} /></div>}>
          <div data-route={def.id} data-module={def.module}>
            <C />
          </div>
        </Suspense>
      </Boundary>
    </RequireGuard>
  );
}
