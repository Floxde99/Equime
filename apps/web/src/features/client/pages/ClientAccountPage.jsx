import { deleteAccountSchema, updateMeSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { deleteAccount, exportAccountData, updateProfile } from '@/features/auth/api.js';
import { SubscriptionSummary } from '@/features/billing/components/SubscriptionSummary.jsx';
import { useEntitlements } from '@/features/billing/useEntitlements.js';
import { useAuthStore } from '@/stores/authStore.js';

/** Compte famille : profil, export et suppression RGPD (Excel 3.1, US-1.6). */
export function ClientAccountPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clear);
  const [error, setError] = useState('');
  const [profileOk, setProfileOk] = useState(false);
  const [exportOk, setExportOk] = useState(false);

  const entitlementsQuery = useEntitlements();

  const profileForm = useForm({
    resolver: zodResolver(updateMeSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
    },
  });

  const deleteForm = useForm({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { confirmation: '' },
  });

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      setUser(updated);
      setProfileOk(true);
    },
    onError: () => setProfileOk(false),
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
    onSuccess: () => {
      setError('');
      setExportOk(true);
    },
    onError: (err) => {
      setExportOk(false);
      setError(err.message ?? 'Export impossible');
    },
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        eyebrow="Espace famille"
        title="Mon compte"
        description="Gérez vos données personnelles."
      />

      <Card title="Forfaits de la famille">
        <QueryState
          isPending={entitlementsQuery.isPending}
          isError={entitlementsQuery.isError}
          error={entitlementsQuery.error}
          onRetry={entitlementsQuery.refetch}
        >
          <FamilyEntitlements riders={entitlementsQuery.data?.riders ?? []} />
        </QueryState>
      </Card>

      <Card title="Mes informations">
        <form
          className="space-y-4"
          onSubmit={profileForm.handleSubmit((values) => {
            setProfileOk(false);
            profileMutation.mutate(values);
          })}
          noValidate
        >
          <Field
            label="Email (non modifiable)"
            htmlFor="account-email"
            hint="L’adresse email ne peut pas être changée depuis ce formulaire."
          >
            <Input
              id="account-email"
              type="email"
              value={user?.email ?? ''}
              readOnly
              autoComplete="email"
              className="bg-paper text-muted-on-card"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Prénom"
              htmlFor="account-firstName"
              error={profileForm.formState.errors.firstName?.message}
            >
              <Input
                id="account-firstName"
                autoComplete="given-name"
                invalid={!!profileForm.formState.errors.firstName}
                {...profileForm.register('firstName')}
              />
            </Field>
            <Field
              label="Nom"
              htmlFor="account-lastName"
              error={profileForm.formState.errors.lastName?.message}
            >
              <Input
                id="account-lastName"
                autoComplete="family-name"
                invalid={!!profileForm.formState.errors.lastName}
                {...profileForm.register('lastName')}
              />
            </Field>
          </div>
          <Field
            label="Téléphone"
            htmlFor="account-phone"
            error={profileForm.formState.errors.phone?.message}
          >
            <Input
              id="account-phone"
              type="tel"
              autoComplete="tel"
              invalid={!!profileForm.formState.errors.phone}
              {...profileForm.register('phone')}
            />
          </Field>
          {profileOk ? <Alert variant="success">Profil mis à jour.</Alert> : null}
          {profileMutation.isError ? (
            <Alert>{profileMutation.error?.message ?? 'Mise à jour impossible'}</Alert>
          ) : null}
          <Button type="submit" loading={profileMutation.isPending}>
            Enregistrer
          </Button>
        </form>
      </Card>

      <Card title="Exporter mes données">
        <p className="font-sans text-sm text-muted">
          Téléchargez une copie structurée de votre profil, vos cavaliers et vos factures (droit à
          la portabilité RGPD).
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
          {exportOk ? (
            <p className="mt-3 font-sans text-sm text-success">Export téléchargé.</p>
          ) : null}
        </div>
      </Card>

      <Card title="Supprimer mon compte">
        <p className="font-sans text-sm text-muted">
          Cette action est irréversible. Vos données personnelles seront anonymisées, vos documents
          supprimés et vos sessions révoquées. Les factures seront conservées de façon anonymisée
          (obligation comptable).
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={deleteForm.handleSubmit((values) => mutation.mutate(values))}
        >
          <Field
            label="Tapez « SUPPRIMER MON COMPTE » pour confirmer"
            htmlFor="confirmation"
            error={deleteForm.formState.errors.confirmation?.message}
          >
            <Input id="confirmation" autoComplete="off" {...deleteForm.register('confirmation')} />
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

/**
 * Forfait de chaque cavalier (ADR 011) ; la souscription se fait depuis la page Famille.
 * @param {{ riders: Array<{ riderId: string, firstName: string, lastName: string,
 *   subscription: object | null }> }} props
 */
function FamilyEntitlements({ riders }) {
  if (riders.length === 0) {
    return (
      <p className="font-sans text-sm text-muted-on-card">
        Ajoutez un cavalier pour choisir son forfait.{' '}
        <Link to="/app/cavaliers" className="text-primary underline">
          Ouvrir la page Famille
        </Link>
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {riders.map((rider) => (
        <li key={rider.riderId}>
          <p className="font-sans text-sm font-semibold text-on-card">
            {rider.firstName} {rider.lastName}
          </p>
          {rider.subscription ? (
            <SubscriptionSummary entitlement={rider} />
          ) : (
            <p className="font-sans text-sm text-muted-on-card">
              Pas de forfait.{' '}
              <Link to="/app/cavaliers" className="text-primary underline">
                Choisir un forfait
              </Link>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
