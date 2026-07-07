import { DOCUMENT_STATUS_LABELS, ROLES } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  banMember,
  fetchMembers,
  fetchPendingDocuments,
  reviewDocument,
  unbanMember,
} from '@/features/admin/api.js';

/** Gestion des membres et validation des documents (US-9.2, US-9.3). */
export function AdminMembersPage() {
  const qc = useQueryClient();
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['admin-members'],
    queryFn: fetchMembers,
  });
  const { data: pendingRiders = [], isLoading: docsLoading } = useQuery({
    queryKey: ['pending-documents'],
    queryFn: fetchPendingDocuments,
  });

  const banMutation = useMutation({
    mutationFn: banMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members'] }),
  });
  const unbanMutation = useMutation({
    mutationFn: unbanMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members'] }),
  });

  if (membersLoading || docsLoading) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-text">Membres</h1>
        <p className="mt-1 font-sans text-sm text-muted">
          Bannissement et validation des documents cavaliers.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-display-semi text-xl text-text">Documents en attente</h2>
        {pendingRiders.length === 0 ? (
          <p className="font-sans text-sm text-muted">Aucun document en attente.</p>
        ) : (
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
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display-semi text-xl text-text">Comptes</h2>
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <p className="font-sans text-sm font-semibold text-text">
                  {member.firstName} {member.lastName}
                </p>
                <p className="font-sans text-xs text-muted">
                  {member.email} — {member.role === ROLES.CLIENT ? 'Client' : 'Moniteur'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {member.banned ? (
                  <Badge variant="danger">Banni</Badge>
                ) : (
                  <Badge variant="success">Actif</Badge>
                )}
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
                      onClick={() => banMutation.mutate(member.id)}
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
    </div>
  );
}

/** @param {{ rider: object, onReviewed: () => void }} props */
function PendingDocumentCard({ rider, onReviewed }) {
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

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
        Famille {rider.family.user.firstName} {rider.family.user.lastName} ({rider.family.user.email})
      </p>
      <ul className="mt-3 space-y-2">
        {pendingDocs.map((docType) => (
          <li key={docType} className="flex flex-wrap items-center gap-2">
            <span className="font-sans text-sm text-muted">
              {docType === 'medical_certificate' ? 'Certificat médical' : 'Licence'} —{' '}
              {DOCUMENT_STATUS_LABELS.pending}
            </span>
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
              <>
                <Button
                  type="button"
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate({ docType, decision: 'approved' })}
                >
                  Valider
                </Button>
                <Button type="button" variant="ghost" onClick={() => setRejecting(docType)}>
                  Refuser
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
