import { ROLES } from '@equime/shared';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router';

import { AdminLayout } from '@/components/layouts/AdminLayout.jsx';
import { ClientLayout } from '@/components/layouts/ClientLayout.jsx';
import { InstructorLayout } from '@/components/layouts/InstructorLayout.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { AuthProvider } from '@/features/auth/AuthProvider.jsx';
import { RedirectIfAuthenticated, RequireAuth } from '@/features/auth/guards.jsx';
import { AuthLayout } from '@/features/auth/pages/AuthLayout.jsx';
import { RouteErrorPage } from '@/features/home/pages/RouteErrorPage.jsx';

/**
 * Code-split une page exportée nommée (pas de default export).
 * @param {() => Promise<Record<string, import('react').ComponentType>>} importer
 * @param {string} exportName
 */
function lazyNamed(importer, exportName) {
  return lazy(() => importer().then((mod) => ({ default: mod[exportName] })));
}

const HomePage = lazyNamed(() => import('@/features/home/pages/HomePage.jsx'), 'HomePage');
const NotFoundPage = lazyNamed(
  () => import('@/features/home/pages/NotFoundPage.jsx'),
  'NotFoundPage'
);
const LoginPage = lazyNamed(() => import('@/features/auth/pages/LoginPage.jsx'), 'LoginPage');
const RegisterPage = lazyNamed(
  () => import('@/features/auth/pages/RegisterPage.jsx'),
  'RegisterPage'
);
const ForgotPasswordPage = lazyNamed(
  () => import('@/features/auth/pages/ForgotPasswordPage.jsx'),
  'ForgotPasswordPage'
);
const ResetPasswordPage = lazyNamed(
  () => import('@/features/auth/pages/ResetPasswordPage.jsx'),
  'ResetPasswordPage'
);
const ClientDashboardPage = lazyNamed(
  () => import('@/features/client/pages/ClientDashboardPage.jsx'),
  'ClientDashboardPage'
);
const ClientPlanningPage = lazyNamed(
  () => import('@/features/client/pages/ClientPlanningPage.jsx'),
  'ClientPlanningPage'
);
const ClientEventsPage = lazyNamed(
  () => import('@/features/engagement/pages/ClientEventsPage.jsx'),
  'ClientEventsPage'
);
const VolunteerPage = lazyNamed(
  () => import('@/features/engagement/pages/VolunteerPage.jsx'),
  'VolunteerPage'
);
const MessagesPage = lazyNamed(
  () => import('@/features/engagement/pages/MessagesPage.jsx'),
  'MessagesPage'
);
const NotificationsPage = lazyNamed(
  () => import('@/features/engagement/pages/NotificationsPage.jsx'),
  'NotificationsPage'
);
const ClientInvoicesPage = lazyNamed(
  () => import('@/features/client/pages/ClientInvoicesPage.jsx'),
  'ClientInvoicesPage'
);
const ClientAccountPage = lazyNamed(
  () => import('@/features/client/pages/ClientAccountPage.jsx'),
  'ClientAccountPage'
);
const RidersPage = lazyNamed(() => import('@/features/riders/pages/RidersPage.jsx'), 'RidersPage');
const InstructorDashboardPage = lazyNamed(
  () => import('@/features/instructor/pages/InstructorDashboardPage.jsx'),
  'InstructorDashboardPage'
);
const InstructorPlanningPage = lazyNamed(
  () => import('@/features/instructor/pages/InstructorPlanningPage.jsx'),
  'InstructorPlanningPage'
);
const AttendancePage = lazyNamed(
  () => import('@/features/instructor/pages/AttendancePage.jsx'),
  'AttendancePage'
);
const InstructorIncidentsPage = lazyNamed(
  () => import('@/features/engagement/pages/InstructorIncidentsPage.jsx'),
  'InstructorIncidentsPage'
);
const InstructorHealthPage = lazyNamed(
  () => import('@/features/instructor/pages/InstructorHealthPage.jsx'),
  'InstructorHealthPage'
);
const InstructorHorseHealthPage = lazyNamed(
  () => import('@/features/instructor/pages/InstructorHorseHealthPage.jsx'),
  'InstructorHorseHealthPage'
);
const AdminDashboardPage = lazyNamed(
  () => import('@/features/admin/pages/AdminDashboardPage.jsx'),
  'AdminDashboardPage'
);
const AdminPlanningPage = lazyNamed(
  () => import('@/features/admin/pages/AdminPlanningPage.jsx'),
  'AdminPlanningPage'
);
const AdminCavalryPage = lazyNamed(
  () => import('@/features/admin/pages/AdminCavalryPage.jsx'),
  'AdminCavalryPage'
);
const AdminHorsePage = lazyNamed(
  () => import('@/features/admin/pages/AdminHorsePage.jsx'),
  'AdminHorsePage'
);
const AdminEventsPage = lazyNamed(
  () => import('@/features/engagement/pages/AdminEventsPage.jsx'),
  'AdminEventsPage'
);
const AdminBillingPage = lazyNamed(
  () => import('@/features/admin/pages/AdminBillingPage.jsx'),
  'AdminBillingPage'
);
const AdminMembersPage = lazyNamed(
  () => import('@/features/admin/pages/AdminMembersPage.jsx'),
  'AdminMembersPage'
);

