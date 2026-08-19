import { forgotPasswordSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { forgotPassword } from '../api.js';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';

/** Demande de réinitialisation — la réponse est volontairement neutre. */
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values) {
    setServerError(null);
    try {
      await forgotPassword(values.email);
      setSent(true);
    } catch (err) {
      setServerError(err.message);
    }
  }

  return (
    <>
      <h1 className="font-display text-4xl text-on-card">Mot de passe oublié</h1>
      <p className="mt-2 font-sans text-sm text-muted-on-card">
        Indiquez votre email : si un compte existe, vous recevrez un lien de réinitialisation
        valable une heure.
      </p>

      {sent ? (
        <Alert variant="success" className="mt-6">
          Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
          {serverError && <Alert>{serverError}</Alert>}

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={!!errors.email}
              {...field('email')}
            />
          </Field>

          <Button type="submit" loading={isSubmitting} className="w-full">
            Envoyer le lien
          </Button>
        </form>
      )}

      <p className="mt-6 text-center font-sans text-sm text-muted">
        <Link to="/login" className="text-text underline underline-offset-2 hover:text-primary">
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}
