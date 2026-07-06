import { createBrowserRouter } from 'react-router';

import { HomePage } from './features/home/pages/HomePage.jsx';

/**
 * Routeur applicatif (React Router v7, mode data router).
 * Les routes par rôle (client, moniteur, admin) et les guards
 * seront ajoutés en Phase 2 avec l'authentification.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
]);
