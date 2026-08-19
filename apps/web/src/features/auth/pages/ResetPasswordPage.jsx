import { PASSWORD_POLICY, resetPasswordSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';

import { resetPassword } from '../api.js';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';

/** Réinitialisation effective — le token arrive par le lien email (?token=…). */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(values) {
    setServerError(null);
    try {
      await resetPassword(values);
      setDone(true);
    } catch (err) {
      setServerError(err.message);
    }
  }

  return (
    <>
      <h1 className="font-display text-4xl text-on-card">Nouveau mot de passe</h1>

      {done ? (
        <>
          <Alert variant="success" className="mt-6">
            Mot de passe mis à jour. Vous pouvez vous connecter.
          </Alert>
          <p className="mt-6 text-center font-sans text-sm">
            <Link to="/login" className="text-text underline underline-offset-2 hover:text-primary">
              Se connecter
            </Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
          {serverError && <Alert>{serverError}</Alert>}
          {!token && (
            <Alert>
              Lien invalide : ouvrez le lien reçu par email, ou refaites une demande depuis
              «&nbsp;Mot de passe oublié&nbsp;».
            </Alert>
          )}

          <Field
            label="Nouveau mot de passe"
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

          <Button type="submit" loading={isSubmitting} disabled={!token} className="w-full">
            Mettre à jour
          </Button>
        </form>
      )}
    </>
  );
}
