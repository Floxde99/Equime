import { ROLES } from '@equime/shared';
import { createBrowserRouter, Outlet } from 'react-router';

import { AdminLayout } from '@/components/layouts/AdminLayout.jsx';
import { ClientLayout } from '@/components/layouts/ClientLayout.jsx';
import { InstructorLayout } from '@/components/layouts/InstructorLayout.jsx';
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage.jsx';
import { AuthProvider } from '@/features/auth/AuthProvider.jsx';
import { RedirectIfAuthenticated, RequireAuth } from '@/features/auth/guards.jsx';
import { AuthLayout } from '@/features/auth/pages/AuthLayout.jsx';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage.jsx';
import { LoginPage } from '@/features/auth/pages/LoginPage.jsx';
import { RegisterPage } from '@/features/auth/pages/RegisterPage.jsx';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage.jsx';
import { ClientDashboardPage } from '@/features/client/pages/ClientDashboardPage.jsx';
import { HomePage } from '@/features/home/pages/HomePage.jsx';
import { InstructorDashboardPage } from '@/features/instructor/pages/InstructorDashboardPage.jsx';

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
            children: [{ path: '/app', element: <ClientDashboardPage /> }],
          },
        ],
      },

      // --- Espace moniteur ---
      {
        element: <RequireAuth roles={[ROLES.INSTRUCTOR]} />,
        children: [
          {
            element: <InstructorLayout />,
            children: [{ path: '/moniteur', element: <InstructorDashboardPage /> }],
          },
        ],
      },

      // --- Espace admin ---
      {
        element: <RequireAuth roles={[ROLES.ADMIN]} />,
        children: [
          {
            element: <AdminLayout />,
            children: [{ path: '/admin', element: <AdminDashboardPage /> }],
          },
        ],
      },
    ],
  },
]);
