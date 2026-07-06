import { loginSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';

import { login } from '../api.js';
import { HOME_BY_ROLE } from '../guards.jsx';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { useAuthStore } from '@/stores/authStore.js';

/** Page de connexion (US-1.2). */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState(null);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values) {
    setServerError(null);
    try {
      const user = await login(values);
      setUser(user);
      navigate(location.state?.from ?? HOME_BY_ROLE[user.role] ?? '/', { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  }

  return (
    <>
      <h1 className="font-display-semi text-2xl text-text">Connexion</h1>
      <p className="mt-1 font-sans text-sm text-muted">Accédez à votre espace Equime.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {serverError && <Alert>{serverError}</Alert>}

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...field('email')}
          />
        </Field>

        <Field label="Mot de passe" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...field('password')}
          />
        </Field>

        <div className="text-right">
          <Link
            to="/mot-de-passe-oublie"
            className="font-sans text-xs text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full">
          Se connecter
        </Button>
      </form>

      <p className="mt-6 text-center font-sans text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link to="/register" className="text-text underline underline-offset-2 hover:text-primary">
          Créer un compte
        </Link>
      </p>
    </>
  );
}
