import { PASSWORD_POLICY, registerSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { register as registerAccount } from '../api.js';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { useAuthStore } from '@/stores/authStore.js';

/** Page d'inscription client (US-1.1) — la famille est créée côté API. */
export function RegisterPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState(null);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values) {
    setServerError(null);
    try {
      const user = await registerAccount(values);
      setUser(user);
      navigate('/app', { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  }

  return (
    <>
      <h1 className="font-display-semi text-2xl text-text">Créer un compte</h1>
      <p className="mt-1 font-sans text-sm text-muted">
        Gérez vos cavaliers, réservations et factures.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {serverError && <Alert>{serverError}</Alert>}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom" htmlFor="firstName" error={errors.firstName?.message}>
            <Input
              id="firstName"
              autoComplete="given-name"
              invalid={!!errors.firstName}
              {...field('firstName')}
            />
          </Field>
          <Field label="Nom" htmlFor="lastName" error={errors.lastName?.message}>
            <Input
              id="lastName"
              autoComplete="family-name"
              invalid={!!errors.lastName}
              {...field('lastName')}
            />
          </Field>
        </div>

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...field('email')}
          />
        </Field>

        <Field label="Téléphone (facultatif)" htmlFor="phone" error={errors.phone?.message}>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            invalid={!!errors.phone}
            {...field('phone')}
          />
        </Field>

        <Field
          label="Mot de passe"
          htmlFor="password"
          error={errors.password?.message}
          hint={PASSWORD_POLICY}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            {...field('password')}
          />
        </Field>

        <Button type="submit" loading={isSubmitting} className="w-full">
          Créer mon compte
        </Button>
      </form>

      <p className="mt-6 text-center font-sans text-sm text-muted">
        Déjà inscrit ?{' '}
        <Link to="/login" className="text-text underline underline-offset-2 hover:text-primary">
          Se connecter
        </Link>
      </p>
    </>
  );
}