/** Fallback accessible pendant le chargement d’un chunk de page. */
function RouteFallback() {
  return (
    <div className="space-y-4 py-8" role="status" aria-live="polite" aria-busy="true">
      <p className="font-sans text-sm text-muted">Chargement…</p>
      <Skeleton lines={6} />
    </div>
  );
}

function SuspenseOutlet() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

/** Shell racine : amorce la session (refresh silencieux) pour toute l'application. */
function AppShell() {
  return (
    <AuthProvider>
      <SuspenseOutlet />
    </AuthProvider>
  );
}

/**
 * Routeur applicatif (React Router v7).
 * Guards par rôle + layouts dédiés (design system §6).
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },

      // --- Pages publiques d'authentification (redirige si déjà connecté) ---
      {
        element: <RedirectIfAuthenticated />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              {
                element: <SuspenseOutlet />,
                children: [
                  { path: '/login', element: <LoginPage /> },
                  { path: '/register', element: <RegisterPage /> },
                  { path: '/mot-de-passe-oublie', element: <ForgotPasswordPage /> },
                  { path: '/reinitialisation', element: <ResetPasswordPage /> },
                ],
              },
            ],
          },
        ],
      },

      // --- Espace client ---
      {
        element: <RequireAuth roles={[ROLES.CLIENT]} />,
        children: [
          {
            element: <ClientLayout />,
            children: [
              {
                element: <SuspenseOutlet />,
                errorElement: <RouteErrorPage embedded />,
                children: [
                  { path: '/app', element: <ClientDashboardPage /> },
                  { path: '/app/planning', element: <ClientPlanningPage /> },
                  { path: '/app/cavaliers', element: <RidersPage /> },
                  { path: '/app/evenements', element: <ClientEventsPage /> },
                  { path: '/app/benevolat', element: <VolunteerPage /> },
                  { path: '/app/messages', element: <MessagesPage /> },
                  { path: '/app/notifications', element: <NotificationsPage /> },
                  { path: '/app/factures', element: <ClientInvoicesPage /> },
                  { path: '/app/compte', element: <ClientAccountPage /> },
                ],
              },
            ],
          },
        ],
      },

      // --- Espace moniteur ---
      {
        element: <RequireAuth roles={[ROLES.INSTRUCTOR]} />,
        children: [
          {
            element: <InstructorLayout />,
            children: [
              {
                element: <SuspenseOutlet />,
                errorElement: <RouteErrorPage embedded />,
                children: [
                  { path: '/moniteur', element: <InstructorDashboardPage /> },
                  { path: '/moniteur/planning', element: <InstructorPlanningPage /> },
                  { path: '/moniteur/appel', element: <AttendancePage /> },
                  { path: '/moniteur/incidents', element: <InstructorIncidentsPage /> },
                  { path: '/moniteur/sante', element: <InstructorHealthPage /> },
                  { path: '/moniteur/sante/:id', element: <InstructorHorseHealthPage /> },
                  { path: '/moniteur/messages', element: <MessagesPage /> },
                ],
              },
            ],
          },
        ],
      },

      // --- Espace admin ---
      {
        element: <RequireAuth roles={[ROLES.ADMIN]} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              {
                element: <SuspenseOutlet />,
                errorElement: <RouteErrorPage embedded />,
                children: [
                  { path: '/admin', element: <AdminDashboardPage /> },
                  { path: '/admin/planning', element: <AdminPlanningPage /> },
                  { path: '/admin/cavalerie', element: <AdminCavalryPage /> },
                  { path: '/admin/cavalerie/:id', element: <AdminHorsePage /> },
                  { path: '/admin/evenements', element: <AdminEventsPage /> },
                  { path: '/admin/incidents', element: <InstructorIncidentsPage admin /> },
                  { path: '/admin/benevolat', element: <VolunteerPage admin /> },
                  { path: '/admin/messages', element: <MessagesPage /> },
                  { path: '/admin/notifications', element: <NotificationsPage /> },
                  { path: '/admin/facturation', element: <AdminBillingPage /> },
                  { path: '/admin/clients', element: <AdminMembersPage /> },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
