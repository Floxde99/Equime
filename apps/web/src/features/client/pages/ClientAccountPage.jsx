import { deleteAccountSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { deleteAccount, exportAccountData } from '@/features/auth/api.js';
import { useAuthStore } from '@/stores/authStore.js';

/** Suppression de compte RGPD avec confirmation explicite (US-1.6). */
export function ClientAccountPage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clear);
  const [error, setError] = useState('');

  const form = useForm({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { confirmation: '' },
  });

  const mutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      clearAuth();
      navigate('/login', { replace: true });
    },
    onError: (err) => setError(err.message ?? 'Suppression impossible'),
  });

  const exportMutation = useMutation({
    mutationFn: exportAccountData,
    onError: (err) => setError(err.message ?? 'Export impossible'),
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Mon compte</h1>
        <p className="mt-1 font-sans text-sm text-muted">Gérez vos données personnelles.</p>
      </div>

      <Card title="Exporter mes données">
        <p className="font-sans text-sm text-muted">
          Téléchargez une copie structurée de votre profil, vos cavaliers et vos factures (droit à la
          portabilité RGPD).
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            Télécharger l&apos;export JSON
          </Button>
        </div>
      </Card>

      <Card title="Supprimer mon compte">
        <p className="font-sans text-sm text-muted">
          Cette action est irréversible. Vos données personnelles seront anonymisées, vos
          documents supprimés et vos sessions révoquées. Les factures seront conservées de façon
          anonymisée (obligation comptable).
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <Field
            label='Tapez « SUPPRIMER MON COMPTE » pour confirmer'
            htmlFor="confirmation"
            error={form.formState.errors.confirmation?.message}
          >
            <Input id="confirmation" autoComplete="off" {...form.register('confirmation')} />
          </Field>
          {error ? <p className="font-sans text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="danger" loading={mutation.isPending}>
            Supprimer définitivement
          </Button>
        </form>
      </Card>
    </div>
  );
}
