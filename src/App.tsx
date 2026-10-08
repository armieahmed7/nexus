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
  { basename: config.basename },
);

export default function App() {
  return <RouterProvider router={router} />;
}
