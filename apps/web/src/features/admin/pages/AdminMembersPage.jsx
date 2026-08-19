import {
  createMemberSchema,
  DOCUMENT_STATUS_LABELS,
  PASSWORD_POLICY,
  ROLE_LABELS,
  ROLES,
  updateMeSchema,
} from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Select } from '@/components/ui/select.jsx';
import {
  banMember,
  createMember,
  fetchMembers,
  fetchPendingDocuments,
  reviewDocument,
  unbanMember,
  updateMember,
} from '@/features/admin/api.js';
import { changeFamilySubscription, fetchSubscriptionPlans } from '@/features/billing/api.js';
import { STITCH_PHOTOS } from '@/lib/demoPhotos.js';
import { formatEuroCents } from '@/lib/money.js';

/** Gestion des membres et validation des documents (US-9.2, US-9.3). */
export function AdminMembersPage() {
  const qc = useQueryClient();
  const [pendingBan, setPendingBan] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [planMember, setPlanMember] = useState(null);

  const {
    data: members = [],
    isLoading: membersLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-members'],
    queryFn: fetchMembers,
  });
  const { data: pendingRiders = [], isLoading: docsLoading } = useQuery({
    queryKey: ['pending-documents'],
    queryFn: fetchPendingDocuments,
  });
  const { data: plans = [] } = useQuery({
    queryKey: ['admin-subscription-plans'],
    queryFn: fetchSubscriptionPlans,
  });

  const banMutation = useMutation({
    mutationFn: banMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members'] }),
  });
  const unbanMutation = useMutation({
    mutationFn: unbanMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members'] }),
  });

  if (membersLoading || docsLoading || isError) {
    return (
      <QueryState
        isPending={membersLoading || docsLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
      >
        {null}
      </QueryState>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Adhérents"
        description="Création des comptes client et moniteur, édition des fiches et formules famille."
      />

      <section className="relative overflow-hidden rounded-xl">
        <img src={STITCH_PHOTOS.membersBanner} alt="" className="h-48 w-full object-cover" />
        <div className="absolute inset-0 bg-ink/45" />
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          <p className="font-display text-3xl text-white">L&apos;excellence au quotidien</p>
          <p className="mt-1 max-w-xl font-sans text-sm text-white/85">
            La communauté Equime, suivie avec la même exigence que la cavalerie.
          </p>
        </div>
      </section>

      {pendingRiders.length > 0 ? (
        <section className="space-y-4 rounded-xl bg-danger/10 p-5">
          <h2 className="font-display text-xl text-danger">Licences et certificats à échéance</h2>
          <p className="font-sans text-sm text-on-card">
            {pendingRiders.length} cavalier(s) ont un document en attente de validation.
          </p>
          <ul className="space-y-3">
            {pendingRiders.map((rider) => (
              <PendingDocumentCard
                key={rider.id}
                rider={rider}
                onReviewed={() => {
                  qc.invalidateQueries({ queryKey: ['pending-documents'] });
                  qc.invalidateQueries({ queryKey: ['dashboard-kpis'] });
                }}
              />
            ))}
          </ul>
        </section>
      ) : (
        <p className="font-sans text-sm text-muted">Aucun document en attente.</p>
      )}

      <CreateMemberForm
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['admin-members'] });
          qc.invalidateQueries({ queryKey: ['admin-instructors'] });
        }}
      />

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-primary">Annuaire</h2>
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-on-card bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-paper font-sans text-sm font-semibold text-primary"
                >
                  {member.firstName?.[0]}
                  {member.lastName?.[0]}
                </span>
                <div>
                  <p className="font-sans text-sm font-semibold text-text">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="font-sans text-xs text-muted">
                    {member.email} — {ROLE_LABELS[member.role] ?? member.role}
                    {member.family?.subscriptionPlan
                      ? ` · ${member.family.subscriptionPlan.name} (${member.family.sessionQuota} séance(s))`
                      : member.role === ROLES.CLIENT
                        ? ' · sans formule'
                        : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {member.banned ? (
                  <Badge variant="danger">Banni</Badge>
                ) : (
                  <Badge variant="success">Actif</Badge>
                )}
                <Button type="button" variant="ghost" onClick={() => setEditingMember(member)}>
                  Modifier
                </Button>
                {member.role === ROLES.CLIENT && member.family ? (
                  <Button type="button" variant="ghost" onClick={() => setPlanMember(member)}>
                    Formule
                  </Button>
                ) : null}
                {member.role === ROLES.CLIENT ? (
                  member.banned ? (
                    <Button
                      type="button"
                      variant="ghost"
                      loading={unbanMutation.isPending}
                      onClick={() => unbanMutation.mutate(member.id)}
                    >
                      Débannir
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="danger"
                      loading={banMutation.isPending}
                      onClick={() => setPendingBan(member)}
                    >
                      Bannir
                    </Button>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={Boolean(pendingBan)}
        title={pendingBan ? `Bannir ${pendingBan.firstName} ${pendingBan.lastName} ?` : ''}
        confirmLabel="Bannir"
        loading={banMutation.isPending}
        onClose={() => setPendingBan(null)}
        onConfirm={() => {
          banMutation.mutate(pendingBan.id, { onSettled: () => setPendingBan(null) });
        }}
      />

      <EditMemberDialog
        member={editingMember}
        onClose={() => setEditingMember(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['admin-members'] });
          setEditingMember(null);
        }}
      />

      <ChangePlanDialog
        member={planMember}
        plans={plans}
        onClose={() => setPlanMember(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['admin-members'] });
          setPlanMember(null);
        }}
      />
    </div>
  );
}

