import { createConversationSchema, createMessageSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  createConversation,
  fetchConversationMessages,
  fetchConversations,
  fetchMessageContacts,
  markConversationRead,
  sendMessage,
} from '@/features/engagement/api.js';
import { useSpaceEyebrow } from '@/lib/useSpaceEyebrow.js';

export function MessagesPage() {
  const eyebrow = useSpaceEyebrow();
  const qc = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [error, setError] = useState('');

  const createForm = useForm({
    resolver: zodResolver(createConversationSchema),
    defaultValues: { participantId: '', subject: '' },
  });
  const sendForm = useForm({
    resolver: zodResolver(createMessageSchema),
    defaultValues: { body: '' },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['message-contacts'],
    queryFn: fetchMessageContacts,
  });
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    refetchInterval: 5_000,
  });

  const effectiveId = selectedConversationId || conversations[0]?.id;
  const selectedConversation =
    conversations.find((conversation) => conversation.id === effectiveId) ?? null;
  const hasUnread = Boolean(selectedConversation?.hasUnread);

  const { data: messages = [] } = useQuery({
    queryKey: ['conversation-messages', effectiveId],
    queryFn: () => fetchConversationMessages(effectiveId),
    enabled: Boolean(effectiveId),
    refetchInterval: effectiveId ? 5_000 : false,
  });

  const markReadMutation = useMutation({
    mutationFn: markConversationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const { mutate: markRead } = markReadMutation;

  useEffect(() => {
    if (!effectiveId || !hasUnread) return;
    markRead(effectiveId);
  }, [effectiveId, hasUnread, markRead]);

  const createMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (conversation) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setSelectedConversationId(conversation.id);
      createForm.reset();
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: ({ conversationId, body }) => sendMessage(conversationId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation-messages', effectiveId] });
      sendForm.reset();
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  const participantId = createForm.watch('participantId');
  const messageBody = sendForm.watch('body');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Messagerie"
        description="Rafraîchissement automatique toutes les 5 secondes, lecture suivie par participant."
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card title="Nouvelle conversation">
          <form
            className="space-y-4"
            noValidate
            onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
          >
            <Select
              label="Contact"
              error={createForm.formState.errors.participantId?.message}
              options={[
                { value: '', label: '— Sélectionner —' },
                ...contacts.map((contact) => ({
                  value: contact.id,
                  label: `${contact.firstName} ${contact.lastName} (${contact.role})`,
                })),
              ]}
              {...createForm.register('participantId')}
            />
            <Field
              label="Sujet"
              htmlFor="message-subject"
              error={createForm.formState.errors.subject?.message}
            >
              <Input
                id="message-subject"
                placeholder="Question planning, suivi cavalier..."
                invalid={!!createForm.formState.errors.subject}
                {...createForm.register('subject')}
              />
            </Field>
            <Button type="submit" disabled={!participantId} loading={createMutation.isPending}>
              Ouvrir la conversation
            </Button>
          </form>

          <div className="mt-6 space-y-3 border-t border-border pt-4">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  effectiveId === conversation.id
                    ? 'border-primary bg-paper'
                    : 'border-border-on-card bg-paper'
                }`}
              >
                <p className="font-sans text-sm font-semibold text-text">
                  {conversation.contacts
                    .map((contact) => `${contact.firstName} ${contact.lastName}`)
                    .join(', ')}
                </p>
                <p className="font-sans text-xs text-muted">
                  {conversation.subject ||
                    conversation.lastMessage?.body ||
                    'Conversation sans sujet'}
                </p>
                {conversation.hasUnread ? (
                  <p className="mt-1 font-sans text-xs text-info">Nouveaux messages</p>
                ) : null}
              </button>
            ))}
            {conversations.length === 0 ? (
              <p className="font-sans text-sm text-muted">Aucune conversation pour le moment.</p>
            ) : null}
          </div>
        </Card>

        <Card title={selectedConversation ? 'Fil de discussion' : 'Conversation'}>
          {!selectedConversation ? (
            <p className="font-sans text-sm text-muted">
              Sélectionnez ou créez une conversation pour commencer.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-sans text-sm font-semibold text-text">
                  {selectedConversation.contacts
                    .map((contact) => `${contact.firstName} ${contact.lastName}`)
                    .join(', ')}
                </p>
                {selectedConversation.subject ? (
                  <p className="font-sans text-sm text-muted">{selectedConversation.subject}</p>
                ) : null}
              </div>

              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-xl border border-border-on-card bg-paper p-3"
                  >
                    <p className="font-sans text-xs text-muted">
                      {message.sender.firstName} {message.sender.lastName}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap font-sans text-sm text-text">
                      {message.body}
                    </p>
                  </div>
                ))}
              </div>

              <form
                className="space-y-4"
                noValidate
                onSubmit={sendForm.handleSubmit((values) =>
                  sendMutation.mutate({
                    conversationId: selectedConversation.id,
                    body: values.body,
                  })
                )}
              >
                <Field
                  label="Votre message"
                  htmlFor="new-message"
                  error={sendForm.formState.errors.body?.message}
                >
                  <Textarea
                    id="new-message"
                    rows={4}
                    invalid={!!sendForm.formState.errors.body}
                    {...sendForm.register('body')}
                  />
                </Field>
                <Button
                  type="submit"
                  disabled={!messageBody?.trim()}
                  loading={sendMutation.isPending}
                >
                  Envoyer
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
