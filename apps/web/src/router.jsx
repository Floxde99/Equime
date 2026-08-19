import { ROLES } from '@equime/shared';
import { createBrowserRouter, Outlet } from 'react-router';

import { AdminLayout } from '@/components/layouts/AdminLayout.jsx';
import { ClientLayout } from '@/components/layouts/ClientLayout.jsx';
import { InstructorLayout } from '@/components/layouts/InstructorLayout.jsx';
import { AdminBillingPage } from '@/features/admin/pages/AdminBillingPage.jsx';
import { AdminCavalryPage } from '@/features/admin/pages/AdminCavalryPage.jsx';
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage.jsx';
import { AdminHorsePage } from '@/features/admin/pages/AdminHorsePage.jsx';
import { AdminMembersPage } from '@/features/admin/pages/AdminMembersPage.jsx';
import { AdminPlanningPage } from '@/features/admin/pages/AdminPlanningPage.jsx';
import { AuthProvider } from '@/features/auth/AuthProvider.jsx';
import { RedirectIfAuthenticated, RequireAuth } from '@/features/auth/guards.jsx';
import { AuthLayout } from '@/features/auth/pages/AuthLayout.jsx';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage.jsx';
import { LoginPage } from '@/features/auth/pages/LoginPage.jsx';
import { RegisterPage } from '@/features/auth/pages/RegisterPage.jsx';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage.jsx';
import { ClientAccountPage } from '@/features/client/pages/ClientAccountPage.jsx';
import { ClientDashboardPage } from '@/features/client/pages/ClientDashboardPage.jsx';
import { ClientInvoicesPage } from '@/features/client/pages/ClientInvoicesPage.jsx';
import { ClientPlanningPage } from '@/features/client/pages/ClientPlanningPage.jsx';
import { AdminEventsPage } from '@/features/engagement/pages/AdminEventsPage.jsx';
import { ClientEventsPage } from '@/features/engagement/pages/ClientEventsPage.jsx';
import { InstructorIncidentsPage } from '@/features/engagement/pages/InstructorIncidentsPage.jsx';
import { MessagesPage } from '@/features/engagement/pages/MessagesPage.jsx';
import { NotificationsPage } from '@/features/engagement/pages/NotificationsPage.jsx';
import { VolunteerPage } from '@/features/engagement/pages/VolunteerPage.jsx';
import { HomePage } from '@/features/home/pages/HomePage.jsx';
import { NotFoundPage } from '@/features/home/pages/NotFoundPage.jsx';
import { RouteErrorPage } from '@/features/home/pages/RouteErrorPage.jsx';
import { AttendancePage } from '@/features/instructor/pages/AttendancePage.jsx';
import { InstructorDashboardPage } from '@/features/instructor/pages/InstructorDashboardPage.jsx';
import { InstructorHealthPage } from '@/features/instructor/pages/InstructorHealthPage.jsx';
import { InstructorHorseHealthPage } from '@/features/instructor/pages/InstructorHorseHealthPage.jsx';
import { InstructorPlanningPage } from '@/features/instructor/pages/InstructorPlanningPage.jsx';
import { RidersPage } from '@/features/riders/pages/RidersPage.jsx';

/** Shell racine : amorce la session (refresh silencieux) pour toute l'application. */
function AppShell() {
  return (
    <AuthProvider>
      <Outlet />
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
              { path: '/login', element: <LoginPage /> },
              { path: '/register', element: <RegisterPage /> },
              { path: '/mot-de-passe-oublie', element: <ForgotPasswordPage /> },
              { path: '/reinitialisation', element: <ResetPasswordPage /> },
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
