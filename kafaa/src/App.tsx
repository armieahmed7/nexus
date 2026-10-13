import { createBrowserRouter, Outlet, RouterProvider, type RouteObject } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { ToastProvider } from './ui/Toast';
import { SessionProvider } from './auth/session';
import { Layout } from './shell/Layout';
import { RouteView } from './shell/RouteView';
import { NotFound } from './shell/NotFound';
import { ROUTES } from './routes/registry';
import { config } from './config';

function Providers() {
  return (
    <I18nProvider>
      <ToastProvider>
        <SessionProvider>
          <Outlet />
        </SessionProvider>
      </ToastProvider>
    </I18nProvider>
  );
}

function children(prefix: string): RouteObject[] {
  return [
    ...ROUTES.map((def) => {
      const rel = def.path === '/' ? '' : def.path.slice(1);
      const path = prefix ? (rel ? `${prefix}/${rel}` : prefix) : rel;
      return path === '' ? { index: true, element: <RouteView def={def} /> } : { path, element: <RouteView def={def} /> };
    }),
    { path: prefix ? `${prefix}/*` : '*', element: <NotFound /> },
  ];
}

const router = createBrowserRouter(
  [
    {
      element: <Providers />,
      children: [{ path: '/', element: <Layout />, children: [...children(''), ...children('ar')] }],
    },
  ],
  {
    basename: config.basename,
    // audit 2026-10-13 (finding 17): opt in to the React Router v7 behaviours now (removes six warnings on every page). Kafa'a links are
    // absolute (L / localPath), so the splat-relative path change does not affect them.
    future: { v7_relativeSplatPath: true, v7_fetcherPersist: true, v7_normalizeFormMethod: true, v7_partialHydration: true, v7_skipActionErrorRevalidation: true },
  },
);

export default function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