/** @param {{ onCreated: () => void }} props */
function CreateMemberForm({ onCreated }) {
  const [serverError, setServerError] = useState(null);
  const {
    register: field,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: ROLES.INSTRUCTOR,
    },
  });

  const mutation = useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      setServerError(null);
      reset();
      onCreated();
    },
    onError: (err) => {
      setServerError(err.message);
    },
  });

  return (
    <Card title="Nouveau membre">
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
        noValidate
      >
        {serverError ? (
          <div className="md:col-span-2">
            <Alert>{serverError}</Alert>
          </div>
        ) : null}
        {mutation.isSuccess ? (
          <div className="md:col-span-2">
            <Alert variant="success">Compte créé. Communiquez le mot de passe temporaire.</Alert>
          </div>
        ) : null}
        <Field label="Prénom" htmlFor="member-first-name" error={errors.firstName?.message}>
          <Input
            id="member-first-name"
            autoComplete="given-name"
            invalid={!!errors.firstName}
            {...field('firstName')}
          />
        </Field>
        <Field label="Nom" htmlFor="member-last-name" error={errors.lastName?.message}>
          <Input
            id="member-last-name"
            autoComplete="family-name"
            invalid={!!errors.lastName}
            {...field('lastName')}
          />
        </Field>
        <Field label="Email" htmlFor="member-email" error={errors.email?.message}>
          <Input
            id="member-email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...field('email')}
          />
        </Field>
        <Field label="Téléphone (facultatif)" htmlFor="member-phone" error={errors.phone?.message}>
          <Input
            id="member-phone"
            type="tel"
            autoComplete="tel"
            invalid={!!errors.phone}
            {...field('phone')}
          />
        </Field>
        <Field label="Rôle" htmlFor="member-role" error={errors.role?.message}>
          <Select
            id="member-role"
            options={[
              { value: ROLES.INSTRUCTOR, label: ROLE_LABELS.instructor },
              { value: ROLES.CLIENT, label: ROLE_LABELS.client },
            ]}
            {...field('role')}
          />
        </Field>
        <Field
          label="Mot de passe temporaire"
          htmlFor="member-password"
          error={errors.password?.message}
          hint={PASSWORD_POLICY}
        >
          <Input
            id="member-password"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            {...field('password')}
          />
        </Field>
        <div className="md:col-span-2">
          <Button type="submit" loading={mutation.isPending}>
            Créer le compte
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * @param {{
 *   member: object | null,
 *   onClose: () => void,
 *   onSaved: () => void,
 * }} props
 */
function EditMemberDialog({ member, onClose, onSaved }) {
  const form = useForm({
    resolver: zodResolver(updateMeSchema),
    values: {
      firstName: member?.firstName ?? '',
      lastName: member?.lastName ?? '',
      phone: member?.phone ?? '',
    },
  });
  const mutation = useMutation({
    mutationFn: (values) => updateMember(member.id, values),
    onSuccess: onSaved,
  });

  return (
    <Dialog
      open={Boolean(member)}
      onClose={onClose}
      title={member ? `Fiche de ${member.firstName} ${member.lastName}` : ''}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            loading={mutation.isPending}
            onClick={form.handleSubmit((values) => mutation.mutate(values))}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      {member ? (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <Field
            label="Prénom"
            htmlFor="edit-first-name"
            error={form.formState.errors.firstName?.message}
          >
            <Input
              id="edit-first-name"
              invalid={!!form.formState.errors.firstName}
              {...form.register('firstName')}
            />
          </Field>
          <Field
            label="Nom"
            htmlFor="edit-last-name"
            error={form.formState.errors.lastName?.message}
          >
            <Input
              id="edit-last-name"
              invalid={!!form.formState.errors.lastName}
              {...form.register('lastName')}
            />
          </Field>
          <Field
            label="Téléphone"
            htmlFor="edit-phone"
            error={form.formState.errors.phone?.message}
          >
            <Input
              id="edit-phone"
              type="tel"
              invalid={!!form.formState.errors.phone}
              {...form.register('phone')}
            />
          </Field>
          {mutation.isError ? (
            <Alert>{mutation.error?.message ?? 'Mise à jour impossible'}</Alert>
          ) : null}
        </form>
      ) : null}
    </Dialog>
  );
}

/**
 * @param {{
 *   member: object | null,
 *   plans: Array<{ id: string, name: string, priceCents: number, sessionsPerWeek: number, active?: boolean }>,
 *   onClose: () => void,
 *   onSaved: () => void,
 * }} props
 */
function ChangePlanDialog({ member, plans, onClose, onSaved }) {
  const currentId = member?.family?.subscriptionPlanId ?? plans[0]?.id ?? '';
  const form = useForm({
    values: { subscriptionPlanId: currentId },
  });
  const mutation = useMutation({
    mutationFn: (values) => changeFamilySubscription(member.family.id, values.subscriptionPlanId),
    onSuccess: onSaved,
  });
  const options = plans.map((plan) => ({
    value: plan.id,
    label: `${plan.name} — ${formatEuroCents(plan.priceCents)} (${plan.sessionsPerWeek} séance(s)/sem.)${plan.active === false ? ' — inactive' : ''}`,
  }));

  return (
    <Dialog
      open={Boolean(member)}
      onClose={onClose}
      title={member ? `Formule de ${member.firstName} ${member.lastName}` : ''}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            loading={mutation.isPending}
            disabled={options.length === 0}
            onClick={form.handleSubmit((values) => mutation.mutate(values))}
          >
            Appliquer la formule
          </Button>
        </>
      }
    >
      {member ? (
        <form className="space-y-4" noValidate>
          <p>Le quota est réinitialisé à quatre semaines de séances du nouveau plan.</p>
          <Field label="Formule" htmlFor="admin-family-plan">
            <Select
              id="admin-family-plan"
              options={options}
              {...form.register('subscriptionPlanId')}
            />
          </Field>
          {mutation.isError ? (
            <Alert>{mutation.error?.message ?? 'Changement impossible'}</Alert>
          ) : null}
        </form>
      ) : null}
    </Dialog>
  );
}

