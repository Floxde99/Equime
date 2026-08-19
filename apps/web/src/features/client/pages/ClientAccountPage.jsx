import { deleteAccountSchema, subscribeFamilyPlanSchema, updateMeSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Select } from '@/components/ui/select.jsx';
import { deleteAccount, exportAccountData, updateProfile } from '@/features/auth/api.js';
import {
  fetchFamilySubscription,
  fetchPublicPlans,
  subscribeFamilyPlan,
} from '@/features/billing/api.js';
import { formatEuroCents } from '@/lib/money.js';
import { useAuthStore } from '@/stores/authStore.js';

/** Compte famille : profil, export et suppression RGPD (Excel 3.1, US-1.6). */
export function ClientAccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clear);
  const [error, setError] = useState('');
  const [profileOk, setProfileOk] = useState(false);
  const [exportOk, setExportOk] = useState(false);

  const subscriptionQuery = useQuery({
    queryKey: ['family-subscription'],
    queryFn: fetchFamilySubscription,
  });
  const plansQuery = useQuery({
    queryKey: ['public-plans'],
    queryFn: fetchPublicPlans,
  });
  const hasPlan = Boolean(subscriptionQuery.data?.subscriptionPlanId);

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

      <QueryState
        isPending={subscriptionQuery.isPending || plansQuery.isPending}
        isError={subscriptionQuery.isError || plansQuery.isError}
        error={subscriptionQuery.error ?? plansQuery.error}
        onRetry={() => {
          subscriptionQuery.refetch();
          plansQuery.refetch();
        }}
      >
        <FamilySubscriptionCard
          subscription={subscriptionQuery.data}
          plans={plansQuery.data ?? []}
          onSubscribed={() => {
            qc.invalidateQueries({ queryKey: ['family-subscription'] });
          }}
        />
      </QueryState>

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
          <Button type="submit" variant={hasPlan ? 'primary' : 'secondary'} loading={profileMutation.isPending}>
            Enregistrer
          </Button>
        </form>
      </Card>

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
          {exportOk ? (
            <p className="mt-3 font-sans text-sm text-success">Export téléchargé.</p>
          ) : null}
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
          onSubmit={deleteForm.handleSubmit((values) => mutation.mutate(values))}
        >
          <Field
            label='Tapez « SUPPRIMER MON COMPTE » pour confirmer'
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
 * @param {{
 *   subscription?: { sessionQuota: number, subscriptionPlan?: { name: string, priceCents: number, sessionsPerWeek: number } | null },
 *   plans: Array<{ id: string, name: string, priceCents: number, sessionsPerWeek: number, description?: string | null }>,
 *   onSubscribed: () => void,
 * }} props
 */
function FamilySubscriptionCard({ subscription, plans, onSubscribed }) {
  const plan = subscription?.subscriptionPlan;
  const form = useForm({
    resolver: zodResolver(subscribeFamilyPlanSchema),
    defaultValues: { subscriptionPlanId: plans[0]?.id ?? '' },
  });
  const mutation = useMutation({
    mutationFn: (values) => subscribeFamilyPlan(values.subscriptionPlanId),
    onSuccess: () => onSubscribed(),
  });

  return (
    <Card title="Formule d’abonnement">
      {plan ? (
        <div className="space-y-2">
          <p className="font-sans text-sm font-semibold text-text">{plan.name}</p>
          <p className="font-sans text-sm text-muted">
            {formatEuroCents(plan.priceCents)} · {plan.sessionsPerWeek} séance(s) / semaine
          </p>
          <p className="font-sans text-sm text-on-card">
            Quota restant : {subscription.sessionQuota} séance(s)
          </p>
          <p className="font-sans text-xs text-muted">
            Pour changer de formule, contactez le secrétariat.
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <p className="font-sans text-sm text-muted">
            Choisissez une formule pour activer les inscriptions aux cours. Le quota initial
            correspond à quatre semaines de séances.
          </p>
          <Field
            label="Formule"
            htmlFor="family-plan"
            error={form.formState.errors.subscriptionPlanId?.message}
          >
            <Select
              id="family-plan"
              options={plans.map((item) => ({
                value: item.id,
                label: `${item.name} — ${formatEuroCents(item.priceCents)} (${item.sessionsPerWeek} séance(s)/sem.)`,
              }))}
              {...form.register('subscriptionPlanId')}
            />
          </Field>
          {mutation.isError ? (
            <Alert>{mutation.error?.message ?? 'Souscription impossible'}</Alert>
          ) : null}
          {plans.length === 0 ? (
            <p className="font-sans text-sm text-muted">Aucune formule n’est proposée pour le moment.</p>
          ) : (
            <Button type="submit" loading={mutation.isPending}>
              Choisir une formule
            </Button>
          )}
        </form>
      )}
    </Card>
  );
}