/** @param {{ rider: object, onReviewed: () => void }} props */
function PendingDocumentCard({ rider, onReviewed }) {
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState({
    medical_certificate: rider.medicalCertificateExpiresAt
      ? String(rider.medicalCertificateExpiresAt).slice(0, 10)
      : '',
    license: rider.licenseExpiresAt ? String(rider.licenseExpiresAt).slice(0, 10) : '',
  });

  const mutation = useMutation({
    mutationFn: (body) => reviewDocument(rider.id, body),
    onSuccess: () => {
      setRejecting(null);
      setReason('');
      onReviewed();
    },
  });

  const pendingDocs = [
    rider.medicalCertificateStatus === 'pending' ? 'medical_certificate' : null,
    rider.licenseStatus === 'pending' ? 'license' : null,
  ].filter(Boolean);

  return (
    <Card>
      <p className="font-sans text-sm font-semibold text-text">
        {rider.firstName} {rider.lastName}
      </p>
      <p className="font-sans text-xs text-muted">
        Famille {rider.family.user.firstName} {rider.family.user.lastName} (
        {rider.family.user.email})
      </p>
      <ul className="mt-3 space-y-3">
        {pendingDocs.map((docType) => (
          <li key={docType} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-sans text-sm text-muted">
                {docType === 'medical_certificate' ? 'Certificat médical' : 'Licence'} —{' '}
                {DOCUMENT_STATUS_LABELS.pending}
              </span>
            </div>
            <Field label="Date d’expiration" htmlFor={`expires-${rider.id}-${docType}`}>
              <Input
                id={`expires-${rider.id}-${docType}`}
                type="date"
                value={expiresAt[docType]}
                onChange={(e) =>
                  setExpiresAt((current) => ({ ...current, [docType]: e.target.value }))
                }
              />
            </Field>
            {rejecting === docType ? (
              <div className="flex w-full flex-wrap items-end gap-2">
                <Field label="Motif du refus" htmlFor={`reason-${docType}`} className="flex-1">
                  <Input
                    id={`reason-${docType}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <Button
                  type="button"
                  variant="danger"
                  loading={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      docType,
                      decision: 'rejected',
                      rejectionReason: reason,
                    })
                  }
                >
                  Confirmer le refus
                </Button>
                <Button type="button" variant="ghost" onClick={() => setRejecting(null)}>
                  Annuler
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  loading={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      docType,
                      decision: 'approved',
                      ...(expiresAt[docType] ? { expiresAt: expiresAt[docType] } : {}),
                    })
                  }
                >
                  Valider
                </Button>
                <Button type="button" variant="ghost" onClick={() => setRejecting(docType)}>
                  Refuser
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
